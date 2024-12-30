# 服务端私有化部署

## https
服务需要https后浏览器才可以正常交互，可以使用nginx反代或本地证书解决

### 方式一：nginx反代(推荐)

```shell
# 在 nginx 的 http 块加入 WebSocket 代理配置

map $http_upgrade $connection_upgrade {  
     default upgrade;  
     '' close;  
}

# server块，建议查看证书提供商的参数
server {
    listen 443 ssl http2;  # 1.1版本后这样写
    server_name www.xxx.com; #填写绑定证书的域名
    ssl_certificate /etc/nginx/xxxx.crt;  # 指定证书的位置，绝对路径
    ssl_certificate_key /etc/nginx/xxxx.key;  # 绝对路径，同上
    ssl_session_timeout 5m;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3; #按照这个协议配置
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;#按照这个套件配置
    ssl_prefer_server_ciphers on;
    client_max_body_size 1024m;

    location / {
        proxy_pass http://你的部署地址;
        proxy_set_header HOST $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;

    }
}
```

### 方式二：本地证书

以mac举例

```shell
# 安装mkcert
brew install mkcert
# 创建本地证书颁发机构
mkcert -install
# 生成证书，可替换自己的域名
mkcert localhost 127.0.0.1
```

之后再目录下可看到对应的证书，分别替换`main.go`里的证书路径

```golang
panic(http.ListenAndServeTLS(":5000", "./certificate.pem", "./private.pem", server))
```

## 部署运行

### docker

```shell
# 打包
docker build -t video_together .
# 启动
docker run -d -p 5001:5001 --name vt video_together
```

### 其他

见`build.sh`
