// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    http://vt.panghair.com
// @version      0.1
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://cdn.jsdelivr.net/gh/maggch97/VideoTogether/icon/favicon-32x32.png
// @downloadURL  https://raw.githubusercontent.com/maggch97/VideoTogether/main/source/js/vt.js
// @updateURL    https://raw.githubusercontent.com/maggch97/VideoTogether/main/source/js/vt.js
// @grant        none
// ==/UserScript==

console.log(window.location);

class VideoTogetherFlyPannel {
    constructor() {
        this.videoTogetherFlyPannel = document.createElement("div");
        this.videoTogetherFlyPannel.id = "videoTogetherFlyPannel";

        this.createRoomButton = document.createElement('button');
        this.createRoomButton.innerHTML = "建房";

        this.joinRoomButton = document.createElement('button');
        this.joinRoomButton.innerHTML = "加入";

        this.helpButton = document.createElement("button");
        this.helpButton.innerHTML = "需要帮助";

        this.createRoomButton.onclick = this.CreateRoomButtonOnClick.bind(this);
        this.joinRoomButton.onclick = this.JoinRoomButtonOnClick.bind(this);
        this.helpButton.onclick = this.HelpButtonOnClick.bind(this);

        this.inputRoomName = document.createElement('input');
        this.inputRoomName.placeholder = "输入房间名";

        this.inputRoomPassword = document.createElement("input");
        this.inputRoomPassword.placeholder = "输入密码";

        this.statusText = document.createElement('p');
        this.statusText.id = "videoTogetherStatusText";

        this.videoTogetherFlyPannel.appendChild(this.statusText);
        this.videoTogetherFlyPannel.appendChild(this.inputRoomName);
        this.videoTogetherFlyPannel.appendChild(this.inputRoomPassword);
        this.videoTogetherFlyPannel.appendChild(this.createRoomButton);
        this.videoTogetherFlyPannel.appendChild(this.joinRoomButton);
        this.videoTogetherFlyPannel.appendChild(this.helpButton);

        //搜寻body元素
        let beasetag = document.querySelector("body");
        //将新元素作为子节点插入到body元素的最后一个子节点之后
        beasetag.appendChild(this.videoTogetherFlyPannel);
        //可以通过videoTogetherFlyPannel.innerHTML = "<button type='button'>启动</button><br><button type='button'>关闭</button>"来写入其他元素，如多个按钮
        // videoTogetherFlyPannel.innerHTML = "按钮";
        //css样式为
        //position:fixed;生成固定定位的元素，相对于浏览器窗口进行定位。元素的位置通过 "left", "top", "right" 以及 "bottom" 属性进行规定。
        //bottom:15px;距窗口底部15px
        //right:15px;距窗口右边15px
        //width:60px;内容的宽度60px
        //height:60px;内容的高度60px
        //background:black;内边距的颜色和内容的颜色设置为黑色，不包括外边距和边框
        //opacity:0.75;不透明度设置为0.75，1为完全不透明
        //color:white;指定文本的颜色为白色
        //text-align:center;指定元素文本的水平对齐方式为居中对齐
        //line-height:60px;设置行高，通过设置为等于该元素的内容高度的值，配合text-align:center;可以使div的文字居中
        //cursor:pointer;定义了鼠标指针放在一个元素边界范围内时所用的光标形状为一只手
        this.videoTogetherFlyPannel.style = "z-index:9999;position:fixed;bottom:15px;right:15px;width:200px;height:200px;background:grey;color:black;text-align:center;line-height:60px;cursor:pointer;";
        //通过匿名函数，设置点击该悬浮按钮后执行的函数
    }

    CreateRoomButtonOnClick() {
        let roomName = this.inputRoomName.value;
        let password = this.inputRoomPassword.value;
        window.videoTogetherExtension.CreateRoom(roomName, password)
    }

    JoinRoomButtonOnClick() {
        let roomName = this.inputRoomName.value;
        window.videoTogetherExtension.JoinRoom(roomName)
    }

    HelpButtonOnClick() {
        window.open('https://github.com/maggch97/VideoTogether/blob/main/README.MD', '_blank');
    }

    UpdateStatusText(text, color) {
        this.statusText.innerHTML = text;
        this.statusText.style = "color:" + color;
    }
}

