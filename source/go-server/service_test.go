package main

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"time"
)

var _ = Describe("Service", func() {
    var srv *VideoTogetherService
    BeforeEach(func() {
        srv = NewVideoTogetherService()
    })

	It("get server timestamp", func(ctx SpecContext) {
		Expect(srv.Timestamp()).To(BeNumerically(">=", 1668969905))
	}, SpecTimeout(time.Second))
})
