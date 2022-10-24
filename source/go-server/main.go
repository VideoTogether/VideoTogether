package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/unrolled/render"
)

type PublicRoom struct {
	Name                 string  `json:"name"`
	LastUpdateClientTime float32 `json:"lastUpdateClientTime"`
	LastUpdateServerTime float32 `json:"lastUpdateServerTime"`
	PlaybackRate         float32 `json:"playbackRate"`
	CurrentTime          float32 `json:"currentTime"`
	Paused               bool    `json:"paused"`
	Url                  string  `json:"url"`
	Duration             float32 `json:"duration"`
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
	PublicRoom
	timestamp float32
}

var roomsData = make(map[string]*Room, 1000)
var dataLock = sync.Mutex{}

func init() {

	if len(os.Args) < 1 {
		panic("please set env")
	}

	http.HandleFunc("/room/get", handleRoomGet)
	http.HandleFunc("/timestamp", handleTimestamp)
	http.HandleFunc("/room/update", handleRoomUpdate)
}

func main() {
	for i := 0; i < 9; i++ {
		fmt.Printf("${%d:_}${%d:_}${%d:/downcase}", 9+6*i, 9+1+6*i, 7+6*i)
	}
	return

	switch strings.TrimSpace(os.Args[0]) {
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
	room := req.URL.Query().Get("room")
	r := render.New()
	if err := r.JSON(res, 200, room); err != nil {
		panic(err)
	}
}

func handleTimestamp(res http.ResponseWriter, req *http.Request) {

}

func handleRoomUpdate(res http.ResponseWriter, req *http.Request) {

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
