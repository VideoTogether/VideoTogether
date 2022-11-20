package main

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/unrolled/render"
)

type slashFix struct {
	mux http.Handler
}

var qps = NewQP(time.Second, 3600)

func (h *slashFix) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.URL.Path = strings.Replace(r.URL.Path, "//", "/", -1)
	enableCors(&w)
	if r.Method == "OPTIONS" {
		return
	}
	qps.Count()
	h.mux.ServeHTTP(w, r)
}

type PublicRoom struct {
	Name                 string  `json:"name"`
	LastUpdateClientTime float64 `json:"lastUpdateClientTime"`
	LastUpdateServerTime float64 `json:"lastUpdateServerTime"`
	PlaybackRate         float64 `json:"playbackRate"`
	CurrentTime          float64 `json:"currentTime"`
	Paused               bool    `json:"paused"`
	Url                  string  `json:"url"`
	Duration             float64 `json:"duration"`
	Public               bool    `json:"public"`
	Protected            bool    `json:"protected"`
	VideoTitle           string  `json:"videoTitle"`
}

// This struct contains some private info
type Room struct {
	PublicRoom
	TempUser string
	Password string
}

type TimestampResponse struct {
	Timestamp float64 `json:"timestamp"`
}

type StatisticsResponse struct {
	RoomCount int64 `json:"roomCount"`
}

type RoomResponse struct {
	*PublicRoom
	*TimestampResponse
}
type ErrorResponse struct {
	ErrorMessage string `json:"errorMessage"`
}

type TempUser struct {
	TempUser string
	LastSeen float64
}

func NewRoomResponse(room *Room) *RoomResponse {
	resp := &RoomResponse{
		TimestampResponse: &TimestampResponse{},
	}
	resp.PublicRoom = &room.PublicRoom
	resp.Timestamp = float64(time.Now().UnixMilli()) / 1000
	return resp
}

var rooms = sync.Map{}
var tempUsers = sync.Map{}

// utils-------------------------------------------------------------------
func p(x float64) *float64 {
	return &x
}

func GetMD5Hash(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

func floatParam(req *http.Request, key string, defaultValue *float64) float64 {
	str := req.URL.Query().Get(key)
	if str == "" {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(key + " is empty")
		}
	}
	num, err := strconv.ParseFloat(str, 64)
	if err != nil {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(fmt.Errorf("%s: %s is not float", key, str))
		}
	}
	if math.IsInf(num, 0) || math.IsNaN(num) {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(fmt.Errorf("%s: %s is inf or nan", key, str))
		}
	}
	return num
}

// TODO localization
func RenderErrorMessage(w io.Writer, errorMessage string) {
	r := render.New()
	if err := r.JSON(w, 200, &ErrorResponse{
		ErrorMessage: errorMessage,
	}); err != nil {
		panic(err)
	}
}

func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Max-Age", "86400")
	(*w).Header().Set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS")
}

// ------------------------------------------------------------------------

func QueryRoom(name string) *Room {
	room, _ := rooms.Load(name)
	if room == nil {
		return nil
	}
	return room.(*Room)
}

func QueryTempUser(tempUserId string) *TempUser {
	tempUser, _ := tempUsers.Load(tempUserId)
	if tempUser == nil {
		return nil
	}
	return tempUser.(*TempUser)
}

func main() {

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/room/get", handleRoomGet)
	httpMux.HandleFunc("/timestamp", handleTimestamp)
	httpMux.HandleFunc("/room/update", handleRoomUpdate)
	httpMux.HandleFunc("/statistics", handleStatistics)
	httpMux.HandleFunc("/kraken", handleKraken)

	httpMux.HandleFunc("/qps", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		// Get the raw HTML, you can gzip it
		s, err := qps.Show()
		if err != nil {
			panic(err)
		}
		w.Write([]byte(s))
	})
	// Add a route to get json report, The name is the same as getting the HTML routing, but you need to add the '_json' suffix
	httpMux.HandleFunc("/qps_json", func(w http.ResponseWriter, r *http.Request) {
		// Get the json report
		bts, err := qps.GetJson()
		if err != nil {
			panic(err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(bts)
	})
	wsHub := newWsHub();
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(wsHub, w, r)
	})
	if len(os.Args) <= 1 {
		panic(http.ListenAndServe("127.0.0.1:5001", &slashFix{httpMux}))
	}

	switch strings.TrimSpace(os.Args[1]) {
	case "debug":
		panic(http.ListenAndServe("127.0.0.1:5001", &slashFix{httpMux}))
	case "prod":
		panic(http.ListenAndServeTLS(":5000", "./certificate.crt", "./private.pem", &slashFix{httpMux}))
	default:
		panic("unknown env")
	}
}

