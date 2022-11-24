package main

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestVideoTogether(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Video Together Go Server Suite")
}
