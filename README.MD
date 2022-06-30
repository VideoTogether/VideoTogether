# <a name="0">Video Together 一起看视频</a>

**Currently only Chinese display language is available in this extension. I'm working on the localization now. English will be available soon, both extension display language and documentation.**

## 欢迎访问插件主页，一键试用 https://videotogether.github.io

<a href="#1">赞助</a>  
<a href="#2">测试截图</a>  
<a href="#3">使用说明</a>  
&emsp;<a href="#4">安装</a>  
&emsp;&emsp;<a href="#5">IOS，安卓</a>  
&emsp;&emsp;<a href="#6">Windows, MacOS</a>  
&emsp;<a href="#7">使用</a>  
&emsp;&emsp;<a href="#8">建房</a>  
&emsp;&emsp;<a href="#9">加入房间</a>  
&emsp;&emsp;<a href="#10">观看本地视频</a>  
<a href="#11">TODO</a>  

文档正在完善中

全平台支持，以 JavaScript 插件形式运行，需要浏览器支持安装 JavaScript 插件

## <a name="1">赞助</a>
<img src="https://user-images.githubusercontent.com/23057110/175770059-c8faad24-dc79-42da-9359-bf462eb7e884.png" width="400">



## <a name="2">测试截图</a>

电脑，手机，平板，电视（Airplay）

<img src="https://user-images.githubusercontent.com/23057110/175769146-79de5922-8a50-48c8-861e-f92cb08734c6.png" width="300"><img src="https://user-images.githubusercontent.com/23057110/175799242-2a7b90fe-5631-4806-94ed-a96b26631d4b.jpg" width="300"><img src="https://user-images.githubusercontent.com/23057110/175799252-7a2803f1-acff-4ae0-8498-46d7b976ae23.jpg" width="300">



## <a name="3">使用说明</a>

请加入插件的交流群获取更详细的帮助信息，以及反馈问题

tg: https://t.me/videotogether_group

QQ群: 170200260 点击链接加入群聊【video together】：https://jq.qq.com/?_wv=1027&k=402cAytc

### <a name="4">安装</a>

#### <a name="5">IOS，安卓</a>
推荐使用 Alook 浏览器，需要关闭 Alook 的视频浮窗播放功能， 官网：https://www.alookweb.com/


安装 Video Together 插件。通过 Alook 浏览器访问下面的安装链接, 点击安装按钮

https://maggch97.github.io/VideoTogether/installation/via.html



#### <a name="6">Windows, MacOS</a>

推荐使用微软 Edge 浏览器，在中国大陆可以正常访问插件商店

Chrome 浏览器用户请自行寻找安装 TamperMonkey 插件的方法

Edge 浏览器访问 https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd 安装 TamperMonkey 插件

点击链接安装 Video Together 插件 https://cdn.jsdelivr.net/gh/maggch97/VideoTogether@latest/release/extension.user.js

### <a name="7">使用</a>

#### <a name="8">建房</a>

房主可以暂停或播放视频，控制播放进度，更换视频等操作。

安装完脚本后打开一个视频页面，右下角窗口内输入房间名及密码，点击建房按钮

注意：密码仅用来建房，加入房间不需要密码。密码目前明文保存，请不要使用任何你的常用密码，推荐使用非常简单的密码，如 1234

注意：页面跳转后房间信息可能会丢失，请使用相同的密码重新创建房间

<img src="https://user-images.githubusercontent.com/23057110/175768741-35889383-de33-4c7b-a2a9-5765e2ac0e5f.png" width="400">


#### <a name="9">加入房间</a>

加入房间后插件会自动同步房主正在播放的视频以及播放状态。

安装完脚本后打开一个视频页面，右下角窗口内输入房间名，点击加入

注意：一些浏览器限制了视频的自动播放，如果视频无法自动播放，请手动点击播放一次即可

注意：页面跳转后房间信息可能会丢失，请重新加入房间

<img src="https://user-images.githubusercontent.com/23057110/175768951-ea80d4d8-fd6b-4aa5-b066-02c122d84bbd.png" width="400" >

#### <a name="10">观看本地视频</a>

在保证每台设备上都有同一份视频文件时，打开网页 https://maggch97.github.io/VideoTogether/tools/local.html 并选择本地视频

按照上面的创建以及加入房间的步骤同步视频播放进度


## <a name="11">TODO</a>

- 使用 Websocket 替代 http 请求
- 统计不同语言使用者
- 增加多语言支持
- 服务端清理不活跃房间
- 服务端增加一些监控和报警
- 在中国部署服务端
