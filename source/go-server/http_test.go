package main

import (
	"encoding/json"
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
	BeforeEach(func() {
		server = ghttp.NewServer()
		vtSrv = NewVideoTogetherService(time.Minute * 3)
		api := newSlashFix(render.New(), vtSrv, qps.NewQP(time.Second, 3600), "", http.DefaultClient)
		server.AppendHandlers(api.ServeHTTP)
	})

	AfterEach(func() {
		server.Close()
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
