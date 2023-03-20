package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/VideoTogether/VideoTogether/internal/qps"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/onsi/gomega/ghttp"
	"github.com/unrolled/render"
)

var _ = Describe("Http Api", func() {
	var server *ghttp.Server
	var vtSrv *VideoTogetherService
	var api *slashFix
	BeforeEach(func() {
		server = ghttp.NewServer()
		vtSrv = NewVideoTogetherService(time.Minute * 3)
		api = newSlashFix(render.New(), vtSrv, qps.NewQP(time.Second, 3600), "", http.DefaultClient)
		server.AppendHandlers(api.ServeHTTP)
	})

	AfterEach(func() {
		server.Close()
	})

	Describe("Cors", func() {
		It("return cors headers", func() {
			resp, err := http.Get(server.URL())
			Expect(err).ShouldNot(HaveOccurred())
			Expect(resp.Header.Get("Access-Control-Allow-Origin")).To(Equal("*"))
			Expect(resp.Header.Get("Access-Control-Max-Age")).To(Equal("86400"))
			Expect(resp.Header.Get("Access-Control-Allow-Methods")).To(Equal("GET,HEAD,POST,OPTIONS"))
		})

		It("return cors headers in preflight response", func() {
			req, err := http.NewRequest(http.MethodOptions, server.URL(), nil)
			Expect(err).ShouldNot(HaveOccurred())
			resp, err := http.DefaultClient.Do(req)

			Expect(err).ShouldNot(HaveOccurred())
			Expect(resp.Header.Get("Access-Control-Allow-Origin")).To(Equal("*"))
			Expect(resp.Header.Get("Access-Control-Max-Age")).To(Equal("86400"))
			Expect(resp.Header.Get("Access-Control-Allow-Methods")).To(Equal("GET,HEAD,POST,OPTIONS"))
		})
		Context("When handler panic", func() {
			BeforeEach(func() {
				api.mux = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					panic("invalid call")
				})
			})

			It("return cors headers", func() {
				req, err := http.NewRequest(http.MethodOptions, server.URL(), nil)
				Expect(err).ShouldNot(HaveOccurred())
				resp, err := http.DefaultClient.Do(req)

				Expect(err).ShouldNot(HaveOccurred())
				Expect(resp.Header.Get("Access-Control-Allow-Origin")).To(Equal("*"))
				Expect(resp.Header.Get("Access-Control-Max-Age")).To(Equal("86400"))
				Expect(resp.Header.Get("Access-Control-Allow-Methods")).To(Equal("GET,HEAD,POST,OPTIONS"))
			})
		})
	})

	Describe("handle panic error", func() {
		Context("When string type", func() {
			BeforeEach(func() {
				api.mux = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					panic("invalid call")
				})
			})

			It("returns http 500 code", func() {
				resp, err := http.Get(server.URL())
				Expect(err).ShouldNot(HaveOccurred())
				Expect(resp.StatusCode).Should(Equal(http.StatusInternalServerError))

				body, err := ioutil.ReadAll(resp.Body)
				Expect(err).ToNot(HaveOccurred())
				Expect(string(body)).Should(Equal("invalid call\n"))
			})
		})

		Context("When error type", func() {
			BeforeEach(func() {
				api.mux = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					panic(errors.New("invalid call"))
				})
			})

			It("returns http 500 code", func() {
				resp, err := http.Get(server.URL())
				Expect(err).ShouldNot(HaveOccurred())
				Expect(resp.StatusCode).Should(Equal(http.StatusInternalServerError))
				body, err := ioutil.ReadAll(resp.Body)
				Expect(err).ToNot(HaveOccurred())
				Expect(string(body)).Should(Equal("invalid call\n"))
			})
		})

		Context("When nil pointer", func() {
			BeforeEach(func() {
				api.mux = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					var room *Room
					_ = room.Url
				})
			})

			It("returns http 500 code", func() {
				resp, err := http.Get(server.URL())
				Expect(err).ShouldNot(HaveOccurred())
				Expect(resp.StatusCode).Should(Equal(http.StatusInternalServerError))

				body, err := ioutil.ReadAll(resp.Body)
				Expect(err).ToNot(HaveOccurred())
				Expect(string(body)).Should(Equal("runtime error: invalid memory address or nil pointer dereference\n"))
			})
		})
	})

	It("returns current timestamp of server", func() {
		beginTime := vtSrv.Timestamp()
		time.Sleep(time.Millisecond)
		resp, err := http.Get(server.URL() + "/timestamp")
		Expect(err).ShouldNot(HaveOccurred())
		Expect(resp.StatusCode).Should(Equal(http.StatusOK))
		bodyDecoder := json.NewDecoder(resp.Body)
		var timestampResp TimestampResponse
		Expect(bodyDecoder.Decode(&timestampResp)).Should(Succeed())
		Expect(timestampResp.Timestamp).Should(BeNumerically("<=", vtSrv.Timestamp()))
		Expect(timestampResp.Timestamp).Should(BeNumerically(">=", beginTime))
	})

	It("Creates a new room", func() {
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
		data.Add("tempUser", "user-001")
		data.Add("protected", "false")
		data.Add("videoTitle", "Dua Lipa - Levitating (Official Animated Music Video)")
		req, err := http.NewRequest("PUT", server.URL()+"/room/update?"+data.Encode(), nil)
		Expect(err).ShouldNot(HaveOccurred())
		resp, err := http.DefaultClient.Do(req)
		Expect(err).ShouldNot(HaveOccurred())

		Expect(resp.StatusCode).Should(Equal(http.StatusOK))
		bodyDecoder := json.NewDecoder(resp.Body)
		var roomResponse RoomResponse
		Expect(bodyDecoder.Decode(&roomResponse)).Should(Succeed())

		Expect(roomResponse.Room.Name).To(Equal("roomName"))
		Expect(roomResponse.Room.Paused).To(Equal(true))

		Expect(vtSrv.QueryRoom("roomName").QueryUser("user-001"))

		room := vtSrv.QueryRoom("roomName")
		Expect(room.hostId).To(Equal("user-001"))
		Expect(room.password).To(Equal(GetMD5Hash("roomPassword")))
		Expect(room.PlaybackRate).To(Equal(1.0))
		Expect(room.CurrentTime).To(Equal(1.0))
		Expect(room.Paused).To(Equal(true))
		Expect(room.Url).To(Equal("https://www.youtube.com/watch?v=N000qglmmY0"))
		Expect(room.LastUpdateClientTime).To(Equal(float64(beginAt.UnixMilli()) / 1000))
		Expect(room.Protected).To(Equal(false))
		Expect(room.VideoTitle).To(Equal("Dua Lipa - Levitating (Official Animated Music Video)"))
		Expect(room.LastUpdateServerTime).To(BeNumerically(">=", float64(beginAt.UnixMilli())/1000))
		Expect(room.LastUpdateServerTime).To(BeNumerically("<=", float64(time.Now().UnixMilli())/1000))
	})

	Context("When update room with incorrect password", func() {
		BeforeEach(func() {
			user := "user-001"
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
			data.Add("language", "zh-cn")
			req, err := http.NewRequest("PUT", server.URL()+"/room/update?"+data.Encode(), nil)
			Expect(err).ShouldNot(HaveOccurred())
			resp, err := http.DefaultClient.Do(req)
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("密码错误"))
		})
	})

	Context("When room is not protected and password is incorrect", func() {
		BeforeEach(func() {
			user := "user-001"
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
			user := "user-001"
			room := vtSrv.CreateRoom("roomName", GetMD5Hash("roomPassword"), user)
			room.Protected = true
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
		})

		It("returns incorrect password error", func() {
			data := url.Values{}
			data.Add("name", "roomName")
			data.Add("password", "incorrect roomPassword")
			data.Add("language", "zh-cn")
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
			data.Add("language", "en-us")
			resp, err := http.Get(server.URL() + "/room/get?" + data.Encode())
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("Room Not Exists"))
		})
	})

	Context("When update room and user is not the host", func() {
		BeforeEach(func() {
			user := "alice"
			room, _ := vtSrv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, "roomName", GetMD5Hash("roomPassword"), user)
			Expect(user).ToNot(BeNil())
			Expect(room).ToNot(BeNil())
			vtSrv.QueryRoom("roomName").NewUser("bob")
			vtSrv.QueryRoom("roomName").setHost("bob")
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
			data.Add("tempUser", "alice")
			data.Add("protected", "false")
			data.Add("videoTitle", "Dua Lipa - Levitating (Official Animated Music Video)")
			data.Add("language", "en-us")
			req, err := http.NewRequest("PUT", server.URL()+"/room/update?"+data.Encode(), nil)
			Expect(err).ShouldNot(HaveOccurred())
			resp, err := http.DefaultClient.Do(req)
			Expect(err).ShouldNot(HaveOccurred())

			Expect(resp.StatusCode).Should(Equal(http.StatusOK))
			bodyDecoder := json.NewDecoder(resp.Body)
			var response ErrorResponse
			Expect(bodyDecoder.Decode(&response)).Should(Succeed())
			Expect(response.ErrorMessage).To(Equal("Other Host Is Syncing"))
		})
	})
})
