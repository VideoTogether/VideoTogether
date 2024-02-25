package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/gorilla/websocket"
)

var joinPanic = 0
var updatePanic = 0
var TxtMsg = 0
var invalidBroadcast = 0

func (h *slashFix) newWsHandler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		language := r.URL.Query().Get("language")

		client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256), isHost: false, vtContext: NewVtContext(language, r.RemoteAddr)}
		client.hub.register <- client

		// Allow collection of memory referenced by the caller by doing all work in
		// new goroutines.
		go client.writePump()
		go client.readPump()
	}
}

func newWsHub(vtSrv *VideoTogetherService, qps *qps.QP) *Hub {
	return &Hub{
		qps:         qps,
		vtSrv:       vtSrv,
		broadcast:   make(chan Broadcast),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		roomClients: sync.Map{},
	}
}

type BroadcastType int32

const (
	ALL     BroadcastType = 0
	MEMBERS BroadcastType = 1
	HOST    BroadcastType = 2
)

type Broadcast struct {
	RoomName string
	Type     BroadcastType
	Message  interface{}
}

type WsRoomResponse struct {
	Method string       `json:"method"`
	Data   RoomResponse `json:"data"`
}

type WsResponse struct {
	Method string `json:"method"`
	Data   any    `json:"data"`
}

type RoomClients struct {
	name    string
	clients sync.Map
}

type Hub struct {
	vtSrv *VideoTogetherService

	// Inbound messages from the clients.
	broadcast chan Broadcast

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	roomClients sync.Map
	qps         *qps.QP
}

func (h *Hub) getRoomClients(roomName string) *RoomClients {
	rc, _ := h.roomClients.Load(roomName)
	if rc != nil {
		return rc.(*RoomClients)
	}

	rc, _ = h.roomClients.LoadOrStore(roomName, &RoomClients{
		name:    roomName,
		clients: sync.Map{},
	})
	return rc.(*RoomClients)
}

func (h *Hub) run() {
	for {
		func() {
			select {
			case _ = <-h.register:
				return
			case client := <-h.unregister:
				h.removeClientFromRoom(client.roomName, client)
			case message := <-h.broadcast:
				b, err := json.Marshal(message.Message)
				if err != nil {
					fmt.Println("Encode json error: " + err.Error())
					return
				}
				room := h.vtSrv.QueryRoom(message.RoomName)
				if room == nil {
					return
				}

				roomClients := h.getRoomClients(message.RoomName)
				if roomClients == nil {
					return
				}

				roomClients.clients.Range(func(key, value any) bool {
					client := key.(*Client)
					if client.isHost {
						if !room.IsHost(client.lastTempUserId) {
							return true
						}
					}
					switch message.Type {
					case MEMBERS:
						if client.isHost {
							return true
						}
					case HOST:
						if !client.isHost {
							return true
						}
					}
					select {
					case client.send <- b:
					default:
						h.removeClientFromRoom(message.RoomName, client)
					}
					return true
				})
			}
		}()
	}
}

func (h *Hub) removeClientFromRoom(roomName string, c *Client) {
	rc := h.getRoomClients(roomName)
	rc.clients.Delete(c)
}

func (h *Hub) isVaildClient(roomName string, c *Client) bool {
	rc := h.getRoomClients(roomName)
	value, ok := rc.clients.Load(c)
	if !ok || value != true {
		return false
	}
	return true
}

func (h *Hub) addClientToRoom(roomName string, c *Client) {
	rc := h.getRoomClients(roomName)
	rc.clients.Store(c, true)
}

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512 * 1024
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub *Hub

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send           chan []byte
	roomName       string
	lastTempUserId string
	isHost         bool
	vtContext      *VtContext
}

type WsRequestMessage struct {
	Method string          `json:"method"`
	Data   json.RawMessage `json:"data"`
}

type WsResponseMessage struct {
	Method string      `json:"method"`
	Data   interface{} `json:"data"`
}

type JoinRoomRequest struct {
	RoomName     string `json:"name"`
	RoomPassword string `json:"password"`
}

type UpdateMemberRequest struct {
	*Member
	RoomName           string  `json:"roomName"`
	RoomPassword       string  `json:"password"`
	SendLocalTimestamp float64 `json:"sendLocalTimestamp"`
}

type RealUrlRequest struct {
	M3u8Url string `json:"m3u8Url"`
	Idx     int    `json:"idx"`
	Origin  string `json:"origin"`
}

type RealUrlResponse struct {
	Origin string `json:"origin"`
	Real   string `json:"real"`
}

type M3u8ContentRequest struct {
	M3u8Url string `json:"m3u8Url"`
}

type M3u8ContentResponse struct {
	M3u8Url string `json:"m3u8Url"`
	Content string `json:"content"`
}

type SingleTextMessage struct {
	Msg      string `json:"msg"`
	Id       string `json:"id"`
	VoiceId  string `json:"voiceId"`
	AudioUrl string `json:"audioUrl"`
}

