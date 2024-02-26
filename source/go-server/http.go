package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"strings"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/unrolled/render"
)

var vtVersion = randInt(0, 1e9)
var adminPassword = randomString(30)
var easyShareFailedList = make([]string, 0)
var easyshareSucc = 0
var easyshareErr = 0
var confirmM3u8Download = 0
var confirmVideoDownload = 0
var downloadCompleted = 0

func Init() {
	vtVersion = randInt(0, 1e9)
	adminPassword = randomString(30)
}

func randomString(l int) string {
	bytes := make([]byte, l)
	for i := 0; i < l; i++ {
		bytes[i] = byte(randInt(65, 90))
	}
	return string(bytes)
}

func randInt(min int, max int) int {
	return min + rand.Intn(max-min)
}

type slashFix struct {
	render *render.Render
	mux    http.Handler
	vtSrv  *VideoTogetherService
	qps    *qps.QP

	rpClient *http.Client
}

func newSlashFix(
	render *render.Render,
	vtSrv *VideoTogetherService,
	qps *qps.QP,
	rpClient *http.Client,
) *slashFix {
	s := &slashFix{
		render:   render,
		vtSrv:    vtSrv,
		qps:      qps,
		rpClient: rpClient,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/room/get", s.handleRoomGet)
	mux.HandleFunc("/timestamp", s.handleTimestamp)
	mux.HandleFunc("/room/update", s.handleRoomUpdate)
	mux.HandleFunc("/statistics", s.handleStatistics)
	mux.HandleFunc("/kraken", s.handleKraken)
	mux.HandleFunc("/qps", s.qpsHtml)
	mux.HandleFunc("/qps_json", s.qpsJson)
	mux.HandleFunc("/static/check_easy_share", s.handleStaticCheckEasyShare)
	mux.HandleFunc("/reecho/new_voice", s.handleReechoNewVoice)

	// don't rely on beta APIs
	mux.HandleFunc("/beta/admin", s.handleBetaAdmin)
	mux.HandleFunc("/beta/counter", s.handleCounter)

	wsHub := newWsHub(vtSrv, qps)
	go wsHub.run()
	mux.HandleFunc("/ws", s.newWsHandler(wsHub))

	s.mux = mux
	return s
}

func (h *slashFix) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if e := recover(); e != nil {
			h.handleError(w, e)
		}
	}()

	r.URL.Path = strings.Replace(r.URL.Path, "//", "/", -1)
	h.enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}
	log.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
	h.qps.Count(r.URL.Path)
	h.mux.ServeHTTP(w, r)
}

type TimestampResponse struct {
	Timestamp float64 `json:"timestamp"`
}

type TimestampExtendedResponse struct {
	Timestamp float64 `json:"timestamp"`
	VtVersion int     `json:"vtVersion"`
}

type RoomResponse struct {
	*Room
	*TimestampResponse
}

type TimestampV2Response struct {
	SendLocalTimestamp     float64 `json:"sendLocalTimestamp"`
	ReceiveServerTimestamp float64 `json:"receiveServerTimestamp"`
	SendServerTimestamp    float64 `json:"sendServerTimestamp"`
}

func (h *slashFix) newRoomResponse(room *Room) *RoomResponse {
	resp := &RoomResponse{
		TimestampResponse: &TimestampResponse{Timestamp: h.vtSrv.Timestamp()},
		Room:              room,
	}
	return resp
}

func (h *slashFix) handleStaticCheckEasyShare(res http.ResponseWriter, req *http.Request) {
	h.Html(res, 200, "<script>let url=window.location.hash.substring(1);fetch(url).then(r => {if (r.ok) {window.top.postMessage({source: 'VideoTogether',type: 25,data: {m3u8Url: url}}, '*');}})</script>")
}
func (h *slashFix) handleReechoNewVoice(res http.ResponseWriter, req *http.Request) {
	type RequestBody struct {
		VoiceAudioBase64 string `json:"voiceAudioBase64"`
	}
	var body RequestBody
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		h.handleError(res, err)
		return
	}
	voiceId := NewReechoClientWithCtx(h.vtSrv.config.ReechoToken, &h.vtSrv.config, req.Context()).CreateNewVoice(body.VoiceAudioBase64)
	h.JSON(res, 200, map[string]interface{}{
		"voiceId": voiceId,
	})
}

func (h *slashFix) handleRoomUpdate(res http.ResponseWriter, req *http.Request) {
	userId := req.URL.Query().Get("tempUser")
	name := req.URL.Query().Get("name")
	password := GetMD5Hash(req.URL.Query().Get("password"))
	language := req.URL.Query().Get("language")

	room, err := h.vtSrv.GetAndCheckUpdatePermissionsOfRoom(NewVtContext(language, req.RemoteAddr), name, password, userId)
	if err != nil {
		h.respondError(res, err.Error())
		return
	}

	room.PlaybackRate = floatParam(req, "playbackRate", p(float64(1)))
	room.CurrentTime = floatParam(req, "currentTime", nil)
	room.Paused = req.URL.Query().Get("paused") != "false"
	room.Url = req.URL.Query().Get("url")
	room.setM3u8Url(req.URL.Query().Get("m3u8Url"))
	room.LastUpdateClientTime = floatParam(req, "lastUpdateClientTime", nil)
	room.Duration = floatParam(req, "duration", p(1e9))
	room.LastUpdateServerTime = h.vtSrv.Timestamp()
	room.Protected = req.URL.Query().Get("protected") == "true"
	room.VideoTitle = req.URL.Query().Get("videoTitle")

	h.JSON(res, 200, h.newRoomResponse(room))
}

