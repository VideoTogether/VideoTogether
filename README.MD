# <a name="0">Video Together 一起看视频</a>

**Currently only Chinese display language is available in this extension. I'm working on the localization now. English will be available soon, both extension display language and documentation.**

## 欢迎访问插件主页，查看安装使用说明 https://videotogether.github.io

文档正在完善中
请加入插件的交流群获取更详细的帮助信息，以及反馈问题

Telegram: https://t.me/videotogether_group

QQ群: 170200260

也欢迎提交任何 issue 以及 PR

## 安装使用

安装说明： https://videotogether.github.io/guide/install.html

使用说明：https://videotogether.github.io/guide/introduction.html

## 开发

### 插件

插件的核心代码在 `main/source/extension/vt.js`

此外还有一个壳插件，为了让用户安装后可以一直获取最新的插件，代码在 `source/extension/extension.js`

代码中 {{{ }}} 代表的是将某个文件插入到此处

输入命令 `python script/build_extension.py` 脚本能够进行编译，编译结果在 `release` 目录

### 服务端

代码在 `source/server/main.py` 

`python source/server/main.py debug` 运行一个本地服务器

#### 私有化部署

私有部署文档：https://videotogether.github.io/guide/deploy.html

## TODO

- 使用 Websocket 替代 http 请求
- 统计不同语言使用者
- 增加多语言支持
- 服务端清理不活跃房间
- 服务端增加一些监控和报警
- 在中国部署服务端


### 赞助
<img src="https://user-images.githubusercontent.com/23057110/175770059-c8faad24-dc79-42da-9359-bf462eb7e884.png" width="300">
