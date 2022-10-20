package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type Rooom struct {
	Name                 string  `json:"name"`
	Password             string  `json:"password"`
	LastUpdateClientTime float64 `json:"lastUpdateClientTime"`
	LastUpdateServerTime float64 `json:"lastUpdateServerTime"`
	PlaybackRate         float64 `json:"playbackRate"`
	CurrentTime          float64 `json:"currentTime"`
	Paused               bool    `json:"paused"`
	Url                  string  `json:"url"`
	Duration             float64 `json:"duration"`

	expireTime time.Time
}

var roomsData = make(map[string]*Rooom, 1000)
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

	switch strings.TrimSpace(os.Args[0]) {
	case "debug":
		panic(http.ListenAndServe(":5000", nil))
	case "prod":
		panic(http.ListenAndServeTLS(":5000", "", "", nil))
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
