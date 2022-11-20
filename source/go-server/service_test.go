package main

import (
	"testing"
	. "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"
)

func Test_Timestamp(t *testing.T) {
	s := VideoTogetherService{}
	timestamp := s.Timestamp()
	
	assert.Gr()
}


Describe("Checking video together service", Label("service"), func() {
    var srv *VideoTogetherService
    BeforeEach(func() {
        srv = NewVideoTogetherService()
    })

	It("get server timestamp", func(ctx SpecContext) {
		Expect(valjean.Checkout(ctx, library, "Les Miserables")).To(Succeed())
		Expect(valjean.Books()).To(ContainElement(book))
		Expect(srv.Timestamp()).To(BeNumerically(">=", 1668969905))
	}, SpecTimeout(time.Second * 5))
})