func handleStatistics(res http.ResponseWriter, req *http.Request) {
	enableCors(&res)
	var roomCount int64
	var expireTime = float64(time.Now().UnixMilli())/1000 - 60*3
	rooms.Range(func(key, value any) bool {
		if room := QueryRoom(key.(string)); room == nil || room.LastUpdateClientTime < expireTime {
			rooms.Delete(key)
		} else {
			roomCount++
		}
		return true
	})
	r := render.New()
	if err := r.JSON(res, 200, &StatisticsResponse{
		RoomCount: roomCount,
	}); err != nil {
		panic(err)
	}
}

func handleRoomGet(res http.ResponseWriter, req *http.Request) {
	enableCors(&res)
	defer func() {
		if e := recover(); e != nil {
			handleError(res, e)
		}

	}()
	password := GetMD5Hash(req.URL.Query().Get("password"))
	name := req.URL.Query().Get("name")
	room := QueryRoom(name)
	if room == nil {
		RenderErrorMessage(res, "房间不存在")
		return
	}
	if room.Protected && room.Password != password {
		RenderErrorMessage(res, "密码错误")
		return
	}
	r := render.New()
	if err := r.JSON(res, 200, NewRoomResponse(QueryRoom(name))); err != nil {
		panic(err)
	}
}

func handleTimestamp(res http.ResponseWriter, req *http.Request) {
	enableCors(&res)
	r := render.New()
	if err := r.JSON(res, 200, &TimestampResponse{
		Timestamp: float64(time.Now().UnixMilli()) / 1000,
	}); err != nil {
		panic(err)
	}
}

func handleKraken(res http.ResponseWriter, req *http.Request) {
	enableCors(&res)
	if req.Method == "OPTIONS" {
		return
	}

	body, err := ioutil.ReadAll(req.Body)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}

	req.Body = ioutil.NopCloser(bytes.NewReader(body))

	// create a new url from the raw RequestURI sent by the client
	url := "http://panghair.com:7002/"

	proxyReq, err := http.NewRequest(req.Method, url, bytes.NewReader(body))

	// We may want to filter some headers, otherwise we could just use a shallow copy
	// proxyReq.Header = req.Header
	proxyReq.Header = make(http.Header)
	for h, val := range req.Header {
		proxyReq.Header[h] = val
	}
	proxyClient := &http.Client{}
	resp, err := proxyClient.Do(proxyReq)
	if err != nil {
		http.Error(res, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	responseData, err := ioutil.ReadAll(resp.Body)

	r := render.New()
	if err := r.Text(res, 200, string(responseData)); err != nil {
		panic(err)
	}
}

func handleRoomUpdate(res http.ResponseWriter, req *http.Request) {
	enableCors(&res)
	name := req.URL.Query().Get("name")
	password := GetMD5Hash(req.URL.Query().Get("password"))
	room := QueryRoom(name)
	if room == nil {
		room = &Room{}
		room.Name = name
		// TODO hash
		room.Password = password
		rooms.Store(name, room)
	} else {
		if room.Password != password {
			RenderErrorMessage(res, "房名已存在，密码错误")
			return
		}
	}
	room.PlaybackRate = floatParam(req, "playbackRate", p(1))
	room.CurrentTime = floatParam(req, "currentTime", nil)
	room.Paused = req.URL.Query().Get("paused") != "false"
	room.Url = req.URL.Query().Get("url")
	room.LastUpdateClientTime = floatParam(req, "lastUpdateClientTime", nil)
	room.Duration = floatParam(req, "duration", p(1e9))
	room.LastUpdateServerTime = float64(time.Now().UnixMilli()) / 1000
	tempUserId := req.URL.Query().Get("tempUser")
	if tempUser := QueryTempUser(tempUserId); tempUser == nil {
		tempUser := &TempUser{
			TempUser: tempUserId,
			LastSeen: float64(time.Now().UnixMilli()) / 1000,
		}
		tempUsers.Store(tempUser.TempUser, tempUser)
		room.TempUser = tempUserId
	} else {
		if room.TempUser != "" && room.TempUser != tempUserId {
			RenderErrorMessage(res, "其他房主正在同步")
			return
		}
		room.TempUser = tempUserId
		tempUser.LastSeen = float64(time.Now().UnixMilli()) / 1000
	}

	room.Public = false
	room.Protected = req.URL.Query().Get("protected") == "true"
	room.VideoTitle = req.URL.Query().Get("videoTitle")
	r := render.New()
	if err := r.JSON(res, 200, NewRoomResponse(QueryRoom(name))); err != nil {
		panic(err)
	}
}

func handleError(res http.ResponseWriter, e interface{}) {
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
		http.Error(res, fmt.Sprint("%v", e), http.StatusInternalServerError)
	}
}
