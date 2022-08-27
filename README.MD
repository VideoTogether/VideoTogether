# <a name="0">Video Together 一起看视频</a>

**Currently only Chinese display language is available in this extension. I'm working on the localization now. English will be available soon, both extension display language and documentation.**

## 欢迎访问插件主页，查看安装使用说明 http://2gether.video/

# 注意, m3u8 分支的代码是纯实验性质的, 不会通过任何渠道分发给 VideoTogehter 插件的任何用户

# 如果您认为这个分支代码侵犯了您的任何利益,请联系我们,我们会立马删除这个分支

# Note: The code of the m3u8 branch is purely experimental and will not be distributed to any users of VideoTogehter through any channels

# If you think this branch code infringes any of your interests, please contact us and we will delete this branch immediately

文档正在完善中
请加入插件的交流群获取更详细的帮助信息，以及反馈问题

Telegram: https://t.me/videotogether_group

QQ群: 170200260

也欢迎提交任何 issue 以及 PR

## 安装使用

正式版安装说明： http://2gether.video/guide/install.html

使用说明：http://2gether.video/guide/introduction.html


测试版安装：https://github.com/VideoTogether/VideoTogether/raw/main/release/extension.beta.user.js

测试版使用过程中可能会遇到各种问题，欢迎反馈测试中遇到的问题

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

私有部署文档：http://2gether.video/guide/deploy.html

## TODO

- 使用 Websocket 替代 http 请求
- 统计不同语言使用者
- 增加多语言支持
- 服务端清理不活跃房间
- 服务端增加一些监控和报警
- 在中国部署服务端


### 赞助

项目天使轮赞助

<img src="https://user-images.githubusercontent.com/23057110/175770059-c8faad24-dc79-42da-9359-bf462eb7e884.png" width="300">

七夕追加赞助

<img width="290" alt="B54A4B2B-D606-4CD8-B5BF-0AA53CD1B010" src="https://user-images.githubusercontent.com/23057110/182861201-022c9460-9174-47ce-b8d8-3ab3ff737e25.png">

