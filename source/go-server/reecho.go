package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/google/uuid"
)

type ReechoClient struct {
	token  string
	config *Configuration
	ctx    context.Context
}

var ReechoVoiceUserMap = sync.Map{}
var ReechoVoiceUserMapSize = 0

// cache the audio generated from same voiceId and text
var ReechoVoiceCache = sync.Map{}
var ReechoVoiceCacheHits = 0
var ReechoVoiceCacheMisses = 0

func getCacheKey(voiceId string, text string) string {
	return voiceId + text
}

func NewReechoClientWithCtx(token string, config *Configuration, ctx context.Context) *ReechoClient {
	return &ReechoClient{token: token, config: config, ctx: ctx}
}

func (reecho *ReechoClient) post(url string, headers map[string]string, data map[string]interface{}) (result map[string]interface{}) {
	dataStr, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(reecho.ctx, "POST", url, bytes.NewBuffer(dataStr))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}
	return result
}

var commonVoiceQuotaId = "*"

func (reecho *ReechoClient) CheckAndUseQuota(voiceId string, credit int) bool {
	if quotaItem, ok := reecho.config.ReechoQuota[voiceId]; ok {
		if quotaItem.Quota-quotaItem.Used >= credit {
			quotaItem.Used += credit
			return true
		} else {
			return false
		}
	}
	if voiceId != commonVoiceQuotaId {
		return reecho.CheckAndUseQuota(commonVoiceQuotaId, credit)
	}
	return false
}

func (reecho *ReechoClient) CreateNewVoice(voiceAudioBase64 string) (voiceId string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered in getVoice:", r)
			voiceId = ""
		}
	}()

	url := "https://v1.reecho.cn/api/tts/voice"
	headers := map[string]string{
		"Authorization": reecho.token,
		"Content-Type":  "application/json",
	}
	// 'vt_' + timestamp + uuid
	name := "vt_" + fmt.Sprintf("%f", Timestamp()) + "_" + uuid.New().String()

	data := map[string]interface{}{
		"name":        name,
		"description": "",
		"prompt":      voiceAudioBase64,
		"avatar":      nil,
		"preProcess":  true,
	}
	result := reecho.post(url, headers, data)
	return result["data"].(map[string]interface{})["id"].(string)
}

func (reecho *ReechoClient) GetTextAudioUrl(voiceId string, text string) (audioUrl string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered in getVoice:", r)
			audioUrl = ""
		}
	}()

	if cache, ok := ReechoVoiceCache.Load(getCacheKey(voiceId, text)); ok {
		ReechoVoiceCacheHits++
		return cache.(string)
	}

	if _, ok := ReechoVoiceUserMap.Load(voiceId); !ok {
		ReechoVoiceUserMap.Store(voiceId, 0)
		ReechoVoiceUserMapSize++
	}

	if !reecho.CheckAndUseQuota(voiceId, len(text)) {
		return ""
	}
	ReechoVoiceCacheMisses++

	url := "https://v1.reecho.cn/api/tts/simple-generate"
	headers := map[string]string{
		"Authorization": reecho.token,
		"Content-Type":  "application/json",
	}
	data := map[string]interface{}{
		"model":           "reecho-neural-voice-001",
		"randomness":      97,
		"stability_boost": 0,
		"voiceId":         voiceId,
		"text":            text,
	}
	result := reecho.post(url, headers, data)

	dataMap := result["data"].(map[string]interface{})
	audioUrl = dataMap["audio"].(string)
	if audioUrl != "" {
		ReechoVoiceCache.Store(getCacheKey(voiceId, text), audioUrl)
	}
	return audioUrl
}
