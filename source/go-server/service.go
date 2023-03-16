package main

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Sponsor struct {
	Room          string `json:"room"`
	BackgroundUrl string `json:"backgroundUrl"`
}

func NewVideoTogetherService(roomExpireTime time.Duration) *VideoTogetherService {
	sponsorStr, err := ioutil.ReadFile("./sponsor.json")
	if err != nil {
		log.Fatal("Error when opening file: ", err)
	}
	var sponsorList []Sponsor
	err = json.Unmarshal(sponsorStr, &sponsorList)
	if err != nil {
		log.Fatal("Error during Unmarshal(): ", err)
	}
	sponsorMap := make(map[string]Sponsor)
	for _, sponsor := range sponsorList {
		sponsorMap[sponsor.Room] = sponsor
	}

	return &VideoTogetherService{
		sponsors:       sponsorMap,
		rooms:          sync.Map{},
		users:          sync.Map{},
		roomExpireTime: roomExpireTime,
	}
}

type VideoTogetherService struct {
	sponsors       map[string]Sponsor
	rooms          sync.Map
	users          sync.Map
	roomExpireTime time.Duration
}

func (s *VideoTogetherService) Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
}

func (s *VideoTogetherService) GetRoomBackgroundUrl(room string) string {
	if sponsor, ok := s.sponsors[room]; ok {
		return sponsor.BackgroundUrl
	}
	if sponsor, ok := s.sponsors[""]; ok {
		return sponsor.BackgroundUrl
	}
	return ""
}

func (s *VideoTogetherService) GetAndCheckUpdatePermissionsOfRoom(ctx *VtContext, roomName, roomPassword string, userId string) (*Room, *User, error) {
	user := s.QueryUser(userId)
	isNewUser := false
	if user == nil {
		isNewUser = true
		user = s.NewUser(userId)
	}

	room := s.QueryRoom(roomName)
	if room == nil {
		room = s.CreateRoom(roomName, roomPassword, user)
	}

	if room.password != roomPassword {
		return nil, nil, errors.New(GetErrorMessage(ctx.Language).WrongPassword)
	}

	if !room.IsHost(user) {
		if isNewUser {
			room.SetHost(user)
		} else {
			return nil, nil, errors.New(GetErrorMessage(ctx.Language).OtherHostSyncing)
		}
	}

	return room, user, nil
}

func (s *VideoTogetherService) CreateRoom(name, password string, host *User) *Room {
	room := &Room{}
	room.Name = name
	room.password = password
	room.LastUpdateClientTime = s.Timestamp()
	room.hostId = host.UserId
	room.BackgroundUrl = s.GetRoomBackgroundUrl(name)
	room.Uuid = uuid.New().String()
	s.rooms.Store(name, room)
	return room
}

func (s *VideoTogetherService) QueryRoom(name string) *Room {
	room, _ := s.rooms.Load(name)
	if room == nil {
		return nil
	}
	pRoom := room.(*Room)
	pRoom.WaitForLoadding = pRoom.LastLoaddingTimestamp+5 > s.Timestamp()
	return pRoom
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
	BackgroundUrl        string  `json:"backgroundUrl"`
	Uuid                 string  `json:"uuid"`
	// last timestamp that member reported his video is loadding
	// this is a server timestamp, don't check this in client
	LastLoaddingTimestamp float64 `json:"lastLoaddingTimestamp"`
	WaitForLoadding       bool    `json:"waitForLoadding"`

	hostId   string
	password string
}

func (r *Room) HasAccess(password string) bool {
	return !r.Protected || r.password == password
}

func (r *Room) IsHost(u *User) bool {
	if u == nil {
		return false
	}
	return r.hostId == u.UserId
}

func (r *Room) SetHost(u *User) {
	r.hostId = u.UserId
}

type User struct {
	UserId   string
	LastSeen float64
}
