package main

import (
	"fmt"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Service", func() {
	var srv *VideoTogetherService
	var r Room
	var rootUser = "root"
	BeforeEach(func() {
		r.NewUser(rootUser)
		srv = NewVideoTogetherService(time.Minute * 3)
		r.NewUser(rootUser)
	})

	It("get server timestamp", func(ctx SpecContext) {
		Expect(srv.Timestamp()).To(BeNumerically(">=", 1668969905))
	}, SpecTimeout(time.Second))

	Describe("Room", func() {
		It("Creates 2 rooms", func(ctx SpecContext) {
			room1 := srv.CreateRoom("roomName1", "password", rootUser)
			Expect(room1.Name).To(Equal("roomName1"))
			Expect(room1.password).To(Equal("password"))

			room2 := srv.CreateRoom("roomName2", "password2", rootUser)
			Expect(room2.Name).To(Equal("roomName2"))
			Expect(room2.password).To(Equal("password2"))
		}, SpecTimeout(time.Second))

		It("Returns nil when room does not exist", func(ctx SpecContext) {
			srv.CreateRoom("roomName", "password", rootUser)
			room := srv.QueryRoom("roomName2")
			Expect(room).To(BeNil())
		}, SpecTimeout(time.Second))

		It("Gets the same room from creating or from querying", func(ctx SpecContext) {
			r1 := srv.CreateRoom("roomName", "password", rootUser)
			r2 := srv.QueryRoom("roomName")
			Expect(r2).To(Equal(r1))
		}, SpecTimeout(time.Second))

		Describe("Gets and checks permission of room", func() {
			Context("When user and room do not exist", func() {
				It("Creates a new new and creates a new room for the new user", func() {
					r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, "roomName", "password", "user-001")
					Expect(err).To(BeNil())
					Expect(r.Name).To(Equal("roomName"))
					Expect(r.password).To(Equal("password"))
					Expect(r.hostId).To(Equal("user-001"))
				})
			})

			Context("When user exist but room does not exist", func() {
				It("Creates a new room for the existent user", func() {
					r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, "roomName", "password", rootUser)
					Expect(err).To(BeNil())
					Expect(r.Name).To(Equal("roomName"))
					Expect(r.password).To(Equal("password"))
					Expect(r.hostId).To(Equal(rootUser))
				})
			})

			Context("When user and room  both exist", func() {
				It("Gets the room and user", func() {
					room := srv.CreateRoom("roomName", "password", rootUser)
					r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, "roomName", "password", rootUser)
					Expect(err).To(BeNil())
					Expect(r.hostId).To(Equal(rootUser))
					Expect(fmt.Sprintf("%p", r)).To(Equal(fmt.Sprintf("%p", room)))
				})
			})

			Context("When user and room both exist", func() {
				Context("When user is not the host of the room and with incorrect password", func() {
					It("returns incorrect password error", func() {
						room := srv.CreateRoom("roomName", "password", rootUser)
						bob := "bob"
						room.NewUser(bob)
						r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, room.Name, "incorrect "+room.password, bob)
						Expect(err.Error()).To(Equal(GetErrorMessage("").WrongPassword))
						Expect(r).To(BeNil())
					})
				})

				Context("When user is the host of the room and with incorrect password", func() {
					It("returns incorrect password error", func() {
						room := srv.CreateRoom("roomName", "password", rootUser)
						r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, room.Name, "incorrect "+room.password, rootUser)
						Expect(err.Error()).To(Equal(GetErrorMessage("").WrongPassword))
						Expect(r).To(BeNil())
					})
				})

				Context("When user is not the host of the room and with correct password", func() {
					It("returns not host error", func() {
						room := srv.CreateRoom("roomName", "password", rootUser)
						bob := "bob"
						room.NewUser(bob)
						r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, room.Name, room.password, bob)
						Expect(err.Error()).To(Equal(GetErrorMessage("").OtherHostSyncing))
						Expect(r).To(BeNil())
					})
				})

				Context("When user is the host of the room and with correct password", func() {
					It("returns user and room with no error", func() {
						room := srv.CreateRoom("roomName", "password", rootUser)
						r, err := srv.GetAndCheckUpdatePermissionsOfRoom(&VtContext{}, room.Name, room.password, rootUser)
						Expect(err).To(BeNil())
						Expect(r).ToNot(BeNil())
					})
				})
			})
		})

		It("is host", func(ctx SpecContext) {
			room := srv.CreateRoom("roomName", "password", rootUser)
			Expect(room.IsHost(rootUser)).To(Equal(true))
		}, SpecTimeout(time.Second))

		It("is not host", func(ctx SpecContext) {
			room := srv.CreateRoom("roomName", "password", rootUser)
			bob := "bob"
			room.NewUser(bob)
			Expect(room.IsHost(bob)).To(Equal(false))
		}, SpecTimeout(time.Second))

		Context("Access", func() {
			It("has access to the protected room for correct password", func(ctx SpecContext) {
				room := srv.CreateRoom("roomName", "password", rootUser)
				room.Protected = true
				Expect(room.HasAccess("password")).To(Equal(true))
			}, SpecTimeout(time.Second))

			It("does not have access to the protected room for incorrect password", func(ctx SpecContext) {
				room := srv.CreateRoom("roomName", "password", rootUser)
				room.Protected = true
				Expect(room.HasAccess("incorrect password")).To(Equal(false))
			}, SpecTimeout(time.Second))

			It("has access to the public room for correct password", func(ctx SpecContext) {
				room := srv.CreateRoom("roomName", "password", rootUser)
				Expect(room.HasAccess("password")).To(Equal(true))
			}, SpecTimeout(time.Second))

			It("has access to the public room even the password is incorrect", func(ctx SpecContext) {
				room := srv.CreateRoom("roomName", "password", rootUser)
				Expect(room.HasAccess("incorrect password")).To(Equal(true))
			}, SpecTimeout(time.Second))
		})
	})

	Describe("User", func() {
		Context("When user id is not placed", func() {
			It("Creates new user", func() {
				userId := "bob"
				Expect(!r.QueryUser(userId))

				r.NewUser(userId)
				Expect(r.QueryUser(userId))
			})
		})

		// Context("When user id is placed", func() {
		// 	It("Creates a new user but have different memory address", func() {
		// 		userId := "bob"
		// 		rNewUser(userId)
		// 		Expect().To(Equal(userId))

		// 		u2 := srv.NewUser(userId)
		// 		Expect(u2.UserId).To(Equal(userId))

		// 		Expect(fmt.Sprintf("%p", u1)).ToNot(Equal(fmt.Sprintf("%p", u2)))
		// 	})
		// })

		Context("When query user", func() {
			It("Refreshes last seen timestamp", func() {
				// time.Sleep(time.Millisecond)
				// lastSeenAt := rootUser.LastSeen
				// u := srv.QueryUser(rootUser.UserId)
				// Expect(u.LastSeen).To(BeNumerically(">", lastSeenAt))
				// Expect(u.LastSeen).To(Equal(rootUser.LastSeen))
				Expect(r.QueryUser(rootUser))
			})
		})
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

		Context("When room expired", func() {
			It("returns no room", func(ctx SpecContext) {
				s := NewVideoTogetherService(time.Millisecond * 50)
				s.CreateRoom("roomName", "password", rootUser)
				stat := s.Statistics()
				Expect(stat.RoomCount).To(Equal(1))
				time.Sleep(time.Millisecond * 100)
				stat = s.Statistics()
				Expect(stat.RoomCount).To(Equal(0))
			}, SpecTimeout(time.Second))
		})
	})
})
