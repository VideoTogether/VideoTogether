package main

func NewVideoTogetherService() *VideoTogetherService {
	
}

type VideoTogetherService struct {
}

func (s *VideoTogetherService) Timestamp() float64 {
	return float64(time.Now().UnixMilli()) / 1000
}