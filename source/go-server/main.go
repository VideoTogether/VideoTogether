package main

import (
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	_ "net/http/pprof"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/unrolled/render"
)

func main() {
	// go func() {
	// 	log.Println(http.ListenAndServe("localhost:6060", nil))
	// }()

	rand.Seed(time.Now().UnixNano())
	Init()
	_ = os.WriteFile("admin_password.txt", []byte(adminPassword), 0644)
	vtSrv := NewVideoTogetherService(time.Minute * 3)
	server := newSlashFix(
		render.New(),
		vtSrv,
		qps.NewQP(time.Second, 3600),
		&http.Client{},
	)
	if len(os.Args) <= 1 {
		panic(http.ListenAndServe(":5001", server))
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
