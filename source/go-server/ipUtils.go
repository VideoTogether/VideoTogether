package main

import (
	"bufio"
	"encoding/binary"
	"net"
	"os"
	"strings"
)

// Download the ip list file from https://raw.githubusercontent.com/mayaxcn/china-ip-list/master/chn_ip.txt

type IPRanges []IPRange

type IPRange struct {
	Start net.IP
	End   net.IP
}

func (r IPRanges) Len() int {
	return len(r)
}

func loadChinaIPRanges(filePath string) (IPRanges, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var ranges IPRanges
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, " ")
		if len(parts) == 2 {
			ranges = append(ranges, IPRange{
				Start: net.ParseIP(parts[0]),
				End:   net.ParseIP(parts[1]),
			})
		}
	}
	return ranges, scanner.Err()
}

func (r IPRanges) search(ip net.IP) bool {
	if ip == nil {
		return false
	}
	left, right := 0, len(r)-1
	ipVal := binary.BigEndian.Uint32(ip.To4())

	for left <= right {
		mid := left + (right-left)/2
		startVal := binary.BigEndian.Uint32(r[mid].Start.To4())
		endVal := binary.BigEndian.Uint32(r[mid].End.To4())

		if ipVal >= startVal && ipVal <= endVal {
			return true
		} else if ipVal < startVal {
			right = mid - 1
		} else {
			left = mid + 1
		}
	}
	return false
}
