package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	"github.com/gorilla/websocket"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/onsi/gomega/ghttp"
	"github.com/tidwall/gjson"
	"github.com/unrolled/render"
)

var _ = Describe("WebSocket", func() {
	var server *ghttp.Server
	var vtSrv *VideoTogetherService
	var api *slashFix
	var wsUrl string
	var wsConn *websocket.Conn
	BeforeEach(func() {
		server = ghttp.NewServer()
		vtSrv = NewVideoTogetherService(time.Minute * 3)
		api = newSlashFix(render.New(), vtSrv, qps.NewQP(time.Second, 3600), "", http.DefaultClient)
		server.AppendHandlers(api.ServeHTTP, api.ServeHTTP)

		serverUrl, err := url.Parse(server.URL())
		Expect(err).ShouldNot(HaveOccurred())
		wsUrl = fmt.Sprintf("ws://%s/ws", serverUrl.Host)

		dialer := websocket.Dialer{}
		var resp *http.Response
		wsConn, resp, err = dialer.Dial(wsUrl, nil)
		Expect(err).ShouldNot(HaveOccurred())
		body, err := ioutil.ReadAll(resp.Body)
		Expect(err).ShouldNot(HaveOccurred())
		Expect(string(body)).To(Equal(""))
		Expect(wsConn).ToNot(BeNil())
	})

	AfterEach(func() {
		wsConn.Close()
		server.Close()
	})

	When("invalid websocket upgrade", func() {
		BeforeEach(func() {
			server.AppendHandlers(api.ServeHTTP)
		})

		It("returns error message", func() {
			resp, err := http.Get(server.URL() + "/ws")
			Expect(err).ShouldNot(HaveOccurred())
			Expect(resp.Header.Get("Access-Control-Allow-Origin")).To(Equal("*"))
			Expect(resp.Header.Get("Access-Control-Max-Age")).To(Equal("86400"))
			Expect(resp.Header.Get("Access-Control-Allow-Methods")).To(Equal("GET,HEAD,POST,OPTIONS"))
		})
	})

	When("message is not a valid json", func() {
		It("returns unknown method error", func() {
			messages := []string{
				"",
				"/test",
				"/call",
				"<xml></xml>",
			}
			for _, msg := range messages {
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())
				_, p, err := wsConn.ReadMessage()
				Expect(err).ShouldNot(HaveOccurred())
				Expect(string(p)).To(Equal("{\"method\":\"\",\"errorMessage\":\"unknown method\"}"))
			}
		})
	})

	When("message is a valid json but with unsupported method", func() {
		It("returns unknown method error", func() {
			methods := []string{
				"",
				"test",
				"/test",
				"/test/test",
			}
			for _, method := range methods {
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"method": "%s"}`, method)))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())
				_, p, err := wsConn.ReadMessage()
				Expect(err).ShouldNot(HaveOccurred())
				Expect(string(p)).To(Equal(fmt.Sprintf("{\"method\":\"%s\",\"errorMessage\":\"unknown method\"}", method)))
			}
		})
	})

	When("message is a valid json but with invalid data", func() {
		It("returns invalid data error", func() {
			messages := []string{
				`{"method": "/room/update", "data": "update room"}`,
				`{"method": "/room/update", "data": "my new room"}`,
			}
			for _, msg := range messages {
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())
				_, p, err := wsConn.ReadMessage()
				Expect(err).ShouldNot(HaveOccurred())
				resp := gjson.ParseBytes(p)
				Expect(resp.Get("method").String()).To(Equal("/room/update"))
				Expect(resp.Get("errorMessage").String()).To(Equal("invalid data"))
			}
		})
	})
	Context("when update room", func() {
		Context("and the room does not exist", func() {
			It("returns room info", func() {
				msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password111",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := wsConn.ReadMessage()
				_, bodyBytes, err = wsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)

				Expect(res.Get("method").String()).To(Equal("/room/update"))
				roomData := res.Get("data")

				Expect(roomData.Get("password").Exists()).To(Equal(false))
				Expect(roomData.Get("tempUser").Exists()).To(Equal(false))

				Expect(roomData.Get("name").String()).To(Equal("my room name"))
				Expect(roomData.Get("playbackRate").Float()).To(Equal(1.0))
				Expect(roomData.Get("currentTime").Float()).To(Equal(1.0))
				Expect(roomData.Get("paused").Bool()).To(Equal(true))
				Expect(roomData.Get("url").String()).To(Equal("https://www.youtube.com/watch?v=N000qglmmY0"))
				Expect(roomData.Get("lastUpdateClientTime").Float()).To(Equal(1669197153.123))
				Expect(roomData.Get("lastUpdateServerTime").Float()).To(BeNumerically(">=", 1669197153.123))
				Expect(roomData.Get("duration").Float()).To(Equal(1.23))
				Expect(roomData.Get("protected").Bool()).To(Equal(false))
				Expect(roomData.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating (Official Animated Music Video)"))
			})
		})
	})

	Context("when join room", func() {
		Context("and it does not exist", func() {
			It("returns not existent error", func() {
				msg := `{
  "method": "/room/join",
  "data": {
    "roomName": "my room name",
    "roomPassword": "my room password111"
  }
}`
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := wsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)
				Expect(res.Get("method").String()).To(Equal("/room/join"))
				Expect(res.Get("errorMessage").String()).To(Equal((GetErrorMessage("").RoomNotExist)))
			})
		})

		Context("When room is not protected and password is incorrect", func() {
			BeforeEach(func() {
				user := "alice"
				room := vtSrv.CreateRoom("my room name", GetMD5Hash("my room password"), user)
				Expect(user).ToNot(BeNil())
				Expect(room).ToNot(BeNil())
			})

			It("returns room information", func() {
				msg := `{
  "method": "/room/join",
  "data": {
    "name": "my room name",
    "password": "my room password111"
  }
}`
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := wsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)
				Expect(res.Get("method").String()).To(Equal("/room/join"))
				roomData := res.Get("data")
				Expect(roomData.Get("timestamp").Float()).To(BeNumerically(">", 0))
				Expect(roomData.Get("name").String()).To(Equal("my room name"))
				Expect(roomData.Get("url").String()).To(Equal(""))
			})
		})

		Context("When room is protected and password is incorrect", func() {
			BeforeEach(func() {
				user := "user-001"
				room := vtSrv.CreateRoom("my room name", GetMD5Hash("roomPassword"), user)
				room.Protected = true
				Expect(user).ToNot(BeNil())
				Expect(room).ToNot(BeNil())
			})

			It("returns incorrect password error", func() {
				msg := `{
  "method": "/room/join",
  "data": {
    "name": "my room name",
    "password": "incorrect password"
  }
}`
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := wsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)
				Expect(res.Get("method").String()).To(Equal("/room/join"))
				Expect(res.Get("errorMessage").String()).To(Equal("Wrong Password"))
			})
		})

		Context("When room info changed", func() {
			BeforeEach(func() {
				msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
				Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := wsConn.ReadMessage()
				_, bodyBytes, err = wsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)
				Expect(res.Get("method").String()).To(Equal("/room/update"))
				roomData := res.Get("data")

				Expect(roomData.Get("password").Exists()).To(Equal(false))
				Expect(roomData.Get("tempUser").Exists()).To(Equal(false))

				Expect(roomData.Get("name").String()).To(Equal("my room name"))
			})

			It("server should push latest room info to user", func() {
				dialer := websocket.Dialer{}
				guestWsConn, resp, err := dialer.Dial(wsUrl, nil)
				Expect(err).ShouldNot(HaveOccurred())
				body, err := ioutil.ReadAll(resp.Body)
				Expect(err).ShouldNot(HaveOccurred())
				Expect(string(body)).To(Equal(""))
				Expect(guestWsConn).ToNot(BeNil())

				msg := `{
  "method": "/room/join",
  "data": {
    "name": "my room name",
    "password": "my room password"
  }
}`
				Expect(guestWsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
				Expect(guestWsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
				Expect(guestWsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

				_, bodyBytes, err := guestWsConn.ReadMessage()
				Expect(err).ToNot(HaveOccurred())

				res := gjson.ParseBytes(bodyBytes)
				Expect(res.Get("method").String()).To(Equal("/room/join"))
				dataRes := res.Get("data")
				Expect(dataRes.Get("name").String()).To(Equal("my room name"))
				Expect(dataRes.Get("currentTime").Float()).To(Equal(1.0))
				Expect(dataRes.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating (Official Animated Music Video)"))

				go func() {
					// Wait new updates
					Expect(guestWsConn.SetReadDeadline(time.Now().Add(time.Second * 2))).Should(Succeed())

					_, bodyBytes, err := guestWsConn.ReadMessage()
					Expect(err).ToNot(HaveOccurred())

					res := gjson.ParseBytes(bodyBytes)
					Expect(res.Get("method").String()).To(Equal("/room/update"))
					roomData := res.Get("data")
					Expect(roomData.Get("name").String()).To(Equal("my room name"))
					Expect(roomData.Get("currentTime").Float()).To(Equal(2.0))
					Expect(roomData.Get("url").String()).To(Equal("https://www.youtube.com/watch?v=vFWv44Z4Jhk"))
					Expect(roomData.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"))
					Expect(roomData.Get("paused").Bool()).To(Equal(false))

					guestWsConn.Close()
				}()

				{
					updateMsg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 2.0,
    "paused": false,
    "url": "https://www.youtube.com/watch?v=vFWv44Z4Jhk",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"
  }
}`
					Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
					Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(updateMsg))).Should(Succeed())
					Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

					_, bodyBytes, err = wsConn.ReadMessage()
					_, bodyBytes, err = wsConn.ReadMessage()
					Expect(err).ToNot(HaveOccurred())

					res := gjson.ParseBytes(bodyBytes)
					Expect(res.Get("method").String()).To(Equal("/room/update"))
					roomData := res.Get("data")

					Expect(roomData.Get("password").Exists()).To(Equal(false))
					Expect(roomData.Get("tempUser").Exists()).To(Equal(false))

					Expect(roomData.Get("name").String()).To(Equal("my room name"))
					Expect(roomData.Get("currentTime").Float()).To(Equal(2.0))
					Expect(roomData.Get("url").String()).To(Equal("https://www.youtube.com/watch?v=vFWv44Z4Jhk"))
					Expect(roomData.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"))
					Expect(roomData.Get("paused").Bool()).To(Equal(false))
				}
			})

			It("should push latest room info to users when some users disconnect", func() {
				server.AppendHandlers(api.ServeHTTP, api.ServeHTTP)
				{
					// guest 1
					dialer := websocket.Dialer{}
					guestWsConn, resp, err := dialer.Dial(wsUrl, nil)
					Expect(err).ShouldNot(HaveOccurred())
					body, err := ioutil.ReadAll(resp.Body)
					Expect(err).ShouldNot(HaveOccurred())
					Expect(string(body)).To(Equal(""))
					Expect(guestWsConn).ToNot(BeNil())

					msg := `{
  "method": "/room/join",
  "data": {
    "name": "my room name",
    "password": "my room password"
  }
}`
					Expect(guestWsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
					Expect(guestWsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
					Expect(guestWsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

					_, bodyBytes, err := guestWsConn.ReadMessage()
					Expect(err).ToNot(HaveOccurred())

					res := gjson.ParseBytes(bodyBytes)
					Expect(res.Get("method").String()).To(Equal("/room/join"))
					dataRes := res.Get("data")
					Expect(dataRes.Get("name").String()).To(Equal("my room name"))
					Expect(dataRes.Get("currentTime").Float()).To(Equal(1.0))
					Expect(dataRes.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating (Official Animated Music Video)"))

					go func() {
						// Wait new updates
						Expect(guestWsConn.SetReadDeadline(time.Now().Add(time.Second * 2))).Should(Succeed())

						_, bodyBytes, err := guestWsConn.ReadMessage()
						Expect(err).ToNot(HaveOccurred())

						res := gjson.ParseBytes(bodyBytes)
						Expect(res.Get("method").String()).To(Equal("/room/update"))
						roomData := res.Get("data")
						Expect(roomData.Get("name").String()).To(Equal("my room name"))
						Expect(roomData.Get("currentTime").Float()).To(Equal(2.0))
						Expect(roomData.Get("url").String()).To(Equal("https://www.youtube.com/watch?v=vFWv44Z4Jhk"))
						Expect(roomData.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"))
						Expect(roomData.Get("paused").Bool()).To(Equal(false))

						guestWsConn.Close()
					}()
				}
				{
					// guest 2
					dialer := websocket.Dialer{}
					guestWsConn, resp, err := dialer.Dial(wsUrl, nil)
					Expect(err).ShouldNot(HaveOccurred())
					body, err := ioutil.ReadAll(resp.Body)
					Expect(err).ShouldNot(HaveOccurred())
					Expect(string(body)).To(Equal(""))
					Expect(guestWsConn).ToNot(BeNil())

					msg := `{
  "method": "/room/join",
  "data": {
    "name": "my room name",
    "password": "my room password"
  }
}`
					Expect(guestWsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
					Expect(guestWsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
					Expect(guestWsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

					_, bodyBytes, err := guestWsConn.ReadMessage()
					Expect(err).ToNot(HaveOccurred())

					res := gjson.ParseBytes(bodyBytes)
					Expect(res.Get("method").String()).To(Equal("/room/join"))
					dataRes := res.Get("data")
					Expect(dataRes.Get("name").String()).To(Equal("my room name"))
					Expect(dataRes.Get("currentTime").Float()).To(Equal(1.0))
					Expect(dataRes.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating (Official Animated Music Video)"))

					go func() {
						guestWsConn.Close()
					}()
				}

				{
					updateMsg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 2.0,
    "paused": false,
    "url": "https://www.youtube.com/watch?v=vFWv44Z4Jhk",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"
  }
}`
					Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
					Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(updateMsg))).Should(Succeed())
					Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

					_, bodyBytes, err := wsConn.ReadMessage()
					_, bodyBytes, err = wsConn.ReadMessage()
					Expect(err).ToNot(HaveOccurred())

					res := gjson.ParseBytes(bodyBytes)
					Expect(res.Get("method").String()).To(Equal("/room/update"))
					roomData := res.Get("data")

					Expect(roomData.Get("password").Exists()).To(Equal(false))
					Expect(roomData.Get("tempUser").Exists()).To(Equal(false))

					Expect(roomData.Get("name").String()).To(Equal("my room name"))
					Expect(roomData.Get("currentTime").Float()).To(Equal(2.0))
					Expect(roomData.Get("url").String()).To(Equal("https://www.youtube.com/watch?v=vFWv44Z4Jhk"))
					Expect(roomData.Get("videoTitle").String()).To(Equal("Dua Lipa - Levitating ft. DaBaby / Don't Start Now (Live at the GRAMMYs 2021)"))
					Expect(roomData.Get("paused").Bool()).To(Equal(false))
				}
			})
		})

	})

	Context("When update room with incorrect password", func() {
		BeforeEach(func() {
			msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
			Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
			Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
			Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

			_, bodyBytes, err := wsConn.ReadMessage()
			_, bodyBytes, err = wsConn.ReadMessage()
			Expect(err).ToNot(HaveOccurred())

			res := gjson.ParseBytes(bodyBytes)
			Expect(res.Get("method").String()).To(Equal("/room/update"))
			roomData := res.Get("data")
			Expect(roomData.Get("name").String()).To(Equal("my room name"))
		})

		It("returns incorrect password error", func() {
			msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "incorrect password",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
			Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
			Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
			Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

			_, bodyBytes, err := wsConn.ReadMessage()
			Expect(err).ToNot(HaveOccurred())

			res := gjson.ParseBytes(bodyBytes)
			Expect(res.Get("method").String()).To(Equal("/room/update"))
			Expect(res.Get("errorMessage").String()).To(Equal("Wrong Password"))
		})
	})

	Context("when user is not the host", func() {
		BeforeEach(func() {
			msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
			Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
			Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
			Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

			_, bodyBytes, err := wsConn.ReadMessage()
			_, bodyBytes, err = wsConn.ReadMessage()
			Expect(err).ToNot(HaveOccurred())

			res := gjson.ParseBytes(bodyBytes)
			Expect(res.Get("method").String()).To(Equal("/room/update"))
			roomData := res.Get("data")
			Expect(roomData.Get("name").String()).To(Equal("my room name"))

			msg = `{
				"method": "/room/update",
				"data": {
				  "name": "my room name",
				  "password": "my room password",
				  "playbackRate": 1.0,
				  "currentTime": 1.0,
				  "paused": true,
				  "url": "https://www.youtube.com/watch?v=N000qglmmY0",
				  "lastUpdateClientTime": 1669197153.123,
				  "duration": 1.23,
				  "tempUser": "bob bob",
				  "protected": false,
				  "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
				}
			  }`
			Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
			Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
			Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

			_, bodyBytes, err = wsConn.ReadMessage()
			_, bodyBytes, err = wsConn.ReadMessage()
			Expect(err).ToNot(HaveOccurred())

			res = gjson.ParseBytes(bodyBytes)
			Expect(res.Get("method").String()).To(Equal("/room/update"))
			roomData = res.Get("data")
			Expect(roomData.Get("name").String()).To(Equal("my room name"))
		})

		It("returns not host error", func() {
			msg := `{
  "method": "/room/update",
  "data": {
    "name": "my room name",
    "password": "my room password",
    "playbackRate": 1.0,
    "currentTime": 1.0,
    "paused": true,
    "url": "https://www.youtube.com/watch?v=N000qglmmY0",
    "lastUpdateClientTime": 1669197153.123,
    "duration": 1.23,
    "tempUser": "alice alice",
    "protected": false,
    "videoTitle": "Dua Lipa - Levitating (Official Animated Music Video)"
  }
}`
			Expect(wsConn.SetWriteDeadline(time.Now().Add(time.Second))).Should(Succeed())
			Expect(wsConn.WriteMessage(websocket.TextMessage, []byte(msg))).Should(Succeed())
			Expect(wsConn.SetReadDeadline(time.Now().Add(time.Second))).Should(Succeed())

			_, bodyBytes, err := wsConn.ReadMessage()
			Expect(err).ToNot(HaveOccurred())

			res := gjson.ParseBytes(bodyBytes)
			Expect(res.Get("method").String()).To(Equal("/room/update"))
			Expect(res.Get("errorMessage").String()).To(Equal(GetErrorMessage("").OtherHostSyncing))
		})
	})
})
