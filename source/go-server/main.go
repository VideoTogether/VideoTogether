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
	name                 string
	lastUpdateClientTime float32
	lastUpdateServerTime float32
	playbackRate         float32
	currentTime          float32
	paused               bool
	url                  string
	duration             float32
	public               bool
	protected            bool
	videoTitle           string
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
	room := req.URL.Query().Get("room")
	r := render.New()
	r.JSON(res, 200, room)
}

func handleTimestamp(res http.ResponseWriter, req *http.Request) {

}

func handleRoomUpdate(res http.ResponseWriter, req *http.Request) {

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
