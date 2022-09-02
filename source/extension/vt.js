// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    https://2gether.video/
// @version      {{timestamp}}
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://2gether.video/icon/favicon-32x32.png
// @grant        none
// ==/UserScript==

(function () {
    class VideoTogetherFlyPannel {
        constructor() {
            this.sessionKey = "VideoTogetherFlySaveSessionKey";
            this.isInRoom = false;

            this.isMain = (window.self == window.top);
            if (this.isMain) {
                window.addEventListener("message", e => {
                    if (window.VideoTogetherSettingEnabled) {
                        return;
                    }
                    if (e.data.type == MessageType.LoadStorageData) {
                        if (!this.disableDefaultSize) {
                            if (e.data.data.MinimiseDefault) {
                                this.Minimize();
                            } else {
                                this.Maximize();
                            }
                            this.disableDefaultSize = false;
                        }
                        window.VideoTogetherStorage = e.data.data;
                    }
                    if (e.data.type == MessageType.SyncStorageData) {
                        window.VideoTogetherStorage = e.data.data;
                    }
                });
                let wrapper = document.createElement("div");
                wrapper.innerHTML = `{{{ {"user": "./html/pannel.html","order":100} }}}`;
                (document.body || document.documentElement).appendChild(wrapper);

                document.getElementById("videoTogetherMinimize").onclick = this.Minimize.bind(this);
                document.getElementById("videoTogetherMaximize").onclick = this.Maximize.bind(this);

                this.createRoomButton = document.querySelector('#videoTogetherCreateButton');
                this.joinRoomButton = document.querySelector("#videoTogetherJoinButton");
                this.exitButton = document.querySelector("#videoTogetherExitButton");
                this.voiceButton = document.querySelector("#videoTogetherVoiceButton");
                this.voiceButton.onclick = this.JoinVoiceRoom.bind(this);
                this.helpButton = document.querySelector("#videoTogetherHelpButton");

                this.createRoomButton.onclick = this.CreateRoomButtonOnClick.bind(this);
                this.joinRoomButton.onclick = this.JoinRoomButtonOnClick.bind(this);
                this.helpButton.onclick = this.HelpButtonOnClick.bind(this);
                this.exitButton.onclick = (() => {
                    try {
                        document.querySelector("#videoTogetherVoiceIframe").remove();
                    } catch (e) { console.error(e); }
                    window.videoTogetherExtension.exitRoom();
                });
                this.inputRoomName = document.querySelector('#videoTogetherRoomNameInput');
                this.inputRoomPassword = document.querySelector("#videoTogetherRoomPasswordInput");
                this.inputRoomNameLabel = document.querySelector('#videoTogetherRoomNameLabel');
                this.inputRoomPasswordLabel = document.querySelector("#videoTogetherRoomPasswordLabel");
                this.videoTogetherVideoVolumeDown = document.querySelector("#videoTogetherVideoVolumeDown");
                this.videoTogetherVideoVolumeUp = document.querySelector("#videoTogetherVideoVolumeUp");
                this.videoTogetherVideoVolumeDown.onclick = () => {
                    this.volume -= 0.1;
                    this.volume = Math.max(0, this.volume);
                    window.videoTogetherExtension.sendMessageToTop(MessageType.ChangeVideoVolume, { volume: this.volume })
                }
                this.videoTogetherVideoVolumeUp.onclick = () => {
                    this.volume += 0.1;
                    this.volume = Math.min(1, this.volume);
                    window.videoTogetherExtension.sendMessageToTop(MessageType.ChangeVideoVolume, { volume: this.volume })
                }
                this.volume = 1;
                this.statusText = document.querySelector("#videoTogetherStatusText");
                this.InLobby(true);
                this.Init();
            }

            try {
                document.querySelector("#videoTogetherLoading").remove()
            } catch { }
        }

        Minimize() {
            this.SaveIsMinimized(true);
            this.disableDefaultSize = true;
            document.getElementById("videoTogetherFlyPannel").style.display = "none";
            document.getElementById("videoTogetherSamllIcon").style.display = "block"
        }

        Maximize() {
            this.SaveIsMinimized(false);
            this.disableDefaultSize = true;
            document.getElementById("videoTogetherFlyPannel").style.display = "block";
            document.getElementById("videoTogetherSamllIcon").style.display = "none"
        }

        SaveIsMinimized(minimized) {
            localStorage.setItem("VideoTogetherMinimizedHere", minimized ? 1 : 0)
        }

        Init() {
            let VideoTogetherMinimizedHere = localStorage.getItem("VideoTogetherMinimizedHere");
            if (VideoTogetherMinimizedHere == 0) {
                this.Maximize();
            } else if (VideoTogetherMinimizedHere == 1) {
                this.Minimize();
            }
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

        JoinVoiceRoom() {
            this.Maximize();
            try {
                document.querySelector("#videoTogetherVoiceIframe").remove();
            } catch (e) { console.error(e); }
            let roomName = "VideoTogether_" + this.inputRoomName.value;
            alert("{$voice_call_experimental_alert$}");
            let voiceRoomIframe = document.createElement("iframe");
            let url = new URL("https://voice.2gether.video");
            url.searchParams.set("room", roomName);
            voiceRoomIframe.src = url;
            voiceRoomIframe.id = "videoTogetherVoiceIframe"
            voiceRoomIframe.allow = "camera;microphone"
            voiceRoomIframe.style.display = "None";
            document.body.appendChild(voiceRoomIframe);
            this.voiceButton.style = "display: None";
            this.videoTogetherVideoVolumeDown.style = "";
            this.videoTogetherVideoVolumeUp.style = "";
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
            this.Maximize();
            this.inputRoomName.disabled = true;
            this.createRoomButton.style = "display: None";
            this.joinRoomButton.style = "display: None";
            this.exitButton.style = "";
            this.voiceButton.style = "";
            this.inputRoomPasswordLabel.style.display = "None";
            this.inputRoomPassword.style.display = "None";
            this.videoTogetherVideoVolumeDown.style = "display: None";
            this.videoTogetherVideoVolumeUp.style = "display: None";
            this.isInRoom = true;
        }

        InLobby(init = false) {
            if (!init) {
                this.Maximize();
            }
            this.inputRoomName.disabled = false;
            this.inputRoomPasswordLabel.style.display = "inline-block";
            this.inputRoomPassword.style.display = "inline-block";
            this.createRoomButton.style = "";
            this.joinRoomButton.style = "";
            this.exitButton.style = "display: None";
            this.voiceButton.style = "display: None";
            this.videoTogetherVideoVolumeDown.style = "display: None";
            this.videoTogetherVideoVolumeUp.style = "display: None";
            this.isInRoom = false;
        }

        CreateRoomButtonOnClick() {
            this.Maximize();
            let roomName = this.inputRoomName.value;
            let password = this.inputRoomPassword.value;
            this.SaveRoomInfo(roomName, password);
            window.videoTogetherExtension.CreateRoom(roomName, password);
        }

        JoinRoomButtonOnClick() {
            this.Maximize();
            let roomName = this.inputRoomName.value;
            let password = this.inputRoomPassword.value;
            this.SaveRoomInfo(roomName, password);
            window.videoTogetherExtension.JoinRoom(roomName, password);
        }

        HelpButtonOnClick() {
            this.Maximize();
            window.open('https://2gether.video/guide/qa.html', '_blank');
        }

        UpdateStatusText(text, color) {
            this.statusText.innerHTML = text;
            this.statusText.style.color = color;
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
        GetRoomData: 7,
        ChangeVoiceVolume: 8,
        ChangeVideoVolume: 9,

        // will be deprecated
        LoadStorageData: 10,
        SyncStorageData: 11,
        SetStorageData: 12,
        // --------------------

        FetchRequest: 13,
        FetchResponse: 14,

        SetStorageValue: 15,
        SyncStorageValue: 16,

        ExtensionInitSuccess: 17,

        SetTabStorage: 18,
        SetTabStorageSuccess: 19,
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
            this.cspBlockedHost = {};
            // TODO clear
            this.rspMap = {};
            this.video_together_host = '{{{ {"":"./config/release_host","debug":"./config/debug_host","order":0} }}}';
            this.video_together_backup_host = 'https://api.chizhou.in/';
            this.video_tag_names = ["video", "bwp-video"]

            this.timer = 0
            this.roomName = ""
            this.roomPassword = ""
            this.role = this.RoleEnum.Null
            this.url = ""
            this.duration = undefined

            this.minTrip = 1e9;
            this.timeOffset = 0;

            this.activatedVideo = undefined;
            this.tempUser = this.generateUUID();
            this.version = '{{timestamp}}';
            this.isMain = (window.self == window.top);
            this.UserId = undefined;

            this.allLinksTargetModified = false;

            // we need a common callback function to deal with all message
            this.SetTabStorageSuccessCallback = () => { };
            document.addEventListener("securitypolicyviolation", (e) => {
                let host = (new URL(e.blockedURI)).host;
                this.cspBlockedHost[host] = true;
            });
            try {
                this.CreateVideoDomObserver();
            } catch { }
            this.timer = setInterval(this.ScheduledTask.bind(this), 2 * 1000);
            this.videoMap = new Map();
            window.addEventListener('message', message => {
                if (message.data.context) {
                    this.tempUser = message.data.context.tempUser;
                    this.videoTitle = message.data.context.videoTitle;
                    window.VideoTogetherStorage = message.data.context.VideoTogetherStorage;
                }
                this.processReceivedMessage(message.data.type, message.data.data);
            });
            window.addEventListener('click', message => {
                setTimeout(this.ScheduledTask.bind(this), 200);
            })
            this.RunWithRetry(this.SyncTimeWithServer.bind(this), 2);

            if (this.isMain) {
                try {
                    try {
                        this.RecoveryState();
                    } catch { };
                    this.EnableDraggable();

                    setTimeout(() => {
                        let allDoms = document.querySelectorAll("*");
                        for (let i = 0; i < allDoms.length; i++) {
                            const cssObj = window.getComputedStyle(allDoms[i], null);
                            if (cssObj.getPropertyValue("z-index") == 2147483647 && !allDoms[i].id.startsWith("videoTogether")) {
                                allDoms[i].style.zIndex = 2147483646;
                            }
                        }
                    }, 2000);
                } catch (e) { console.error(e) }
            }
            setTimeout(() => {
                // fall back to china service
                if (this.minTrip == 1e9) {
                    this.video_together_host = this.video_together_backup_host;
                }
            }, 3000);
        }

        setRole(role) {
            this.role = role
            switch (role) {
                case this.RoleEnum.Master:
                    document.querySelector("#videoTogetherRoleText").innerHTML = "{$host_role$}";
                    break;
                case this.RoleEnum.Member:
                    document.querySelector("#videoTogetherRoleText").innerHTML = "{$memeber_role$}";
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

        PostMessage(window, data) {
            if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.postMessage))) {
                window.postMessage(data, "*");
            } else {
                if (!this.NativePostMessageFunction) {
                    let temp = document.createElement("iframe");
                    temp.style.display = 'None';
                    document.body.append(temp);
                    this.NativePostMessageFunction = temp.contentWindow.postMessage;
                }
                this.NativePostMessageFunction.call(window, data, "*");
            }
        }

        async Fetch(url) {
            url = new URL(url);
            url.searchParams.set("version", this.version);
            try {
                url.searchParams.set("loaddingVersion", window.VideoTogetherStorage.LoaddingVersion);
            } catch (e) { }
            try {
                url.searchParams.set("userId", window.VideoTogetherStorage.PublicUserId);
            } catch (e) { }
            url = url.toString();
            let host = (new URL(url)).host;
            if (this.cspBlockedHost[host]) {
                let id = this.generateUUID()
                this.sendMessageToTop(MessageType.FetchRequest, {
                    id: id,
                    url: url.toString(),
                    method: "GET",
                    data: null,
                });
                return await new Promise((resolve, reject) => {
                    let intervalId = setInterval(() => {
                        if (this.rspMap[id] != undefined) {
                            resolve({ json: () => this.rspMap[id], status: 200 });
                        }
                    }, 200);
                    setTimeout(() => {
                        clearInterval(intervalId);
                        reject(new Error("{$timeout$}"));
                    }, 5000);
                });
            }
            if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.fetch))) {
                return await window.fetch(url);
            } else {
                if (!this.NativeFetchFunction) {
                    let temp = document.createElement("iframe");
                    temp.style.display = 'None';
                    document.body.append(temp);
                    this.NativeFetchFunction = temp.contentWindow.fetch;
                }
                return await this.NativeFetchFunction.call(window, url);
            }
        }

        sendMessageToTop(type, data) {
            this.PostMessage(window.top, {
                source: "VideoTogether",
                type: type,
                data: data
            });
        }

        sendMessageToSelf(type, data) {
            this.PostMessage(window, {
                source: "VideoTogether",
                type: type,
                data: data
            });
        }

        sendMessageToSon(type, data) {
            let iframs = document.getElementsByTagName("iframe");
            for (let i = 0; i < iframs.length; i++) {
                this.PostMessage(iframs[i].contentWindow, {
                    source: "VideoTogether",
                    type: type,
                    data: data,
                    context: {
                        tempUser: this.tempUser,
                        videoTitle: this.isMain ? document.title : this.videoTitle,
                        VideoTogetherStorage: window.VideoTogetherStorage
                    }
                });
                // console.info("send ", type, iframs[i].contentWindow, data)
            }
        }

        async ForEachVideo(func) {
            try {
                // Netflix
                if (window.location.host.includes("netflix")) {
                    try {
                        let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
                        let player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);
                        if (!player.videoTogetherVideoWrapper) {
                            player.videoTogetherVideoWrapper = new VideoWrapper();
                        }
                        let videoWrapper = player.videoTogetherVideoWrapper;
                        videoWrapper.play = async () => await player.play();
                        videoWrapper.pause = async () => await player.pause();
                        videoWrapper.paused = player.isPaused()
                        videoWrapper.currentTimeGetter = () => player.getCurrentTime() / 1000;
                        videoWrapper.currentTimeSetter = (v) => player.seek(1000 * v);
                        videoWrapper.duration = player.getDuration() / 1000;
                        videoWrapper.playbackRateGetter = () => player.getPlaybackRate();
                        videoWrapper.playbackRateSetter = (v) => { player.setPlaybackRate(v) };
                        await func(videoWrapper);
                    } catch (e) { }
                }
                // 百度网盘
                if (window.location.host.includes('pan.baidu.com')) {
                    if (!this.BaiduPanPlayer) {
                        for (let key in window["$"]["cache"]) {
                            try {
                                if (window["$"]["cache"][key]["handle"]["elem"].player) {
                                    this.BaiduPanPlayer = window["$"]["cache"][key]["handle"]["elem"].player;
                                    break;
                                }
                            } catch { }
                        }
                    }
                    if (this.BaiduPanPlayer) {
                        if (!this.BaiduPanPlayer.videoTogetherVideoWrapper) {
                            this.BaiduPanPlayer.videoTogetherVideoWrapper = new VideoWrapper();
                        }
                        let videoWrapper = this.BaiduPanPlayer.videoTogetherVideoWrapper;
                        videoWrapper.play = async () => await this.BaiduPanPlayer.play();
                        videoWrapper.pause = async () => await this.BaiduPanPlayer.pause();
                        videoWrapper.paused = this.BaiduPanPlayer.paused();
                        videoWrapper.currentTimeGetter = () => this.BaiduPanPlayer.currentTime();
                        videoWrapper.currentTimeSetter = (v) => this.BaiduPanPlayer.currentTime(v);
                        videoWrapper.duration = this.BaiduPanPlayer.duration();
                        videoWrapper.playbackRateGetter = () => { };
                        videoWrapper.playbackRateSetter = (v) => { };
                        await func(videoWrapper);
                    }
                }
            } catch (e) { }
            try {
                // 腾讯视频
                if (window.__PLAYER__ != undefined) {
                    if (window.__PLAYER__.videoTogetherVideoWrapper == undefined) {
                        window.__PLAYER__.videoTogetherVideoWrapper = new VideoWrapper();
                    }
                    let videoWrapper = window.__PLAYER__.videoTogetherVideoWrapper;
                    videoWrapper.play = async () => await window.__PLAYER__.corePlayer.play();
                    videoWrapper.pause = async () => await window.__PLAYER__.corePlayer.pause();
                    videoWrapper.paused = window.__PLAYER__.paused;
                    videoWrapper.currentTimeGetter = () => window.__PLAYER__.currentVideoInfo.playtime;
                    videoWrapper.currentTimeSetter = (v) => { if (!videoWrapper.videoTogetherPaused) { window.__PLAYER__.seek(v) } };
                    videoWrapper.duration = window.__PLAYER__.currentVideoInfo.duration;
                    videoWrapper.playbackRateGetter = () => window.__PLAYER__.playbackRate;
                    videoWrapper.playbackRateSetter = (v) => window.__PLAYER__.playbackRate = v;
                    await func(videoWrapper);
                }
            } catch (e) { };

            // baidupan vip
            try {
                let video = document.getElementById("video-root").shadowRoot.getElementById("html5player_html5_api");
                if (video != undefined) {
                    await func(video);
                }
            } catch (e) { };
            this.video_tag_names.forEach(async tag => {
                let videos = document.getElementsByTagName(tag);
                for (let i = 0; i < videos.length; i++) {
                    try {
                        await func(videos[i]);
                    } catch (e) { console.error(e) };
                }
            });
        }

        UpdateStatusText(text, color) {
            if (window.self != window.top) {
                this.sendMessageToTop(MessageType.UpdateStatusText, { text: text + "", color: color });
            } else {
                window.videoTogetherFlyPannel.UpdateStatusText(text + "", color);
            }
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
                    this.ForEachVideo(async video => {
                        if (video.VideoTogetherVideoId == data.video.id) {
                            try {
                                await this.SyncMasterVideo(data, video);
                                _this.UpdateStatusText("{$sync_success$} " + _this.GetDisplayTimeText(), "green");
                            } catch (e) {
                                this.UpdateStatusText(e, "red");
                            }
                        }
                    })
                    this.sendMessageToSon(type, data);
                    break;
                case MessageType.SyncMemberVideo:
                    this.ForEachVideo(async video => {
                        if (video.VideoTogetherVideoId == data.video.id) {
                            try {
                                await this.SyncMemberVideo(data, video);
                            } catch (e) {
                                _this.UpdateStatusText(e, "red");
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
                case MessageType.ChangeVideoVolume:
                    this.ForEachVideo(video => {
                        video.volume = data.volume;
                    });
                    this.sendMessageToSon(type, data);
                case MessageType.FetchResponse: {
                    if (data.data) {
                        this.rspMap[data.id] = data.data;
                        setTimeout(() => {
                            delete this.rspMap[data.id];
                        }, 5 * 1000);
                    } else {

                    }
                    break;
                }
                case MessageType.SyncStorageValue: {
                    window.VideoTogetherStorage = data;
                    try {
                        this.RecoveryState()
                    } catch (e) { };

                    if (!window.videoTogetherFlyPannel.disableDefaultSize && !window.VideoTogetherSettingEnabled) {
                        if (data.MinimiseDefault) {
                            window.videoTogetherFlyPannel.Minimize();
                        } else {
                            window.videoTogetherFlyPannel.Maximize();
                        }
                    }
                    if (typeof (data.PublicUserId) != 'string' || data.PublicUserId.length < 5) {
                        this.sendMessageToTop(MessageType.SetStorageValue, { key: "PublicUserId", value: this.generateUUID() });
                    }
                    if (window.VideoTogetherSettingEnabled == undefined) {
                        try {
                            document.getElementById('videoTogetherSetting').href = "https://setting.2gether.video/v2.html";
                        } catch (e) { }
                    }
                    window.VideoTogetherSettingEnabled = true;
                    break;
                }
                case MessageType.SetTabStorageSuccess: {
                    this.SetTabStorageSuccessCallback();
                    break;
                }
                default:
                    // console.info("unhandled message:", type, data)
                    break;
            }
        }

        openAllLinksInSelf() {
            let hrefs = document.getElementsByTagName("a");
            for (let i = 0; i < hrefs.length; i++) {
                hrefs[i].target = "_self";
            }
        }

        async RunWithRetry(func, count) {
            for (let i = 0; i < count; i++) {
                try {
                    return await func();
                } catch (e) { };
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
                            try {
                                _this.AddVideoListener(mutation.addedNodes[i]);
                            } catch { }
                        }

                        try {
                            if (window.VideoTogetherStorage.OpenAllLinksInSelf != false && _this.role != _this.RoleEnum.Null) {
                                if (mutation.addedNodes[i].tagName == "A") {
                                    mutation.addedNodes[i].target = "_self";
                                }
                                let links = mutation.addedNodes[i].getElementsByTagName("a");
                                for (let i = 0; i < links.length; i++) {
                                    links[i].target = "_self";
                                }
                            }
                        } catch { }
                    }
                });
            });
            observer.observe(document.body || document.documentElement, { childList: true, subtree: true })
            this.video_tag_names.forEach(vTag => {
                let videos = document.getElementsByTagName(vTag);
                for (let i = 0; i < videos.length; i++) {
                    this.AddVideoListener(videos[i]);
                }
            })
        }

        getLocalTimestamp() {
            return Date.now() / 1000 + this.timeOffset;
        }

        async SyncTimeWithServer() {
            let startTime = Date.now() / 1000;
            let response = await this.Fetch(this.video_together_host + "/timestamp");
            let endTime = Date.now() / 1000;
            let data = await this.CheckResponse(response);
            this.UpdateTimestampIfneeded(data["timestamp"], startTime, endTime);
        }

        RecoveryState() {
            if (this.recovered) {
                return;
            }
            this.recovered = true;
            function RecoveryStateFrom(getFunc) {
                let vtRole = getFunc("VideoTogetherRole");
                let vtUrl = getFunc("VideoTogetherUrl");
                let vtRoomName = getFunc("VideoTogetherRoomName");
                let timestamp = parseFloat(getFunc("VideoTogetherTimestamp"));
                let password = getFunc("VideoTogetherPassword");
                if (timestamp + 60 < Date.now() / 1000) {
                    return;
                }

                if (vtUrl != null && vtRoomName != null) {
                    if (vtRole == this.RoleEnum.Member || vtRole == this.RoleEnum.Master) {
                        this.setRole(parseInt(vtRole));
                        this.url = vtUrl;
                        this.roomName = vtRoomName;
                        this.password = password;
                        window.videoTogetherFlyPannel.inputRoomName.value = vtRoomName;
                        window.videoTogetherFlyPannel.inputRoomPassword.value = password;
                        window.videoTogetherFlyPannel.InRoom();
                    }
                }
            }

            let url = new URL(window.location);
            if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                try {
                    RecoveryStateFrom.bind(this)(key => window.VideoTogetherStorage.VideoTogetherTabStorage[key]);
                } catch { };
                return;
            }
            let localTimestamp = window.sessionStorage.getItem("VideoTogetherTimestamp");
            let urlTimestamp = url.searchParams.get("VideoTogetherTimestamp");
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

        async JoinRoom(name, password) {
            try {
                this.tempUser = this.generateUUID();
                let data = await this.RunWithRetry(async () => await this.GetRoom(name, password), 2);
                this.roomName = name;
                this.password = password;
                this.setRole(this.RoleEnum.Member);
                window.videoTogetherFlyPannel.InRoom();
            } catch (e) {
                this.UpdateStatusText(e, "red");
            }
        }

        exitRoom() {
            this.duration = undefined;
            window.videoTogetherFlyPannel.inputRoomName.value = "";
            window.videoTogetherFlyPannel.inputRoomPassword.value = "";
            this.roomName = "";
            this.setRole(this.RoleEnum.Null);
            window.videoTogetherFlyPannel.InLobby();
            let state = this.GetRoomState("");
            this.sendMessageToTop(MessageType.SetTabStorage, state);
            this.SaveStateToSessionStorageWhenSameOrigin("");
        }

        async ScheduledTask() {
            let _this = this;
            try {
                await this.ForEachVideo(video => {
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
                if (this.minTrip == 1e9) {
                    await this.SyncTimeWithServer();
                }
            } catch { };

            if (this.role != this.RoleEnum.Null) {
                try {
                    if (window.VideoTogetherStorage.OpenAllLinksInSelf != false && !this.allLinksTargetModified) {
                        this.allLinksTargetModified = true;
                        this.openAllLinksInSelf();
                    }
                } catch { }
            }

            try {
                switch (this.role) {
                    case this.RoleEnum.Null:
                        return;
                    case this.RoleEnum.Master: {
                        if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                            let state = this.GetRoomState("");
                            this.sendMessageToTop(MessageType.SetTabStorage, state);
                        }
                        this.SaveStateToSessionStorageWhenSameOrigin("");
                        let video = this.GetVideoDom();
                        if (video == undefined) {
                            await this.UpdateRoom(this.roomName,
                                this.password,
                                this.linkWithoutState(window.location),
                                1,
                                0,
                                true,
                                1e9);
                            throw new Error("{$no_video_in_this_page$}");
                        } else {
                            this.sendMessageToTop(MessageType.SyncMasterVideo, { video: video, password: this.password, roomName: this.roomName, link: this.linkWithoutState(window.location) });
                        }
                        break;
                    }
                    case this.RoleEnum.Member: {
                        let room = await this.GetRoom(this.roomName, this.password);
                        this.duration = room["duration"];
                        if (room["url"] != this.url && (window.VideoTogetherStorage == undefined || !window.VideoTogetherStorage.DisableRedirectJoin)) {
                            if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                                let state = this.GetRoomState(room["url"]);
                                this.sendMessageToTop(MessageType.SetTabStorage, state);
                                setInterval(() => {
                                    if (window.VideoTogetherStorage.VideoTogetherTabStorage.VideoTogetherUrl == room["url"]) {
                                        this.SetTabStorageSuccessCallback = () => {
                                            this.sendMessageToTop(MessageType.JumpToNewPage, { url: room["url"] });
                                        }
                                    }
                                }, 200);
                            } else {
                                if (this.SaveStateToSessionStorageWhenSameOrigin(room["url"])) {
                                    this.sendMessageToTop(MessageType.JumpToNewPage, { url: room["url"] });
                                } else {
                                    this.sendMessageToTop(MessageType.JumpToNewPage, { url: this.linkWithMemberState(room["url"]).toString() });
                                }
                            }
                        } else {
                            let state = this.GetRoomState("");
                            this.sendMessageToTop(MessageType.SetTabStorage, state);
                            this.SaveStateToSessionStorageWhenSameOrigin("");
                        }
                        let video = this.GetVideoDom();
                        if (video == undefined) {
                            throw new Error("{$no_video_in_this_page$}");
                        } else {
                            this.sendMessageToTop(MessageType.SyncMemberVideo, { video: this.GetVideoDom(), roomName: this.roomName, password: this.password })
                        }
                        break;
                    }
                }
            } catch (e) {
                this.UpdateStatusText(e, "red");
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
                    if (closestVideo == undefined) {
                        closestVideo = video;
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
            await this.UpdateRoom(data.roomName,
                data.password,
                data.link,
                videoDom.playbackRate,
                videoDom.currentTime,
                videoDom.paused,
                videoDom.duration);
        }

        linkWithoutState(link) {
            let url = new URL(link);
            url.searchParams.delete("VideoTogetherUrl");
            url.searchParams.delete("VideoTogetherRoomName");
            url.searchParams.delete("VideoTogetherRole");
            url.searchParams.delete("VideoTogetherPassword");
            url.searchParams.delete("VideoTogetherTimestamp");
            return url.toString();
        }

        GetRoomState(link) {
            if (this.role == this.RoleEnum.Null) {
                return {};
            }
            return {
                VideoTogetherUrl: link,
                VideoTogetherRoomName: this.roomName,
                VideoTogetherPassword: this.password,
                VideoTogetherRole: this.role,
                VideoTogetherTimestamp: Date.now() / 1000,
            }
        }

        SaveStateToSessionStorageWhenSameOrigin(link) {
            try {
                let sameOrigin = false;
                if (link != "") {
                    let url = new URL(link);
                    let currentUrl = new URL(window.location);
                    sameOrigin = (url.origin == currentUrl.origin);
                }

                if (link == "" || sameOrigin) {
                    window.sessionStorage.setItem("VideoTogetherUrl", link);
                    window.sessionStorage.setItem("VideoTogetherRoomName", this.roomName);
                    window.sessionStorage.setItem("VideoTogetherPassword", this.password);
                    window.sessionStorage.setItem("VideoTogetherRole", this.role);
                    window.sessionStorage.setItem("VideoTogetherTimestamp", Date.now() / 1000);
                    return sameOrigin;
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
            url.searchParams.set("VideoTogetherUrl", link);
            url.searchParams.set("VideoTogetherRoomName", this.roomName);
            url.searchParams.set("VideoTogetherPassword", this.password);
            url.searchParams.set("VideoTogetherRole", this.role);
            url.searchParams.set("VideoTogetherTimestamp", Date.now() / 1000);
            let urlStr = url.toString();
            if (tmpSearch.length > 1) {
                urlStr = urlStr + "&" + tmpSearch.slice(1);
            }
            return new URL(urlStr);
        }

        CalculateRealCurrent(data) {
            let playbackRate = parseFloat(data["playbackRate"]);
            return data["currentTime"] + (this.getLocalTimestamp() - data["lastUpdateClientTime"]) * (isNaN(playbackRate) ? 1 : playbackRate);
        }

        GetDisplayTimeText() {
            let date = new Date();
            return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        }

        async SyncMemberVideo(data, videoDom) {
            let room = await this.GetRoom(data.roomName, data.password);
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
                        if (videoDom.paused) {
                            throw new Error("{$need_to_play_manually$}");
                        }
                    } catch (e) {
                        throw new Error("{$need_to_play_manually$}");
                    }
                }
            }
            if (videoDom.playbackRate != room["playbackRate"]) {
                try {
                    videoDom.playbackRate = parseFloat(room["playbackRate"]);
                } catch (e) { }
            }
            if (isNaN(videoDom.duration)) {
                throw new Error("{$need_to_play_manually$}");
            }
            this.sendMessageToTop(MessageType.UpdateStatusText, { text: "{$sync_success$} " + this.GetDisplayTimeText(), color: "green" })
        }

        async CheckResponse(response) {
            if (response.status != 200) {
                throw new Error("http code: " + response.status);
            } else {
                let data = await response.json();
                if ("errorMessage" in data) {
                    throw new Error(data["errorMessage"]);
                }
                return data;
            }
        }

        async CreateRoom(name, password) {
            try {
                this.tempUser = this.generateUUID();
                let url = this.linkWithoutState(window.location);
                let data = this.RunWithRetry(async () => await this.UpdateRoom(name, password, url, 1, 0, true, 0), 2);
                this.setRole(this.RoleEnum.Master);
                this.roomName = name;
                this.password = password;
                window.videoTogetherFlyPannel.InRoom();
            } catch (e) { this.UpdateStatusText(e, "red") }
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
            apiUrl.searchParams.set("tempUser", this.tempUser);
            apiUrl.searchParams.set("public", (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.PublicVideoRoom));
            apiUrl.searchParams.set("protected", (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.PasswordProtectedRoom));
            apiUrl.searchParams.set("videoTitle", this.isMain ? document.title : this.videoTitle);
            let startTime = Date.now() / 1000;
            let response = await this.Fetch(apiUrl);
            let endTime = Date.now() / 1000;
            let data = await this.CheckResponse(response);
            this.UpdateTimestampIfneeded(data["timestamp"], startTime, endTime);
            return data;
        }

        async UpdateTimestampIfneeded(serverTimestamp, startTime, endTime) {
            if (typeof serverTimestamp == 'number' && typeof startTime == 'number' && typeof endTime == 'number') {
                if (endTime - startTime < this.minTrip) {
                    this.timeOffset = serverTimestamp - (startTime + endTime) / 2;
                    this.minTrip = endTime - startTime;
                }
            }
        }

        async GetRoom(name, password) {
            let url = new URL(this.video_together_host + "/room/get");
            url.searchParams.set("name", name);
            url.searchParams.set("tempUser", this.tempUser);
            url.searchParams.set("password", password);
            let startTime = Date.now() / 1000;
            let response = await this.Fetch(url);
            let endTime = Date.now() / 1000;
            let data = await this.CheckResponse(response);
            this.UpdateTimestampIfneeded(data["timestamp"], startTime, endTime);
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
        window.videoTogetherExtension.sendMessageToSelf(MessageType.ExtensionInitSuccess, {})
    }
    try {
        document.querySelector("#videoTogetherLoading").remove()
    } catch { }
})()
