package main

import (
	"time"
)

func NewVideoTogetherService() *VideoTogetherService {
	return &VideoTogetherService{}
}

type VideoTogetherService struct {
}

func (s *VideoTogetherService) Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
}