class VideoTogetherExtension {
    RoleEnum = {
        Null: 1,
        Master: 2,
        Member: 3,
    }
    video_together_host = "https://vt.panghair.com:5000/";

    timer = 0
    roomName = ""
    roomPassword = ""
    // 0: null, 1: 
    role = this.RoleEnum.Null
    url = ""

    serverTimestamp = 0;
    localTimestamp = 0;

    constructor() {
        this.timer = setInterval(this.ScheduledTask.bind(this), 2 * 1000);
        this.RecoveryState();
        this.SyncTimeWithServer();
    }

    getLocalTimestamp() {
        return Date.now() / 1000 - this.localTimestamp + this.serverTimestamp;
    }

    async SyncTimeWithServer() {
        let startTime = this.getLocalTimestamp()
        let response = await fetch(this.video_together_host + "/timestamp");
        let endTime = this.getLocalTimestamp();
        let data = await this.CheckResponse(response);
        if (typeof (data["timestamp"]) == "number") {
            this.serverTimestamp = data["timestamp"];
            this.localTimestamp = (startTime + endTime) / 2;
        }
    }

    RecoveryState() {
        console.log("recovery: ", window.location)
        function RecoveryStateFromUrl(url) {
            console.log(url);
            let vtRole = url.searchParams.get("videoTogetherRole");
            let vtUrl = url.searchParams.get("videoTogetherUrl");
            let vtRoomName = url.searchParams.get("VideoTogetherRoomName");
            if (vtUrl != null && vtRoomName != null) {
                if (vtRole == this.RoleEnum.Member) {
                    this.role = parseInt(vtRole);
                    this.url = vtUrl;
                    this.roomName = vtRoomName;
                    window.videoTogetherFlyPannel.inputRoomName.value = vtRoomName;
                }
            }
        }
        function RecoveryStateFromLocalStorage() {

        }
        let url = new URL(window.location);

        let localTimestamp = window.localStorage.getItem("videoTogetherTimestamp");
        let urlTimestamp = url.searchParams.get("videoTogetherTimestamp");
        if (localTimestamp == null && urlTimestamp == null) {
            return;
        } else if (localTimestamp == null) {
            RecoveryStateFromUrl.bind(this)(url);
        } else if (urlTimestamp == null) {

        } else if (parseFloat(localTimestamp) >= parseFloat(urlTimestamp)) {

        } else {
            RecoveryStateFromUrl.bind(this)(url);
        }
    }

    async JoinRoom(name) {
        let data = this.GetRoom(name);
        this.roomName = name;
        this.role = this.RoleEnum.Member;
    }

    async ScheduledTask() {
        try {
            switch (this.role) {
                case this.RoleEnum.Null:
                    return;
                case this.RoleEnum.Master:
                    await this.SyncMasterVideo();
                    break;
                case this.RoleEnum.Member:
                    await this.SyncMemberVideo();
                    break;
            }
        } catch (error) {
            console.log(error);
        }
        if (this.serverTimestamp == 0) {
            await this.SyncTimeWithServer();
        }
    }

    GetVideoDom() {
        let videos = document.getElementsByTagName("video");
        if (videos.length == 0) {
            videos = document.getElementsByTagName("bwp-video");
        }
        return videos[0];
    }


    async SyncMasterVideo() {
        let video = this.GetVideoDom();
        this.UpdateRoom(this.roomName,
            this.password,
            this.linkWithoutState(window.location),
            video.playbackRate,
            video.currentTime,
            video.paused);
        window.videoTogetherFlyPannel.UpdateStatusText("同步成功 " + this.GetDisplayTimeText(), "green");
    }

    linkWithoutState(link) {
        let url = new URL(link);
        url.searchParams.delete("videoTogetherUrl");
        url.searchParams.delete("VideoTogetherRoomName");
        url.searchParams.delete("videoTogetherRole");
        return url;
    }

    linkWithMemberState(link) {
        let url = new URL(link);
        url.searchParams.set("videoTogetherUrl", link);
        url.searchParams.set("VideoTogetherRoomName", this.roomName);
        url.searchParams.set("videoTogetherRole", this.role);
        url.searchParams.set("videoTogetherTimestamp", this.getLocalTimestamp())
        return url;
    }

    CalculateRealCurrent(data) {
        console.log("delta", this.getLocalTimestamp() - data["lastUpdateClientTime"]);
        return data["currentTime"] + this.getLocalTimestamp() - data["lastUpdateClientTime"];
    }

