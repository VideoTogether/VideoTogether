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
    try{
        // this attribute will break the cloudflare turnstile
        document.currentScript.removeAttribute("cachedvt")
        document.currentScript.remove()
    }catch{}
    const language = '{$language$}'
    const vtRuntime = `{{{ {"user": "./config/vt_runtime_extension", "website": "./config/vt_runtime_website","order":100} }}}`;
    const realUrlCache = {}
    const m3u8ContentCache = {}

    const Var = {
        isThisMemberLoading: false,
        cdnConfig: undefined,
    }

    let inDownload = false;
    let isDownloading = false;

    let roomUuid = null;

    const lastRunQueue = []
    // request can only be called up to 10 times in 5 seconds
    const periodSec = 5;
    const timeLimitation = 15;
    const textVoiceAudio = document.createElement('audio');

    const encodedChinaCdnA = 'aHR0cHM6Ly92aWRlb3RvZ2V0aGVyLm9zcy1jbi1oYW5nemhvdS5hbGl5dW5jcy5jb20='
    function getCdnPath(encodedCdn, path) {
        const cdn = encodedCdn.startsWith('https') ? encodedCdn : atob(encodedCdn);
        return `${cdn}/${path}`;
    }
    async function getCdnConfig(encodedCdn) {
        if (Var.cdnConfig != undefined) {
            return Var.cdnConfig;
        }
        return extension.Fetch(getCdnPath(encodedCdn, 'release/cdn-config.json')).then(r => r.json()).then(config => Var.cdnConfig = config).then(() => Var.cdnConfig)
    }
    async function getEasyShareHostChina() {
        return getCdnConfig(encodedChinaCdnA).then(c => c.easyShareHostChina)
    }

    let trustedPolicy = undefined;
    function updateInnnerHTML(e, html) {
        try {
            e.innerHTML = html;
        } catch {
            if (trustedPolicy == undefined) {
                trustedPolicy = trustedTypes.createPolicy('videoTogetherExtensionVtJsPolicy', {
                    createHTML: (string) => string,
                    createScript: (string) => string,
                    createScriptURL: (url) => url
                });
            }
            e.innerHTML = trustedPolicy.createHTML(html);
        }
    }

    function getDurationStr(duration) {
        try {
            let d = parseInt(duration);
            let str = ""
            let units = [" {$SecondLabel$} ", " {$MinuteLabel$} ", " {$HourLabel$} "]
            for (let i in units) {
                if (d > 0) {
                    str = d % 60 + units[i] + str;
                }
                d = Math.floor(d / 60)
            }
            return str;
        } catch {
            return "N/A"
        }
    }

    function downloadEnabled() {
        try {
            if (window.VideoTogetherDownload == 'disabled') {
                return false;
            }
            const type = VideoTogetherStorage.UserscriptType
            return parseInt(window.VideoTogetherStorage.LoaddingVersion) >= 1694758378
                && (type == "Chrome" || type == "Safari" || type == "Firefox")
                && !isDownloadBlackListDomain()
        } catch {
            return false;
        }
    }

    function isM3U8(textContent) {
        return textContent.trim().startsWith('#EXTM3U');
    }
    function isMasterM3u8(textContent) {
        return textContent.includes('#EXT-X-STREAM-INF:');
    }

    function getFirstMediaM3U8(m3u8Content, m3u8Url) {
        if (!isMasterM3u8(m3u8Content)) {
            return null;
        }
        const lines = m3u8Content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine != "") {
                return new URL(trimmedLine, m3u8Url);
            }
        }
        return null;
    }

    function startDownload(_vtArgM3u8Url, _vtArgM3u8Content, _vtArgM3u8Urls, _vtArgTitle, _vtArgPageUrl) {
        /*{{{ {"":"../local/download.js", "order":100} }}}*/
    }

    function isLimited() {
        while (lastRunQueue.length > 0 && lastRunQueue[0] < Date.now() / 1000 - periodSec) {
            lastRunQueue.shift();
        }
        if (lastRunQueue.length > timeLimitation) {
            console.error("limited")
            return true;
        }
        lastRunQueue.push(Date.now() / 1000);
        return false;
    }

    function getVideoTogetherStorage(key, defaultVal) {
        try {
            if (window.VideoTogetherStorage == undefined) {
                return defaultVal
            } else {
                if (window.VideoTogetherStorage[key] == undefined) {
                    return defaultVal
                } else {
                    return window.VideoTogetherStorage[key];
                }
            }
        } catch { return defaultVal }
    }

    function getEnableTextMessage() {
        return getVideoTogetherStorage('EnableTextMessage', true);
    }

    function getEnableMiniBar() {
        return getVideoTogetherStorage('EnableMiniBar', true);
    }

    function skipIntroLen() {
        try {
            let len = parseInt(window.VideoTogetherStorage.SkipIntroLength);
            if (window.VideoTogetherStorage.SkipIntro && !isNaN(len)) {
                return len;
            }
        } catch { }
        return 0;
    }

    function isEmpty(s) {
        try {
            return s.length == 0;
        } catch {
            return true;
        }
    }

    function emptyStrIfUdf(s) {
        return s == undefined ? "" : s;
    }

    let isDownloadBlackListDomainCache = undefined;
    function isDownloadBlackListDomain() {
        if (window.location.protocol != 'http:' && window.location.protocol != 'https:') {
            return true;
        }
        const domains = [
            'iqiyi.com', 'qq.com', 'youku.com',
            'bilibili.com', 'baidu.com', 'quark.cn',
            'aliyundrive.com', "115.com", "acfun.cn", "youtube.com",
        ];
        if (isDownloadBlackListDomainCache == undefined) {
            const hostname = window.location.hostname;
            isDownloadBlackListDomainCache = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        }
        return isDownloadBlackListDomainCache;
    }

    let isEasyShareBlackListDomainCache = undefined;
    function isEasyShareBlackListDomain() {
        if (window.location.protocol != 'https:') {
            return true;
        }
        const domains = [
            'iqiyi.com', 'qq.com', 'youku.com',
            'bilibili.com', 'baidu.com', 'quark.cn',
            'aliyundrive.com', "115.com", "pornhub.com", "acfun.cn", "youtube.com",
            // --
            "missav.com", "nivod4.tv"
        ];
        if (isEasyShareBlackListDomainCache == undefined) {
            const hostname = window.location.hostname;
            isEasyShareBlackListDomainCache = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        }
        return isEasyShareBlackListDomainCache;
    }

    function isEasyShareEnabled() {
        if (inDownload) {
            return false;
        }
        try {
            if (isWeb()) {
                return false;
            }
            if (isEasyShareBlackListDomain()) {
                return false;
            }
            return window.VideoTogetherEasyShare != 'disabled' && window.VideoTogetherStorage.EasyShare != false;
        } catch {
            return false;
        }
    }

    function isEasyShareMember() {
        try {
            return window.VideoTogetherEasyShareMemberSite == true;
        } catch {
            return false;
        }
    }

    function useMobileStyle(videoDom) {
        let isMobile = false;
        if (window.location.href.startsWith('https://m.bilibili.com/')) {
            isMobile = true;
        }
        if (!isMobile) {
            return;
        }
        document.body.childNodes.forEach(e => {
            try {
                if (e != videoDom && e.style && e.id != 'VideoTogetherWrapper') {
                    e.style.display = 'none'
                }
            } catch { }

        });
        videoDom.setAttribute('controls', true);
        videoDom.style.width = videoDom.style.height = "100%";
        videoDom.style.maxWidth = videoDom.style.maxHeight = "100%";
        videoDom.style.display = 'block';
        if (videoDom.parentElement != document.body) {
            document.body.appendChild(videoDom);
        }
    }

    const mediaUrlsCache = {}
    function extractMediaUrls(m3u8Content, m3u8Url) {
        if (mediaUrlsCache[m3u8Url] == undefined) {
            let lines = m3u8Content.split("\n");
            let mediaUrls = [];
            let base = undefined;
            try {
                base = new URL(m3u8Url);
            } catch { };
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line !== "" && !line.startsWith("#")) {
                    let mediaUrl = new URL(line, base);
                    mediaUrls.push(mediaUrl.href);
                }
            }
            mediaUrlsCache[m3u8Url] = mediaUrls;
        }
        return mediaUrlsCache[m3u8Url];
    }

    function fixedEncodeURIComponent(str) {
        return encodeURIComponent(str).replace(
            /[!'()*]/g,
            (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
        ).replace(/%20/g, '+');
    }

    function fixedDecodeURIComponent(str) {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    }

    function isWeb() {
        try {
            let type = window.VideoTogetherStorage.UserscriptType;
            return type == 'website' || type == 'website_debug';
        } catch {
            return false;
        }
    }

    /**
     * @returns {Element}
     */
    function select(query) {
        let e = window.videoTogetherFlyPannel.wrapper.querySelector(query);
        return e;
    }

    function hide(e) {
        if (e) e.style.display = 'none';
    }

    function show(e) {
        if (e) e.style.display = null;
    }

    function isVideoLoadded(video) {
        try {
            if (isNaN(video.readyState)) {
                return true;
            }
            return video.readyState >= 3;
        } catch {
            return true;
        }
    }

    function isRoomProtected() {
        try {
            return window.VideoTogetherStorage == undefined || window.VideoTogetherStorage.PasswordProtectedRoom != false;
        } catch {
            return true;
        }
    }

    function changeBackground(url) {
        let e = select('.vt-modal-body');
        if (e) {
            if (url == null || url == "") {
                e.style.backgroundImage = 'none';
            } else if (e.style.backgroundImage != `url("${url}")`) {
                e.style.backgroundImage = `url("${url}")`
            }
        }
    }

    function changeMemberCount(c) {
        extension.ctxMemberCount = c;
        updateInnnerHTML(select('#memberCount'), String.fromCodePoint("0x1f465") + " " + c)
    }

    function dsply(e, _show = true) {
        _show ? show(e) : hide(e);
    }

    async function isAudioVolumeRO() {
        let a = new Audio();
        a.volume = 0.5;
        return new Promise(r => setTimeout(() => {
            r(!(a.volume == 0.5))
        }, 1));
    }

    const Global = {
        inited: false,
        NativePostMessageFunction: null,
        NativeAttachShadow: null,
        NativeFetch: null
    }

    function AttachShadow(e, options) {
        try {
            return e.attachShadow(options);
        } catch (err) {
            GetNativeFunction();
            return Global.NativeAttachShadow.call(e, options);
        }
    }

    function GetNativeFunction() {
        if (Global.inited) {
            return;
        }
        Global.inited = true;
        let temp = document.createElement("iframe");
        hide(temp);
        document.body.append(temp);
        Global.NativePostMessageFunction = temp.contentWindow.postMessage;
        Global.NativeAttachShadow = temp.contentWindow.Element.prototype.attachShadow;
        Global.NativeFetch = temp.contentWindow.fetch;
    }

    function PostMessage(window, data) {
        if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.postMessage))) {
            window.postMessage(data, "*");
        } else {
            GetNativeFunction();
            Global.NativePostMessageFunction.call(window, data, "*");
        }
    }

    async function Fetch(url, init) {
        if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.fetch))) {
            return await fetch(url, init);
        } else {
            GetNativeFunction();
            return await Global.NativeFetch.call(window, url, init);
        }
    }

    function sendMessageToTop(type, data) {
        PostMessage(window.top, {
            source: "VideoTogether",
            type: type,
            data: data
        });
    }

    function sendMessageToSelf(type, data) {
        PostMessage(window, {
            source: "VideoTogether",
            type: type,
            data: data
        });
    }

    function sendMessageTo(w, type, data) {
        PostMessage(w, {
            source: "VideoTogether",
            type: type,
            data: data
        });
    }

    function initRangeSlider(slider) {
        const min = slider.min
        const max = slider.max
        const value = slider.value

        slider.style.background = `linear-gradient(to right, #1abc9c 0%, #1abc9c ${(value - min) / (max - min) * 100}%, #d7dcdf ${(value - min) / (max - min) * 100}%, #d7dcdf 100%)`

        slider.addEventListener('input', function () {
            this.style.background = `linear-gradient(to right, #1abc9c 0%, #1abc9c ${(this.value - this.min) / (this.max - this.min) * 100}%, #d7dcdf ${(this.value - this.min) / (this.max - this.min) * 100}%, #d7dcdf 100%)`
        });
    }

    function WSUpdateRoomRequest(name, password, url, playbackRate, currentTime, paused, duration, localTimestamp, m3u8Url) {
        return {
            "method": "/room/update",
            "data": {
                "tempUser": extension.tempUser,
                "password": password,
                "name": name,
                "playbackRate": playbackRate,
                "currentTime": currentTime,
                "paused": paused,
                "url": url,
                "lastUpdateClientTime": localTimestamp,
                "duration": duration,
                "protected": isRoomProtected(),
                "videoTitle": extension.isMain ? document.title : extension.videoTitle,
                "sendLocalTimestamp": Date.now() / 1000,
                "m3u8Url": m3u8Url
            }
        }
    }

    function WSJoinRoomRequest(name, password) {
        return {
            "method": "/room/join",
            "data": {
                "password": password,
                "name": name,
            }
        }
    }

    function WsUpdateMemberRequest(name, password, isLoadding, currentUrl) {
        return {
            "method": "/room/update_member",
            "data": {
                "password": password,
                "roomName": name,
                "sendLocalTimestamp": Date.now() / 1000,
                "userId": extension.tempUser,
                "isLoadding": isLoadding,
                "currentUrl": currentUrl
            }
        }
    }

    function popupError(msg) {
        let x = select("#snackbar");
        updateInnnerHTML(x, msg);
        x.className = "show";
        setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);
        let changeVoiceBtn = select('#changeVoiceBtn');
        if (changeVoiceBtn != undefined) {
            changeVoiceBtn.onclick = () => {
                windowPannel.ShowTxtMsgTouchPannel();
            }
        }
    }

    async function waitForRoomUuid(timeout = 10000) {
        return new Promise((res, rej) => {
            let id = setInterval(() => {
                if (roomUuid != null) {
                    res(roomUuid);
                    clearInterval(id);
                }
            }, 200)
            setTimeout(() => {
                clearInterval(id);
                rej(null);
            }, timeout);
        });
    }

    class Room {
        constructor() {
            this.currentTime = null;
            this.duration = null;
            this.lastUpdateClientTime = null;
            this.lastUpdateServerTime = null;
            this.name = null;
            this.paused = null;
            this.playbackRate = null;
            this.protected = null;
            this.timestamp = null;
            this.url = null;
            this.videoTitle = null;
            this.waitForLoadding = null;
        }
    }

    const WS = {
        _socket: null,
        _lastConnectTime: 0,
        _connectTimeout: 10,
        _expriedTime: 5,
        _lastUpdateTime: 0,
        _lastErrorMessage: null,
        _lastRoom: new Room(),
        _connectedToService: false,
        isOpen() {
            try {
                return this._socket.readyState = 1 && this._connectedToService;
            } catch { return false; }
        },
        async connect() {
            if (this._socket != null) {
                try {
                    if (this._socket.readyState == 1) {
                        return;
                    }
                    if (this._socket.readyState == 0
                        && this._lastConnectTime + this._connectTimeout > Date.now() / 1000) {
                        return;
                    }
                } catch { }
            }
            console.log('ws connect');
            this._lastConnectTime = Date.now() / 1000
            this._connectedToService = false;
            try {
                this.disconnect()
                this._socket = new WebSocket(`wss://${extension.video_together_host.replace("https://", "")}/ws?language=${language}`);
                this._socket.onmessage = async e => {
                    let lines = e.data.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        try {
                            await this.onmessage(lines[i]);
                        } catch (err) { console.log(err, lines[i]) }
                    }
                }
            } catch { }
        },
        async onmessage(str) {
            data = JSON.parse(str);
            if (data['errorMessage'] != null) {
                this._lastUpdateTime = Date.now() / 1000;
                this._lastErrorMessage = data['errorMessage'];
                this._lastRoom = null;
                return;
            }
            this._lastErrorMessage = null;
            if (data['method'] == "/room/join") {
                this._joinedName = data['data']['name'];
            }
            if (data['method'] == "/room/join" || data['method'] == "/room/update" || data['method'] == "/room/update_member") {
                this._connectedToService = true;
                this._lastRoom = Object.assign(data['data'], Room);
                this._lastUpdateTime = Date.now() / 1000;

                if (extension.role == extension.RoleEnum.Member) {
                    if (!isLimited()) {
                        extension.ScheduledTask();
                    }
                }
                if (extension.role == extension.RoleEnum.Master && data['method'] == "/room/update_member") {
                    if (!isLimited()) {
                        extension.setWaitForLoadding(this._lastRoom.waitForLoadding);
                        extension.ScheduledTask();
                    }
                }
            }
            if (data['method'] == 'replay_timestamp') {
                sendMessageToTop(MessageType.TimestampV2Resp, { ts: Date.now() / 1000, data: data['data'] })
            }
            if (data['method'] == 'url_req') {
                extension.UrlRequest(data['data'].m3u8Url, data['data'].idx, data['data'].origin)
            }
            if (data['method'] == 'url_resp') {
                realUrlCache[data['data'].origin] = data['data'].real;
            }
            if (data['method'] == 'm3u8_req') {
                content = extension.GetM3u8Content(data['data'].m3u8Url);
                WS.m3u8ContentResp(data['data'].m3u8Url, content);
            }
            if (data['method'] == 'm3u8_resp') {
                m3u8ContentCache[data['data'].m3u8Url] = data['data'].content;
            }
            if (data['method'] == 'send_txtmsg' && getEnableTextMessage()) {
                popupError("{$new_message_change_voice$}");
                extension.gotTextMsg(data['data'].id, data['data'].msg, false, -1, data['data'].audioUrl);
                sendMessageToTop(MessageType.GotTxtMsg, { id: data['data'].id, msg: data['data'].msg });
            }
        },
        getRoom() {
            if (this._lastUpdateTime + this._expriedTime > Date.now() / 1000) {
                if (this._lastErrorMessage != null) {
                    throw new Error(this._lastErrorMessage);
                }
                return this._lastRoom;
            }
        },
        async send(data) {
            try {
                this._socket.send(JSON.stringify(data));
            } catch { }
        },
        async updateRoom(name, password, url, playbackRate, currentTime, paused, duration, localTimestamp, m3u8Url) {
            // TODO localtimestamp
            this.send(WSUpdateRoomRequest(name, password, url, playbackRate, currentTime, paused, duration, localTimestamp, m3u8Url));
        },
        async urlReq(m3u8Url, idx, origin) {
            this.send({
                "method": "url_req",
                "data": {
                    "m3u8Url": m3u8Url,
                    "idx": idx,
                    "origin": origin
                }
            })
        },
        async urlResp(origin, real) {
            this.send({
                "method": "url_resp",
                "data": {
                    "origin": origin,
                    "real": real,
                }
            })
        },
        async m3u8ContentReq(m3u8Url) {
            this.send({
                "method": "m3u8_req",
                "data": {
                    "m3u8Url": m3u8Url,
                }
            })
        },
        async sendTextMessage(id, msg) {
            this.send({
                "method": "send_txtmsg",
                "data": {
                    "msg": msg,
                    "id": id,
                    "voiceId": getVideoTogetherStorage('PublicReechoVoiceId', "")
                }
            })
        },
        async m3u8ContentResp(m3u8Url, content) {
            this.send({
                "method": "m3u8_resp",
                "data": {
                    "m3u8Url": m3u8Url,
                    "content": content
                }
            })
        },
        async updateMember(name, password, isLoadding, currentUrl) {
            this.send(WsUpdateMemberRequest(name, password, isLoadding, currentUrl));
        },
        _joinedName: null,
        async joinRoom(name, password) {
            if (name == this._joinedName) {
                return;
            }
            this.send(WSJoinRoomRequest(name, password));
        },
        async disconnect() {
            if (this._socket != null) {
                try {
                    this._socket.close();
                } catch { }
            }
            this._joinedName = null;
            this._socket = null;
        }
    }

    const VoiceStatus = {
        STOP: 1,
        CONNECTTING: 5,
        MUTED: 2,
        UNMUTED: 3,
        ERROR: 4
    }

    const Voice = {
        _status: VoiceStatus.STOP,
        _errorMessage: "",
        _rname: "",
        _mutting: false,
        get errorMessage() {
            return this._errorMessage;
        },
        set errorMessage(m) {
            this._errorMessage = m;
            updateInnnerHTML(select("#snackbar"), m);
            let voiceConnErrBtn = select('#voiceConnErrBtn');
            if (voiceConnErrBtn != undefined) {
                voiceConnErrBtn.onclick = () => {
                    alert('{$voice_connection_error_help$}')
                }
            }
        },
        set status(s) {
            this._status = s;
            let disabledMic = select("#disabledMic");
            let micBtn = select('#micBtn');
            let audioBtn = select('#audioBtn');
            let callBtn = select("#callBtn");
            let callConnecting = select("#callConnecting");
            let callErrorBtn = select("#callErrorBtn");
            dsply(callConnecting, s == VoiceStatus.CONNECTTING);
            dsply(callBtn, s == VoiceStatus.STOP);
            let inCall = (VoiceStatus.UNMUTED == s || VoiceStatus.MUTED == s);
            dsply(micBtn, inCall);
            dsply(audioBtn, inCall);
            dsply(callErrorBtn, s == VoiceStatus.ERROR);
            switch (s) {
                case VoiceStatus.STOP:
                    break;
                case VoiceStatus.MUTED:
                    show(disabledMic);
                    break;
                case VoiceStatus.UNMUTED:
                    hide(disabledMic);
                    break;
                case VoiceStatus.ERROR:
                    var x = select("#snackbar");
                    x.className = "show";
                    setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);
                    break;
                default:
                    break;
            }
        },
        get status() {
            return this._status;
        },
        _conn: null,
        set conn(conn) {
            this._conn = conn;
        },
        /**
         * @return {RTCPeerConnection}
         */
        get conn() {
            return this._conn
        },

        _stream: null,
        set stream(s) {
            this._stream = s;
        },
        /**
         * @return {MediaStream}
         */
        get stream() {
            return this._stream;
        },

        _noiseCancellationEnabled: true,
        set noiseCancellationEnabled(n) {
            this._noiseCancellationEnabled = n;
            if (this.inCall) {
                this.updateVoiceSetting(n);
            }
        },

        get noiseCancellationEnabled() {
            return this._noiseCancellationEnabled;
        },

        get inCall() {
            return this.status == VoiceStatus.MUTED || this.status == VoiceStatus.UNMUTED;
        },

        join: async function (name, rname, mutting = false) {
            Voice._rname = rname;
            Voice._mutting = mutting;
            let cancellingNoise = true;
            try {
                cancellingNoise = !(window.VideoTogetherStorage.EchoCancellation === false);
            } catch { }

            Voice.stop();
            Voice.status = VoiceStatus.CONNECTTING;
            this.noiseCancellationEnabled = cancellingNoise;
            let uid = generateUUID();
            let notNullUuid;
            try {
                notNullUuid = await waitForRoomUuid();
            } catch {
                Voice.errorMessage = "{$room_uuid_missing$}";
                Voice.status = VoiceStatus.ERROR;
                return;
            }
            const rnameRPC = fixedEncodeURIComponent(notNullUuid + "_" + rname);
            if (rnameRPC.length > 256) {
                Voice.errorMessage = "{$room_name_too_long$}";
                Voice.status = VoiceStatus.ERROR;
                return;
            }
            if (window.location.protocol != "https:" && window.location.protocol != 'file:') {
                Voice.errorMessage = "{$only_support_https_website$}";
                Voice.status = VoiceStatus.ERROR;
                return;
            }
            const unameRPC = fixedEncodeURIComponent(uid + ':' + Base64.encode(generateUUID()));
            let ucid = "";
            console.log(rnameRPC, uid);
            const configuration = {
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan'
            };

            async function subscribe(pc) {
                var res = await rpc('subscribe', [rnameRPC, unameRPC, ucid]);
                if (res.error && typeof res.error === 'object' && typeof res.error.code === 'number' && [5002001, 5002002].indexOf(res.error.code) != -1) {
                    Voice.join("", Voice._rname, Voice._mutting);
                    return;
                }
                if (res.data) {
                    var jsep = JSON.parse(res.data.jsep);
                    if (jsep.type == 'offer') {
                        await pc.setRemoteDescription(jsep);
                        var sdp = await pc.createAnswer();
                        await pc.setLocalDescription(sdp);
                        await rpc('answer', [rnameRPC, unameRPC, ucid, JSON.stringify(sdp)]);
                    }
                }
                setTimeout(function () {
                    if (Voice.conn != null && pc === Voice.conn && Voice.status != VoiceStatus.STOP) {
                        subscribe(pc);
                    }
                }, 3000);
            }


            try {
                await start();
            } catch (e) {
                if (Voice.status == VoiceStatus.CONNECTTING) {
                    Voice.status = VoiceStatus.ERROR;
                    Voice.errorMessage = "{$connection_error$}";
                }
            }

            if (Voice.status == VoiceStatus.CONNECTTING) {
                Voice.status = mutting ? VoiceStatus.MUTED : VoiceStatus.UNMUTED;
            }

            async function start() {

                let res = await rpc('turn', [unameRPC]);
                if (res.data && res.data.length > 0) {
                    configuration.iceServers = res.data;
                    configuration.iceTransportPolicy = 'relay';
                }

                Voice.conn = new RTCPeerConnection(configuration);

                Voice.conn.onicecandidate = ({ candidate }) => {
                    rpc('trickle', [rnameRPC, unameRPC, ucid, JSON.stringify(candidate)]);
                };

                Voice.conn.ontrack = (event) => {
                    console.log("ontrack", event);

                    let stream = event.streams[0];
                    let sid = fixedDecodeURIComponent(stream.id);
                    let id = sid.split(':')[0];
                    // var name = Base64.decode(sid.split(':')[1]);
                    console.log(id, uid);
                    if (id === uid) {
                        return;
                    }
                    event.track.onmute = (event) => {
                        console.log("onmute", event);
                    };

                    let aid = 'peer-audio-' + id;
                    let el = select('#' + aid);
                    if (el) {
                        el.srcObject = stream;
                    } else {
                        el = document.createElement(event.track.kind)
                        el.id = aid;
                        el.srcObject = stream;
                        el.autoplay = true;
                        el.controls = false;
                        select('#peer').appendChild(el);
                    }
                };

                try {
                    const constraints = {
                        audio: {
                            echoCancellation: cancellingNoise,
                            noiseSuppression: cancellingNoise
                        },
                        video: false
                    };
                    Voice.stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (err) {
                    if (Voice.status == VoiceStatus.CONNECTTING) {
                        Voice.errorMessage = "{$no_micphone_access$}";
                        Voice.status = VoiceStatus.ERROR;
                    }
                    return;
                }

                Voice.stream.getTracks().forEach((track) => {
                    track.enabled = !mutting;
                    Voice.conn.addTrack(track, Voice.stream);
                });

                await Voice.conn.setLocalDescription(await Voice.conn.createOffer());
                res = await rpc('publish', [rnameRPC, unameRPC, JSON.stringify(Voice.conn.localDescription)]);
                if (res.data) {
                    let jsep = JSON.parse(res.data.jsep);
                    if (jsep.type == 'answer') {
                        await Voice.conn.setRemoteDescription(jsep);
                        ucid = res.data.track;
                        await subscribe(Voice.conn);
                    }
                } else {
                    throw new Error('{$unknown_error$}');
                }
                Voice.conn.oniceconnectionstatechange = e => {
                    if (Voice.conn.iceConnectionState == "disconnected" || Voice.conn.iceConnectionState == "failed" || Voice.conn.iceConnectionState == "closed") {
                        Voice.errorMessage = "{$connection_lost$}";
                        Voice.status = VoiceStatus.ERROR;
                    } else {
                        if (Voice.status == VoiceStatus.ERROR) {
                            Voice.status = Voice._mutting ? VoiceStatus.MUTED : VoiceStatus.UNMUTED;
                        }
                    }
                }
            }

            async function rpc(method, params = [], retryTime = -1) {
                try {
                    const response = await window.videoTogetherExtension.Fetch(extension.video_together_host + "/kraken", "POST", { id: generateUUID(), method: method, params: params }, {
                        method: 'POST', // *GET, POST, PUT, DELETE, etc.
                        mode: 'cors', // no-cors, *cors, same-origin
                        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                        credentials: 'omit', // include, *same-origin, omit
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        redirect: 'follow', // manual, *follow, error
                        referrerPolicy: 'no-referrer', // no-referrer, *client
                        body: JSON.stringify({ id: generateUUID(), method: method, params: params }) // body data type must match "Content-Type" header
                    });
                    return await response.json(); // parses JSON response into native JavaScript objects
                } catch (err) {
                    if (Voice.status == VoiceStatus.STOP) {
                        return;
                    }
                    if (retryTime == 0) {
                        throw err;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    return await rpc(method, params, retryTime - 1);
                }
            }
        },
        stop: () => {
            try {
                Voice.conn.getSenders().forEach(s => {
                    if (s.track) {
                        s.track.stop();
                    }
                });
            } catch (e) { };

            [...select('#peer').querySelectorAll("*")].forEach(e => e.remove());
            try {
                Voice.conn.close();
                delete Voice.conn;
            } catch { }
            try {
                Voice.stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                delete Voice.stream;
            } catch { }
            Voice.status = VoiceStatus.STOP;
        },
        mute: () => {
            Voice.conn.getSenders().forEach(s => {
                if (s.track) {
                    s.track.enabled = false;
                }
            });
            Voice._mutting = true;
            Voice.status = VoiceStatus.MUTED;
        },
        unmute: () => {
            Voice.conn.getSenders().forEach(s => {
                if (s.track) {
                    s.track.enabled = true;
                }
            });
            Voice._mutting = false;
            Voice.status = VoiceStatus.UNMUTED;
        },
        updateVoiceSetting: async (cancellingNoise = false) => {
            const constraints = {
                audio: {
                    echoCancellation: cancellingNoise,
                    noiseSuppression: cancellingNoise
                },
                video: false
            };
            try {
                prevStream = Voice.stream;
                Voice.stream = await navigator.mediaDevices.getUserMedia(constraints);
                Voice.conn.getSenders().forEach(s => {
                    if (s.track) {
                        s.replaceTrack(Voice.stream.getTracks().find(t => t.kind == s.track.kind));
                    }
                })
                prevStream.getTracks().forEach(t => t.stop());
                delete prevStream;
            } catch (e) { console.log(e); };
        }
    }

    function generateUUID() {
        if (crypto.randomUUID != undefined) {
            return crypto.randomUUID();
        }
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    function generateTempUserId() {
        return generateUUID() + ":" + Date.now() / 1000;
    }

    /**
     *
     *  Base64 encode / decode
     *  http://www.webtoolkit.info
     *
     **/
    const Base64 = {

        // private property
        _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

        // public method for encoding
        , encode: function (input) {
            var output = "";
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            var i = 0;

            input = Base64._utf8_encode(input);

            while (i < input.length) {
                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                }
                else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                    this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                    this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
            } // Whend

            return output;
        } // End Function encode


        // public method for decoding
        , decode: function (input) {
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
            while (i < input.length) {
                enc1 = this._keyStr.indexOf(input.charAt(i++));
                enc2 = this._keyStr.indexOf(input.charAt(i++));
                enc3 = this._keyStr.indexOf(input.charAt(i++));
                enc4 = this._keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }

                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }

            } // Whend

            output = Base64._utf8_decode(output);

            return output;
        } // End Function decode


        // private method for UTF-8 encoding
        , _utf8_encode: function (string) {
            var utftext = "";
            string = string.replace(/\r\n/g, "\n");

            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }

            } // Next n

            return utftext;
        } // End Function _utf8_encode

        // private method for UTF-8 decoding
        , _utf8_decode: function (utftext) {
            var string = "";
            var i = 0;
            var c, c1, c2, c3;
            c = c1 = c2 = 0;

            while (i < utftext.length) {
                c = utftext.charCodeAt(i);

                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                }
                else if ((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i + 1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                }
                else {
                    c2 = utftext.charCodeAt(i + 1);
                    c3 = utftext.charCodeAt(i + 2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }

            } // Whend

            return string;
        } // End Function _utf8_decode
    }

    let GotTxtMsgCallback = undefined;

    class VideoTogetherFlyPannel {
        constructor() {
            this.sessionKey = "VideoTogetherFlySaveSessionKey";
            this.isInRoom = false;

            this.isMain = (window.self == window.top);
            setInterval(() => {
                if (getEnableMiniBar() && getEnableTextMessage() && document.fullscreenElement != undefined
                    && (extension.ctxRole == extension.RoleEnum.Master || extension.ctxRole == extension.RoleEnum.Member)) {
                    const qs = (s) => this.fullscreenWrapper.querySelector(s);
                    try {
                        qs("#memberCount").innerText = extension.ctxMemberCount;
                        qs("#send-button").disabled = !extension.ctxWsIsOpen;
                    } catch { };
                    if (document.fullscreenElement.contains(this.fullscreenSWrapper)) {
                        return;
                    }
                    let shadowWrapper = document.createElement("div");
                    this.fullscreenSWrapper = shadowWrapper;
                    shadowWrapper.id = "VideoTogetherfullscreenSWrapper";
                    let wrapper;
                    try {
                        wrapper = AttachShadow(shadowWrapper, { mode: "open" });
                        wrapper.addEventListener('keydown', (e) => e.stopPropagation());
                        this.fullscreenWrapper = wrapper;
                    } catch (e) { console.error(e); }
                    updateInnnerHTML(wrapper, `{{{ {"": "./html/fullscreen.html","order":100} }}}`);
                    document.fullscreenElement.appendChild(shadowWrapper);
                    var container = wrapper.getElementById('container');
                    let expandBtn = wrapper.getElementById('expand-button');
                    let msgInput = wrapper.getElementById('text-input');
                    let sendBtn = wrapper.getElementById('send-button');
                    let closeBtn = wrapper.getElementById('close-btn');
                    let expanded = true;
                    function expand() {
                        if (expanded) {
                            expandBtn.innerText = '>'
                            sendBtn.style.display = 'none';
                            msgInput.classList.remove('expand');

                        } else {
                            expandBtn.innerText = '<';
                            sendBtn.style.display = 'inline-block';
                            msgInput.classList.add("expand");
                        }
                        expanded = !expanded;
                    }
                    closeBtn.onclick = () => { shadowWrapper.style.display = "none"; }
                    wrapper.getElementById('expand-button').addEventListener('click', () => expand());
                    sendBtn.onclick = () => {
                        extension.currentSendingMsgId = generateUUID();
                        sendMessageToTop(MessageType.SendTxtMsg, { currentSendingMsgId: extension.currentSendingMsgId, value: msgInput.value });
                    }
                    GotTxtMsgCallback = (id, msg) => {
                        console.log(id, msg);
                        if (id == extension.currentSendingMsgId && msg == msgInput.value) {
                            msgInput.value = "";
                        }
                    }
                    msgInput.addEventListener("keyup", e => {
                        if (e.key == "Enter") {
                            sendBtn.click();
                        }
                    });
                } else {
                    if (this.fullscreenSWrapper != undefined) {
                        this.fullscreenSWrapper.remove();
                        this.fullscreenSWrapper = undefined;
                        this.fullscreenWrapper = undefined;
                        GotTxtMsgCallback = undefined;
                    }
                }
            }, 500);
            if (this.isMain) {
                document.addEventListener("click", () => {
                    this.enableSpeechSynthesis();
                });
                this.minimized = false;
                let shadowWrapper = document.createElement("div");
                shadowWrapper.id = "VideoTogetherWrapper";
                shadowWrapper.ontouchstart = (e) => { e.stopPropagation() }
                let wrapper;
                try {
                    wrapper = AttachShadow(shadowWrapper, { mode: "open" });
                    wrapper.addEventListener('keydown', (e) => e.stopPropagation())
                } catch (e) { console.error(e); }

                this.shadowWrapper = shadowWrapper;
                this.wrapper = wrapper;
                updateInnnerHTML(wrapper, `{{{ {"": "./html/pannel.html","order":100} }}}`);
                (document.body || document.documentElement).appendChild(shadowWrapper);

                wrapper.querySelector("#videoTogetherMinimize").onclick = () => { this.Minimize() }
                wrapper.querySelector("#videoTogetherMaximize").onclick = () => { this.Maximize() }
                ["", "webkit"].forEach(prefix => {
                    document.addEventListener(prefix + "fullscreenchange", (event) => {
                        if (document.fullscreenElement || document.webkitFullscreenElement) {
                            hide(this.videoTogetherFlyPannel);
                            hide(this.videoTogetherSamllIcon);
                        } else {
                            if (this.minimized) {
                                this.Minimize();
                            } else {
                                this.Maximize();
                            }
                        }
                    });
                });
                wrapper.querySelector("#textMessageInput").addEventListener("keyup", e => {
                    if (e.key == "Enter") {
                        wrapper.querySelector("#textMessageSend").click();
                    }
                });
                wrapper.querySelector("#textMessageSend").onclick = async () => {
                    extension.currentSendingMsgId = generateUUID();
                    WS.sendTextMessage(extension.currentSendingMsgId, select("#textMessageInput").value);
                }
                this.lobbyBtnGroup = wrapper.querySelector("#lobbyBtnGroup");
                this.createRoomButton = wrapper.querySelector('#videoTogetherCreateButton');
                this.joinRoomButton = wrapper.querySelector("#videoTogetherJoinButton");
                this.roomButtonGroup = wrapper.querySelector('#roomButtonGroup');
                this.exitButton = wrapper.querySelector("#videoTogetherExitButton");
                this.callBtn = wrapper.querySelector("#callBtn");
                this.callBtn.onclick = () => Voice.join("", window.videoTogetherExtension.roomName);
                this.helpButton = wrapper.querySelector("#videoTogetherHelpButton");
                this.audioBtn = wrapper.querySelector("#audioBtn");
                this.micBtn = wrapper.querySelector("#micBtn");
                this.videoVolume = wrapper.querySelector("#videoVolume");
                this.callVolumeSlider = wrapper.querySelector("#callVolume");
                this.callErrorBtn = wrapper.querySelector("#callErrorBtn");
                this.easyShareCopyBtn = wrapper.querySelector("#easyShareCopyBtn");
                this.textMessageChat = wrapper.querySelector("#textMessageChat");
                this.textMessageConnecting = wrapper.querySelector("#textMessageConnecting");
                this.textMessageConnectingStatus = wrapper.querySelector("#textMessageConnectingStatus");
                this.zhcnTtsMissing = wrapper.querySelector("#zhcnTtsMissing");
                this.downloadBtn = wrapper.querySelector("#downloadBtn");
                hide(this.downloadBtn);
                this.confirmDownloadBtn = wrapper.querySelector("#confirmDownloadBtn")
                this.confirmDownloadBtn.onclick = () => {
                    if (extension.downloadM3u8UrlType == "video") {
                        extension.Fetch(extension.video_together_host + "/beta/counter?key=confirm_video_download")
                        console.log(extension.downloadM3u8Url, extension.downloadM3u8UrlType)
                        sendMessageToTop(MessageType.SetStorageValue, {
                            key: "PublicNextDownload", value: {
                                filename: document.title + '.mp4',
                                url: extension.downloadM3u8Url
                            }
                        });
                        const a = document.createElement("a");
                        a.href = extension.downloadM3u8Url;
                        a.target = "_blank";
                        a.download = document.title + ".mp4";
                        a.click();
                        return;
                    }
                    extension.Fetch(extension.video_together_host + "/beta/counter?key=confirm_m3u8_download")
                    isDownloading = true;
                    const m3u8url = extension.downloadM3u8Url
                    sendMessageTo(extension.m3u8PostWindows[extension.GetM3u8WindowId(m3u8url)], MessageType.StartDownload, {
                        m3u8Url: m3u8url,
                        m3u8Content: extension.GetM3u8Content(m3u8url),
                        urls: extension.GetAllM3u8SegUrls(m3u8url),
                        title: document.title,
                        pageUrl: window.location.href
                    });

                    hide(this.confirmDownloadBtn);
                    show(select("#downloadProgress"));
                }
                this.downloadBtn.onclick = () => {
                    setInterval(() => {
                        if (isDownloading) {
                            return;
                        }
                        if (extension.downloadM3u8Url != undefined) {
                            show(this.confirmDownloadBtn);
                            select('#downloadVideoInfo').innerText = getDurationStr(extension.downloadDuration);
                        } else {
                            hide(this.confirmDownloadBtn);
                            select('#downloadVideoInfo').innerText = "{$DidntDetectVideo$}"
                        }
                    }, 1000);
                    inDownload = true;
                    this.inputRoomName.value = "download_" + generateUUID();
                    this.createRoomButton.click()
                    hide(select('.vt-modal-footer'))
                    hide(select('#mainPannel'))
                    show(select('#downloadPannel'))
                }
                this.easyShareCopyBtn.onclick = async () => {
                    try {
                        if (isWeb()) {
                            await navigator.clipboard.writeText(extension.linkWithMemberState(window.location, extension.RoleEnum.Member, false))
                        } else {
                            let shareText = '{$easy_share_line_template$}';
                            shareText = shareText.replace("<main_share_link>", await extension.generateEasyShareLink())
                            if (shareText.indexOf("<china_share_link>") != -1) {
                                shareText = shareText.replace("<china_share_link>", await extension.generateEasyShareLink(true))
                            }
                            await navigator.clipboard.writeText(shareText);
                        }
                        popupError("{$easy_share_link_copied$}");
                    } catch {
                        popupError("{$easy_share_link_copy_failed$}");
                    }
                }
                this.callErrorBtn.onclick = () => {
                    Voice.join("", window.videoTogetherExtension.roomName);
                }
                this.videoVolume.oninput = () => {
                    extension.videoVolume = this.videoVolume.value;
                    sendMessageToTop(MessageType.ChangeVideoVolume, { volume: extension.getVideoVolume() / 100 });
                }
                this.callVolumeSlider.oninput = () => {
                    extension.voiceVolume = this.callVolumeSlider.value;
                    [...select('#peer').querySelectorAll("*")].forEach(e => {
                        e.volume = extension.getVoiceVolume() / 100;
                    });
                }
                initRangeSlider(this.videoVolume);
                initRangeSlider(this.callVolumeSlider);
                this.audioBtn.onclick = async () => {
                    let hideMain = select('#mainPannel').style.display == 'none';

                    dsply(select('#mainPannel'), hideMain);
                    dsply(select('#voicePannel'), !hideMain);
                    if (!hideMain) {
                        this.audioBtn.style.color = '#1890ff';
                    } else {
                        this.audioBtn.style.color = '#6c6c6c';
                    }
                    if (await isAudioVolumeRO()) {
                        show(select('#iosVolumeErr'));
                        hide(select('#videoVolumeCtrl'));
                        hide(select('#callVolumeCtrl'));
                    }
                }
                this.micBtn.onclick = async () => {
                    switch (Voice.status) {
                        case VoiceStatus.STOP: {
                            // TODO need fix
                            await Voice.join();
                            break;
                        }
                        case VoiceStatus.UNMUTED: {
                            Voice.mute();
                            break;
                        }
                        case VoiceStatus.MUTED: {
                            Voice.unmute();
                            break;
                        }
                    }
                }

                this.createRoomButton.onclick = this.CreateRoomButtonOnClick.bind(this);
                this.joinRoomButton.onclick = this.JoinRoomButtonOnClick.bind(this);
                this.helpButton.onclick = this.HelpButtonOnClick.bind(this);
                this.exitButton.onclick = (() => {
                    window.videoTogetherExtension.exitRoom();
                });
                this.videoTogetherRoleText = wrapper.querySelector("#videoTogetherRoleText")
                this.videoTogetherSetting = wrapper.querySelector("#videoTogetherSetting");
                hide(this.videoTogetherSetting);
                this.inputRoomName = wrapper.querySelector('#videoTogetherRoomNameInput');
                this.inputRoomPassword = wrapper.querySelector("#videoTogetherRoomPdIpt");
                this.inputRoomNameLabel = wrapper.querySelector('#videoTogetherRoomNameLabel');
                this.inputRoomPasswordLabel = wrapper.querySelector("#videoTogetherRoomPasswordLabel");
                this.videoTogetherHeader = wrapper.querySelector("#videoTogetherHeader");
                this.videoTogetherFlyPannel = wrapper.getElementById("videoTogetherFlyPannel");
                this.videoTogetherSamllIcon = wrapper.getElementById("videoTogetherSamllIcon");

                this.volume = 1;
                this.statusText = wrapper.querySelector("#videoTogetherStatusText");
                this.InLobby(true);
                this.Init();
                setInterval(() => {
                    this.ShowPannel();
                }, 1000);
            }

            try {
                document.querySelector("#videoTogetherLoading").remove()
            } catch { }
        }

        ShowTxtMsgTouchPannel() {
            try {
                function exitFullScreen() {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) { /* Firefox */
                        document.mozCancelFullScreen();
                    }
                }
                exitFullScreen();
            } catch { }
            try {
                this.txtMsgTouchPannel.remove();
            } catch { }
            this.txtMsgTouchPannel = document.createElement('div');
            let touch = this.txtMsgTouchPannel;
            touch.id = "videoTogetherTxtMsgTouch";
            touch.style.width = "100%";
            touch.style.height = "100%";
            touch.style.position = "fixed";
            touch.style.top = "0";
            touch.style.left = "0";
            touch.style.zIndex = "2147483647";
            touch.style.background = "#fff";
            touch.style.display = "flex";
            touch.style.justifyContent = "center";
            touch.style.alignItems = "center";
            touch.style.padding = "0px";
            touch.style.flexDirection = "column";
            touch.style.lineHeight = "40px";
            AttachShadow(this.txtMsgTouchPannel, { mode: "open" })
            touch.addEventListener('click', function () {
                windowPannel.enableSpeechSynthesis();
                document.body.removeChild(touch);
                windowPannel.txtMsgTouchPannel = undefined;
            });
            document.body.appendChild(touch);

            this.setTxtMsgTouchPannelText("{$you_have_a_new_msg$}");
        }

        setTxtMsgInterface(type) {
            hide(this.textMessageChat);
            hide(this.textMessageConnecting);
            hide(this.textMessageConnectingStatus);
            hide(this.zhcnTtsMissing);
            if (type == 0) {

            }
            if (type == 1) {
                show(this.textMessageChat);
            }
            if (type == 2) {
                show(this.textMessageConnecting);
                this.textMessageConnectingStatus.innerText = "{$textMessageConnecting$}"
                show(this.textMessageConnectingStatus);
            }
            if (type == 3) {
                show(this.textMessageConnecting);
                show(this.zhcnTtsMissing);
            }
            if (type == 4) {
                show(this.textMessageConnecting);
                this.textMessageConnectingStatus.innerText = "{$textMessageDisabled$}"
                show(this.textMessageConnectingStatus);
            }
        }

        enableSpeechSynthesis() {
            if (!extension.speechSynthesisEnabled) {
                try {
                    extension.gotTextMsg("", "", true);
                    extension.speechSynthesisEnabled = true;
                    textVoiceAudio.play();
                } catch { }
            }
        }

        setTxtMsgTouchPannelText(s) {
            let span = document.createElement('span');
            span.style.fontSize = "40px";
            span.style.lineHeight = "40px";
            span.style.color = "black";
            span.style.overflowWrap = "break-word";
            span.style.textAlign = "center";
            span.textContent = s;
            this.txtMsgTouchPannel.shadowRoot.appendChild(span);
            let voiceSelect = document.createElement('select');
            this.voiceSelect = voiceSelect;
            voiceSelect.onclick = (e) => {
                e.stopPropagation();
            }
            let label = span.cloneNode(true);
            label.textContent = "{$choose_voice_below$}";
            this.txtMsgTouchPannel.shadowRoot.appendChild(document.createElement('br'));
            this.txtMsgTouchPannel.shadowRoot.appendChild(label);
            let voices = speechSynthesis.getVoices();
            voices.forEach(function (voice, index) {
                var option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = voice.name + ' (' + voice.lang + ')';
                voiceSelect.appendChild(option);
            });
            voiceSelect.oninput = (e) => {
                console.log(e);
                sendMessageToTop(MessageType.SetStorageValue, { key: "PublicMessageVoice", value: voiceSelect.value });
            }
            voiceSelect.style.fontSize = "20px";
            voiceSelect.style.height = "50px";
            voiceSelect.style.maxWidth = "100%";
            try {
                if (window.VideoTogetherStorage.PublicMessageVoice != undefined) {
                    voiceSelect.value = window.VideoTogetherStorage.PublicMessageVoice;
                } else {
                    voiceSelect.value = speechSynthesis.getVoices().find(v => v.default).voiceURI;
                }
            } catch { };
            this.txtMsgTouchPannel.shadowRoot.appendChild(voiceSelect)
        }

        ShowPannel() {
            if (!document.documentElement.contains(this.shadowWrapper)) {
                (document.body || document.documentElement).appendChild(this.shadowWrapper);
            }
        }

        Minimize(isDefault = false) {
            this.minimized = true;
            if (!isDefault) {
                this.SaveIsMinimized(true);
            }
            this.disableDefaultSize = true;
            hide(this.videoTogetherFlyPannel);
            show(this.videoTogetherSamllIcon);
        }

        Maximize(isDefault = false) {
            this.minimized = false;
            if (!isDefault) {
                this.SaveIsMinimized(false);
            }
            this.disableDefaultSize = true;
            show(this.videoTogetherFlyPannel);
            hide(this.videoTogetherSamllIcon);
        }

        SaveIsMinimized(minimized) {
            localStorage.setItem("VideoTogetherMinimizedHere", minimized ? 1 : 0)
        }

        Init() {
            let VideoTogetherMinimizedHere = localStorage.getItem("VideoTogetherMinimizedHere");
            if (VideoTogetherMinimizedHere == 0) {
                this.Maximize(true);
            } else if (VideoTogetherMinimizedHere == 1) {
                this.Minimize(true);
            }
        }

        InRoom() {
            try {
                speechSynthesis.getVoices();
            } catch { };
            this.Maximize();
            this.inputRoomName.disabled = true;
            hide(this.lobbyBtnGroup)
            show(this.roomButtonGroup);
            this.exitButton.style = "";
            hide(this.inputRoomPasswordLabel);
            hide(this.inputRoomPassword);
            this.inputRoomName.placeholder = "";
            this.isInRoom = true;
            hide(this.downloadBtn)
        }

        InLobby(init = false) {
            if (!init) {
                this.Maximize();
            }
            this.inputRoomName.disabled = false;
            this.inputRoomPasswordLabel.style.display = "inline-block";
            this.inputRoomPassword.style.display = "inline-block";
            this.inputRoomName.placeholder = "{$room_input_placeholder$}"
            show(this.lobbyBtnGroup);
            hide(this.roomButtonGroup);
            hide(this.easyShareCopyBtn);
            this.setTxtMsgInterface(0);
            dsply(this.downloadBtn, downloadEnabled())
            this.isInRoom = false;
        }

        CreateRoomButtonOnClick() {
            this.Maximize();
            let roomName = this.inputRoomName.value;
            let password = this.inputRoomPassword.value;
            window.videoTogetherExtension.CreateRoom(roomName, password);
        }

        JoinRoomButtonOnClick() {
            this.Maximize();
            let roomName = this.inputRoomName.value;
            let password = this.inputRoomPassword.value;
            window.videoTogetherExtension.JoinRoom(roomName, password);
        }

        HelpButtonOnClick() {
            this.Maximize();
            let url = 'https://videotogether.github.io/guide/qa.html';
            if (language == 'zh-cn') {
                url = 'https://www.bilibili.com/opus/956528691876200471';
            }
            if (vtRuntime == "website") {
                url = "https://videotogether.github.io/guide/website_qa.html";
            }
            window.open(url, '_blank');
        }

        UpdateStatusText(text, color) {
            updateInnnerHTML(this.statusText, text);
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

        FetchRequest: 13,
        FetchResponse: 14,

        SetStorageValue: 15,
        SyncStorageValue: 16,

        ExtensionInitSuccess: 17,

        SetTabStorage: 18,
        SetTabStorageSuccess: 19,

        UpdateRoomRequest: 20,
        CallScheduledTask: 21,

        RoomDataNotification: 22,
        UpdateMemberStatus: 23,
        TimestampV2Resp: 24,
        // EasyShareCheckSucc: 25,
        FetchRealUrlReq: 26,
        FetchRealUrlResp: 27,
        FetchRealUrlFromIframeReq: 28,
        FetchRealUrlFromIframeResp: 29,
        SendTxtMsg: 30,
        GotTxtMsg: 31,
        StartDownload: 32,
        DownloadStatus: 33,


        UpdateM3u8Files: 1001,

        SaveIndexedDb: 2001,
        ReadIndexedDb: 2002,
        SaveIndexedDbResult: 2003,
        ReadIndexedDbResult: 2004,
        RegexMatchKeysDb: 2005,
        RegexMatchKeysDbResult: 2006,
        DeleteFromIndexedDb: 2007,
        DeleteFromIndexedDbResult: 2008,
        StorageEstimate: 2009,
        StorageEstimateResult: 2010,
        ReadIndexedDbSw: 2011,
        ReadIndexedDbSwResult: 2012,
        //2013 used

        IosStorageSet: 3001,
        IosStorageSetResult: 3002,
        IosStorageGet: 3003,
        IosStorageGetResult: 3004,
        IosStorageDelete: 3005,
        IosStorageDeleteResult: 3006,
        IosStorageUsage: 3007,
        IosStorageUsageResult: 3008,
        IosStorageCompact: 3009,
        IosStorageDeletePrefix: 3010,
        IosStorageDeletePrefixResult: 3011,
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

            this.video_together_host = '{{{ {"":"./config/release_host","debug":"./config/debug_host","order":0} }}}';
            this.video_together_main_host = '{{{ {"":"./config/release_host","order":0} }}}';
            this.video_together_backup_host = 'https://api.xn--6kr25xemln66b.com/';
            this.video_tag_names = ["video", "bwp-video", "fake-iframe-video"]

            this.timer = 0
            this.roomName = ""
            this.roomPassword = ""
            this.role = this.RoleEnum.Null
            this.url = ""
            this.duration = undefined
            this.waitForLoadding = false;
            this.playAfterLoadding = false;
            this.minTrip = 1e9;
            this.timeOffset = 0;
            this.lastScheduledTaskTs = 0;
            this.httpSucc = false;

            this.activatedVideo = undefined;
            this.tempUser = generateTempUserId();
            this.version = '{{timestamp}}';
            this.isMain = (window.self == window.top);
            this.UserId = undefined;

            this.callbackMap = new Map;
            this.allLinksTargetModified = false;
            this.voiceVolume = null;
            this.videoVolume = null;
            this.m3u8Files = {};
            this.m3u8DurationReCal = {};
            this.m3u8UrlTestResult = {};
            this.hasCheckedM3u8Url = {};
            this.m3u8PostWindows = {};
            this.m3u8MediaUrls = {};
            this.currentM3u8Url = undefined;
            this.ctxMemberCount = 0;
            this.downloadSpeedMb = 0;
            this.downloadPercentage = 0;
            this.currentSendingMsgId = null;

            this.isIos = undefined;
            this.speechSynthesisEnabled = false;
            // we need a common callback function to deal with all message
            this.SetTabStorageSuccessCallback = () => { };
            document.addEventListener("securitypolicyviolation", (e) => {
                let host = (new URL(e.blockedURI)).host;
                this.cspBlockedHost[host] = true;
            });
            try {
                this.CreateVideoDomObserver();
            } catch { }
            this.timer = setInterval(() => this.ScheduledTask(true), 2 * 1000);
            this.videoMap = new Map();
            window.addEventListener('message', message => {
                if (message.data.context) {
                    this.tempUser = message.data.context.tempUser;
                    this.videoTitle = message.data.context.videoTitle;
                    this.voiceStatus = message.data.context.voiceStatus;
                    this.timeOffset = message.data.context.timeOffset;
                    this.ctxRole = message.data.context.ctxRole;
                    this.ctxMemberCount = message.data.context.ctxMemberCount;
                    this.ctxWsIsOpen = message.data.context.ctxWsIsOpen;
                    // sub frame has 2 storage data source, top frame or extension.js in this frame
                    // this 2 data source should be same.
                    window.VideoTogetherStorage = message.data.context.VideoTogetherStorage;
                }
                this.processReceivedMessage(message.data.type, message.data.data, message);
            });
            try {
                navigator.serviceWorker.addEventListener('message', (message) => {
                    console.log(`Received a message from service worker: ${event.data}`);
                    this.processReceivedMessage(message.data.type, message.data.data, message);
                });
            } catch { };

            // if some element's click be invoked frequenctly, a lot of http request will be sent
            // window.addEventListener('click', message => {
            //     setTimeout(this.ScheduledTask.bind(this), 200);
            // })

            if (this.isMain) {
                try {
                    try {
                        this.RecoveryState();
                    } catch { }
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
        }

        async gotTextMsg(id, msg, prepare = false, idx = -1, audioUrl = undefined) {
            if (idx > speechSynthesis.getVoices().length) {
                return;
            }
            if (!prepare && !extension.speechSynthesisEnabled) {
                windowPannel.ShowTxtMsgTouchPannel();
                for (let i = 0; i <= 1000 && !extension.speechSynthesisEnabled; i++) {
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            try {
                if (id == this.currentSendingMsgId && msg == select("#textMessageInput").value) {
                    select("#textMessageInput").value = "";
                }
            } catch { }

            // iOS cannot play audio in background
            if (!isEmpty(audioUrl) && !this.isIos) {
                textVoiceAudio.src = audioUrl;
                textVoiceAudio.play();
                return;
            }

            let ssu = new SpeechSynthesisUtterance();
            ssu.text = msg;
            ssu.volume = 1;
            ssu.rate = 1;
            ssu.pitch = 1;
            if (idx == -1) {
                try {
                    ssu.voice = speechSynthesis.getVoices().find(v => v.voiceURI == window.VideoTogetherStorage.PublicMessageVoice);
                } catch { }
            } else {
                ssu.voice = speechSynthesis.getVoices()[idx];
            }
            if (!prepare) {
                let startTs = 0;
                ssu.onstart = (e => { startTs = e.timeStamp });
                ssu.onend = (e => {
                    const duration = e.timeStamp - startTs;
                    if (duration < 100) {
                        this.gotTextMsg(id, msg, prepare, idx + 1);
                    }
                });
            }
            speechSynthesis.speak(ssu);
        }

        setRole(role) {
            let setRoleText = text => {
                updateInnnerHTML(window.videoTogetherFlyPannel.videoTogetherRoleText, text);
            }
            this.role = role
            switch (role) {
                case this.RoleEnum.Master:
                    setRoleText("{$host_role$}");
                    break;
                case this.RoleEnum.Member:
                    setRoleText("{$memeber_role$}");
                    break;
                default:
                    setRoleText("");
                    break;
            }
        }

        async generateEasyShareLink(china = false) {
            const path = `${language}/easyshare.html?VideoTogetherRole=3&VideoTogetherRoomName=${this.roomName}&VideoTogetherTimestamp=9999999999&VideoTogetherUrl=&VideoTogetherPassword=${this.password}`;
            if (china) {
                return getCdnPath(await getEasyShareHostChina(), path);
            } else {
                return getCdnPath('https://videotogether.github.io', path);
            }
        }

        async Fetch(url, method = 'GET', data = null) {
            if (!extension.isMain) {
                console.error("fetch in child");
                throw new Error("fetch in child");
            }
            url = new URL(url);
            url.searchParams.set("version", this.version);
            try {
                url.searchParams.set("language", language);
                url.searchParams.set("voiceStatus", this.isMain ? Voice.status : this.voiceStatus);
                url.searchParams.set("loaddingVersion", window.VideoTogetherStorage.LoaddingVersion);
                url.searchParams.set("runtimeType", window.VideoTogetherStorage.UserscriptType);
            } catch (e) { }
            try {
                url.searchParams.set("userId", window.VideoTogetherStorage.PublicUserId);
            } catch (e) { }
            url = url.toString();
            let host = (new URL(url)).host;
            if (this.cspBlockedHost[host] || url.startsWith('http:')) {
                let id = generateUUID()
                return await new Promise((resolve, reject) => {
                    this.callbackMap.set(id, (data) => {
                        if (data.data) {
                            resolve({ json: () => data.data, status: 200 });
                        } else {
                            reject(new Error(data.error));
                        }
                        this.callbackMap.delete(id);
                    })
                    sendMessageToTop(MessageType.FetchRequest, {
                        id: id,
                        url: url.toString(),
                        method: method,
                        data: data,
                    });
                    setTimeout(() => {
                        try {
                            if (this.callbackMap.has(id)) {
                                this.callbackMap.get(id)({ error: "{$timeout$}" });
                            }
                        } finally {
                            this.callbackMap.delete(id);
                        }
                    }, 20000);
                });
            }

            try {
                if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.fetch))) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    return await window.fetch(url, {
                        method: method,
                        body: data == null ? undefined : JSON.stringify(data),
                        signal: controller.signal
                    });
                } else {
                    GetNativeFunction();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    return await Global.NativeFetch.call(window, url, {
                        method: method,
                        body: data == null ? undefined : JSON.stringify(data),
                        signal: controller.signal
                    });
                }
            } catch (e) {
                const host = new URL(extension.video_together_host);
                const requestUrl = new URL(url);
                if (host.hostname == requestUrl.hostname) {
                    extension.httpSucc = false;
                }
                throw e;
            }
        }

        async ForEachVideo(func) {
            try {
                if (window.location.hostname.endsWith("iqiyi.com")) {
                    let video = document.querySelector('.iqp-player-videolayer-inner > video');
                    if (video != null) {
                        video.VideoTogetherChoosed = true;
                        try { await func(video) } catch { };
                    }
                }
                // disneyplus
                if (window.location.hostname.endsWith("disneyplus.com")) {
                    try {
                        let ff = document.querySelector('.ff-10sec-icon');
                        let rr = document.querySelector('.rwd-10sec-icon');
                        let video = document.querySelector('video');
                        if (ff && rr && video) {
                            if (!video.videoTogetherVideoWrapper) {
                                video.videoTogetherVideoWrapper = new VideoWrapper();
                            }
                            let videoWrapper = video.videoTogetherVideoWrapper;
                            videoWrapper.play = async () => await video.play();
                            videoWrapper.pause = async () => await video.pause();
                            videoWrapper.paused = video.paused
                            videoWrapper.currentTimeGetter = () => video.currentTime;
                            videoWrapper.currentTimeSetter = (v) => {
                                let isFf = v > video.currentTime;
                                let d = Math.abs(v - video.currentTime);
                                let clickTime = parseInt(d / 10);
                                if (clickTime > 0) {
                                    console.log(clickTime);
                                }
                                for (let i = 0; i < clickTime; i++) {
                                    isFf ? ff.click() : rr.click();
                                }
                                setTimeout(() => {
                                    isFf ? ff.click() : rr.click();
                                    if (!isVideoLoadded(video)) {
                                        console.log("loading");
                                        ff.click();
                                        rr.click();
                                    }
                                    setTimeout(() => {
                                        if (isVideoLoadded(video)) {
                                            video.currentTime = v;
                                        }
                                    }, 100);
                                }, 200);
                            }
                            videoWrapper.duration = video.duration;
                            videoWrapper.playbackRateGetter = () => video.playbackRate;
                            videoWrapper.playbackRateSetter = (v) => { video.playbackRate = v };
                            await func(videoWrapper);
                        }
                    } catch (e) { }
                }
                // Netflix
                if (window.location.hostname.endsWith("netflix.com")) {
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
                        try {
                            if (document.querySelector('.vjs-controls-enabled').player != undefined) {
                                this.BaiduPanPlayer = document.querySelector('.vjs-controls-enabled').player;
                            }
                        } catch { }
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
                        videoWrapper.playbackRateGetter = () => this.BaiduPanPlayer.playbackRate();
                        videoWrapper.playbackRateSetter = (v) => this.BaiduPanPlayer.playbackRate(v);
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

            this.video_tag_names.forEach(async tag => {
                let videos = document.getElementsByTagName(tag);
                for (let i = 0; i < videos.length; i++) {
                    try {
                        try {
                            if (videos[i].VideoTogetherDisabled) {
                                continue;
                            }
                        } catch { };
                        try {
                            if (window.location.hostname.endsWith('bilibili.com')) {
                                if (!!videos[i].closest('div.video-page-card-small') || !!videos[i].closest('div.feed-card')) {
                                    // this is a thumbnail video
                                    continue
                                }
                            }
                        } catch { }
                        await func(videos[i]);
                    } catch (e) { console.error(e) };
                }
            });
        }

        sendMessageToSonWithContext(type, data) {
            if (this.isMain) {
                this.ctxRole = this.role;
            }
            let iframs = document.getElementsByTagName("iframe");
            for (let i = 0; i < iframs.length; i++) {
                PostMessage(iframs[i].contentWindow, {
                    source: "VideoTogether",
                    type: type,
                    data: data,
                    context: {
                        tempUser: this.tempUser,
                        videoTitle: this.isMain ? document.title : this.videoTitle,
                        voiceStatus: this.isMain ? Voice.status : this.voiceStatus,
                        VideoTogetherStorage: window.VideoTogetherStorage,
                        timeOffset: this.timeOffset,
                        ctxRole: this.ctxRole,
                        ctxMemberCount: this.ctxMemberCount,
                        ctxWsIsOpen: this.ctxWsIsOpen
                    }
                });
                // console.info("send ", type, iframs[i].contentWindow, data)
            }
        }

        async FetchRemoteRealUrl(m3u8Url, idx, originUrl) {
            if (realUrlCache[originUrl] != undefined) {
                return realUrlCache[originUrl];
            }
            if (this.isMain) {
                WS.urlReq(m3u8Url, idx, originUrl);
            } else {
                sendMessageToTop(MessageType.FetchRealUrlFromIframeReq, { m3u8Url: m3u8Url, idx: idx, origin: originUrl });
            }

            return new Promise((res, rej) => {
                let id = setInterval(() => {
                    if (realUrlCache[originUrl] != undefined) {
                        res(realUrlCache[originUrl]);
                        clearInterval(id);
                    }
                }, 200);
                setTimeout(() => {
                    clearInterval(id);
                    rej(null);
                }, 3000);
            });
        }

        async FetchRemoteM3u8Content(m3u8Url) {
            if (m3u8ContentCache[m3u8Url] != undefined) {
                return m3u8ContentCache[m3u8Url];
            }
            WS.m3u8ContentReq(m3u8Url);
            return new Promise((res, rej) => {
                let id = setInterval(() => {
                    if (m3u8ContentCache[m3u8Url] != undefined) {
                        res(m3u8ContentCache[m3u8Url]);
                        clearInterval(id);
                    }
                })
                setTimeout(() => {
                    clearInterval(id);
                    rej(null);
                }, 3000)
            })
        }

        GetM3u8Content(m3u8Url) {
            let m3u8Content = "";
            for (let id in this.m3u8Files) {
                this.m3u8Files[id].forEach(m3u8 => {
                    if (m3u8Url == m3u8.m3u8Url) {
                        m3u8Content = m3u8.m3u8Content;
                    }
                })
            }
            return m3u8Content;
        }

        GetM3u8WindowId(m3u8Url) {
            let windowId = undefined;
            for (let id in this.m3u8Files) {
                this.m3u8Files[id].forEach(m3u8 => {
                    if (m3u8Url == m3u8.m3u8Url) {
                        windowId = id;
                    }
                })
            }
            return windowId;
        }

        UrlRequest(m3u8Url, idx, origin) {
            for (let id in this.m3u8Files) {
                this.m3u8Files[id].forEach(m3u8 => {
                    if (m3u8Url == m3u8.m3u8Url) {
                        let urls = extractMediaUrls(m3u8.m3u8Content, m3u8.m3u8Url);
                        let url = urls[idx];
                        sendMessageTo(this.m3u8PostWindows[id], MessageType.FetchRealUrlReq, { url: url, origin: origin });
                    }
                })
            }
        }

        async testM3u8OrVideoUrl(testUrl) {
            const onsecuritypolicyviolation = (e) => {
                if (e.blockedURI == testUrl) {
                    // m3u8 can always be fetched, because hls.js
                    this.m3u8UrlTestResult[testUrl] = 'video'
                }
            }
            document.addEventListener("securitypolicyviolation", onsecuritypolicyviolation)
            if (this.m3u8UrlTestResult[testUrl] != undefined) {
                return this.m3u8UrlTestResult[testUrl];
            }
            function limitStream(stream, limit) {
                const reader = stream.getReader();
                let bytesRead = 0;

                return new ReadableStream({
                    async pull(controller) {
                        const { value, done } = await reader.read();

                        if (done || bytesRead >= limit) {
                            controller.close();
                            return;
                        }

                        bytesRead += value.byteLength;
                        controller.enqueue(value);
                    },

                    cancel(reason) {
                        reader.cancel(reason);
                    }
                });
            }

            return new Promise((res, rej) => {
                const rtnType = (tp) => {
                    if (this.m3u8UrlTestResult[testUrl] == undefined) {
                        this.m3u8UrlTestResult[testUrl] = tp
                    }
                    res(this.m3u8UrlTestResult[testUrl])
                }
                const abortController = new AbortController();
                VideoTogetherFetch(testUrl, { signal: abortController.signal }).then(response => {
                    const contentType = response.headers.get('Content-Type')
                    if (contentType.startsWith('video/')) {
                        rtnType('video');
                    }
                    const limitedStream = limitStream(response.body, 1024); // Limit to 1024 bytes
                    return new Response(limitedStream, { headers: response.headers });
                }).then(r => r.text())
                    .then(async txt => {
                        abortController.abort();
                        if (isM3U8(txt)) {
                            rtnType('m3u8');
                        } else {
                            rtnType('video');
                        }
                    }).catch(e => {
                        if (testUrl.startsWith('blob')) {
                            rtnType('unknown');
                        } else {
                            rtnType('video');
                        }
                    }).finally(() => {
                        document.removeEventListener("securitypolicyviolation", onsecuritypolicyviolation)
                    })
            })
        }

        // download
        GetAllM3u8SegUrls(m3u8Url) {
            for (let id in this.m3u8Files) {
                for (let mid in this.m3u8Files[id]) {
                    let m3u8 = this.m3u8Files[id][mid]
                    if (m3u8Url == m3u8.m3u8Url) {
                        return extractMediaUrls(m3u8.m3u8Content, m3u8.m3u8Url);
                    }
                }
            }
        }

        // end of download

        UpdateStatusText(text, color) {
            if (window.self != window.top) {
                sendMessageToTop(MessageType.UpdateStatusText, { text: text + "", color: color });
            } else {
                window.videoTogetherFlyPannel.UpdateStatusText(text + "", color);
            }
        }

        async processReceivedMessage(type, data, _msg) {
            let _this = this;
            // console.info("get ", type, window.location, data);
            switch (type) {
                case MessageType.CallScheduledTask:
                    this.ScheduledTask();
                    break;
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
                            } catch (e) {
                                this.UpdateStatusText(e, "red");
                            }
                        }
                    })
                    this.sendMessageToSonWithContext(type, data);
                    break;
                case MessageType.UpdateRoomRequest:
                    let m3u8Url = undefined;
                    try {
                        let d = NaN;
                        let selected = null;
                        for (let id in this.m3u8Files) {
                            this.m3u8Files[id].forEach(m3u8 => {
                                // here m3u8Url may be empty, may caused by the new response
                                // from limitedstream, but we have a new fetch after that,
                                // so we can always get the correct url.
                                if (isNaN(d) || Math.abs(data.duration - m3u8.duration) <= d) {
                                    d = Math.abs(data.duration - m3u8.duration);
                                    selected = m3u8;
                                }
                                return;
                            })
                        }
                        if (d < 3 || d / data.duration < 0.03) {
                            m3u8Url = selected.m3u8Url;
                        }
                    } catch { }
                    if (data.m3u8Url == undefined) {
                        data.m3u8Url = m3u8Url;
                    } else {
                    }// data.m3u8Url may be a video file

                    if (data.m3u8UrlType == 'video') {
                        this.downloadM3u8Url = data.m3u8Url;
                        this.downloadM3u8UrlType = 'video';
                        this.downloadDuration = data.duration;
                    } else {
                        if (m3u8Url != undefined) {
                            this.downloadM3u8Url = m3u8Url;
                            this.downloadDuration = data.duration;
                            this.downloadM3u8UrlType = 'm3u8'; // video or other
                        } else {
                            this.downloadM3u8Url = undefined;
                            this.downloadDuration = undefined;
                        }
                    }


                    if (!isEasyShareEnabled()) {
                        data.m3u8Url = "";
                    }
                    try {
                        function showEasyShareCopyBtn() {
                            if (language == 'zh-cn') {
                                getCdnConfig(encodedChinaCdnA).then(() => show(windowPannel.easyShareCopyBtn));
                            } else {
                                show(windowPannel.easyShareCopyBtn);
                            }
                        }
                        if (!isEmpty(data.m3u8Url) && isEasyShareEnabled()) {
                            this.currentM3u8Url = data.m3u8Url;
                            showEasyShareCopyBtn();
                        } else {
                            this.currentM3u8Url = undefined;
                            if (isWeb()) {
                                showEasyShareCopyBtn();
                            } else {
                                hide(windowPannel.easyShareCopyBtn);
                            }
                        }
                    } catch { };
                    try {
                        await this.UpdateRoom(data.name, data.password, data.url, data.playbackRate, data.currentTime, data.paused, data.duration, data.localTimestamp, data.m3u8Url);
                        if (this.waitForLoadding) {
                            this.UpdateStatusText("{$wait_for_memeber_loadding$}", "red");
                        } else {
                            _this.UpdateStatusText("{$sync_success$} " + _this.GetDisplayTimeText(), "green");
                        }
                    } catch (e) {
                        this.UpdateStatusText(e, "red");
                    }
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
                    this.sendMessageToSonWithContext(type, data);
                    break;
                case MessageType.GetRoomData:
                    this.duration = data["duration"];
                    break;
                case MessageType.UpdateStatusText:
                    window.videoTogetherFlyPannel.UpdateStatusText(data.text, data.color);
                    break;
                case MessageType.JumpToNewPage:
                    window.location = data.url;
                    let currentUrl = new URL(window.location);
                    let newUrl = new URL(data.url);
                    if (newUrl.hash != "") {
                        currentUrl.hash = "";
                        newUrl.hash = "";
                        if (currentUrl.href == newUrl.href) {
                            extension.url = data.url;
                            // window.location.reload();// for hash change
                        }
                    }
                    break;
                case MessageType.ChangeVideoVolume:
                    this.ForEachVideo(video => {
                        video.volume = data.volume;
                    });
                    this.sendMessageToSonWithContext(type, data);
                    break;
                case MessageType.FetchResponse: {
                    try {
                        this.callbackMap.get(data.id)(data);
                    } catch { };
                    break;
                }
                case MessageType.SyncStorageValue: {
                    const firstSync = (window.VideoTogetherSettingEnabled == undefined)
                    window.VideoTogetherStorage = data;
                    if (!this.isMain) {
                        return;
                    }
                    try {
                        if (window.VideoTogetherStorage.PublicNextDownload.url == window.location.href
                            && this.HasDownload != true) {
                            const a = document.createElement("a");
                            a.href = window.VideoTogetherStorage.PublicNextDownload.url;
                            a.download = window.VideoTogetherStorage.PublicNextDownload.filename;
                            a.click();
                            this.HasDownload = true;
                        }
                    } catch { }
                    try {
                        if (!this.RecoveryStateFromTab) {
                            this.RecoveryStateFromTab = true;
                            this.RecoveryState()
                        }
                    } catch (e) { };
                    try {
                        if (data.PublicMessageVoice != null) {
                            windowPannel.voiceSelect.value = data.PublicMessageVoice;
                        }
                    } catch { };
                    if (!window.videoTogetherFlyPannel.disableDefaultSize && firstSync) {
                        if (data.MinimiseDefault) {
                            window.videoTogetherFlyPannel.Minimize(true);
                        } else {
                            window.videoTogetherFlyPannel.Maximize(true);
                        }
                    }
                    if (typeof (data.PublicUserId) != 'string' || data.PublicUserId.length < 5) {
                        sendMessageToTop(MessageType.SetStorageValue, { key: "PublicUserId", value: generateUUID() });
                    }
                    try {
                        if (firstSync) {
                            if (!isWeb()) {
                                window.videoTogetherFlyPannel.videoTogetherSetting.href = "https://videotogether.github.io/setting/v2.html";
                                show(select('#videoTogetherSetting'));
                            } else {
                                // website
                                if (window.videoTogetherWebsiteSettingUrl != undefined) {
                                    window.videoTogetherFlyPannel.videoTogetherSetting.href = window.videoTogetherWebsiteSettingUrl;
                                    show(select('#videoTogetherSetting'));
                                }
                            }
                        }
                    } catch (e) { }
                    try {
                        dsply(select('#downloadBtn'), downloadEnabled() && !windowPannel.isInRoom)
                    } catch { }
                    window.VideoTogetherSettingEnabled = true;
                    break;
                }
                case MessageType.SetTabStorageSuccess: {
                    this.SetTabStorageSuccessCallback();
                    break;
                }
                case MessageType.RoomDataNotification: {
                    if (data['uuid'] != "") {
                        roomUuid = data['uuid'];
                    }
                    changeBackground(data['backgroundUrl']);
                    changeMemberCount(data['memberCount'])
                    break;
                }
                case MessageType.UpdateMemberStatus: {
                    WS.updateMember(this.roomName, this.password, data.isLoadding, this.url);
                    break;
                }
                case MessageType.TimestampV2Resp: {
                    let l1 = data['data']['sendLocalTimestamp'];
                    let s1 = data['data']['receiveServerTimestamp'];
                    let s2 = data['data']['sendServerTimestamp'];
                    let l2 = data['ts']
                    this.UpdateTimestampIfneeded(s1, l1, l2 - s2 + s1);
                    break;
                }
                case MessageType.UpdateM3u8Files: {
                    data['m3u8Files'].forEach(m3u8 => {
                        try {
                            function calculateM3U8Duration(textContent) {
                                let totalDuration = 0;
                                const lines = textContent.split('\n');

                                for (let i = 0; i < lines.length; i++) {
                                    if (lines[i].startsWith('#EXTINF:')) {
                                        if (i + 1 >= lines.length || lines[i + 1].startsWith('#')) {
                                            continue;
                                        }
                                        let durationLine = lines[i];
                                        let durationParts = durationLine.split(':');
                                        if (durationParts.length > 1) {
                                            let durationValue = durationParts[1].split(',')[0];
                                            let duration = parseFloat(durationValue);
                                            if (!isNaN(duration)) {
                                                totalDuration += duration;
                                            }
                                        }
                                    }
                                }
                                return totalDuration;
                            }

                            const cyrb53 = (str, seed = 0) => {
                                let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
                                for (let i = 0, ch; i < str.length; i++) {
                                    ch = str.charCodeAt(i);
                                    h1 = Math.imul(h1 ^ ch, 2654435761);
                                    h2 = Math.imul(h2 ^ ch, 1597334677);
                                }
                                h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
                                h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
                                h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
                                h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

                                return 4294967296 * (2097151 & h2) + (h1 >>> 0);
                            };
                            if (m3u8.m3u8Url.startsWith("data:")) {
                                m3u8.m3u8Url = `${cyrb53(m3u8.m3u8Url)}`;
                            }
                            if (this.m3u8DurationReCal[m3u8.m3u8Url] == undefined) {
                                this.m3u8DurationReCal[m3u8.m3u8Url] = calculateM3U8Duration(m3u8.m3u8Content);
                            }
                            m3u8.duration = this.m3u8DurationReCal[m3u8.m3u8Url];
                        } catch { }
                    })
                    this.m3u8Files[data['id']] = data['m3u8Files'];
                    this.m3u8PostWindows[data['id']] = _msg.source;
                    break;
                }
                case MessageType.FetchRealUrlReq: {
                    console.log(data);
                    if (realUrlCache[data.url] == undefined) {
                        const controller = new AbortController();
                        let r = await Fetch(data.url, {
                            method: "GET",
                            signal: controller.signal
                        });
                        controller.abort();
                        realUrlCache[data.url] = r.url;
                    }
                    sendMessageToTop(MessageType.FetchRealUrlResp, { origin: data.origin, real: realUrlCache[data.url] });
                    break;
                }
                case MessageType.FetchRealUrlResp: {
                    console.log(data);
                    WS.urlResp(data.origin, data.real);
                    break;
                }
                case MessageType.FetchRealUrlFromIframeReq: {
                    let real = await extension.FetchRemoteRealUrl(data.m3u8Url, data.idx, data.origin);
                    sendMessageTo(_msg.source, MessageType.FetchRealUrlFromIframeResp, { origin: data.origin, real: real });
                    break;
                }
                case MessageType.FetchRealUrlFromIframeResp: {
                    realUrlCache[data.origin] = data.real;
                    break;
                }
                case MessageType.SendTxtMsg: {
                    WS.sendTextMessage(data.currentSendingMsgId, data.value);
                    break;
                }
                case MessageType.GotTxtMsg: {
                    try {
                        GotTxtMsgCallback(data.id, data.msg);
                    } catch { };
                    this.sendMessageToSonWithContext(MessageType.GotTxtMsg, data);
                    break;
                }
                case MessageType.ReadIndexedDbSw: {
                    const result = await readFromIndexedDB(data.table, data.key);
                    data.data = result
                    navigator.serviceWorker.controller.postMessage({
                        source: "VideoTogether",
                        type: 2012,
                        data: data
                    });
                    break;
                }
                case MessageType.StartDownload: {
                    startDownload(data.m3u8Url, data.m3u8Content, data.urls, data.title, data.pageUrl);
                    setInterval(() => {
                        sendMessageToTop(MessageType.DownloadStatus, {
                            downloadSpeedMb: this.downloadSpeedMb,
                            downloadPercentage: this.downloadPercentage
                        })
                    }, 1000)
                    break;
                }
                case MessageType.DownloadStatus: {
                    extension.downloadSpeedMb = data.downloadSpeedMb;
                    extension.downloadPercentage = data.downloadPercentage;
                    if (extension.downloadPercentage == 100) {
                        if (this.downloadM3u8Completed != true) {
                            this.downloadM3u8Completed = true;
                            extension.Fetch(extension.video_together_host + "/beta/counter?key=download_m3u8_completed")
                        }
                        hide(select("#downloadingAlert"))
                        show(select("#downloadCompleted"))
                    }
                    select("#downloadStatus").innerText = extension.downloadPercentage + "% "
                    select("#downloadSpeed").innerText = extension.downloadSpeedMb.toFixed(2) + "MB/s"
                    select("#downloadProgressBar").value = extension.downloadPercentage
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
                videoDom.VideoTogetherVideoId = generateUUID();
            }
            sendMessageToTop(MessageType.ActivatedVideo, new VideoModel(videoDom.VideoTogetherVideoId, videoDom.duration, Date.now() / 1000, Date.now() / 1000));
        }

        addListenerMulti(el, s, fn) {
            s.split(' ').forEach(e => el.addEventListener(e, fn, false));
        }

        VideoClicked(e) {
            console.info("vide event: ", e.type);
            // maybe we need to check if the event is activated by user interaction
            this.setActivatedVideoDom(e.target);
            if (!isLimited()) {
                sendMessageToTop(MessageType.CallScheduledTask, {});
            }
        }

        AddVideoListener(videoDom) {
            if (this.VideoClickedListener == undefined) {
                this.VideoClickedListener = this.VideoClicked.bind(this)
            }
            this.addListenerMulti(videoDom, "play pause seeked", this.VideoClickedListener);
        }

        CreateVideoDomObserver() {
            let _this = this;
            let observer = new WebKitMutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        if (mutation.addedNodes[i].tagName == "VIDEO" || mutation.addedNodes[i].tagName == "BWP-VIDEO") {
                            try {
                                _this.AddVideoListener(mutation.addedNodes[i]);
                            } catch { }
                        }
                        try {
                            let videos = mutation.addedNodes[i].querySelectorAll("video");
                            [...videos].forEach(v => _this.AddVideoListener(v));
                        } catch { }
                        try {
                            if (extension.isMain && window.VideoTogetherStorage.OpenAllLinksInSelf != false && _this.role != _this.RoleEnum.Null) {
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

        async SyncTimeWithServer(url = null) {
            if (url == null) {
                url = this.video_together_host;
            }
            let startTime = Date.now() / 1000;
            let response = await this.Fetch(url + "/timestamp");
            let endTime = Date.now() / 1000;
            let data = await this.CheckResponse(response);
            this.httpSucc = true
            this.video_together_host = url;
            this.UpdateTimestampIfneeded(data["timestamp"], startTime, endTime);
            sendMessageToTop(MessageType.SetStorageValue, { key: "PublicVtVersion", value: data["vtVersion"] });
        }

        RecoveryState() {
            function RecoveryStateFrom(getFunc) {
                let vtRole = getFunc("VideoTogetherRole");
                let vtUrl = getFunc("VideoTogetherUrl");
                let vtRoomName = getFunc("VideoTogetherRoomName");
                let timestamp = parseFloat(getFunc("VideoTogetherTimestamp"));
                let password = getFunc("VideoTogetherPassword");
                let voice = getFunc("VideoTogetherVoice");
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
                        switch (voice) {
                            case VoiceStatus.MUTED:
                                Voice.join("", vtRoomName, true);
                                break;
                            case VoiceStatus.UNMUTED:
                                Voice.join("", vtRoomName, false);
                                break;
                            default:
                                Voice.status = VoiceStatus.STOP;
                                break;
                        }
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
            if (name == "") {
                popupError("{$please_input_room_name$}")
                return;
            }
            try {
                this.tempUser = generateTempUserId();
                this.roomName = name;
                this.password = password;
                this.setRole(this.RoleEnum.Member);
                window.videoTogetherFlyPannel.InRoom();
            } catch (e) {
                this.UpdateStatusText(e, "red");
            }
        }

        exitRoom() {
            this.voiceVolume = null;
            this.videoVolume = null;
            roomUuid = null;
            WS.disconnect();
            Voice.stop();
            show(select('#mainPannel'));
            hide(select('#voicePannel'));
            this.duration = undefined;
            window.videoTogetherFlyPannel.inputRoomName.value = "";
            window.videoTogetherFlyPannel.inputRoomPassword.value = "";
            this.roomName = "";
            this.setRole(this.RoleEnum.Null);
            window.videoTogetherFlyPannel.InLobby();
            let state = this.GetRoomState("");
            sendMessageToTop(MessageType.SetTabStorage, state);
            this.SaveStateToSessionStorageWhenSameOrigin("");
        }

        getVoiceVolume() {
            if (this.voiceVolume != null) {
                return this.voiceVolume;
            }
            try {
                if (window.VideoTogetherStorage.VideoTogetherTabStorage.VoiceVolume != null) {
                    return window.VideoTogetherStorage.VideoTogetherTabStorage.VoiceVolume;
                }
            } catch { }
            return 100;
        }

        getVideoVolume() {
            if (this.videoVolume != null) {
                return this.videoVolume;
            }
            try {
                if (window.VideoTogetherStorage.VideoTogetherTabStorage.VideoVolume != null) {
                    return window.VideoTogetherStorage.VideoTogetherTabStorage.VideoVolume;
                }
            } catch { }
            return 100;
        }

        async ScheduledTask(scheduled = false) {
            if (scheduled && this.lastScheduledTaskTs + 2 > Date.now() / 1000) {
                return;
            }
            this.lastScheduledTaskTs = Date.now() / 1000;

            try {
                if (this.isMain) {
                    if (windowPannel.videoVolume.value != this.getVideoVolume()) {
                        windowPannel.videoVolume.value = this.getVideoVolume()
                        windowPannel.videoVolume.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    if (windowPannel.callVolumeSlider.value != this.getVoiceVolume()) {
                        windowPannel.callVolumeSlider.value = this.getVoiceVolume();
                        windowPannel.callVolumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    if (this.videoVolume != null) {
                        sendMessageToTop(MessageType.ChangeVideoVolume, { volume: this.getVideoVolume() / 100 });
                    }
                    [...select('#peer').querySelectorAll("*")].forEach(e => {
                        e.volume = this.getVoiceVolume() / 100;
                    });
                }
            } catch { }
            try {
                await this.ForEachVideo(video => {
                    if (video.VideoTogetherVideoId == undefined) {
                        video.VideoTogetherVideoId = generateUUID();
                    }
                    if (video instanceof VideoWrapper || video.VideoTogetherChoosed == true) {
                        // ad hoc
                        sendMessageToTop(MessageType.ReportVideo, new VideoModel(video.VideoTogetherVideoId, video.duration, 0, Date.now() / 1000, 1));
                    } else {
                        sendMessageToTop(MessageType.ReportVideo, new VideoModel(video.VideoTogetherVideoId, video.duration, 0, Date.now() / 1000));
                    }
                })
                this.videoMap.forEach((video, id, map) => {
                    if (video.refreshTime + VIDEO_EXPIRED_SECOND < Date.now() / 1000) {
                        map.delete(id);
                    }
                })
            } catch { };


            if (this.role != this.RoleEnum.Null) {
                if (this.isIos == null) {
                    this.isIos = await isAudioVolumeRO();
                }
                WS.connect();
                this.ctxWsIsOpen = WS.isOpen();
                if (!getEnableTextMessage()) {
                    windowPannel.setTxtMsgInterface(4);
                } else if (this.ctxWsIsOpen) {
                    windowPannel.setTxtMsgInterface(1);
                } else {
                    windowPannel.setTxtMsgInterface(2);
                }
                try {
                    if (this.isMain && window.VideoTogetherStorage.OpenAllLinksInSelf != false && !this.allLinksTargetModified) {
                        this.allLinksTargetModified = true;
                        this.openAllLinksInSelf();
                    }
                } catch { }
                try {
                    if (this.minTrip == 1e9 || !this.httpSucc) {
                        this.SyncTimeWithServer(this.video_together_main_host);
                        setTimeout(() => {
                            if (this.minTrip == 1e9 || !this.httpSucc) {
                                this.SyncTimeWithServer(this.video_together_backup_host);
                            }
                        }, 3000);
                    } else {
                        // TODO
                        // if (this.video_together_host == this.video_together_backup_host) {
                        //     this.SyncTimeWithServer(this.video_together_main_host);
                        // }
                    }
                } catch { };
            }

            try {
                switch (this.role) {
                    case this.RoleEnum.Null:
                        return;
                    case this.RoleEnum.Master: {
                        if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                            let state = this.GetRoomState("");
                            sendMessageToTop(MessageType.SetTabStorage, state);
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
                                1e9,
                                this.getLocalTimestamp());
                            throw new Error("{$no_video_in_this_page$}");
                        } else {
                            sendMessageToTop(MessageType.SyncMasterVideo, {
                                waitForLoadding: this.waitForLoadding,
                                video: video,
                                password: this.password,
                                roomName: this.roomName,
                                link: this.linkWithoutState(window.location)
                            });
                        }
                        break;
                    }
                    case this.RoleEnum.Member: {
                        let room = await this.GetRoom(this.roomName, this.password);
                        sendMessageToTop(MessageType.RoomDataNotification, room);
                        this.duration = room["duration"];
                        let newUrl = room["url"];
                        if (isEasyShareMember()) {
                            if (isEmpty(room['m3u8Url'])) {
                                throw new Error("{$video_not_supported$}");
                            } else {
                                let _url = new URL(window.location);
                                _url.hash = room['m3u8Url'];
                                newUrl = _url.href;
                                window.VideoTogetherEasyShareUrl = room['url'];
                                window.VideoTogetherEasyShareTitle = room['videoTitle'];
                            }
                        }
                        if (newUrl != this.url && (window.VideoTogetherStorage == undefined || !window.VideoTogetherStorage.DisableRedirectJoin)) {
                            if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                                let state = this.GetRoomState(newUrl);
                                sendMessageToTop(MessageType.SetTabStorage, state);
                                setInterval(() => {
                                    if (window.VideoTogetherStorage.VideoTogetherTabStorage.VideoTogetherUrl == newUrl) {
                                        try {
                                            if (isWeb()) {
                                                if (!this._jumping && window.location.origin != (new URL(newUrl).origin)) {
                                                    this._jumping = true;
                                                    alert("{$please_join_again_after_jump$}");
                                                }
                                            }
                                        } catch { };
                                        this.SetTabStorageSuccessCallback = () => {
                                            sendMessageToTop(MessageType.JumpToNewPage, { url: newUrl });
                                            this.SetTabStorageSuccessCallback = () => { };
                                        }
                                    }
                                }, 200);
                            } else {
                                if (this.SaveStateToSessionStorageWhenSameOrigin(newUrl)) {
                                    sendMessageToTop(MessageType.JumpToNewPage, { url: newUrl });
                                } else {
                                    sendMessageToTop(MessageType.JumpToNewPage, { url: this.linkWithMemberState(newUrl).toString() });
                                }
                            }
                        } else {
                            let state = this.GetRoomState("");
                            sendMessageToTop(MessageType.SetTabStorage, state);
                        }
                        if (this.PlayAdNow()) {
                            throw new Error("{$ad_playing$}");
                        }
                        let video = this.GetVideoDom();
                        if (video == undefined) {
                            throw new Error("{$no_video_in_this_page$}");
                        } else {
                            sendMessageToTop(MessageType.SyncMemberVideo, { video: this.GetVideoDom(), roomName: this.roomName, password: this.password, room: room })
                        }
                        break;
                    }
                }
            } catch (e) {
                this.UpdateStatusText(e, "red");
            }
        }

        PlayAdNow() {
            try {
                // iqiyi
                if (window.location.hostname.endsWith('iqiyi.com')) {
                    let cdTimes = document.querySelectorAll('.cd-time');
                    for (let i = 0; i < cdTimes.length; i++) {
                        if (cdTimes[i].offsetParent != null) {
                            return true;
                        }
                    }
                }
            } catch { }
            try {
                if (window.location.hostname.endsWith('v.qq.com')) {
                    let adCtrls = document.querySelectorAll('.txp_ad_control:not(.txp_none)');
                    for (let i = 0; i < adCtrls.length; i++) {
                        if (adCtrls[i].getAttribute('data-role') == 'creative-player-video-ad-control') {
                            return true;
                        }
                    }
                }
            } catch { }
            try {
                if (window.location.hostname.endsWith('youku.com')) {
                    if (document.querySelector('.advertise-layer').querySelector('div')) {
                        return true;
                    }
                }
            } catch { }
            return false;
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
                // return this.activatedVideo;
            }

            // get the longest video for master
            const _duration = this.duration == undefined ? 1e9 : this.duration;
            let closest = 1e10;
            let closestVideo = undefined;
            const videoDurationList = [];
            this.videoMap.forEach((video, id) => {
                try {
                    if (!isFinite(video.duration)) {
                        return;
                    }
                    videoDurationList.push(video.duration);
                    if (closestVideo == undefined) {
                        closestVideo = video;
                    }
                    if (Math.abs(video.duration - _duration) < closest) {
                        closest = Math.abs(video.duration - _duration);
                        closestVideo = video;
                    }
                } catch (e) { console.error(e); }
            });
            // collect this for debug
            this.videoDurationList = videoDurationList;
            return closestVideo;
        }

        async SyncMasterVideo(data, videoDom) {
            try {
                if (this.isMain) {
                    useMobileStyle(videoDom);
                }
            } catch { }

            if (skipIntroLen() > 0 && videoDom.currentTime < skipIntroLen()) {
                videoDom.currentTime = skipIntroLen();
            }
            if (data.waitForLoadding) {
                if (!videoDom.paused) {
                    videoDom.pause();
                    this.playAfterLoadding = true;
                }
            } else {
                if (this.playAfterLoadding) {
                    videoDom.play();
                }
                this.playAfterLoadding = false;
            }
            let paused = videoDom.paused;
            if (this.playAfterLoadding) {
                // some sites do not load video when paused
                paused = false;
            } else {
                if (!isVideoLoadded(videoDom)) {
                    paused = true;
                }
            }
            let m3u8Url;
            let m3u8UrlType;
            try {
                let nativeSrc = videoDom.src;
                if (nativeSrc == "" || nativeSrc == undefined) {
                    nativeSrc = videoDom.querySelector('source').src;
                }

                nativeSrc = new URL(nativeSrc, window.location).href
                if (nativeSrc.startsWith('http')) {
                    m3u8Url = nativeSrc;
                }

                this.testM3u8OrVideoUrl(nativeSrc).then(r => {
                    if (r == 'm3u8' && this.hasCheckedM3u8Url[nativeSrc] != true) {
                        fetch(nativeSrc).then(r => r.text()).then(m3u8Content => {
                            if (isMasterM3u8(m3u8Content)) {
                                const mediaM3u8Url = getFirstMediaM3U8(m3u8Content, nativeSrc);
                                fetch(mediaM3u8Url).then(r => r.text()).then(() => {
                                    this.hasCheckedM3u8Url[nativeSrc] = true;
                                })
                            } else {
                                this.hasCheckedM3u8Url[nativeSrc] = true;
                            }
                        }
                        )
                    }
                })
                m3u8UrlType = this.m3u8UrlTestResult[nativeSrc]

            } catch { };
            sendMessageToTop(MessageType.UpdateRoomRequest, {
                name: data.roomName,
                password: data.password,
                url: data.link,
                playbackRate: videoDom.playbackRate,
                currentTime: videoDom.currentTime,
                paused: paused,
                duration: videoDom.duration,
                localTimestamp: this.getLocalTimestamp(),
                m3u8Url: m3u8Url,
                m3u8UrlType: m3u8UrlType
            })
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
            if (inDownload) {
                return {};
            }
            if (this.role == this.RoleEnum.Null) {
                return {};
            }

            let voice = Voice.status;
            if (voice == VoiceStatus.CONNECTTING) {
                try {
                    voice = window.VideoTogetherStorage.VideoTogetherTabStorage.VideoTogetherVoice;
                } catch {
                    voice = VoiceStatus.STOP;
                }
            }

            return {
                VideoTogetherUrl: link,
                VideoTogetherRoomName: this.roomName,
                VideoTogetherPassword: this.password,
                VideoTogetherRole: this.role,
                VideoTogetherTimestamp: Date.now() / 1000,
                VideoTogetherVoice: voice,
                VideoVolume: this.getVideoVolume(),
                VoiceVolume: this.getVoiceVolume()
            }
        }

        SaveStateToSessionStorageWhenSameOrigin(link) {
            if (inDownload) {
                return false;
            }
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

        linkWithMemberState(link, newRole = undefined, expire = true) {
            let url = new URL(link);
            let tmpSearch = url.search;
            url.search = "";
            url.searchParams.set("VideoTogetherUrl", link);
            url.searchParams.set("VideoTogetherRoomName", this.roomName);
            url.searchParams.set("VideoTogetherPassword", this.password);
            url.searchParams.set("VideoTogetherRole", newRole ? newRole : this.role);
            url.searchParams.set("VideoTogetherTimestamp", expire ? Date.now() / 1000 : 1e10);
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
            try {
                if (this.isMain) {
                    useMobileStyle(videoDom);
                }
            } catch { }
            if (this.lastSyncMemberVideo + 1 > Date.now() / 1000) {
                return;
            }
            this.lastSyncMemberVideo = Date.now() / 1000;

            let room = data.room;
            sendMessageToTop(MessageType.GetRoomData, room);

            // useless
            this.duration = room["duration"];
            // useless
            if (videoDom == undefined) {
                throw new Error("没有视频");
            }

            const waitForLoadding = room['waitForLoadding'];
            let paused = room['paused'];
            if (waitForLoadding && !paused && !Var.isThisMemberLoading) {
                paused = true;
            }
            let isLoading = (Math.abs(this.memberLastSeek - videoDom.currentTime) < 0.01);
            this.memberLastSeek = -1;
            if (paused == false) {
                videoDom.videoTogetherPaused = false;
                if (Math.abs(videoDom.currentTime - this.CalculateRealCurrent(room)) > 1) {
                    videoDom.currentTime = this.CalculateRealCurrent(room);
                }
                // play fail will return so here is safe
                this.memberLastSeek = videoDom.currentTime;
            } else {
                videoDom.videoTogetherPaused = true;
                if (Math.abs(videoDom.currentTime - room["currentTime"]) > 0.1) {
                    videoDom.currentTime = room["currentTime"];
                }
            }
            if (videoDom.paused != paused) {
                if (paused) {
                    console.info("pause");
                    videoDom.pause();
                } else {
                    try {
                        console.info("play");
                        {
                            // check if the video is ready
                            if (window.location.hostname.endsWith('aliyundrive.com')) {
                                if (videoDom.readyState == 0) {
                                    throw new Error("{$need_to_play_manually$}");
                                }
                            }
                        }
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
            sendMessageToTop(MessageType.UpdateStatusText, { text: "{$sync_success$} " + this.GetDisplayTimeText(), color: "green" });

            setTimeout(() => {
                try {
                    if (Math.abs(room["duration"] - videoDom.duration) < 0.5) {
                        isLoading = isLoading && !isVideoLoadded(videoDom)
                    } else {
                        isLoading = false;
                    }
                } catch { isLoading = false };
                Var.isThisMemberLoading = isLoading;
                // make the member count update slow
                sendMessageToTop(MessageType.UpdateMemberStatus, { isLoadding: isLoading });
            }, 1);
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
            if (name == "") {
                popupError("{$please_input_room_name$}")
                return;
            }
            try {
                this.tempUser = generateTempUserId();
                let url = this.linkWithoutState(window.location);
                let data = this.RunWithRetry(async () => await this.UpdateRoom(name, password, url, 1, 0, true, 0, this.getLocalTimestamp()), 2);
                this.setRole(this.RoleEnum.Master);
                this.roomName = name;
                this.password = password;
                window.videoTogetherFlyPannel.InRoom();
            } catch (e) { this.UpdateStatusText(e, "red") }
        }

        setWaitForLoadding(b) {
            let enabled = true;
            try { enabled = (window.VideoTogetherStorage.WaitForLoadding != false) } catch { }
            this.waitForLoadding = enabled && b;
        }

        async UpdateRoom(name, password, url, playbackRate, currentTime, paused, duration, localTimestamp, m3u8Url = "") {
            m3u8Url = emptyStrIfUdf(m3u8Url);
            try {
                if (window.location.pathname == "/page") {
                    let url = new URL(atob(new URL(window.location).searchParams.get("url")));
                    window.location = url;
                }
            } catch { }
            WS.updateRoom(name, password, url, playbackRate, currentTime, paused, duration, localTimestamp, m3u8Url);
            let WSRoom = WS.getRoom();
            if (WSRoom != null) {
                this.setWaitForLoadding(WSRoom['waitForLoadding']);
                sendMessageToTop(MessageType.RoomDataNotification, WSRoom);
                return WSRoom;
            }
            let apiUrl = new URL(this.video_together_host + "/room/update");
            apiUrl.searchParams.set("name", name);
            apiUrl.searchParams.set("password", password);
            apiUrl.searchParams.set("playbackRate", playbackRate);
            apiUrl.searchParams.set("currentTime", currentTime);
            apiUrl.searchParams.set("paused", paused);
            apiUrl.searchParams.set("url", url);
            apiUrl.searchParams.set("lastUpdateClientTime", localTimestamp);
            apiUrl.searchParams.set("duration", duration);
            apiUrl.searchParams.set("tempUser", this.tempUser);
            apiUrl.searchParams.set("protected", isRoomProtected());
            apiUrl.searchParams.set("videoTitle", this.isMain ? document.title : this.videoTitle);
            apiUrl.searchParams.set("m3u8Url", emptyStrIfUdf(m3u8Url));
            let startTime = Date.now() / 1000;
            let response = await this.Fetch(apiUrl);
            let endTime = Date.now() / 1000;
            let data = await this.CheckResponse(response);
            sendMessageToTop(MessageType.RoomDataNotification, data);
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
            WS.joinRoom(name, password);
            let WSRoom = WS.getRoom();
            if (WSRoom != null) {
                // TODO updatetimestamp
                return WSRoom;
            }
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
                if (window.videoTogetherFlyPannel.videoTogetherHeader.contains(e.target)) {
                    target = window.videoTogetherFlyPannel.videoTogetherFlyPannel;
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
                document.onpointermove = dr;

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
                target.onpointerup = endDrag;
            }
            window.videoTogetherFlyPannel.videoTogetherHeader.onmousedown = filter;
            window.videoTogetherFlyPannel.videoTogetherHeader.ontouchstart = filter;
            window.videoTogetherFlyPannel.videoTogetherHeader.onpointerdown = filter;
        }
    }

    try {
        if (window.location.hostname == 'yiyan.baidu.com' || window.location.hostname.endsWith('cloudflare.com')) {
            GetNativeFunction();
            window.Element.prototype.attachShadow = Global.NativeAttachShadow;
        }
    } catch { }

    // TODO merge Pannel and Extension class
    if (window.videoTogetherFlyPannel === undefined) {
        window.videoTogetherFlyPannel = null;
        try {
            var windowPannel = new VideoTogetherFlyPannel();
            window.videoTogetherFlyPannel = windowPannel;
        } catch (e) { console.error(e) }
    }
    if (window.videoTogetherExtension === undefined) {
        window.videoTogetherExtension = null;
        var extension = new VideoTogetherExtension();
        window.videoTogetherExtension = extension;
        sendMessageToSelf(MessageType.ExtensionInitSuccess, {})
    }
    try {
        document.querySelector("#videoTogetherLoading").remove()
    } catch { }
})()
