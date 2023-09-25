package main

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var DownloadCount = 0

type Sponsor struct {
	Room          string `json:"room"`
	BackgroundUrl string `json:"backgroundUrl"`
}

func NewVideoTogetherService(roomExpireTime time.Duration) *VideoTogetherService {
	s := &VideoTogetherService{
		sponsors:       make(map[string]Sponsor),
		rooms:          sync.Map{},
		roomExpireTime: roomExpireTime,
	}
	s.LoadSponsorData()
	return s
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

func (s *VideoTogetherService) LoadSponsorData() {
	sponsorStr, err := os.ReadFile("./sponsor.json")
	if err != nil {
		log.Panic("Error when opening file: ", err)
		return
	}
	var sponsorList []Sponsor
	err = json.Unmarshal(sponsorStr, &sponsorList)
	if err != nil {
		log.Panic("Error during Unmarshal(): ", err)
		return
	}
	sponsorMap := make(map[string]Sponsor)
	for _, sponsor := range sponsorList {
		sponsorMap[sponsor.Room] = sponsor
	}
	s.sponsors = sponsorMap
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
		return nil, errors.New(GetErrorMessage(ctx.Language).HostWrongPassword)
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
	if strings.HasPrefix(name, "download_") {
		DownloadCount++
	}
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

func (r *Room) UpdateMember(m Member) bool /*Need to notification room*/ {
	m.lastUpdateTimestamp = Timestamp()
	m.room = r
	r.members.Store(m.UserId, &m)
	MemberCount := r.MemberCount
	Loading := r.WaitForLoadding
	r.UpdateMemberData()
	if MemberCount == r.MemberCount && Loading == r.WaitForLoadding {
		return false
	} else {
		return true
	}
}

type Statistics struct {
	RoomCount                   int       `json:"roomCount"`
	LoaddingTimeList            []float64 `json:"loaddingTimeList"`
	MemberCountList             []int64   `json:"memberCountList"`
	EasyShareRoomCount          int       `json:"easyShareRoomCount"`
	EasyShareSupportedRoomCount int       `json:"easyShareSupportedRoomCount"`
	D1                          int
	D2                          int
	EasyshareSucc               int
	EasyshareErr                int
	EasyShareFailedUrl          *[]string
	TxtMsg                      int
	InvalidBroadcast            int
	DownloadCount               int
	DownloadCompleted           int
	ConfirmM3u8Download         int
	ConfirmVideoDownload        int
}

func (s *VideoTogetherService) Statistics() Statistics {
	return s.StatisticsN("")
}

func (s *VideoTogetherService) StatisticsN(pwd string) Statistics {
	var stat Statistics
	if pwd == adminPassword {
		stat.EasyShareFailedUrl = &easyShareFailedList
	}
	stat.DownloadCompleted = downloadCompleted
	stat.ConfirmM3u8Download = confirmM3u8Download
	stat.ConfirmVideoDownload = confirmVideoDownload
	stat.InvalidBroadcast = invalidBroadcast
	stat.TxtMsg = TxtMsg
	stat.DownloadCount = DownloadCount
	stat.LoaddingTimeList = make([]float64, 0)
	stat.MemberCountList = make([]int64, 10)
	stat.D1 = updatePanic
	stat.D2 = joinPanic
	stat.EasyshareSucc = easyshareSucc
	stat.EasyshareErr = easyshareErr
	var expireTime = float64(time.Now().Add(-s.roomExpireTime).UnixMilli()) / 1000
	s.rooms.Range(func(key, value any) bool {
		if room := s.QueryRoom(key.(string)); room == nil || room.LastUpdateClientTime < expireTime {
			s.rooms.Delete(key)
		} else {
			if room.isEasyShare {
				stat.EasyShareRoomCount++
			}
			if room.M3u8Url != "" {
				stat.EasyShareSupportedRoomCount++
			}
			stat.RoomCount++
			idx := room.MemberCount
			if idx >= len(stat.MemberCountList) {
				idx = len(stat.MemberCountList) - 1
			}
			stat.MemberCountList[idx]++
			if room.BeginLoaddingTimestamp != 0 {
				stat.LoaddingTimeList = append(stat.LoaddingTimeList, s.Timestamp()-room.BeginLoaddingTimestamp)
			}
		}
		return true
	})
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
	M3u8Url              string  `json:"m3u8Url"`

	// id for room not host
	Uuid string `json:"uuid"`

	// last timestamp that member reported his video is loadding
	// this is a server timestamp, don't check this in client
	WaitForLoadding        bool    `json:"waitForLoadding"`
	BeginLoaddingTimestamp float64 `json:"beginLoaddingTimestamp"`
	MemberCount            int     `json:"memberCount"`

	userIds     sync.Map
	members     sync.Map
	hostId      string
	password    string
	isEasyShare bool
}

type Member struct {
	UserId              string `json:"userId"`
	IsLoadding          bool   `json:"isLoadding"`
	CurrentUrl          string `json:"currentUrl"`
	lastUpdateTimestamp float64

	room *Room
}

func (m *Member) IsEasyShare() bool {
	return m.room.M3u8Url != "" && strings.Contains(m.CurrentUrl, m.room.M3u8Url)
}

func (m *Member) IsJoined() bool {

	return m.lastUpdateTimestamp+10 > Timestamp() &&
		(m.CurrentUrl == m.room.Url /*same page*/ || m.IsEasyShare() /*easy share*/)
}

func (r *Room) setM3u8Url(url string) {
	r.M3u8Url = url
}

func (r *Room) UpdateMemberData() {
	count := 0
	waitForLoadding := false
	isEasyShare := false
	r.members.Range(func(key, value any) bool {
		member := value.(*Member)
		isEasyShare = isEasyShare || member.IsEasyShare()
		if member != nil && member.IsJoined() {
			count++
			waitForLoadding = waitForLoadding || member.IsLoadding
		}
		return true
	})
	// ignore the loadding status when video is end, this is false positive
	waitForLoadding = waitForLoadding && r.Duration != r.CurrentTime
	if r.LastUpdateServerTime+10 > Timestamp() {
		count++
	}
	r.MemberCount = count
	r.WaitForLoadding = waitForLoadding
	r.isEasyShare = isEasyShare
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