    GetDisplayTimeText() {
        let date = new Date();
        return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    }

    async SyncMemberVideo() {
        let video = this.GetVideoDom();
        let data = await this.GetRoom(this.roomName);
        window.videoTogetherFlyPannel.UpdateStatusText("同步成功 " + this.GetDisplayTimeText(), "green");
        if (data["url"] != this.url) {
            window.location = this.linkWithMemberState(data["url"]);
        }
        if (Math.abs(video.currentTime - this.CalculateRealCurrent(data)) > 1) {
            video.currentTime = this.CalculateRealCurrent(data);
        }
        if (video.paused != data["paused"]) {
            if (data["paused"]) {
                video.pause();
                console.log("pause");
            } else {
                video.play();
                console.log("play");
            }
        }
        if (video.playbackRate != data["playbackRate"]) {
            video.playbackRate = data["playbackRate"];
        }
    }

    async CheckResponse(response) {
        if (response.status != 200) {
            window.videoTogetherFlyPannel.UpdateStatusText("未知错误，错误码：" + response.status, "red");
            throw new Error(response.status);
        } else {
            let data = await response.json();
            if ("errorMessage" in data) {
                window.videoTogetherFlyPannel.UpdateStatusText(data["errorMessage"], "red");
                throw new Error(data["errorMessage"]);
            }
            return data;
        }
    }

    async CreateRoom(name, password) {
        let url = this.linkWithoutState(window.location);
        let data = await this.UpdateRoom(name, password, url, 1, 0, true);
        this.role = this.RoleEnum.Master;
        this.roomName = name;
        this.password = password;
    }

    async UpdateRoom(name, password, url, playbackRate, currentTime, paused) {
        let apiUrl = new URL(this.video_together_host + "/room/update");
        apiUrl.searchParams.set("name", name);
        apiUrl.searchParams.set("password", password);
        apiUrl.searchParams.set("playbackRate", playbackRate);
        apiUrl.searchParams.set("currentTime", currentTime);
        apiUrl.searchParams.set("paused", paused);
        apiUrl.searchParams.set("url", url);
        apiUrl.searchParams.set("lastUpdateClientTime", this.getLocalTimestamp());
        // url.searchParams.set("lastUpdateClientTime", timestamp)
        let response = await fetch(apiUrl);
        let data = await this.CheckResponse(response);
        return data;
    }

    async GetRoom(name) {
        let url = new URL(this.video_together_host + "/room/get");
        url.searchParams.set("name", name);
        let response = await fetch(url);
        let data = await this.CheckResponse(response);
        return data;
    }
}

// function VideoTogetherRequest(url, callback) {
//     if (callback !== null || callback !== undefined) {
//         url.searchParams.set("callback", callback);
//     }
//     var head = document.getElementsByTagName('head')[0];
//     var script = document.createElement('script');
//     script.type = 'text/javascript';
//     script.crossOrigin = 'anonymous';
//     script.referrerpolicy = ''
//     script.src = url;
//     head.appendChild(script);
// }


var dragBox = function (drag, wrap) {

    function getCss(ele, prop) {
        return parseInt(window.getComputedStyle(ele)[prop]);
    }

    var initX,
        initY,
        dragable = false,
        wrapLeft = getCss(wrap, "left"),
        wrapRight = getCss(wrap, "top");

    drag.addEventListener("mousedown", function (e) {
        dragable = true;
        initX = e.clientX;
        initY = e.clientY;
    }, false);

    document.addEventListener("mousemove", function (e) {
        if (dragable === true) {
            var nowX = e.clientX,
                nowY = e.clientY,
                disX = nowX - initX,
                disY = nowY - initY;
            wrap.style.left = wrapLeft + disX + "px";
            wrap.style.top = wrapRight + disY + "px";
        }
    });

    drag.addEventListener("mouseup", function (e) {
        dragable = false;
        wrapLeft = getCss(wrap, "left");
        wrapRight = getCss(wrap, "top");
    }, false);

};

window.videoTogetherFlyPannel = new VideoTogetherFlyPannel();
window.videoTogetherExtension = new VideoTogetherExtension();
// dragBox(document.querySelector("#videoTogetherFlyPannel"), document.querySelector("#videoTogetherFlyPannel"));
