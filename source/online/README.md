通过代理的形式注入插件脚本到网页中

你需要准备

1. 一个配置了泛解析的域名
2. 一个泛解析的SSL证书

```
1. 安装 miniflare

npm install -g miniflare 

修改一下 miniflare 

cd /usr/lib/node_modules/miniflare
sudo vi node_modules/@miniflare/http-server/dist/src/index.js

if (pathname.startsWith("/cdn-cgi/")) {
改成
if (false && pathname.startsWith("/cdn-cgi/")) {

2. 修改内容为你的域名

修改 VideoTogether/source/online/WORKER_HOSTNAME


3. 编译 worker 代码
cd VideoTogether
python script/build_extension.py

4. 运行

cd VideoTogether/release

miniflare worker.js --watch --debug  --https-key SSL私钥文件 --https-cert SSL证书 -p 443 --kv-persist --kv ONLINE_SYNC

```