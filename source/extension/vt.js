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
                wrapper.innerHTML = `{{{ {"user": "./html/pannel.html","order":100} }}}`;
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
                this.inputRoomNameLabel = document.querySelector('#videoTogetherRoomNameLabel');
                this.inputRoomPasswordLabel = document.querySelector("#videoTogetherRoomPasswordLabel");

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
            this.inputRoomPasswordLabel.style.display = "None";
            this.inputRoomPassword.style.display = "None";
        }

        InLobby() {
            this.inputRoomName.disabled = false;
            this.inputRoomPasswordLabel.style.display = "inline-block";
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
            this.video_together_host = '{{{ {"":"./config/release_host","debug":"./config/debug_host","order":0} }}}';
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
