package main

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"log"
	"os"
	"sort"
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
		roomExpireTime: roomExpireTime,
	}
}

type VideoTogetherService struct {
	sponsors       map[string]Sponsor
	rooms          sync.Map
	roomExpireTime time.Duration
}

func Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
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

func (s *VideoTogetherService) GetAndCheckUpdatePermissionsOfRoom(ctx *VtContext, roomName, roomPassword string, userId string) (*Room, error) {

	room := s.QueryRoom(roomName)
	if room == nil {
		room = s.CreateRoom(roomName, roomPassword, userId)
	}

	isNewUser := !room.QueryUser(userId)
	if isNewUser {
		room.NewUser(userId)
	}

	if room.password != roomPassword {
		return nil, errors.New(GetErrorMessage(ctx.Language).WrongPassword)
	}

	if !room.IsHost(userId) {
		if isNewUser {
			room.setHost(userId)
		} else {
			return nil, errors.New(GetErrorMessage(ctx.Language).OtherHostSyncing)
		}
	}

	return room, nil
}

func (s *VideoTogetherService) CreateRoom(name, password string, hostId string) *Room {
	room := &Room{}
	room.Name = name
	room.password = password
	room.LastUpdateClientTime = s.Timestamp()
	room.hostId = hostId
	room.BackgroundUrl = s.GetRoomBackgroundUrl(name)
	room.Uuid = uuid.New().String()
	room.members = sync.Map{}
	room.userIds = sync.Map{}
	s.rooms.Store(name, room)
	return room
}

func (s *VideoTogetherService) QueryRoom(name string) *Room {
	room, _ := s.rooms.Load(name)
	if room == nil {
		return nil
	}
	pRoom := room.(*Room)

	pRoom.UpdateMemberData()

	if pRoom.WaitForLoadding {
		if pRoom.BeginLoaddingTimestamp == 0 {
			pRoom.BeginLoaddingTimestamp = s.Timestamp()
		}
	} else {
		pRoom.BeginLoaddingTimestamp = 0
	}

	// pRoom.WaitForLoadding = false
	return pRoom
}

func (r *Room) QueryUser(userId string) bool {
	_, ok := r.userIds.Load(userId)
	return ok
}

func (r *Room) NewUser(userId string) {
	r.userIds.Store(userId, true)
}

func (r *Room) UpdateMember(m Member) {
	m.lastUpdateTimestamp = Timestamp()
	m.room = r
	r.members.Store(m.UserId, &m)
}

type Statistics struct {
	RoomCount        int       `json:"roomCount"`
	LoaddingTimeList []float64 `json:"loaddingTimeList"`
	LoaddingRooms    []Room    `json:"loaddingRooms"`
	MemberCountList  []int64   `json:"memberCountList"`
}

func (s *VideoTogetherService) Statistics() Statistics {
	var stat Statistics
	stat.LoaddingTimeList = make([]float64, 0)
	stat.LoaddingRooms = make([]Room, 0)
	stat.MemberCountList = make([]int64, 10)
	var expireTime = float64(time.Now().Add(-s.roomExpireTime).UnixMilli()) / 1000
	s.rooms.Range(func(key, value any) bool {
		if room := s.QueryRoom(key.(string)); room == nil || room.LastUpdateClientTime < expireTime {
			s.rooms.Delete(key)
		} else {
			stat.RoomCount++
			idx := room.MemberCount
			if idx >= len(stat.MemberCountList) {
				idx = len(stat.MemberCountList) - 1
			}
			stat.MemberCountList[idx]++
			if room.BeginLoaddingTimestamp != 0 {
				stat.LoaddingTimeList = append(stat.LoaddingTimeList, s.Timestamp()-room.BeginLoaddingTimestamp)
				stat.LoaddingRooms = append(stat.LoaddingRooms, *room)
			}
		}
		return true
	})
	statStr, _ := json.Marshal(stat)
	// for loadding bug investigation
	_ = os.WriteFile("stat.json", statStr, 0644)
	stat.LoaddingRooms = nil
	sort.Float64s(stat.LoaddingTimeList)
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

	// id for room not host
	Uuid string `json:"uuid"`

	// last timestamp that member reported his video is loadding
	// this is a server timestamp, don't check this in client
	WaitForLoadding        bool    `json:"waitForLoadding"`
	BeginLoaddingTimestamp float64 `json:"beginLoaddingTimestamp"`
	MemberCount            int     `json:"memberCount"`

	userIds  sync.Map
	members  sync.Map
	hostId   string
	password string
}

type Member struct {
	UserId              string `json:"userId"`
	IsLoadding          bool   `json:"isLoadding"`
	CurrentUrl          string `json:"currentUrl"`
	lastUpdateTimestamp float64

	room *Room
}

func (m *Member) IsJoined() bool {
	return m.lastUpdateTimestamp+10 > Timestamp() && m.CurrentUrl == m.room.Url
}

func (r *Room) UpdateMemberData() {
	count := 0
	waitForLoadding := false
	r.members.Range(func(key, value any) bool {
		member := value.(*Member)
		if member != nil && member.IsJoined() {
			count++
			waitForLoadding = waitForLoadding || member.IsLoadding
		}
		return true
	})
	r.MemberCount = count
	r.WaitForLoadding = waitForLoadding
}

func (r *Room) HasAccess(password string) bool {
	return !r.Protected || r.password == password
}

func (r *Room) IsHost(userId string) bool {
	return r.hostId == userId
}

func (r *Room) setHost(userId string) {
	r.hostId = userId
}

type User struct {
	UserId   string
	LastSeen float64
}
