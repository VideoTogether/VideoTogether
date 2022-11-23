package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

func (h *slashFix) newWsHandler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			panic(err)
		}
		client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
		client.hub.register <- client

		// Allow collection of memory referenced by the caller by doing all work in
		// new goroutines.
		go client.writePump()
		go client.readPump()
	}
}

func newWsHub(vtSrv *VideoTogetherService) *Hub {
	return &Hub{
		clients:       make(map[*Client]bool),
		vtSrv:         vtSrv,
		broadcast:     make(chan Broadcast),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		roomClients:   make(map[string][]*Client),
		roomClientsMu: sync.Mutex{},
	}
}

type Broadcast struct {
	RoomName string
	Message  interface{}
}

type WsRoomResponse struct {
	Method string       `json:"method"`
	Data   RoomResponse `json:"data"`
}

type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	vtSrv *VideoTogetherService

	// Inbound messages from the clients.
	broadcast chan Broadcast

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	roomClients   map[string][]*Client
	roomClientsMu sync.Mutex
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				if client.roomName != "" {
					h.removeClientFromRoom(client.roomName, client)
				}
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			b, err := json.Marshal(message.Message)
			if err != nil {
				fmt.Println("Encode json error: " + err.Error())
				continue
			}

			for client := range h.clients {
				select {
				case client.send <- b:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func (h *Hub) removeClientFromRoom(roomName string, c *Client) {
	h.roomClientsMu.Lock()
	defer h.roomClientsMu.Unlock()

	idx := In(c, h.roomClients[roomName])
	if idx == -1 {
		return
	}

	h.roomClients[roomName] = Remove(h.roomClients[roomName], idx)
}

func (h *Hub) addClientToRoom(roomName string, c *Client) {
	h.roomClientsMu.Lock()
	defer h.roomClientsMu.Unlock()

	clients := h.roomClients[roomName]
	if clients == nil {
		h.roomClients[roomName] = []*Client{c}
		return
	}

	if In(c, h.roomClients[roomName]) != -1 {
		return
	}

	h.roomClients[roomName] = append(h.roomClients[roomName], c)
}

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub *Hub

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send     chan []byte
	roomName string
}

type RoomUpdateRequest struct {
	Name                 string `json:"name"`
	Password             string `json:"password"`
	PlaybackRate         string `json:"playbackRate"`
	CurrentTime          string `json:"currentTime"`
	Paused               string `json:"paused"`
	Url                  string `json:"url"`
	LastUpdateClientTime string `json:"lastUpdateClientTime"`
	Duration             string `json:"duration"`
	TempUserId           string `json:"tempUser"`
	Protected            string `json:"protected"`
	VideoTitle           string `json:"videoTitle"`
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

type UpdateRoomRequest struct {
	*Room
	UserId   string `json:"tempUser"`
	Password string `json:"password"`
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
		switch req.Method {
		case "/room/join":
			c.joinRoom(&req)
		case "/room/update":
			c.updateRoom(&req)
		default:
			c.reply(req.Method, nil, errors.New("unknown method"))
		}
	}
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
		c.reply(rawReq.Method, nil, RoomNotExist)
		return
	}
	if !room.HasAccess(roomPw) {
		c.reply(rawReq.Method, nil, errors.New("密码错误"))
		return
	}

	c.roomName = req.RoomName
	c.hub.addClientToRoom(req.RoomName, c)
	c.reply(rawReq.Method, RoomResponse{
		TimestampResponse: &TimestampResponse{
			Timestamp: c.hub.vtSrv.Timestamp(),
		},
		Room: room,
	}, nil)
}

func (c *Client) updateRoom(rawReq *WsRequestMessage) {
	var req UpdateRoomRequest
	if err := json.Unmarshal(rawReq.Data, &req); err != nil {
		c.reply(rawReq.Method, nil, errors.New("invalid data"))
		return
	}
	roomPw := GetMD5Hash(req.Password)
	c.roomName = req.Room.Name

	room, _, err := c.hub.vtSrv.GetAndCheckUpdatePermissionsOfRoom(req.Name, roomPw, req.UserId)
	if err != nil {
		c.reply(rawReq.Method, nil, err)
		return
	}

	// Update room info
	room.PlaybackRate = req.PlaybackRate
	room.CurrentTime = req.CurrentTime
	room.Paused = req.Paused
	room.Url = req.Url
	room.LastUpdateClientTime = req.LastUpdateClientTime
	room.Duration = req.Duration
	room.LastUpdateServerTime = c.hub.vtSrv.Timestamp()
	room.Protected = req.Protected
	room.VideoTitle = req.VideoTitle

	c.roomName = room.Name
	c.hub.addClientToRoom(room.Name, c)
	c.hub.broadcast <- Broadcast{
		RoomName: room.Name,
		Message: WsRoomResponse{
			Method: rawReq.Method,
			Data: RoomResponse{
				TimestampResponse: &TimestampResponse{
					Timestamp: c.hub.vtSrv.Timestamp(),
				},
				Room: room,
			},
		},
	}
}

type WsErrorResponse struct {
	Method       string `json:"method"`
	ErrorMessage string `json:"errorMessage"`
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
