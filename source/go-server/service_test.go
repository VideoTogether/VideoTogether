package main

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"time"
)

var _ = Describe("Service", func() {
	var srv *VideoTogetherService
	var rootUser *User
	BeforeEach(func() {
		srv = NewVideoTogetherService()
		rootUser = srv.NewUser("root")
	})

	It("get server timestamp", func(ctx SpecContext) {
		Expect(srv.Timestamp()).To(BeNumerically(">=", 1668969905))
	}, SpecTimeout(time.Second))

	Describe("create room", func() {
		It("create 2 rooms", func(ctx SpecContext) {
			room1 := srv.CreateRoom("roomName1", "password", rootUser)
			Expect(room1.Name).To(Equal("roomName1"))
			Expect(room1.password).To(Equal("password"))

			room2 := srv.CreateRoom("roomName2", "password2", rootUser)
			Expect(room2.Name).To(Equal("roomName2"))
			Expect(room2.password).To(Equal("password2"))
		}, SpecTimeout(time.Second))
	})

	Describe("query room", func() {
		It("doesn't exist room", func(ctx SpecContext) {
			srv.CreateRoom("roomName", "password", rootUser)
			room := srv.QueryRoom("roomName2")
			Expect(room).To(BeNil())
		}, SpecTimeout(time.Second))

		It("exist room", func(ctx SpecContext) {
			r1 := srv.CreateRoom("roomName", "password", rootUser)
			r2 := srv.QueryRoom("roomName")
			Expect(r2).To(Equal(r1))
		}, SpecTimeout(time.Second))
	})

	Describe("get statistics", func() {
		It("has no rooms", func(ctx SpecContext) {
			s := srv.Statistics()
			Expect(s.RoomCount).To(Equal(0))
		}, SpecTimeout(time.Second))

		It("has 1 room", func(ctx SpecContext) {
			srv.CreateRoom("roomName", "password", rootUser)
			s := srv.Statistics()
			Expect(s.RoomCount).To(Equal(1))
		}, SpecTimeout(time.Second))

		It("has 2 rooms", func(ctx SpecContext) {
			srv.CreateRoom("roomName", "password", rootUser)
			srv.CreateRoom("roomName2", "password2", rootUser)
			s := srv.Statistics()
			Expect(s.RoomCount).To(Equal(2))
		}, SpecTimeout(time.Second))
	})

})
