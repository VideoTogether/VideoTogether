package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strconv"
)

func p(x float64) *float64 {
	return &x
}

func GetMD5Hash(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

func floatParam(req *http.Request, key string, defaultValue *float64) float64 {
	str := req.URL.Query().Get(key)
	if str == "" {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(key + " is empty")
		}
	}
	num, err := strconv.ParseFloat(str, 64)
	if err != nil {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(fmt.Errorf("%s: %s is not float", key, str))
		}
	}
	if math.IsInf(num, 0) || math.IsNaN(num) {
		if defaultValue != nil {
			return *defaultValue
		} else {
			panic(fmt.Errorf("%s: %s is inf or nan", key, str))
		}
	}
	return num
}
