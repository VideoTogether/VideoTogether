FROM golang:1.18
WORKDIR /go/src
COPY . .
EXPOSE 5001
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN ["/bin/bash", "/go/src/build.sh"]
CMD ["/bin/bash", "/go/src/output/bootstrap.sh"]