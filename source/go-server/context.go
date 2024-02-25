package main

import (
	"log"
	"net"
)

type VtContext struct {
	Language   string
	RemoteAddr string // ip:port
}

func NewVtContext(language string, remoteAddr string) *VtContext {
	return &VtContext{
		Language:   language,
		RemoteAddr: remoteAddr,
	}
}

func (c *VtContext) GetRemoteIp() string {
	ip, _, err := net.SplitHostPort(c.RemoteAddr)
	if err != nil {
		log.Println("GetRemoteIp: SplitHostPort failed:", err)
		return ""
	}
	return ip
}
