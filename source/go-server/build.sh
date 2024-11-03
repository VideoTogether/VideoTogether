#!/usr/bin/env bash
RUN_NAME="VideoTogetherServer"
mkdir -p output
cp bootstrap.sh output/bootstrap.sh
chmod +x output/bootstrap.sh

# 设置开启go mod
go env -w GO111MODULE=auto
# 设置go代理
go env -w GOPROXY=https://goproxy.cn

go build -o output/${RUN_NAME}