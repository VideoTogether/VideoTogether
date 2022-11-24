package main

import (
	"errors"
	"sync"
	"time"
)

func NewVideoTogetherService(roomExpireTime time.Duration) *VideoTogetherService {
	return &VideoTogetherService{
		rooms:          sync.Map{},
		users:          sync.Map{},
		roomExpireTime: roomExpireTime,
	}
}

type VideoTogetherService struct {
	rooms          sync.Map
	users          sync.Map
	roomExpireTime time.Duration
}

func (s *VideoTogetherService) Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
}

var (
	IncorrectPasswordErr = errors.New("房名已存在，密码错误")
	NotHostErr           = errors.New("你不是房主")
)

func (s *VideoTogetherService) GetAndCheckUpdatePermissionsOfRoom(roomName, roomPassword string, userId string) (*Room, *User, error) {
	user := s.QueryUser(userId)
	if user == nil {
		user = s.NewUser(userId)
	}

	room := s.QueryRoom(roomName)
	if room == nil {
		room = s.CreateRoom(roomName, roomPassword, user)
	}

	if room.password != roomPassword {
		return nil, nil, IncorrectPasswordErr
	}
	if !room.IsHost(user) {
		return nil, nil, NotHostErr
	}

	return room, user, nil
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
	u, _ := s.users.Load(userId)
	if u == nil {
		return nil
	}
	u.(*User).LastSeen = s.Timestamp()
	return u.(*User)
}

func (s *VideoTogetherService) NewUser(userId string) *User {
	u := &User{
		UserId:   userId,
		LastSeen: s.Timestamp(),
	}
	s.users.Store(userId, u)
	return u
}

type Statistics struct {
	RoomCount int `json:"roomCount"`
}

func (s *VideoTogetherService) Statistics() Statistics {
	var stat Statistics
	var expireTime = float64(time.Now().Add(-s.roomExpireTime).UnixMilli()) / 1000
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