type UpdateRoomRequest struct {
	*Room
	TempUser           string  `json:"tempUser"`
	Password           string  `json:"password"`
	SendLocalTimestamp float64 `json:"sendLocalTimestamp"`
}

// readPump pumps messages from the websocket connection to the hub.
//
// The application runs readPump in a per-connection goroutine. The application
// ensures that there is at most one reader on a connection by executing all
// reads from this goroutine.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		message = bytes.TrimSpace(bytes.Replace(message, newline, space, -1))
		var req WsRequestMessage
		if err = json.Unmarshal(message, &req); err != nil {
			// response error
		}

		c.hub.qps.Count("#WS#" + req.Method)
		switch req.Method {
		case "/room/join":
			c.joinRoom(&req)
		case "/room/update":
			// this api can only be called by host, don't call this api from member
			c.updateRoom(&req)
		case "/room/update_member":
			c.updateMember(&req)
		case "url_req":
			c.reqRealUrl(&req)
		case "url_resp":
			c.respRealUrl(&req)
		case "m3u8_req":
			c.reqM3u8Content(&req)
		case "m3u8_resp":
			c.respM3u8Content(&req)
		case "send_txtmsg":
			c.sendTextMessage(&req)
		default:
			c.reply(req.Method, nil, errors.New("unknown method"))
		}
	}
}

func (c *Client) sendBroadcast(broadcast *Broadcast) {
	if c.roomName == "" {
		invalidBroadcast++
		return
	}
	room := c.hub.vtSrv.QueryRoom(c.roomName)
	if room == nil {
		invalidBroadcast++
		return
	}
	if c.isHost && !room.IsHost(c.lastTempUserId) {
		invalidBroadcast++
		// this host is not valid
		return
	}
	if !c.hub.isVaildClient(c.roomName, c) {
		invalidBroadcast++
		return
	}
	c.hub.broadcast <- *broadcast
}

func (c *Client) sendTextMessage(rawReq *WsRequestMessage) {
	TxtMsg++
	var data SingleTextMessage
	if err := json.Unmarshal(rawReq.Data, &data); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	var once sync.Once
	sendBroadcast := func() {
		once.Do(func() {
			cancel()
			data.VoiceId = ""
			c.sendBroadcast(&Broadcast{
				RoomName: c.roomName,
				Type:     ALL,
				Message: WsResponse{
					Method: rawReq.Method,
					Data:   data,
				},
			})
		})
	}

	go func() {
		defer cancel()

		// 10 seconds timeout
		time.AfterFunc(10*time.Second, sendBroadcast)

		if data.VoiceId != "" && data.Msg != "" && len(data.Msg) < 40 {
			data.AudioUrl = NewReechoClientWithCtx(c.hub.vtSrv.config.ReechoToken, &c.hub.vtSrv.config, ctx).GetTextAudioUrl(data.VoiceId, data.Msg)
		}

		sendBroadcast()
	}()
}

// TODO need a template function to do this
func (c *Client) respM3u8Content(rawReq *WsRequestMessage) {
	var data M3u8ContentResponse
	if err := json.Unmarshal(rawReq.Data, &data); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	c.sendBroadcast(&Broadcast{
		RoomName: c.roomName,
		Type:     MEMBERS,
		Message: WsResponse{
			Method: "m3u8_resp",
			Data:   data,
		},
	})
}

func (c *Client) reqM3u8Content(rawReq *WsRequestMessage) {
	var data M3u8ContentRequest
	if err := json.Unmarshal(rawReq.Data, &data); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	c.sendBroadcast(&Broadcast{
		RoomName: c.roomName,
		Type:     HOST,
		Message: WsResponse{
			Method: "m3u8_req",
			Data:   data,
		},
	})
}

func (c *Client) respRealUrl(rawReq *WsRequestMessage) {
	var data RealUrlResponse
	if err := json.Unmarshal(rawReq.Data, &data); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	c.sendBroadcast(&Broadcast{
		RoomName: c.roomName,
		Type:     MEMBERS,
		Message: WsResponse{
			Method: "url_resp",
			Data:   data,
		},
	})
}

func (c *Client) reqRealUrl(rawReq *WsRequestMessage) {
	var data RealUrlRequest
	if err := json.Unmarshal(rawReq.Data, &data); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	c.sendBroadcast(&Broadcast{
		RoomName: c.roomName,
		Type:     HOST,
		Message: WsResponse{
			Method: "url_req",
			Data:   data,
		},
	})
}

