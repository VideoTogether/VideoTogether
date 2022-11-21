package main

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/unrolled/render"
)

func main() {
	srv := NewVideoTogetherService()
	server := &slashFix{
		render:    render.New(),
		vtSrv:     srv,
		qps:       qps.NewQP(time.Second, 3600),
		krakenUrl: "http://panghair.com:7002/",
		rpClient:  &http.Client{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/room/get", server.handleRoomGet)
	mux.HandleFunc("/timestamp", server.handleTimestamp)
	mux.HandleFunc("/room/update", server.handleRoomUpdate)
	mux.HandleFunc("/statistics", server.handleStatistics)
	mux.HandleFunc("/kraken", server.handleKraken)
	mux.HandleFunc("/qps", server.qpsHtml)
	mux.HandleFunc("/qps_json", server.qpsJson)
	// wsHub := newWsHub();
	// http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
	// 	serveWs(wsHub, w, r)
	// })
	server.mux = mux
	if len(os.Args) <= 1 {
		panic(http.ListenAndServe("127.0.0.1:5001", server))
	}

	switch strings.TrimSpace(os.Args[1]) {
	case "debug":
		panic(http.ListenAndServe("127.0.0.1:5001", server))
	case "prod":
		panic(http.ListenAndServeTLS(":5000", "./certificate.crt", "./private.pem", server))
	default:
		panic("unknown env")
	}
}
