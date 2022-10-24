package main

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/unrolled/render"
)

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
	tempUser string
	password string
}

type RoomResponse struct {
	*PublicRoom
	Timestamp float64 `json:"timestamp"`
}

func NewRoomResponse(room *Room) *RoomResponse {
	resp := &RoomResponse{}
	resp.PublicRoom = &room.PublicRoom
	resp.Timestamp = float64(time.Now().UnixMilli()) / 1000
	return resp
}

var rooms = sync.Map{}
var dataLock = sync.Mutex{}

// utils-------------------------------------------------------------------
func p(x float64) *float64 {
	return &x
}

// ------------------------------------------------------------------------

func QueryRoom(name string) *Room {
	room, _ := rooms.Load(name)
	if room == nil {
		return nil
	}
	return room.(*Room)
}

// TODO localization
func RenderErrorMessage(w io.Writer, errorMessage string) {

}

func init() {

	if len(os.Args) < 1 {
		panic("please set env")
	}

	http.HandleFunc("/room/get", handleRoomGet)
	http.HandleFunc("/timestamp", handleTimestamp)
	http.HandleFunc("/room/update", handleRoomUpdate)
}

func main() {

	switch strings.TrimSpace(os.Args[1]) {
	case "debug":
		panic(http.ListenAndServe("127.0.0.1:5001", nil))
	case "prod":
		panic(http.ListenAndServeTLS(":5001", "", "", nil))
	default:
		panic("unknown env")
	}
}

func handleRoomGet(res http.ResponseWriter, req *http.Request) {

	defer func() {
		if e := recover(); e != nil {
			handleError(res, e)
		}

	}()
	name := req.URL.Query().Get("name")
	r := render.New()
	if err := r.JSON(res, 200, NewRoomResponse(QueryRoom(name))); err != nil {
		panic(err)
	}
}

func handleTimestamp(res http.ResponseWriter, req *http.Request) {
	r := render.New()
	r.Text(res, 200, "{\"timestamp\":1666624261.2934232}")
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

func handleRoomUpdate(res http.ResponseWriter, req *http.Request) {
	name := req.URL.Query().Get("name")
	password := req.URL.Query().Get("password")
	room := QueryRoom(name)
	if room == nil {
		room = &Room{}
		room.Name = name
		// TODO hash
		room.password = password
		rooms.Store(name, room)
	} else {
		if room.password != password {
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

	// TODO tempUser

	room.Public = false
	room.Protected = req.URL.Query().Get("protected") == "true"
	room.VideoTitle = req.URL.Query().Get("videoTitle")
	r := render.New()
	if err := r.JSON(res, 200, room); err != nil {
		panic(err)
	}
}

func handleGetVtUserJs(res http.ResponseWriter, req *http.Request) {

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
