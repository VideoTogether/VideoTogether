package main

import "sync"

type KrakenRoom struct {
	roomName string
	endpoint string
}

var krakenRooms = sync.Map{}

func NewKrakenRoom(roomName string, endpoint string) *KrakenRoom {
	kr := &KrakenRoom{
		endpoint: endpoint,
		roomName: roomName,
	}
	krakenRooms.Store(roomName, kr)
	return kr
}

func GetKrakenRoomEndpoint(roomName string, defaultEndpoint string) string {
	kr, ok := krakenRooms.Load(roomName)
	if !ok {
		return defaultEndpoint
	}
	return kr.(*KrakenRoom).endpoint
}

func DeleteKrakenRoom(roomName string) {
	krakenRooms.Delete(roomName)
}
