// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    http://vt.panghair.com
// @version      0.1
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://cdn.jsdelivr.net/gh/maggch97/VideoTogether/icon/favicon-32x32.png
// @grant        none
// ==/UserScript==

vtHtml = `
{{{
{"user": "./html/pannel.html"}
}}}
`

class VideoTogetherFlyPannel {
    static createElement(tag, id, classes) {
        let element = document.createElement(tag);
        element.id = id;
        element.classList = classes;
        return element;
    }

    constructor() {
        let wrapper = document.createElement("div");
        wrapper.innerHTML = vtHtml;
        document.querySelector("body").appendChild(wrapper);
        this.createRoomButton = document.querySelector('#videoTogetherCreateButton');
        this.joinRoomButton = document.querySelector("#videoTogetherJoinButton");
        this.exitButton = document.querySelector("#videoTogetherExitButton");
        this.helpButton = document.querySelector("#videoTogetherHelpButton");

        this.exitButton.style = "display: None"

        this.createRoomButton.onclick = this.CreateRoomButtonOnClick.bind(this);
        this.joinRoomButton.onclick = this.JoinRoomButtonOnClick.bind(this);
        this.helpButton.onclick = this.HelpButtonOnClick.bind(this);
        this.exitButton.onclick = () => { window.videoTogetherExtension.exitRoom(); }
        this.inputRoomName = document.querySelector('#videoTogetherRoomNameInput');
        this.inputRoomPassword = document.querySelector("#videoTogetherRoomPasswordInput");

        this.statusText = document.querySelector("#videoTogetherStatusText");
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }
    }

    InRoom() {
        this.createRoomButton.style = "display: None";
        this.joinRoomButton.style = "display: None";
        this.exitButton.style = "";
    }

    InLobby() {
        this.exitButton.style = "display: None"
        this.createRoomButton.style = "";
        this.joinRoomButton.style = "";
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
            let vtRole = url.searchParams.get("videoTogetherRole");
            let vtUrl = url.searchParams.get("videoTogetherUrl");
            let vtRoomName = url.searchParams.get("VideoTogetherRoomName");
            let timestamp = parseFloat(url.searchParams.get("videoTogetherTimestamp"));
            if (timestamp + 60 < Date.now() / 1000) {
                return;
            }

            if (vtUrl != null && vtRoomName != null) {
                if (vtRole == this.RoleEnum.Member) {
                    this.role = parseInt(vtRole);
                    this.url = vtUrl;
                    this.roomName = vtRoomName;
                    window.videoTogetherFlyPannel.inputRoomName.value = vtRoomName;
                    window.videoTogetherFlyPannel.InRoom();
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
        window.videoTogetherFlyPannel.InRoom();
    }

    exitRoom() {
        window.videoTogetherFlyPannel.inputRoomName.value = "";
        window.videoTogetherFlyPannel.inputRoomPassword.value = "";
        this.roomName = "";
        this.role = this.RoleEnum.Null;
        window.videoTogetherFlyPannel.InLobby();
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
        url.searchParams.set("videoTogetherTimestamp", Date.now() / 1000)
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
        if (data["url"] != this.url) {
            window.location = this.linkWithMemberState(data["url"]);
        }
        if (data["paused"] == false) {
            if (Math.abs(video.currentTime - this.CalculateRealCurrent(data)) > 1) {
                video.currentTime = this.CalculateRealCurrent(data);
            }
        }
        if (video.paused != data["paused"]) {
            if (data["paused"]) {
                video.pause();
                console.log("pause");
            } else {
                try {
                    await video.play();
                } catch (e) {
                    window.videoTogetherFlyPannel.UpdateStatusText("自动播放失败，请手动点击播放", "red");
                    throw new Error(e);
                }
            }
        }
        if (video.playbackRate != data["playbackRate"]) {
            video.playbackRate = data["playbackRate"];
        }
        window.videoTogetherFlyPannel.UpdateStatusText("同步成功 " + this.GetDisplayTimeText(), "green");
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
        window.videoTogetherFlyPannel.InRoom();
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
            let nowX = e.clientX,
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
dragBox(document.querySelector("#videoTogetherHeader"), document.querySelector("#videoTogetherFlyPannel"));
