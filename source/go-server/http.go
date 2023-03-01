package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strings"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/unrolled/render"
)

type slashFix struct {
	render *render.Render
	mux    http.Handler
	vtSrv  *VideoTogetherService
	qps    *qps.QP

	krakenUrl string // https://github.com/MixinNetwork/kraken
	rpClient  *http.Client
}

func newSlashFix(
	render *render.Render,
	vtSrv *VideoTogetherService,
	qps *qps.QP,
	krakenUrl string,
	rpClient *http.Client,
) *slashFix {
	s := &slashFix{
		render:    render,
		vtSrv:     vtSrv,
		qps:       qps,
		krakenUrl: krakenUrl,
		rpClient:  rpClient,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/room/get", s.handleRoomGet)
	mux.HandleFunc("/timestamp", s.handleTimestamp)
	mux.HandleFunc("/room/update", s.handleRoomUpdate)
	mux.HandleFunc("/statistics", s.handleStatistics)
	mux.HandleFunc("/kraken", s.handleKraken)
	mux.HandleFunc("/qps", s.qpsHtml)
	mux.HandleFunc("/qps_json", s.qpsJson)

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

type RoomResponse struct {
	*Room
	*TimestampResponse
}

func (h *slashFix) newRoomResponse(room *Room) *RoomResponse {
	resp := &RoomResponse{
		TimestampResponse: &TimestampResponse{Timestamp: h.vtSrv.Timestamp()},
		Room:              room,
	}
	return resp
}

func (h *slashFix) handleRoomUpdate(res http.ResponseWriter, req *http.Request) {
	userId := req.URL.Query().Get("tempUser")
	name := req.URL.Query().Get("name")
	password := GetMD5Hash(req.URL.Query().Get("password"))
	language := req.URL.Query().Get("language")

	room, _, err := h.vtSrv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{Language: language}, name, password, userId)
	if err != nil {
		h.respondError(res, err.Error())
		return
	}

	room.PlaybackRate = floatParam(req, "playbackRate", p(float64(1)))
	room.CurrentTime = floatParam(req, "currentTime", nil)
	room.Paused = req.URL.Query().Get("paused") != "false"
	room.Url = req.URL.Query().Get("url")
	room.LastUpdateClientTime = floatParam(req, "lastUpdateClientTime", nil)
	room.Duration = floatParam(req, "duration", p(1e9))
	room.LastUpdateServerTime = h.vtSrv.Timestamp()
	room.Protected = req.URL.Query().Get("protected") == "true"
	room.VideoTitle = req.URL.Query().Get("videoTitle")
	room.BackgroundUrl = h.vtSrv.GetRoomBackgroundUrl(room.Name)

	h.JSON(res, 200, h.newRoomResponse(room))
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

func (h *slashFix) handleTimestamp(res http.ResponseWriter, req *http.Request) {
	h.JSON(res, 200, TimestampResponse{Timestamp: h.vtSrv.Timestamp()})
}

// A reverse proxy to Kraken which support real-time voice communication
func (h *slashFix) handleKraken(res http.ResponseWriter, req *http.Request) {
	if req.Method == "OPTIONS" {
		return
	}

	proxyReq, err := http.NewRequest(req.Method, h.krakenUrl, req.Body)
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
	h.JSON(res, 200, h.vtSrv.Statistics())
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