func (c *Client) joinRoom(rawReq *WsRequestMessage) {
	var req JoinRoomRequest
	if err := json.Unmarshal(rawReq.Data, &req); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	roomPw := GetMD5Hash(req.RoomPassword)

	room := c.hub.vtSrv.QueryRoom(req.RoomName)
	if room == nil {
		c.reply(rawReq.Method, nil, errors.New(GetErrorMessage(c.vtContext.Language).RoomNotExist))
		return
	}
	if !room.HasAccess(roomPw) {
		c.reply(rawReq.Method, nil, errors.New(GetErrorMessage(c.vtContext.Language).WrongPassword))
		return
	}

	if c.roomName != "" && c.roomName != req.RoomName {
		joinPanic++
		c.conn.Close()
		return
	}

	c.roomName = req.RoomName
	c.hub.addClientToRoom(req.RoomName, c)
	c.reply(rawReq.Method, RoomResponse{
		// TODO remove this timestamp
		TimestampResponse: &TimestampResponse{
			Timestamp: c.hub.vtSrv.Timestamp(),
		},
		Room: room,
	}, nil)
}

func (c *Client) updateMember(rawReq *WsRequestMessage) {
	var startTime = Timestamp()
	var req UpdateMemberRequest
	if err := json.Unmarshal(rawReq.Data, &req); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	roomPw := GetMD5Hash(req.RoomPassword)
	room := c.hub.vtSrv.QueryRoom(req.RoomName)
	if room == nil {
		c.reply(rawReq.Method, nil, errors.New(GetErrorMessage(c.vtContext.Language).RoomNotExist))
		return
	}
	if !room.HasAccess(roomPw) {
		c.reply(rawReq.Method, nil, errors.New(GetErrorMessage(c.vtContext.Language).WrongPassword))
		return
	}
	needNotification := room.UpdateMember(*req.Member)
	if needNotification {
		c.sendBroadcast(&Broadcast{
			RoomName: room.Name,
			Type:     ALL,
			Message: WsRoomResponse{
				Method: rawReq.Method,
				Data: RoomResponse{
					// TODO remove this timestamp
					TimestampResponse: &TimestampResponse{
						Timestamp: c.hub.vtSrv.Timestamp(),
					},
					Room: room,
				},
			},
		})
	}
	var endTime = Timestamp()
	c.replyTimestamp(req.SendLocalTimestamp, startTime, endTime)
}

func (c *Client) updateRoom(rawReq *WsRequestMessage) {
	var startTime = Timestamp()
	var req UpdateRoomRequest
	if err := json.Unmarshal(rawReq.Data, &req); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	roomPw := GetMD5Hash(req.Password)

	if c.roomName != "" && c.roomName != req.Room.Name {
		updatePanic++
		c.conn.Close()
		return
	}

	c.roomName = req.Room.Name

	room, err := c.hub.vtSrv.GetAndCheckUpdatePermissionsOfRoom(c.vtContext, req.Name, roomPw, req.TempUser)
	if err != nil {
		c.reply(rawReq.Method, nil, err)
		return
	}
	c.lastTempUserId = req.TempUser

	// Update room info
	room.PlaybackRate = req.PlaybackRate
	room.CurrentTime = req.CurrentTime
	room.Paused = req.Paused
	room.Url = req.Url
	room.setM3u8Url(req.M3u8Url)
	room.LastUpdateClientTime = req.LastUpdateClientTime
	room.Duration = req.Duration
	room.LastUpdateServerTime = c.hub.vtSrv.Timestamp()
	room.Protected = req.Protected
	room.VideoTitle = req.VideoTitle

	c.isHost = true
	c.roomName = room.Name
	c.hub.addClientToRoom(room.Name, c)
	c.sendBroadcast(&Broadcast{
		RoomName: room.Name,
		Type:     ALL,
		Message: WsRoomResponse{
			Method: rawReq.Method,
			Data: RoomResponse{
				// TODO remove this timestamp
				TimestampResponse: &TimestampResponse{
					Timestamp: c.hub.vtSrv.Timestamp(),
				},
				Room: room,
			},
		},
	})
	var endTime = Timestamp()
	c.replyTimestamp(req.SendLocalTimestamp, startTime, endTime)
}

type WsErrorResponse struct {
	Method       string `json:"method"`
	ErrorMessage string `json:"errorMessage"`
}

func (c *Client) replyTimestamp(sl float64, rs float64, ss float64) {
	c.reply("replay_timestamp", TimestampV2Response{
		SendLocalTimestamp:     sl,
		ReceiveServerTimestamp: rs,
		SendServerTimestamp:    ss,
	}, nil)
}

func (c *Client) reply(method string, data interface{}, err error) {
	errFn := func(err error) {
		b, _ := json.Marshal(WsErrorResponse{
			Method:       method,
			ErrorMessage: err.Error(),
		})
		c.send <- b
	}

	if err != nil {
		errFn(err)
		return
	}

	if b, err := json.Marshal(WsResponseMessage{
		Method: method,
		Data:   data,
	}); err != nil {
		errFn(err)
	} else {
		c.send <- b
	}
}

// writePump pumps messages from the hub to the websocket connection.
//
// A goroutine running writePump is started for each connection. The
// application ensures that there is at most one writer to a connection by
// executing all writes from this goroutine.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.hub.qps.Count("#WS#send")
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
