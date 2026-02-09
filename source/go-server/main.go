package main

import (
	"crypto/tls"
	"errors"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "net/http/pprof"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/unrolled/render"
)

type certManager struct {
	certFile string
	keyFile  string
	cert     *tls.Certificate
	mu       sync.RWMutex
}

func (cm *certManager) loadCert() {
	cert, err := tls.LoadX509KeyPair(cm.certFile, cm.keyFile)
	if err != nil {
		log.Printf("Error loading certificate: %v", err)
		return
	}
	
	cm.mu.Lock()
	cm.cert = &cert
	cm.mu.Unlock()
	log.Printf("Certificate reloaded successfully")
}

func (cm *certManager) getCert() (*tls.Certificate, error) {
	cm.mu.RLock()
	cert := cm.cert
	cm.mu.RUnlock()
	
	if cert == nil {
		return nil, errors.New("certificate not loaded")
	}
	return cert, nil
}

func (cm *certManager) start() {
	cm.loadCert()
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cm.loadCert()
		}
	}()
}

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
		certFile := os.Getenv("CERT_FILE")
		keyFile := os.Getenv("KEY_FILE")
		if certFile == "" {
			certFile = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
		}
		if keyFile == "" {
			keyFile = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
		}
		
		cm := &certManager{
			certFile: certFile,
			keyFile:  keyFile,
		}
		cm.start()
		
		tlsConfig := &tls.Config{
			GetCertificate: func(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
				return cm.getCert()
			},
		}
		
		httpServer := &http.Server{
			Addr:        ":5000",
			Handler:     server,
			TLSConfig:   tlsConfig,
			IdleTimeout: 120 * time.Second,
		}
		
		panic(httpServer.ListenAndServeTLS("", ""))
	default:
		panic("unknown env")
	}
}
