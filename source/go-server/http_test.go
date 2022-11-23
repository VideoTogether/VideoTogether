package main

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
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
})
