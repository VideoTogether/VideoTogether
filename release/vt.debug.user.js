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

(function () {
    class VideoTogetherFlyPannel {
        constructor() {
            this.sessionKey = "VideoTogetherFlySaveSessionKey";

            this.isMain = (window.self == window.top);
            if (this.isMain) {
                let wrapper = document.createElement("div");
                wrapper.innerHTML = `<div id="videoTogetherFlyPannel">
    <div id="videoTogetherHeader">
        <img style="display: inline;" src="https://cdn.jsdelivr.net/gh/maggch97/VideoTogether/icon/favicon-16x16.png">
        <p style="display: inline;" id="videoTogetherTitle">Video Together</p>
        <button id="videoTogetherMinimize" style="margin-right: 0px;margin-left: auto; min-width: 16px">-</button>
    </div>
    <div id="videoTogetherBody">
        <div style="width: 200px;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;display: inline-block;">
            <p style="display: inline;" id="videoTogetherRoleText"></p>
        </div>
        <div style="width: 200px;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;display: inline-block;">
            <p style="display: inline;" id="videoTogetherStatusText"></p>
        </div>
        <input id="videoTogetherRoomNameInput" autocomplete="off" placeholder="房间名">
        <input id="videoTogetherRoomPasswordInput" autocomplete="off" placeholder="密码,只有建房需要">
        <button id="videoTogetherCreateButton">建房</button>
        <button id="videoTogetherJoinButton">加入</button>
        <button id="videoTogetherExitButton" style="display: none;">退出</button>
        <button id="videoTogetherHelpButton">需要帮助</button>
    </div>
</div>

<div style="width: 24px; height: 24px;" id="VideoTogetherSamllIcon">
    <img draggable="false" width="24px" height="24px" id="videoTogetherMaximize"
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAACrFBMVEXg9b7e87jd87jd9Lnd9Lre9Lng9b/j98jm98vs99fy9ubu89/e1sfJqKnFnqLGoaXf9Lvd87Xe87fd8rfV67Ti9sbk98nm9sze48TX3rjU1rTKr6jFnaLe9Lfe87Xe9LjV7LPN4q3g78PJuqfQ1a7OzarIsabEnaHi9sXd8rvd8rbd87axx4u70Jrl+cvm+szQxq25lZTR1a7KvaXFo6LFnaHEnKHd6r3Y57TZ7bLb8bTZ7rKMomClun/k+MrOx6yue4PIvqfP06vLv6fFoqLEnKDT27DS3a3W6K7Y7bDT6auNq2eYn3KqlYShYXTOwLDAzZ7MyanKtqbEoaHDm6DDm5/R2K3Q2KzT4q3W6a7P3amUhWp7SEuMc2rSyri3zJe0xpPV17TKuqbGrqLEnqDQ2K3O06rP0arR2qzJx6GZX160j4rP1LOiuH2GnVzS3rXb47zQ063OzanHr6PDnaDMxajIsaXLwKfEt5y6mI/GyqSClVZzi0bDzp+8nY/d6L/X4rbQ1qzMyKjEqKHFpqLFpaLGqaO2p5KCjlZ5jky8z5izjoOaXmLc5r3Z57jU4K7S3K3NyqnBm56Mg2KTmWnM0KmwhH2IOUunfXnh8cXe8b7Z7LPV4rDBmZ3Cmp+6mZWkk32/qZihbG97P0OdinXQ3rTk+Mjf9L/d8rja6ri9lpqnh4qhgoWyk5Kmd3qmfHW3oou2vZGKpmaUrXDg9MPf9L3e876yj5Ori42Mc3aDbG6MYmyifXfHyaPU3rHH0aKDlVhkejW70Zbf9bze87be87ng9cCLcnWQd3qEbG9/ZmmBXmSflYS4u5ra5Lnd6r7U5ba2ypPB153c87re9b2Ba22EbW+AamyDb3CNgXmxsZng7sTj9sjk98rk+Mng9cHe9Lze9Lrd87n////PlyWlAAAAAWJLR0TjsQauigAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAAd0SU1FB+YGGQYXBzHy0g0AAAEbSURBVBjTARAB7/4AAAECAwQFBgcICQoLDA0ODwAQEREREhMUFRYXGBkaGxwOAAYdHhEfICEWFiIjJCUmDicAKCkqKx8sLS4vMDEyMzQ1NgA3ODk6Ozw9Pj9AQUJDRDVFAEZHSElKS0xNTk9QUVJTVFUAVldYWVpbXF1eX2BhYmNkVABlZmdoaWprbG1ub3BxcnN0AEJ1dnd4eXp7fH1+f4CBgoMAc4QnhYaHiImKi4yNjo+QkQBFVFU2kpOUlZaXmJmam5ucAFRVnZ6foKGio6SlpqeoE6kAVaqrrK2ur7CxsrO0tQEDtgC3uLm6u7y9vr/AwcLDxMXGAMfIycrLzM3Oz9DR0tMdAdQA1da619jZ2tvc3d7f4OEB4iRLaea64H7qAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIyLTA2LTI1VDA2OjIzOjAyKzAwOjAwlVQlhgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMi0wNi0yNVQwNjoyMzowMiswMDowMOQJnToAAAAgdEVYdHNvZnR3YXJlAGh0dHBzOi8vaW1hZ2VtYWdpY2sub3JnvM8dnQAAABh0RVh0VGh1bWI6OkRvY3VtZW50OjpQYWdlcwAxp/+7LwAAABh0RVh0VGh1bWI6OkltYWdlOjpIZWlnaHQAMTkyQF1xVQAAABd0RVh0VGh1bWI6OkltYWdlOjpXaWR0aAAxOTLTrCEIAAAAGXRFWHRUaHVtYjo6TWltZXR5cGUAaW1hZ2UvcG5nP7JWTgAAABd0RVh0VGh1bWI6Ok1UaW1lADE2NTYxMzgxODJHYkS0AAAAD3RFWHRUaHVtYjo6U2l6ZQAwQkKUoj7sAAAAVnRFWHRUaHVtYjo6VVJJAGZpbGU6Ly8vbW50bG9nL2Zhdmljb25zLzIwMjItMDYtMjUvNGU5YzJlYjRjNmRhMjIwZDgzYjcyOTYxZmI1ZTJiY2UuaWNvLnBuZ7tNVVEAAAAASUVORK5CYII=">
    </img>
</div>

<style>
    #VideoTogetherSamllIcon {
        display: none;
        z-index: 2147483647;
        position: fixed;
        bottom: 15px;
        right: 15px;
        text-align: center;
    }

    #videoTogetherFlyPannel input {
        line-height: 24px;
        font-size: 16px;
        width: 80%;
        border: 2px inset #d5d5d5;
        color: #424242;
        background: #fff;
        box-shadow: -1px -1px 0 0 #828282;
        margin-top: 8px;
        padding-left: 2px;
    }

    #videoTogetherFlyPannel input:focus {
        outline: 0 !important;
    }

    #videoTogetherFlyPannel button {
        line-height: 24px;
        margin-top: 4px;
        margin-bottom: 4px;
        margin-right: 4px;
        margin-left: 4px;
        border-width: 2px;
        border-style: outset;
        border-color: buttonface;
        border-right-color: #424242;
        border-bottom-color: #424242;
        background: silver;
        color: black;
        padding: 0 0 4px;
        border-radius: 1px;
    }

    #videoTogetherFlyPannel button:hover {
        border: 2px inset #fff;
        background: silver;
        color: #424242;
        box-shadow: -1px -1px #000;
    }

    #videoTogetherFlyPannel button:focus {
        border: 2px inset #fff !important;
        background: silver;
        color: #424242;
        box-shadow: -1px -1px #000 !important;
        outline: 0 !important;
        background: url(https://alexbsoft.github.io/win95.css/assets/background.bmp);
    }

    #videoTogetherFlyPannel button:active {
        border: 2px inset #fff !important;
        color: #424242;
        box-shadow: -1px -1px #000 !important;
        outline: 0 !important;
        background: url(https://alexbsoft.github.io/win95.css/assets/background.bmp);
    }

    #videoTogetherFlyPannel button {
        padding-left: 8px;
        padding-right: 8px;
    }

    #videoTogetherFlyPannel button:focus {
        outline: 1px dotted;
    }

    #videoTogetherFlyPannel {
        border: solid;
        border-width: 2px;
        border-bottom-color: #424242;
        border-right-color: #424242;
        border-left-color: #fff;
        border-top-color: #fff;
        background: silver;
        color: #212529;
    }

    #videoTogetherBody {
        flex: 1 1 auto;
        padding: 4px;
        display: block;

    }

    #videoTogetherFlyPannel #videoTogetherHeader p {
        color: #fff;
    }

    #videoTogetherFlyPannel #videoTogetherHeader {
        touch-action: none;
        align-items: center;
        display: flex;
        line-height: 20px;
        background: -webkit-linear-gradient(left, #08216b, #a5cef7);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-top: 2px;
        padding-left: 4px;
        padding-bottom: 1px;
        text-align: left;
        block-size: 25px
    }

    #videoTogetherFlyPannel {
        display: block;
        z-index: 2147483647;
        position: fixed;
        bottom: 15px;
        right: 15px;
        width: 250px;
        height: 200px;
        text-align: center;
    }

    #videoTogetherFlyPannel #videoTogetherTitle {
        margin-left: 4px;
    }

    #videoTogetherFlyPannel * {
        box-sizing: content-box;
        line-height: 24px;
        font-size: 16px;
        padding-left: 0px;
        padding-right: 0px;
        padding-top: 0px;
        padding-top: 0px;
        margin-top: 0px;
        margin-bottom: 0px;
    }
</style>`;
                document.querySelector("body").appendChild(wrapper);

                document.getElementById("videoTogetherMinimize").onclick = () => {
                    document.getElementById("videoTogetherFlyPannel").style.display = "none";
                    document.getElementById("VideoTogetherSamllIcon").style.display = "block"
                }
                document.getElementById("videoTogetherMaximize").onclick = () => {
                    document.getElementById("videoTogetherFlyPannel").style.display = "block";
                    document.getElementById("VideoTogetherSamllIcon").style.display = "none"
                }

                this.createRoomButton = document.querySelector('#videoTogetherCreateButton');
                this.joinRoomButton = document.querySelector("#videoTogetherJoinButton");
                this.exitButton = document.querySelector("#videoTogetherExitButton");
                this.helpButton = document.querySelector("#videoTogetherHelpButton");

                this.createRoomButton.onclick = this.CreateRoomButtonOnClick.bind(this);
                this.joinRoomButton.onclick = this.JoinRoomButtonOnClick.bind(this);
                this.helpButton.onclick = this.HelpButtonOnClick.bind(this);
                this.exitButton.onclick = (() => { window.videoTogetherExtension.exitRoom(); });
                this.inputRoomName = document.querySelector('#videoTogetherRoomNameInput');
                this.inputRoomPassword = document.querySelector("#videoTogetherRoomPasswordInput");

                this.statusText = document.querySelector("#videoTogetherStatusText");
                this.InLobby();
                this.Init();
            }

            try {
                document.querySelector("#videoTogetherLoading").remove()
            } catch { }
        }

        Init() {
            const data = this.GetSavedRoomInfo()
            if (data) {
                if (data.roomName) {
                    this.inputRoomName.value = data.roomName;
                }
                if (data.password) {
                    this.inputRoomPassword.value = data.roomName;
                }
            }
        }

        GetSavedRoomInfo() {
            try {
                const data = JSON.parse(sessionStorage.getItem(this.sessionKey) || '');
                if (data && (data.roomName || data.password)) {
                    return data;
                }
                return null;
            } catch {
                return null;
            }
        }

        SaveRoomInfo(roomName, password) {
            const data = JSON.stringify({ roomName, password });
            sessionStorage.setItem(this.sessionKey, data);
        }

        InRoom() {
            this.inputRoomName.disabled = true;
            this.createRoomButton.style = "display: None";
            this.joinRoomButton.style = "display: None";
            this.exitButton.style = "";
            this.inputRoomPassword.style.display = "None";
        }

        InLobby() {
            this.inputRoomName.disabled = false;
            this.inputRoomPassword.style.display = "inline-block";
            this.exitButton.style = "display: None"
            this.createRoomButton.style = "";
            this.joinRoomButton.style = "";
            this.exitButton.style = "display: None"
        }

        CreateRoomButtonOnClick() {
            let roomName = this.inputRoomName.value;
            let password = this.inputRoomPassword.value;
            this.SaveRoomInfo(roomName, password);
            window.videoTogetherExtension.CreateRoom(roomName, password)
        }

        JoinRoomButtonOnClick() {
            let roomName = this.inputRoomName.value;
            this.SaveRoomInfo(roomName);
            window.videoTogetherExtension.JoinRoom(roomName)
        }

        HelpButtonOnClick() {
            window.open('https://videotogether.github.io/guide/qa.html', '_blank');
        }

        UpdateStatusText(text, color) {
            this.statusText.innerHTML = text;
            this.statusText.style = "color:" + color;
        }
    }

    class VideoModel {
        constructor(id, duration, activatedTime, refreshTime, priority = 0) {
            this.id = id;
            this.duration = duration;
            this.activatedTime = activatedTime;
            this.refreshTime = refreshTime;
            this.priority = priority;
        }
    }

    let MessageType = {
        ActivatedVideo: 1,
        ReportVideo: 2,
        SyncMemberVideo: 3,
        SyncMasterVideo: 4,
        UpdateStatusText: 5,
        JumpToNewPage: 6,
        GetRoomData: 7
    }

    let VIDEO_EXPIRED_SECOND = 10

    class VideoWrapper {
        set currentTime(v) {
            this.currentTimeSetter(v);
        }
        get currentTime() {
            return this.currentTimeGetter();
        }
        set playbackRate(v) {
            this.playbackRateSetter(v);
        }
        get playbackRate() {
            return this.playbackRateGetter();
        }
        constructor(play, pause, paused, currentTimeGetter, currentTimeSetter, duration, playbackRateGetter, playbackRateSetter) {
            this.play = play;
            this.pause = pause;
            this.paused = paused;
            this.currentTimeGetter = currentTimeGetter;
            this.currentTimeSetter = currentTimeSetter;
            this.duration = duration;
            this.playbackRateGetter = playbackRateGetter;
            this.playbackRateSetter = playbackRateSetter;
        }
    }

    class VideoTogetherExtension {

        constructor() {
            this.RoleEnum = {
                Null: 1,
                Master: 2,
                Member: 3,
            }
            this.video_together_host = 'http://127.0.0.1:5000/';
            this.video_tag_names = ["video", "bwp-video"]
            this.timer = 0
            this.roomName = ""
            this.roomPassword = ""
            this.role = this.RoleEnum.Null
            this.url = ""
            this.duration = undefined
            this.serverTimestamp = 0;
            this.localTimestamp = 0;
            this.activatedVideo = undefined;

            this.isMain = (window.self == window.top);
            this.CreateVideoDomObserver();
            this.timer = setInterval(this.ScheduledTask.bind(this), 2 * 1000);
            this.videoMap = new Map();
            window.addEventListener('message', message => {
                this.processReceivedMessage(message.data.type, message.data.data);
            });
            this.SyncTimeWithServer();

            if (this.isMain) {
                try {
                    this.RecoveryState();
                    this.EnableDraggable();
                } catch (e) { console.error(e) }
            }
        }

        setRole(role) {
            this.role = role
            switch (role) {
                case this.RoleEnum.Master:
                    document.querySelector("#videoTogetherRoleText").innerHTML = "房主";
                    break;
                case this.RoleEnum.Member:
                    document.querySelector("#videoTogetherRoleText").innerHTML = "成员";
                    break;
                default:
                    document.querySelector("#videoTogetherRoleText").innerHTML = "";
                    break;
            }
        }

        generateUUID() {
            if (crypto.randomUUID != undefined) {
                return crypto.randomUUID();
            }
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        }

        sendMessageToTop(type, data) {
            window.top.postMessage({
                type: type,
                data: data
            }, "*")
        }

        sendMessageToSon(type, data) {
            let iframs = document.getElementsByTagName("iframe");
            for (let i = 0; i < iframs.length; i++) {
                iframs[i].contentWindow.postMessage({
                    type: type,
                    data: data
                }, "*");
                // console.info("send ", type, iframs[i].contentWindow, data)
            }
        }

        ForEachVideo(func) {
            try {
                // 腾讯视频
                if (window.__PLAYER__ != undefined) {
                    if (window.__PLAYER__.videoTogetherVideoWrapper == undefined) {
                        window.__PLAYER__.videoTogetherVideoWrapper = new VideoWrapper();
                    }
                    let videoWrapper = window.__PLAYER__.videoTogetherVideoWrapper;
                    videoWrapper.play = () => { window.__PLAYER__.corePlayer.play() };
                    videoWrapper.pause = () => { window.__PLAYER__.corePlayer.pause() };
                    videoWrapper.paused = window.__PLAYER__.paused;
                    videoWrapper.currentTimeGetter = () => window.__PLAYER__.currentVideoInfo.playtime;
                    videoWrapper.currentTimeSetter = (v) => { if (!videoWrapper.videoTogetherPaused) { window.__PLAYER__.seek(v) } };
                    videoWrapper.duration = window.__PLAYER__.currentVideoInfo.duration;
                    videoWrapper.playbackRateGetter = () => window.__PLAYER__.playbackRate;
                    videoWrapper.playbackRateSetter = (v) => window.__PLAYER__.playbackRate = v;
                    func(videoWrapper);
                }
            } catch (e) { console.error(e) };

            this.video_tag_names.forEach(tag => {
                let videos = document.getElementsByTagName(tag);
                for (let i = 0; i < videos.length; i++) {
                    try {
                        func(videos[i]);
                    } catch (e) { console.error(e) };
                }
            });
        }

        processReceivedMessage(type, data) {
            let _this = this;
            // console.info("get ", type, window.location, data);
            switch (type) {
                case MessageType.ActivatedVideo:
                    if (this.activatedVideo == undefined || this.activatedVideo.activatedTime < data.activatedTime) {
                        this.activatedVideo = data;
                    }
                    break;
                case MessageType.ReportVideo:
                    this.videoMap.set(data.id, data);
                    break;
                case MessageType.SyncMasterVideo:
                    this.ForEachVideo(video => {
                        if (video.VideoTogetherVideoId == data.video.id) {
                            try {
                                this.SyncMasterVideo(data, video);
                                _this.sendMessageToTop(MessageType.UpdateStatusText, { text: "同步成功" + _this.GetDisplayTimeText(), color: "green" });
                            } catch (e) {
                                _this.sendMessageToTop(MessageType.UpdateStatusText, { text: "同步异常" + e, color: "green" });
                            }
                        }
                    })
                    this.sendMessageToSon(type, data);
                    break;
                case MessageType.SyncMemberVideo:
                    this.ForEachVideo(video => {
                        if (video.VideoTogetherVideoId == data.video.id) {
                            try {
                                this.SyncMemberVideo(data, video);
                            } catch (e) {
                                _this.sendMessageToTop(MessageType.UpdateStatusText, { text: "同步异常" + e, color: "green" });
                            }
                        }
                    })
                    this.sendMessageToSon(type, data);
                    break;
                case MessageType.GetRoomData:
                    this.duration = data["duration"];
                    break;
                case MessageType.UpdateStatusText:
                    window.videoTogetherFlyPannel.UpdateStatusText(data.text, data.color);
                    break;
                case MessageType.JumpToNewPage:
                    window.location = data.url;
                    break;
                default:
                    // console.info("unhandled message:", type, data)
                    break;
            }
        }

        setActivatedVideoDom(videoDom) {
            if (videoDom.VideoTogetherVideoId == undefined) {
                videoDom.VideoTogetherVideoId = this.generateUUID();
            }
            this.sendMessageToTop(MessageType.ActivatedVideo, new VideoModel(videoDom.VideoTogetherVideoId, videoDom.duration, Date.now() / 1000, Date.now() / 1000));
        }

        addListenerMulti(el, s, fn) {
            s.split(' ').forEach(e => el.addEventListener(e, fn, false));
        }

        VideoClicked(e) {
            console.info("vide event: ", e.type);
            // maybe we need to check if the event is activated by user interaction
            this.setActivatedVideoDom(e.target);
        }

        AddVideoListener(videoDom) {
            if (this.VideoClickedListener == undefined) {
                this.VideoClickedListener = this.VideoClicked.bind(this)
            }
            let _this = this;
            this.addListenerMulti(videoDom, "play pause", this.VideoClickedListener);
        }

        // todo 腾讯视频
        CreateVideoDomObserver() {
            let _this = this;
            let observer = new WebKitMutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {

                        if (mutation.addedNodes[i].tagName == "VIDEO" || mutation.addedNodes[i].tagName == "BWP-VIDEO") {
                            console.info(mutation.addedNodes[i]);
                            try {
                                _this.AddVideoListener(mutation.addedNodes[i]);
                            } catch { }
                        }
                    }
                });
            });
            observer.observe(document.body, { childList: true, subtree: true })
            this.video_tag_names.forEach(vTag => {
                let videos = document.getElementsByTagName(vTag);
                for (let i = 0; i < videos.length; i++) {
                    this.AddVideoListener(videos[i]);
                }
            })
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
            console.info("recovery: ", window.location)
            function RecoveryStateFrom(getFunc) {
                let vtRole = getFunc("videoTogetherRole");
                let vtUrl = getFunc("videoTogetherUrl");
                let vtRoomName = getFunc("VideoTogetherRoomName");
                let timestamp = parseFloat(getFunc("videoTogetherTimestamp"));
                if (timestamp + 10 < Date.now() / 1000) {
                    return;
                }

                if (vtUrl != null && vtRoomName != null) {
                    if (vtRole == this.RoleEnum.Member) {
                        this.setRole(parseInt(vtRole));
                        this.url = vtUrl;
                        this.roomName = vtRoomName;
                        window.videoTogetherFlyPannel.inputRoomName.value = vtRoomName;
                        window.videoTogetherFlyPannel.InRoom();
                    }
                }
            }

            let url = new URL(window.location);

            let localTimestamp = window.sessionStorage.getItem("videoTogetherTimestamp");
            let urlTimestamp = url.searchParams.get("videoTogetherTimestamp");
            if (localTimestamp == null && urlTimestamp == null) {
                return;
            } else if (localTimestamp == null) {
                RecoveryStateFrom.bind(this)(key => url.searchParams.get(key));
            } else if (urlTimestamp == null) {
                RecoveryStateFrom.bind(this)(key => window.sessionStorage.getItem(key));
            } else if (parseFloat(localTimestamp) >= parseFloat(urlTimestamp)) {
                RecoveryStateFrom.bind(this)(key => window.sessionStorage.getItem(key));
            } else {
                RecoveryStateFrom.bind(this)(key => url.searchParams.get(key));
            }
        }

        async JoinRoom(name) {
            let data = this.GetRoom(name);
            this.roomName = name;
            this.setRole(this.RoleEnum.Member);
            window.videoTogetherFlyPannel.InRoom();
        }

        exitRoom() {
            this.duration = undefined;
            window.videoTogetherFlyPannel.inputRoomName.value = "";
            window.videoTogetherFlyPannel.inputRoomPassword.value = "";
            this.roomName = "";
            this.setRole(this.RoleEnum.Null);
            window.videoTogetherFlyPannel.InLobby();
        }

        async ScheduledTask() {
            let _this = this;
            try {
                this.ForEachVideo(video => {
                    if (video.VideoTogetherVideoId == undefined) {
                        video.VideoTogetherVideoId = _this.generateUUID();
                    }
                    if (video instanceof VideoWrapper) {
                        // ad hoc
                        this.sendMessageToTop(MessageType.ReportVideo, new VideoModel(video.VideoTogetherVideoId, video.duration, 0, Date.now() / 1000, 1));
                    } else {
                        this.sendMessageToTop(MessageType.ReportVideo, new VideoModel(video.VideoTogetherVideoId, video.duration, 0, Date.now() / 1000));
                    }
                })
                this.videoMap.forEach((video, id, map) => {
                    if (video.refreshTime + VIDEO_EXPIRED_SECOND < Date.now() / 1000) {
                        map.delete(id);
                    }
                })
            } catch { };

            try {
                if (this.serverTimestamp == 0) {
                    await this.SyncTimeWithServer();
                }
            } catch { };


            try {
                switch (this.role) {
                    case this.RoleEnum.Null:
                        return;
                    case this.RoleEnum.Master:
                        let video = this.GetVideoDom();
                        if (video == undefined) {
                            window.videoTogetherFlyPannel.UpdateStatusText("当前页面没有视频", "red");
                        } else {
                            this.sendMessageToTop(MessageType.SyncMasterVideo, { video: video, password: this.password, roomName: this.roomName, link: this.linkWithoutState(window.location) });
                        }
                        break;
                    case this.RoleEnum.Member:
                        let room = await this.GetRoom(this.roomName);
                        this.duration = room["duration"];
                        if (room["url"] != this.url) {
                            if (this.SaveStateToSessionStorageWhenSameOrigin(room["url"])) {
                                this.sendMessageToTop(MessageType.JumpToNewPage, { url: room["url"] });
                            } else {
                                this.sendMessageToTop(MessageType.JumpToNewPage, { url: this.linkWithMemberState(room["url"]).toString() });
                            }
                        }
                        this.sendMessageToTop(MessageType.SyncMemberVideo, { video: this.GetVideoDom(), roomName: this.roomName })
                        break;
                }
            } catch (error) {
                window.videoTogetherFlyPannel.UpdateStatusText("同步失败 " + this.GetDisplayTimeText(), "red");
            }
        }

        GetVideoDom() {
            let highPriorityVideo = undefined;
            this.videoMap.forEach(video => {
                if (video.priority > 0) {
                    highPriorityVideo = video;
                }
            })
            if (highPriorityVideo != undefined) {
                return highPriorityVideo;
            }
            if (this.role == this.RoleEnum.Master &&
                this.activatedVideo != undefined &&
                this.videoMap.get(this.activatedVideo.id) != undefined &&
                this.videoMap.get(this.activatedVideo.id).refreshTime + VIDEO_EXPIRED_SECOND >= Date.now() / 1000) {
                // do we need use this rule for member role? when multi closest videos?
                return this.activatedVideo;
            }

            let closest = 1e10;
            let closestVideo = undefined;
            let _this = this;
            this.videoMap.forEach((video, id) => {
                try {
                    if (_this.duration == undefined) {
                        closestVideo = video;
                        return;
                    }
                    if (Math.abs(video.duration - _this.duration) < closest) {
                        closest = Math.abs(video.duration - _this.duration);
                        closestVideo = video;
                    }
                } catch (e) { console.error(e); }
            });
            return closestVideo;
        }

        // TODO The poll task works really good currently.
        // But we can sync when video event is traggered to enhance the performance
        // and reduce server workload
        async SyncMasterVideo(data, videoDom) {
            this.UpdateRoom(data.roomName,
                data.password,
                data.link,
                videoDom.playbackRate,
                videoDom.currentTime,
                videoDom.paused,
                videoDom.duration);
            window.videoTogetherFlyPannel.UpdateStatusText("同步成功 " + this.GetDisplayTimeText(), "green");
        }

        linkWithoutState(link) {
            let url = new URL(link);
            url.searchParams.delete("videoTogetherUrl");
            url.searchParams.delete("VideoTogetherRoomName");
            url.searchParams.delete("videoTogetherRole");
            return url.toString();
        }

        SaveStateToSessionStorageWhenSameOrigin(link) {
            try {
                let url = new URL(link);
                let currentUrl = new URL(window.location);
                if (url.origin == currentUrl.origin) {
                    window.sessionStorage.setItem("videoTogetherUrl", link);
                    window.sessionStorage.setItem("VideoTogetherRoomName", this.roomName);
                    window.sessionStorage.setItem("videoTogetherRole", this.role);
                    window.sessionStorage.setItem("videoTogetherTimestamp", Date.now() / 1000);
                    return true;
                } else {
                    return false;
                }
            } catch (e) { console.error(e); }
        }

        linkWithMemberState(link) {
            let url = new URL(link);
            let tmpSearch = url.search;
            url.search = "";
            if (link.toLowerCase().includes("youtube")) {
                url.searchParams.set("app", "desktop");
            }
            url.searchParams.set("videoTogetherUrl", link);
            url.searchParams.set("VideoTogetherRoomName", this.roomName);
            url.searchParams.set("videoTogetherRole", this.role);
            url.searchParams.set("videoTogetherTimestamp", Date.now() / 1000);
            let urlStr = url.toString();
            if (tmpSearch.length > 1) {
                urlStr = urlStr + "&" + tmpSearch.slice(1);
            }
            return new URL(urlStr);
        }

        CalculateRealCurrent(data) {
            return data["currentTime"] + this.getLocalTimestamp() - data["lastUpdateClientTime"];
        }

        GetDisplayTimeText() {
            let date = new Date();
            return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        }

        async SyncMemberVideo(data, videoDom) {
            let room = await this.GetRoom(data.roomName);
            this.sendMessageToTop(MessageType.GetRoomData, room);

            // useless
            this.duration = room["duration"];
            // useless
            if (videoDom == undefined) {
                throw new Error("没有视频");
            }

            if (room["paused"] == false) {
                videoDom.videoTogetherPaused = false;
                if (Math.abs(videoDom.currentTime - this.CalculateRealCurrent(room)) > 1) {
                    videoDom.currentTime = this.CalculateRealCurrent(room);
                }
            } else {
                videoDom.videoTogetherPaused = true;
                if (Math.abs(videoDom.currentTime - room["currentTime"]) > 0.1) {
                    videoDom.currentTime = room["currentTime"];
                }
            }
            if (videoDom.paused != room["paused"]) {
                if (room["paused"]) {
                    console.info("pause");
                    videoDom.pause();
                } else {
                    try {
                        console.info("play");
                        await videoDom.play();
                    } catch (e) {
                        this.sendMessageToTop(MessageType.UpdateStatusText, { text: "自动播放失败，手动点击播放", color: "red" })
                        return;
                    }
                }
            }
            if (videoDom.playbackRate != room["playbackRate"]) {
                videoDom.playbackRate = room["playbackRate"];
            }
            this.sendMessageToTop(MessageType.UpdateStatusText, { text: "同步成功 " + this.GetDisplayTimeText(), color: "green" })
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
            let data = await this.UpdateRoom(name, password, url, 1, 0, true, 0);
            this.setRole(this.RoleEnum.Master);
            this.roomName = name;
            this.password = password;
            window.videoTogetherFlyPannel.InRoom();
        }

        async UpdateRoom(name, password, url, playbackRate, currentTime, paused, duration) {
            let apiUrl = new URL(this.video_together_host + "/room/update");
            apiUrl.searchParams.set("name", name);
            apiUrl.searchParams.set("password", password);
            apiUrl.searchParams.set("playbackRate", playbackRate);
            apiUrl.searchParams.set("currentTime", currentTime);
            apiUrl.searchParams.set("paused", paused);
            apiUrl.searchParams.set("url", url);
            apiUrl.searchParams.set("lastUpdateClientTime", this.getLocalTimestamp());
            apiUrl.searchParams.set("duration", duration);
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

        EnableDraggable() {
            function filter(e) {
                let target = undefined;
                if (document.querySelector("#videoTogetherHeader").contains(e.target)) {
                    target = document.querySelector("#videoTogetherFlyPannel");
                } else {
                    return;
                }


                target.videoTogetherMoving = true;

                if (e.clientX) {
                    target.oldX = e.clientX;
                    target.oldY = e.clientY;
                } else {
                    target.oldX = e.touches[0].clientX;
                    target.oldY = e.touches[0].clientY;
                }

                target.oldLeft = window.getComputedStyle(target).getPropertyValue('left').split('px')[0] * 1;
                target.oldTop = window.getComputedStyle(target).getPropertyValue('top').split('px')[0] * 1;

                document.onmousemove = dr;
                document.ontouchmove = dr;

                function dr(event) {

                    if (!target.videoTogetherMoving) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.clientX) {
                        target.distX = event.clientX - target.oldX;
                        target.distY = event.clientY - target.oldY;
                    } else {
                        target.distX = event.touches[0].clientX - target.oldX;
                        target.distY = event.touches[0].clientY - target.oldY;
                    }

                    target.style.left = Math.min(document.documentElement.clientWidth - target.clientWidth, Math.max(0, target.oldLeft + target.distX)) + "px";
                    target.style.top = Math.min(document.documentElement.clientHeight - target.clientHeight, Math.max(0, target.oldTop + target.distY)) + "px";

                    window.addEventListener('resize', function (event) {
                        target.oldLeft = window.getComputedStyle(target).getPropertyValue('left').split('px')[0] * 1;
                        target.oldTop = window.getComputedStyle(target).getPropertyValue('top').split('px')[0] * 1;
                        target.style.left = Math.min(document.documentElement.clientWidth - target.clientWidth, Math.max(0, target.oldLeft)) + "px";
                        target.style.top = Math.min(document.documentElement.clientHeight - target.clientHeight, Math.max(0, target.oldTop)) + "px";
                    });
                }

                function endDrag() {
                    target.videoTogetherMoving = false;
                }
                target.onmouseup = endDrag;
                target.ontouchend = endDrag;
            }
            document.onmousedown = filter;
            document.ontouchstart = filter;
        }
    }

    // TODO merge Pannel and Extension class
    if (window.videoTogetherFlyPannel === undefined) {
        window.videoTogetherFlyPannel = null;
        window.videoTogetherFlyPannel = new VideoTogetherFlyPannel();
    }
    if (window.videoTogetherExtension === undefined) {
        window.videoTogetherExtension = null;
        window.videoTogetherExtension = new VideoTogetherExtension();
    }
    try {
        document.querySelector("#videoTogetherLoading").remove()
    } catch { }
})()
