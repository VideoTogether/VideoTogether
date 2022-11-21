package main

import (
	"sync"
	"time"
)

func NewVideoTogetherService() *VideoTogetherService {
	return &VideoTogetherService{
		rooms: sync.Map{},
		users: sync.Map{},
	}
}

type VideoTogetherService struct {
	rooms sync.Map
	users sync.Map
}

func (s *VideoTogetherService) Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
}

func (s *VideoTogetherService) LoadOrCreateRoom(name, password string, host *User) *Room {
	room := s.QueryRoom(name)
	if room == nil {
		room = s.CreateRoom(name, password, host)
	}
	return room
}

func (s *VideoTogetherService) CreateRoom(name, password string, host *User) *Room {
	room := &Room{}
	room.Name = name
	room.password = password
	room.LastUpdateClientTime = s.Timestamp()
	room.hostId = host.UserId
	s.rooms.Store(name, room)
	return room
}

func (s *VideoTogetherService) QueryRoom(name string) *Room {
	room, _ := s.rooms.Load(name)
	if room == nil {
		return nil
	}
	return room.(*Room)
}

func (s *VideoTogetherService) QueryUser(userId string) *User {
	guest, _ := s.users.Load(userId)
	if guest == nil {
		return nil
	}
	guest.(*User).LastSeen = s.Timestamp()
	return guest.(*User)
}

func (s *VideoTogetherService) NewUser(userId string) *User {
	g := &User{
		UserId:   userId,
		LastSeen: s.Timestamp(),
	}
	s.users.Store(userId, g)
	return g
}

type Statistics struct {
	RoomCount int `json:"roomCount"`
}

func (s *VideoTogetherService) Statistics() Statistics {
	var stat Statistics
	var expireTime = float64(time.Now().UnixMilli())/1000 - 60*3
	s.rooms.Range(func(key, value any) bool {
		if room := s.QueryRoom(key.(string)); room == nil || room.LastUpdateClientTime < expireTime {
			s.rooms.Delete(key)
		} else {
			stat.RoomCount++
		}
		return true
	})
	return stat
}

type Room struct {
	Name                 string  `json:"name"` // Unique identifier
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

	hostId   string
	password string
}

func (r *Room) HasAccess(password string) bool {
	return !r.Protected || r.password == password
}

func (r *Room) IsHost(u *User) bool {
	return r.hostId == u.UserId
}

type User struct {
	UserId   string
	LastSeen float64
}