func (h *slashFix) handleBetaAdmin(res http.ResponseWriter, req *http.Request) {
	reqAdminPassword := req.URL.Query().Get("password")
	if reqAdminPassword != adminPassword {
		return
	}

	h.vtSrv.LoadConfiguration()
	reqVtVersion := int(floatParam(req, "vtVersion", nil))
	vtVersion = reqVtVersion
}

func (h *slashFix) handleRoomGet(res http.ResponseWriter, req *http.Request) {
	password := GetMD5Hash(req.URL.Query().Get("password"))
	name := req.URL.Query().Get("name")
	language := req.URL.Query().Get("language")
	room := h.vtSrv.QueryRoom(name)
	if room == nil {
		h.respondError(res, GetErrorMessage(language).RoomNotExist)
		return
	}
	if !room.HasAccess(password) {
		h.respondError(res, GetErrorMessage(language).WrongPassword)
		return
	}
	h.JSON(res, 200, h.newRoomResponse(room))
}

// this http api must be requested once when user create or join a room
// any info that need to push once to user should use this
func (h *slashFix) handleTimestamp(res http.ResponseWriter, req *http.Request) {
	h.JSON(res, 200, TimestampExtendedResponse{
		Timestamp: h.vtSrv.Timestamp(),
		VtVersion: vtVersion,
	})
}

// A reverse proxy to Kraken which support real-time voice communication
func (h *slashFix) handleKraken(res http.ResponseWriter, req *http.Request) {
	if req.Method == "OPTIONS" {
		return
	}
	var krakenUrl = h.vtSrv.config.KrakenGlobalEndpoint

	defer req.Body.Close()
	bodyBytes, err := ioutil.ReadAll(req.Body)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}

	func() {
		defer func() {
			if e := recover(); e != nil {
				log.Println("handleKraken decode json error", e)
			}
		}()

		var body map[string]interface{}
		if err := json.NewDecoder(bytes.NewReader(bodyBytes)).Decode(&body); err == nil {
			krakenMethod := body["method"].(string)

			if krakenMethod == "subscribe" || krakenMethod == "answer" || krakenMethod == "trickle" || krakenMethod == "publish" {
				krakenRoomName := body["params"].([]interface{})[0].(string)
				krakenUrl = GetKrakenRoomEndpoint(krakenRoomName, krakenUrl)
			} else if krakenMethod != "turn" {
				// unknown method
				log.Println("unknown krakenMethod", krakenMethod)
			}
		}

	}()

	proxyReq, err := http.NewRequest(req.Method, krakenUrl, bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}

	// We may want to filter some headers, otherwise we could just use a shallow copy
	proxyReq.Header = make(http.Header)
	for key, val := range req.Header {
		proxyReq.Header[key] = val
	}

	resp, err := h.rpClient.Do(proxyReq)
	if err != nil {
		http.Error(res, err.Error(), http.StatusBadGateway)
		return
	}

	defer resp.Body.Close()
	responseData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		http.Error(res, err.Error(), http.StatusBadGateway)
		return
	}

	h.Text(res, 200, string(responseData))
}

func (h *slashFix) handleStatistics(res http.ResponseWriter, req *http.Request) {
	h.JSON(res, 200, h.vtSrv.StatisticsN(req.URL.Query().Get("password")))
}

func (h *slashFix) handleCounter(res http.ResponseWriter, req *http.Request) {
	key := req.URL.Query().Get("key")
	switch key {
	case "easyshare_succ":
		easyshareSucc++
		break
	case "easyshare_err":
		easyshareErr++
		failedUrl := req.URL.Query().Get("failedUrl")
		easyShareFailedList = append(easyShareFailedList, failedUrl)
		break
	case "confirm_m3u8_download":
		confirmM3u8Download++
		break
	case "download_m3u8_completed":
		downloadCompleted++
		break
	case "confirm_video_download":
		confirmVideoDownload++
		break
	}
}

func (h *slashFix) qpsHtml(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// Get the raw HTML, you can gzip it
	s, err := h.qps.Show()
	if err != nil {
		panic(err)
	}
	w.Write([]byte(s))
}

func (h *slashFix) qpsJson(w http.ResponseWriter, _ *http.Request) {
	// Get the json report
	bts, err := h.qps.GetJson()
	if err != nil {
		panic(err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(bts)
}

func (h *slashFix) Text(w io.Writer, status int, v string) {
	if err := h.render.Text(w, status, v); err != nil {
		panic(err)
	}
}

func (h *slashFix) Html(w http.ResponseWriter, status int, v string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	if _, err := w.Write([]byte(v)); err != nil {
		panic(err)
	}
}

func (h *slashFix) JSON(w io.Writer, status int, v interface{}) {
	if err := h.render.JSON(w, status, v); err != nil {
		panic(err)
	}
}

func (h *slashFix) handleError(res http.ResponseWriter, e interface{}) {
	switch e := e.(type) {
	case string:
		http.Error(res, e, http.StatusInternalServerError)
	case interface{ String() string }:
		http.Error(res, e.String(), http.StatusInternalServerError)
	case error:
		http.Error(res, e.Error(), http.StatusInternalServerError)
	case []byte:
		http.Error(res, string(e), http.StatusInternalServerError)
	default:
		http.Error(res, fmt.Sprintf("%v", e), http.StatusInternalServerError)
	}
}

type ErrorResponse struct {
	ErrorMessage string `json:"errorMessage"`
}

// TODO localization
func (h *slashFix) respondError(w io.Writer, errorMessage string) {
	h.JSON(w, 200, &ErrorResponse{
		ErrorMessage: errorMessage,
	})
}

func (h *slashFix) enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.Header().Set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS")
}
