package main

import (
	"encoding/json"
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
			body, err := ioutil.ReadAll(resp.Body)
			Expect(err).ToNot(HaveOccurred())
			Expect(string(body)).Should(HavePrefix("Bad Request\nwebsocket:"))
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

	// FIXME BELOW---

	Context("When update room with incorrect password", func() {
		BeforeEach(func() {
			user := vtSrv.NewUser("user-001")
			room := vtSrv.CreateRoom("roomName", GetMD5Hash("roomPassword"), user)
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
		})

		It("returns incorrect password error", func() {
			beginAt := time.Now()
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "incorrect roomPassword")
			data.Add("playbackRate", "1.0")
			data.Add("currentTime", "1.00")
			data.Add("paused", "true")
			data.Add("url", "https://www.youtube.com/watch?v=N000qglmmY0")
			data.Add("lastUpdateClientTime", fmt.Sprintf("%f", float64(beginAt.UnixMilli())/1000))
			data.Add("duration", "1.23")
			data.Add("tempUser", "user-001")
			data.Add("protected", "false")
			data.Add("videoTitle", "Dua Lipa - Levitating (Official Animated Music Video)")
			req, err := http.NewRequest("PUT", server.URL()+"/room/update?"+data.Encode(), nil)
			Expect(err).ShouldNot(HaveOccurred())
			resp, err := http.DefaultClient.Do(req)
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("房名已存在，密码错误"))
		})
	})

	Context("When room is not protected and password is incorrect", func() {
		BeforeEach(func() {
			user := vtSrv.NewUser("user-001")
			room := vtSrv.CreateRoom("roomName", GetMD5Hash("roomPassword"), user)
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
		})

		It("returns room information", func() {
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "incorrect roomPassword")
			resp, err := http.Get(server.URL() + "/room/get?" + data.Encode())
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response RoomResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.Name).To(Equal("roomName"))
		})
	})

	Context("When room is protected and password is incorrect", func() {
		BeforeEach(func() {
			user := vtSrv.NewUser("user-001")
			room := vtSrv.CreateRoom("roomName", GetMD5Hash("roomPassword"), user)
			room.Protected = true
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
		})

		It("returns incorrect password error", func() {
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "incorrect roomPassword")
			resp, err := http.Get(server.URL() + "/room/get?" + data.Encode())
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("密码错误"))
		})
	})

	Context("When room does not exist", func() {
		It("returns not existent error", func() {
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "roomPassword")
			resp, err := http.Get(server.URL() + "/room/get?" + data.Encode())
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("房间不存在"))
		})
	})

	Context("When update room and user is not the host", func() {
		BeforeEach(func() {
			user := vtSrv.NewUser("alice")
			room := vtSrv.CreateRoom("roomName", GetMD5Hash("roomPassword"), user)
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
		})

		It("returns hot host error", func() {
			beginAt := time.Now()
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "roomPassword")
			data.Add("playbackRate", "1.0")
			data.Add("currentTime", "1.00")
			data.Add("paused", "true")
			data.Add("url", "https://www.youtube.com/watch?v=N000qglmmY0")
			data.Add("lastUpdateClientTime", fmt.Sprintf("%f", float64(beginAt.UnixMilli())/1000))
			data.Add("duration", "1.23")
			data.Add("tempUser", "bob")
			data.Add("protected", "false")
			data.Add("videoTitle", "Dua Lipa - Levitating (Official Animated Music Video)")
			req, err := http.NewRequest("PUT", server.URL()+"/room/update?"+data.Encode(), nil)
			Expect(err).ShouldNot(HaveOccurred())
			resp, err := http.DefaultClient.Do(req)
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("你不是房主"))
		})
	})
})
