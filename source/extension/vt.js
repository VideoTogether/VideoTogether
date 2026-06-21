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
    try {
        // this attribute will break the cloudflare turnstile
        document.currentScript.removeAttribute("cachedvt")
        document.currentScript.remove()
    } catch { }
    const language = '{$language$}'
    const vtRuntime = `{{{ {"user": "./config/vt_runtime_extension", "website": "./config/vt_runtime_website","order":100} }}}`;
    // 設定頁網址（要改成自己部署的設定頁時，只改這一行即可）
    const VT_SETTING_PAGE_URL = "https://lcy000.github.io/VideoTogether-setting/v3.html";
    // 換頁/跳轉後「人數凍結」時長：還原舊人數後，這段時間內擋掉伺服器的假性掉人數。改這一行即可調整。
    const VT_MC_FREEZE_MS = 6000;
    // 「換頁帶過去的人數」最多多舊還願意還原：要涵蓋換頁載入空檔（YT 等重站可達 6~7 秒以上），
    // 與凍結時長是兩回事——這個只決定「值不值得還原」，還原後仍只凍結 VT_MC_FREEZE_MS。
    const VT_MC_CARRY_MAX_AGE_MS = 15000;
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

    const encodedChinaCdnA = 'https://videotogether.oss-cn-hangzhou.aliyuncs.com'
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
    async function getApiHostChina() {
        const encodedHost = await getCdnConfig(encodedChinaCdnA).then(c => c.apiHostChina)
        return encodedHost.startsWith('https') ? encodedHost : atob(encodedHost);
    }

    let trustedPolicy = undefined;
    // YouTube 等「強制 Trusted Types」的頁面：提前建立 policy，讓第一次就走 policy，
    // 不會先試 raw innerHTML 而觸發 CSP 違規（console 噴 "requires 'TrustedHTML' assignment"）。
    // 非強制 TT 的頁面 trustedTypes 不存在或不限名稱，createPolicy 失敗也無妨（維持 raw innerHTML）。
    try {
        if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
            trustedPolicy = trustedTypes.createPolicy('videoTogetherExtensionVtJsPolicy', {
                createHTML: (string) => string,
                createScript: (string) => string,
                createScriptURL: (url) => url
            });
        }
    } catch (e) { }
    function updateInnnerHTML(e, html) {
        try {
            // 已建立 Trusted Types policy（如 YouTube 強制）就直接用，避免先丟 raw innerHTML 而噴 console 錯誤
            e.innerHTML = trustedPolicy ? trustedPolicy.createHTML(html) : html;
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
            // 事件風暴(如 YT 廣告/緩衝/換畫質 狂噴 play/pause/seeked)時的正常節流，非錯誤——
            // 同步仍由每 2 秒的 ScheduledTask 固定跑，這裡只是擋掉冗餘的即時催同步；故降為 debug，不汙染 console「錯誤」。
            console.debug("limited")
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

    function getEnableMessageVoice() {
        return getVideoTogetherStorage('EnableMessageVoice', true);
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

    // === collapse-state:start — 純函式，單元測試見 test/extension/collapse-state.test.js ===
    // 決定面板初始 minimized：
    //   在房間   → 繼承 carried（1/"1"/true=收合、0/"0"/false=展開、缺失=展開）
    //   不在房間 → 看 MinimiseDefault（true=收合、false=展開、未知=收合「安全，絕不先展開」）
    function VideoTogetherResolveMinimized(state) {
        if (state && state.inRoom) {
            var c = state.carried;
            if (c === 1 || c === "1" || c === true) return true;
            if (c === 0 || c === "0" || c === false) return false;
            return false; // 在房間、無記憶 → 展開
        }
        // 注意：呼叫端需將 VideoTogetherStorage.MinimiseDefault (PascalCase) 映射到此 minimiseDefault 欄位
        var d = state ? state.minimiseDefault : undefined;
        if (d === true) return true;
        if (d === false) return false;
        return true; // 不在房間、設定未知 → 收合（安全，絕不先展開）
    }
    // === collapse-state:end ===

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

    // 人數區塊 HTML：icon 永遠在；數字放 .vt-mc-num（CSS 給固定保留寬）。
    // c 為 null/undefined 時只畫 icon＋保留位（剛進房、人數還沒讀到時用），讀到後填入數字，角色文字不會跳位。
    function memberCountInner(c) {
        // 中文顯示「人」單位（如 1 人，數字與「人」間留一個空格）；其他語言只留數字，避免長字爆版
        const unit = (language === 'zh-tw' || language === 'zh-cn') ? '人' : '';
        const icon = '<svg class="vt-mc-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
        const has = !(c === null || c === undefined || c === '');
        const num = has ? (unit ? (c + ' ' + unit) : ('' + c)) : '';
        const cls = unit ? 'vt-mc-num vt-mc-cjk' : 'vt-mc-num';
        return icon + '<span class="' + cls + '">' + num + '</span>';
    }

    function changeMemberCount(c) {
        // 退出房間時 exitRoom() 會先 setRole(Null)，飛行中的 tick 事後回來就不會把人數重畫進大廳。
        if (extension.role === extension.RoleEnum.Null) return;
        // 防呆：只接受數字（含數字字串與 0）。非數字/undefined 不採用，避免把 ctxMemberCount 設成壞值 → 顯示空白或 "undefined"。
        if (c == null || isNaN(Number(c))) return;
        let now = Date.now();
        // 換頁後最多凍結 VT_MC_FREEZE_MS（目前 6 秒）：用「跳轉前的人數」擋住換頁延遲/伺服器「同URL才算」造成的暫時掉到 1 人。
        // 凍結期內，伺服器回報「比目前低」就先不採用（等觀眾跟上）；持平或更高直接採用；逾凍結時長恢復照伺服器。
        // 沒有可凍結的舊值（剛進房/第一筆）時不擋，照伺服器正常顯示 → 不會卡空白。
        let held = extension._mcHoldUntil && now < extension._mcHoldUntil;
        let prev = parseInt(extension.ctxMemberCount);
        if (held && !isNaN(prev) && Number(c) < prev) {
            return;
        }
        extension.ctxMemberCount = c;
        // 記住「目前人數＋時間」，作為下次換頁要帶過去的『跳轉前人數』（同網域整頁重整也能還原；逾 10 秒視為過期）
        try {
            window.sessionStorage.setItem("VideoTogetherLastMemberCount", String(c));
            window.sessionStorage.setItem("VideoTogetherLastMemberCountTime", String(now));
        } catch (e) { }
        updateInnnerHTML(select('#memberCount'), memberCountInner(c));
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
        temp.remove();
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

        slider.style.background = `linear-gradient(to right, var(--vt-accent) 0%, var(--vt-accent) ${(value - min) / (max - min) * 100}%, var(--vt-border) ${(value - min) / (max - min) * 100}%, var(--vt-border) 100%)`

        slider.addEventListener('input', function () {
            this.style.background = `linear-gradient(to right, var(--vt-accent) 0%, var(--vt-accent) ${(this.value - this.min) / (this.max - this.min) * 100}%, var(--vt-border) ${(this.value - this.min) / (this.max - this.min) * 100}%, var(--vt-border) 100%)`
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
                // 「有新訊息(更換語音)」是語音相關提示——關閉語音播報時就不跳，訊息仍會進聊天
                if (getEnableMessageVoice()) {
                    popupError("{$new_message_change_voice$}");
                }
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
            let inCall = (VoiceStatus.UNMUTED == s || VoiceStatus.MUTED == s);
            dsply(callConnecting, s == VoiceStatus.CONNECTTING);
            dsply(callBtn, s == VoiceStatus.STOP || inCall);
            dsply(micBtn, inCall);
            dsply(audioBtn, inCall);
            dsply(select('#vtDonate'), !(inCall || s == VoiceStatus.CONNECTTING)); // 通話中/連線中：只有愛心讓位，分享留著
            dsply(callErrorBtn, s == VoiceStatus.ERROR);
            // 通話鈕做成切換：通話中顯示「結束通話」並可掛斷
            if (callBtn) {
                let callBtnLabel = callBtn.querySelector('span');
                if (callBtnLabel) {
                    callBtnLabel.textContent = inCall ? '{$end_voice_call_button$}' : '{$voice_call_button$}';
                }
                callBtn.classList.toggle('vt-btn-callactive', inCall);
            }
            // 非通話狀態（結束/斷線/連線中）若還停在音量面板就切回主畫面，避免卡住；並還原音量鈕高亮
            if (!inCall && select('#voicePannel') && select('#voicePannel').style.display !== 'none') {
                show(select('#mainPannel'));
                hide(select('#voicePannel'));
                if (audioBtn) audioBtn.style.color = '';
            }
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
            // 全螢幕小窗的「完整」移除：DOM + GotTxtMsgCallback + 舊全螢幕元素的 mousemove 監聽 + 閒置計時器。
            // 退房／離開全螢幕／換全螢幕元素都共用它，避免清理路徑不一致而殘留監聽/計時器（codex 審查指出）。
            const removeFullscreenMini = () => {
                try { if (this.fullscreenSWrapper) this.fullscreenSWrapper.remove(); } catch (e) { }
                this.fullscreenSWrapper = undefined;
                this.fullscreenWrapper = undefined;
                GotTxtMsgCallback = undefined;
                try { if (this.fsIdleEl && this.fsIdleHandler) this.fsIdleEl.removeEventListener("mousemove", this.fsIdleHandler); } catch (e) { }
                try { if (this.clearFsIdle) this.clearFsIdle(); } catch (e) { }
                this.fsIdleEl = undefined; this.fsIdleHandler = undefined;
            };
            setInterval(() => {
                // 小窗(人數)由 EnableMiniBar 決定要不要顯示；聊天(輸入框等)另由 EnableTextMessage 控制(見下方建立小窗處)。
                // 解耦：關掉文字訊息時仍保留人數小窗，不再整個不顯示。
                const _miniShouldShow = getEnableMiniBar() && document.fullscreenElement != undefined
                    && (extension.ctxRole == extension.RoleEnum.Master || extension.ctxRole == extension.RoleEnum.Member);
                if (_miniShouldShow) {
                    const qs = (s) => this.fullscreenWrapper.querySelector(s);
                    try {
                        // 防呆：ctxMemberCount 尚未讀到(undefined)/非數字時顯示空白，不要把 "undefined" 印到小窗
                        const _mc = extension.ctxMemberCount;
                        qs("#memberCount").innerText = (_mc == null || _mc === '' || isNaN(Number(_mc))) ? '' : _mc;
                        qs("#send-button").disabled = !extension.ctxWsIsOpen;
                    } catch { };
                    if (document.fullscreenElement.contains(this.fullscreenSWrapper)) {
                        return;
                    }
                    // 換了全螢幕元素時，舊 wrapper 還掛在已退出全螢幕的舊元素上 → 完整移除(含監聽/計時器)，避免殘留洩漏
                    if (this.fullscreenSWrapper) {
                        removeFullscreenMini();
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
                    // 文字訊息關閉：收掉聊天(箭頭/輸入框/送出)，只留人數膠囊＋✕。建立小窗時決定即可——
                    // 改設定要開設定頁、通常會先離開全螢幕，回來再進全螢幕時小窗會重建並套用最新設定。
                    if (!getEnableTextMessage()) {
                        if (expandBtn) expandBtn.style.display = 'none';
                        if (msgInput) msgInput.style.display = 'none';
                        if (sendBtn) sendBtn.style.display = 'none';
                    }
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
                    closeBtn.onclick = () => { container.style.opacity = "0"; container.style.pointerEvents = "none"; }
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
                    // 可自由拖動（拖左側握把）：用 transform translate 相對位移，與定位脈絡無關，
                    // 不會因全螢幕元素的 containing block 不同而飛到角落
                    let dragHandle = wrapper.getElementById('drag-handle');
                    if (dragHandle) {
                        let vtDragX = 0, vtDragY = 0;
                        dragHandle.addEventListener('mousedown', (e) => {
                            let startX = e.clientX, startY = e.clientY;
                            let baseX = vtDragX, baseY = vtDragY;
                            const onMove = (ev) => {
                                vtDragX = baseX + (ev.clientX - startX);
                                vtDragY = baseY + (ev.clientY - startY);
                                container.style.transform = "translate(" + vtDragX + "px, " + vtDragY + "px)";
                            };
                            const onUp = () => {
                                document.removeEventListener('mousemove', onMove);
                                document.removeEventListener('mouseup', onUp);
                            };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                            e.preventDefault();
                        });
                    }
                    // 3 秒無動作淡出、滑鼠移動再現（取代原本叉叉永久隱藏）
                    let vtIdleTimer = null;
                    const showBar = () => {
                        container.style.opacity = "1";
                        container.style.pointerEvents = "auto";
                        clearTimeout(vtIdleTimer);
                        if (this.fullscreenWrapper && this.fullscreenWrapper.activeElement === msgInput) {
                            return; // 打字中不淡出
                        }
                        vtIdleTimer = setTimeout(() => {
                            container.style.opacity = "0";
                            container.style.pointerEvents = "none";
                        }, 2500);
                    };
                    msgInput.addEventListener("focus", () => { clearTimeout(vtIdleTimer); container.style.opacity = "1"; });
                    msgInput.addEventListener("blur", () => showBar());
                    msgInput.addEventListener("keyup", () => { clearTimeout(vtIdleTimer); });
                    container.addEventListener("mousemove", showBar);
                    this.fsIdleEl = document.fullscreenElement;
                    this.fsIdleHandler = showBar;
                    this.fsIdleEl.addEventListener("mousemove", showBar);
                    this.clearFsIdle = () => { clearTimeout(vtIdleTimer); };
                    showBar();
                } else {
                    // 不顯示(退房 ctxRole→Null／離開全螢幕／關閉設定)：主動移除已注入的小窗(含監聽/計時器)，
                    // 否則它只會停止更新、卻殘留在畫面上顯示舊人數與聊天框（使用者回報退房後小窗還在）。
                    removeFullscreenMini();
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
                let vtThemeBtn = wrapper.querySelector("#vtThemeToggle");
                if (vtThemeBtn) { vtThemeBtn.onclick = () => { this.ToggleTheme() } }
                this.InitTheme();
                // 視窗太小時自動收成小圖示，避免佔掉僅剩的畫面；視窗變大再自動展開（只在自動收起時）
                let autoCollapse = () => {
                    let tooSmall = window.innerWidth < 720 || window.innerHeight < 560;
                    if (tooSmall && !this.minimized) {
                        this.Minimize(true);
                        this.autoMinimized = true;
                    } else if (!tooSmall && this.autoMinimized && this.minimized) {
                        this.Maximize(true);
                        this.autoMinimized = false;
                    }
                };
                window.addEventListener("resize", autoCollapse);
                // 不在載入時主動呼叫 autoCollapse()：初始收/展由 Init（一律先收合）＋ firstSync 決定。
                // 早期呼叫（在元素參考指派前、this.minimized 仍為初始 false）只會把 autoMinimized 誤設成 true，
                // 導致之後視窗放大時把「本該收合」的面板誤展開（codex 指出）。autoCollapse 只當 resize 處理器用。
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
                this.callBtn.onclick = () => {
                    if (Voice.inCall) {
                        Voice.stop();
                    } else {
                        Voice.join("", window.videoTogetherExtension.roomName);
                    }
                };
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
                // 邀請鈕：複製「可直接點開的房間連結」（純連結，不加任何說明文字/備用連結）
                this.inviteBtn = wrapper.querySelector('#vtInviteBtn');
                if (this.inviteBtn) this.inviteBtn.onclick = async () => {
                    try {
                        // 直接給「加入房間連結」：朋友點開直達房主目前的影片頁並自動進房，
                        // 不再經過 easyshare 轉送頁（該頁 zh-tw 在上游是 404，且會多等 6 秒才跳轉）。
                        // 用「乾淨網址」(linkWithoutState) 當基底，讓對方的 url 與房間 url 一致 → 不會再觸發跳轉/暫時頁。
                        const link = extension.linkWithMemberState(extension.linkWithoutState(window.location), extension.RoleEnum.Member, false).toString();
                        await navigator.clipboard.writeText(link);
                        popupError("{$easy_share_link_copied$}");
                    } catch {
                        popupError("{$easy_share_link_copy_failed$}");
                    }
                };
                // 點房號列 → 複製「完整房間名稱」（即使顯示被 … 截斷，複製的仍是完整值，不必展開、無歧義）。
                // 🔗 例外（有自己的複製連結動作）；大廳（房名 input 可編輯）不觸發，讓使用者正常輸入。
                this.roomField = wrapper.querySelector('#vtRoomField');
                if (this.roomField) this.roomField.onclick = async (e) => {
                    if (e.target.closest('#vtInviteBtn')) return;
                    if (!this.inputRoomName || !this.inputRoomName.disabled) return;
                    try {
                        await navigator.clipboard.writeText(this.inputRoomName.value);
                        popupError("{$room_name_copied$}");
                    } catch {
                        popupError("{$easy_share_link_copy_failed$}");
                    }
                };
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
                        this.audioBtn.style.color = 'var(--vt-accent)';
                    } else {
                        this.audioBtn.style.color = '';
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
                this.exitButton.onclick = (() => {
                    window.videoTogetherExtension.exitRoom();
                });
                this.videoTogetherRoleText = wrapper.querySelector("#videoTogetherRoleText")
                this.videoTogetherSetting = wrapper.querySelector("#videoTogetherSetting");
                this.inputRoomName = wrapper.querySelector('#videoTogetherRoomNameInput');
                this.inputRoomPassword = wrapper.querySelector("#videoTogetherRoomPdIpt");
                const keepRoomNameCollapsed = () => {
                    if (!this.inputRoomName || !this.inputRoomName.disabled) return;
                    this.inputRoomName.blur();
                    this.inputRoomName.scrollLeft = 0;
                    requestAnimationFrame(() => {
                        if (!this.inputRoomName || !this.inputRoomName.disabled) return;
                        this.inputRoomName.blur();
                        this.inputRoomName.scrollLeft = 0;
                    });
                };
                if (this.roomField) this.roomField.addEventListener('mousedown', (e) => {
                    if (e.target.closest('#vtInviteBtn')) return;
                    if (!this.inputRoomName || !this.inputRoomName.disabled) return;
                    e.preventDefault();
                    keepRoomNameCollapsed();
                }, true);
                this.inputRoomName.addEventListener('focus', keepRoomNameCollapsed);
                this.inputRoomNameLabel = wrapper.querySelector('#videoTogetherRoomNameLabel');
                this.inputRoomPasswordLabel = wrapper.querySelector("#videoTogetherRoomPasswordLabel");
                // 大廳「房間/密碼」標籤等寬，讓兩個輸入框對齊（中文兩字本來就齊；英日標籤長度不同需補齊）
                try {
                    const lobbyLabelW = { 'en-us': '70px', 'ja-jp': '82px' }[language];
                    if (lobbyLabelW) {
                        this.inputRoomNameLabel.style.flex = '0 0 ' + lobbyLabelW;
                        this.inputRoomPasswordLabel.style.flex = '0 0 ' + lobbyLabelW;
                    }
                } catch { }
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
            hide(this.videoTogetherFlyPannel);
            show(this.videoTogetherSamllIcon);
        }

        Maximize(isDefault = false) {
            this.minimized = false;
            if (!isDefault) {
                this.SaveIsMinimized(false);
            }
            show(this.videoTogetherFlyPannel);
            hide(this.videoTogetherSamllIcon);
        }

        SaveIsMinimized(minimized) {
            // 收/展只在「房間會話」中記憶（跟著房間跨頁繼承）；不在房間則不記憶（沒在房間 → 純看設定）。
            // 立即寫入 TabStorage + sessionStorage，避免手動操作後馬上換頁、來不及被同步迴圈持久化。
            // 註：this.minimized 已由 Minimize/Maximize 先行設定，GetRoomState 讀的就是它。
            try {
                let ext = window.videoTogetherExtension;
                if (ext && ext.role != ext.RoleEnum.Null) {
                    let state = ext.GetRoomState("");
                    sendMessageToTop(MessageType.SetTabStorage, state);
                    ext.SaveStateToSessionStorageWhenSameOrigin("");
                }
            } catch (e) { }
        }

        InitTheme() {
            let saved = null;
            try { saved = localStorage.getItem("VideoTogetherTheme"); } catch (e) { }
            if (saved === "light" || saved === "dark") {
                this.shadowWrapper.setAttribute("data-vt-theme", saved);
            } else {
                this.shadowWrapper.removeAttribute("data-vt-theme");
            }
        }

        ToggleTheme() {
            let cur = this.shadowWrapper.getAttribute("data-vt-theme");
            if (!cur) {
                // 目前跟隨系統：先算出實際呈現的色系再翻轉
                cur = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
            }
            const next = cur === "dark" ? "light" : "dark";
            this.shadowWrapper.setAttribute("data-vt-theme", next);
            try { localStorage.setItem("VideoTogetherTheme", next); } catch (e) { }
        }

        Init() {
            // 載入時一律先呈現「收合」（HTML 預設即收合）。是否展開完全交給「權威」的 firstSync / RecoveryState 決定，
            // 不在這裡依（可能過時的）localStorage 鏡像或 sessionStorage 樂觀展開——那正是「Init 先展開 → 非同步又收回」
            // 展→收閃爍的根因（剛切換設定那次鏡像會過時；在房間時 sessionStorage 與 TabStorage 可能短暫不一致）。
            // 代價：本來該展開的情況（設定關、或在房間且上次展開）會有一次溫和的「收→展」，符合先前確認的取捨。
            this.Minimize(true);
        }

        InRoom() {
            try {
                speechSynthesis.getVoices();
            } catch { };
            // 收/展不再由 InRoom 決定：避免房主狀態傳染觀眾、避免每次還原都強制展開。
            // 改由 Init / RecoveryState / firstSync 依「是否在房間 + carried/設定」決定。
            this.inputRoomName.disabled = true;
            this.inputRoomName.blur();
            this.inputRoomName.scrollLeft = 0;
            let rf = this.wrapper.querySelector('#vtRoomField'); if (rf) rf.classList.add('vt-field--inroom');
            let rc = this.wrapper.querySelector('#vtRoomCard'); if (rc) rc.classList.add('vt-roomcard--active');
            let ib = this.wrapper.querySelector('#vtInviteBtn'); if (ib) show(ib);
            // 進房先畫出人數：若是「剛跳轉過來」(sessionStorage 有 10 秒內的人數)，帶上次人數＋啟動最多 10 秒凍結，
            // 擋住換頁延遲時掉到 1 人；沒有近期紀錄就只畫 icon、讓伺服器正常回報（不會卡空白）。
            let mcEl = this.wrapper.querySelector('#memberCount');
            if (mcEl) {
                let lastMc = null, lastTime = 0;
                try {
                    lastMc = window.sessionStorage.getItem("VideoTogetherLastMemberCount");
                    lastTime = parseFloat(window.sessionStorage.getItem("VideoTogetherLastMemberCountTime")) || 0;
                } catch (e) { }
                // 同網域 sessionStorage 沒有(多半是跨網域換頁遺失)→ 退而讀 TabStorage（跟著房間跨網域帶過來的）
                if (lastMc == null || lastMc === "") {
                    try {
                        let ts = window.VideoTogetherStorage && window.VideoTogetherStorage.VideoTogetherTabStorage;
                        if (ts && ts.VideoTogetherLastMemberCount != null && ts.VideoTogetherLastMemberCount !== "") {
                            lastMc = ts.VideoTogetherLastMemberCount;
                            lastTime = parseFloat(ts.VideoTogetherLastMemberCountTime) || 0;
                        }
                    } catch (e) { }
                }
                let recent = (lastMc != null && lastMc !== "" && (Date.now() - lastTime < VT_MC_CARRY_MAX_AGE_MS));
                if (recent) {
                    // guard：InRoom 可能在 panel 建構期(經 Init→RecoveryState)被呼叫，那時 extension 還沒指派
                    if (typeof extension !== 'undefined' && extension) {
                        extension.ctxMemberCount = lastMc;
                        extension._mcHoldUntil = Date.now() + VT_MC_FREEZE_MS; // 從還原當下起算 6 秒，不錨舊時間（舊時間可能已過期）
                    }
                    updateInnnerHTML(mcEl, memberCountInner(lastMc));
                } else {
                    updateInnnerHTML(mcEl, memberCountInner(null));
                }
            }
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
            // 用 this.wrapper（建構期 window.videoTogetherFlyPannel 尚未指派，不能用 select()）清空人數 + 收起房內元素
            let mc = this.wrapper.querySelector('#memberCount');
            if (mc) updateInnnerHTML(mc, '');
            // 只有「真正退房」(init=false)才清掉記住的人數，避免下次進別的房先閃舊值。
            // ⚠️ 不可在建構期的 InLobby(true) 清：那會在「換頁還原房間」之前就把要跨頁帶過去的人數刪掉，
            //    導致新頁人數從頭重載、凍結失效（使用者回報換頁後人數沒紀錄）。
            if (!init) {
                try {
                    window.sessionStorage.removeItem("VideoTogetherLastMemberCount");
                    window.sessionStorage.removeItem("VideoTogetherLastMemberCountTime");
                } catch (e) { }
            }
            // ⚠️ extension（VideoTogetherExtension 實例）在 panel 建構之後才指派；InLobby(true) 會在
            //   panel 建構期就被呼叫，那時 extension 還是 undefined。必須 guard，否則建構丟例外 → panel=null → 全部按鈕失效。
            if (typeof extension !== 'undefined' && extension) {
                extension._mcHoldUntil = 0;
                extension._lastHostUrl = undefined;
            }
            let rf = this.wrapper.querySelector('#vtRoomField'); if (rf) rf.classList.remove('vt-field--inroom');
            let rc = this.wrapper.querySelector('#vtRoomCard'); if (rc) rc.classList.remove('vt-roomcard--active');
            let ib = this.wrapper.querySelector('#vtInviteBtn'); if (ib) hide(ib);
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

        UpdateStatusText(text, color, holdMs) {
            // 「需停留」訊息（如「已交接給新房主」）在 holdMs 毫秒內不被例行影片狀態（同步成功/尚未偵測到影片…）覆蓋；
            // 只有下一個同樣帶 holdMs 的訊息能在停留期內覆蓋它。
            const _now = Date.now();
            if (!holdMs && this._statusHoldUntil && _now < this._statusHoldUntil) return;
            this._statusHoldUntil = holdMs ? (_now + holdMs) : 0;
            // 取訊息字串並去掉 "Error:" 前綴，避免把整個 Error 物件秀出來
            let msg = (text && text.message) ? text.message : ("" + text);
            msg = msg.replace(/^Error:\s*/i, "");
            // 上游公用伺服器無 zh-tw 在地化、會回英文錯誤 → 在客戶端翻成繁中
            const vtErrMap = {
                "Wrong Password": "{$err_wrong_password$}",
                "Room exists, wrong password": "{$err_room_exists_wrong_password$}",
                "Room Not Exists": "{$err_room_not_exists$}",
                "Other Host Is Syncing": "{$err_other_host_syncing$}",
            };
            if (vtErrMap[msg]) { msg = vtErrMap[msg]; }
            // 用 data-vt-status 交給 CSS 著色（跟隨主題色票：成功=藍、資訊=灰、錯誤=警示）
            const vtSoftInfo = ["{$no_video_in_this_page$}", "{$video_not_supported$}"];
            let status = "";
            if (msg === "") {
                status = "";
            } else if (vtSoftInfo.indexOf(msg) !== -1) {
                status = "info"; // 「還沒偵測到影片」不是錯誤
            } else if (color === "red") {
                status = "error";
            } else if (color === "green") {
                status = "ok";
            } else {
                status = "info";
            }
            updateInnnerHTML(this.statusText, msg);
            this.statusText.style.color = "";
            this.statusText.setAttribute("data-vt-status", status);
            // 有錯誤時不該再顯示「正在連線文字聊天伺服器…」等聊天介面
            if (status === "error") {
                try { this.setTxtMsgInterface(0); } catch (e) { }
            }
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
                try {
                    let host = (new URL(e.blockedURI)).host;
                    this.cspBlockedHost[host] = true;
                } catch (e) { }
            });
            try {
                this.CreateVideoDomObserver();
            } catch { }
            this.timer = setInterval(() => this.ScheduledTask(true), 2 * 1000);
            this.videoMap = new Map();
            let messageListenerAliveCount = 0;
            const messageListener = message => {
                messageListenerAliveCount++;
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
            }
            window.addEventListener('message', messageListener);
            setInterval(() => {
                const currentCount = messageListenerAliveCount;
                setTimeout(() => {
                    if (currentCount == messageListenerAliveCount) {
                        // 看門狗：閒置頁面常會「沒訊息」而誤報，降級為 debug（不再被 Chrome 當擴充錯誤收集）；仍保留重掛當自我修復
                        console.debug("messageListener is dead");
                        window.addEventListener('message', messageListener);
                    }
                }, 6000);
            }, 1000);
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
            // 使用者可在設定頁關閉「文字訊息語音播報」(EnableMessageVoice)；關閉時仍保留文字通知與輸入清空，僅不播語音、不彈出啟用語音面板
            const voiceOn = getEnableMessageVoice();
            if (voiceOn && !prepare && !extension.speechSynthesisEnabled) {
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
            if (!voiceOn) {
                return;
            }

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
            this.role = role;
            this.RefreshRoleText();
        }

        // 依「角色 + 是否直播」更新常駐角色列。直播時觀眾不再跟隨房主播放，故文字改成「直播各自控制」。
        // 有 guard：面板尚未建好時略過（避免初始化期 null 崩潰）；之後 SetLiveContext 變化時會再刷新。
        RefreshRoleText() {
            let el = window.videoTogetherFlyPannel && window.videoTogetherFlyPannel.videoTogetherRoleText;
            if (!el) return;
            let live = !!this._ctxIsLive;
            switch (this.role) {
                case this.RoleEnum.Master:
                    updateInnnerHTML(el, live ? "{$host_role_live$}" : "{$host_role$}");
                    el.dataset.role = 'host';   // 房主＝藍字藍點藍色條
                    break;
                case this.RoleEnum.Member:
                    updateInnnerHTML(el, live ? "{$member_role_live$}" : "{$memeber_role$}");
                    el.dataset.role = 'viewer'; // 觀眾＝灰字灰點，左色條轉灰
                    break;
                default:
                    updateInnnerHTML(el, "");
                    delete el.dataset.role;
                    break;
            }
        }

        // 由 host/member 的同步迴圈每個 tick 呼叫，傳入「自己畫面上的影片是不是直播」。
        // 第一次進入直播跳一次短暫 toast（離開直播會重置，再進直播可再跳一次）；狀態變化時刷新常駐角色列。
        SetLiveContext(isLive) {
            isLive = !!isLive;
            if (isLive && !this._ctxIsLive && !this._liveToastShown) {
                this._liveToastShown = true;
                this.UpdateStatusText("{$live_independent_hint$}", "", 5000);
            }
            // _liveToastShown 的重置改在 IsLiveStream（換影片/換頁時）與 exitRoom 處理。
            // 不在這裡用「!isLive 就重置」，否則直播卡頓造成的偵測閃動會讓 toast 反覆跳。
            if (isLive !== this._ctxIsLive) {
                this._ctxIsLive = isLive;
                this.RefreshRoleText();
            }
        }

        // 房主被別人用「同房名 + 密碼」按『創建房間』接手時，伺服器會對原房主的更新回 "Other Host Is Syncing"。
        // 朋友間換房主的情境：自動把原房主降為觀眾並開始跟隨新房主（之後的 tick 走 Member 分支會自動跟播/跳轉）。
        // 回傳 true 代表「已處理（已降級）」，呼叫端就不要再把它當紅字錯誤顯示。
        // 房主切到「新影片(URL 改變)」且頁面有影片時，於狀態列提醒等觀眾載入（顯示約 5.5 秒、不被例行狀態洗掉）。
        // 判定窗 = 凍結時長 VT_MC_FREEZE_MS(6s)：切片後在該窗內、且穩定 1.5s 後人數仍 >1 才提；逾窗或只剩自己 → 安靜放棄（避免瀏覽/預覽亂跳）。
        MaybeRemindViewersLoading() {
            try {
                const now = Date.now();
                // 「有影片」由呼叫端保證(只在偵測到影片的分支呼叫)。用 URL 變化判定「切到新影片/新集」——
                // 比 video.id(綁 DOM 元素、SPA 換 src 時不變) 可靠；換片 → 重置判定窗。
                const url = this.linkWithoutState(window.location);
                if (url !== this._vtRemindUrl) {
                    this._vtRemindUrl = url;
                    this._vtSyncedSince = now;
                    this._vtViewersReminded = false;
                    return;
                }
                if (this._vtViewersReminded) return;
                const age = now - (this._vtSyncedSince || 0);
                if (age < 1500) return;                  // 防抖：穩定 1.5s（避免瀏覽/預覽/搜尋亂跳）
                if (age > VT_MC_FREEZE_MS) {             // 判定窗 6 秒到 → 獨看，安靜放棄
                    this._vtViewersReminded = true;
                    return;
                }
                if (!(this.ctxMemberCount > 1)) return;  // 只有自己 → 不提
                this._vtViewersReminded = true;
                this.UpdateStatusText("{$viewers_loading_hint$}", "", 5500);
            } catch (_) { }
        }

        MaybeDemoteOnTakeover(e) {
            try {
                let msg = (e && e.message) ? e.message : ("" + e);
                if (msg === "Other Host Is Syncing" && this.role === this.RoleEnum.Master) {
                    this.setRole(this.RoleEnum.Member);
                    this.UpdateStatusText("{$host_handed_over$}", "", 7000);
                    return true;
                }
            } catch (_) { }
            return false;
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

        UpdateStatusText(text, color, holdMs) {
            if (window.self != window.top) {
                sendMessageToTop(MessageType.UpdateStatusText, { text: text + "", color: color, holdMs: holdMs });
            } else {
                window.videoTogetherFlyPannel.UpdateStatusText(text + "", color, holdMs);
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
                        if (this.role === this.RoleEnum.Null) break; // 已退出房間，忽略飛行中 tick 殘留的同步狀態
                        if (this.waitForLoadding) {
                            this.UpdateStatusText("{$wait_for_memeber_loadding$}", "red");
                        } else if (this._ctxIsLive) {
                            _this.UpdateStatusText("{$live_connected$}", "green"); // 直播：只報「已連線」，不謊稱播放同步
                        } else {
                            _this.UpdateStatusText("{$sync_success$}", "green");
                        }
                    } catch (e) {
                        if (this.MaybeDemoteOnTakeover(e)) break; // 被接手 → 自動降為觀眾並跟隨新房主
                        if (this.role !== this.RoleEnum.Null) this.UpdateStatusText(e, "red");
                    }
                    break;
                case MessageType.SyncMemberVideo:
                    this.ForEachVideo(async video => {
                        if (video.VideoTogetherVideoId == data.video.id) {
                            try {
                                await this.SyncMemberVideo(data, video);
                            } catch (e) {
                                if (_this.role !== _this.RoleEnum.Null) _this.UpdateStatusText(e, "red");
                            }
                        }
                    })
                    this.sendMessageToSonWithContext(type, data);
                    break;
                case MessageType.GetRoomData:
                    this.duration = data["duration"];
                    break;
                case MessageType.UpdateStatusText:
                    window.videoTogetherFlyPannel.UpdateStatusText(data.text, data.color, data.holdMs);
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
                    if (firstSync) {
                        // 權威決策（載入後第一次、也是唯一一次依真正的 MinimiseDefault 決定收/展）：
                        // 不在房間 → 純看設定；在房間 → 已由上方 RecoveryState 依 carried 套好，這裡不覆寫。
                        // （this.role 在 RecoveryState 後即反映是否在房間。）Init 一律先收合，故這裡只會「維持收合」或「收→展」，不會「展→收」。
                        if (this.role == this.RoleEnum.Null) {
                            // 用同一個決策函式（不在房間分支），讓 VideoTogetherResolveMinimized 成為收/展的單一來源
                            if (VideoTogetherResolveMinimized({ inRoom: false, minimiseDefault: !!data.MinimiseDefault })) {
                                window.videoTogetherFlyPannel.Minimize(true);
                            } else {
                                window.videoTogetherFlyPannel.Maximize(true);
                            }
                        }
                    }
                    if (typeof (data.PublicUserId) != 'string' || data.PublicUserId.length < 5) {
                        sendMessageToTop(MessageType.SetStorageValue, { key: "PublicUserId", value: generateUUID() });
                    }
                    try {
                        if (firstSync) {
                            if (!isWeb()) {
                                // 設定頁網址統一用 VT_SETTING_PAGE_URL（在檔案最上方，一行可改）
                                window.videoTogetherFlyPannel.videoTogetherSetting.href = VT_SETTING_PAGE_URL;
                                show(select('#videoTogetherSetting'));
                            } else {
                                // website：優先用主站傳入的網址，沒有就退回 VT_SETTING_PAGE_URL
                                window.videoTogetherFlyPannel.videoTogetherSetting.href = window.videoTogetherWebsiteSettingUrl || VT_SETTING_PAGE_URL;
                                show(select('#videoTogetherSetting'));
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
                        // 還原房間時套用 carried 收/展（缺失 → 展開）。getFunc 對應 TabStorage / sessionStorage / URL。
                        if (VideoTogetherResolveMinimized({ inRoom: true, carried: getFunc("VideoTogetherMinimized") })) {
                            window.videoTogetherFlyPannel.Minimize(true);
                        } else {
                            window.videoTogetherFlyPannel.Maximize(true);
                        }
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
            this._ctxIsLive = false;        // 重置直播狀態：下個房間重新判斷、toast 可再提示一次
            this._liveToastShown = false;
            this._liveProbe = undefined;
            this._liveGrowHits = 0;
            this._liveKey = undefined;      // 解除遲滯狀態（IsLiveStream 會重新判斷）
            this._liveState = false;
            this._liveOffStreak = 0;
            // 重置人數凍結與「等待觀眾載入」提醒狀態：避免快速退房再進(尤其同頁重進同房)時，
            // 殘留的凍結擋掉新房第一筆人數、或提醒窗因 _vtRemindUrl 仍等於現 URL 而不再觸發。
            this._mcHoldUntil = 0;
            this.ctxMemberCount = undefined;
            this._vtRemindUrl = undefined;
            this._vtSyncedSince = 0;
            this._vtViewersReminded = false;
            this.setRole(this.RoleEnum.Null);
            // 同步把 ctxRole 也歸 Null：否則它要等下次 sendMessageToSonWithContext 才更新，
            // 期間全螢幕小窗的顯示條件(讀 ctxRole)仍成立 → 退房後小窗不會被移除（使用者回報的殘留）。
            this.ctxRole = this.RoleEnum.Null;
            // 先解除狀態文字的 hold 再清：直播提示「偵測到直播，改為各自控制」是帶 5 秒 hold 的 toast，
            // 不先歸零 _statusHoldUntil，下面的空字串清除會被 UpdateStatusText 的 hold 擋掉 → 提示殘留在大廳。
            try { window.videoTogetherFlyPannel._statusHoldUntil = 0; } catch (e) { }
            window.videoTogetherFlyPannel.UpdateStatusText("", "");
            window.videoTogetherFlyPannel.InLobby();
            let state = this.GetRoomState("");
            sendMessageToTop(MessageType.SetTabStorage, state);
            this.SaveStateToSessionStorageWhenSameOrigin("");
            // 退房清掉房間會話的收/展記憶；之後回到「不在房間 → 純看設定」。
            // TabStorage 因 role=Null 時 GetRoomState 回傳 {} 已被清空。
            try { window.sessionStorage.removeItem("VideoTogetherMinimized"); } catch (e) { }
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
                                getApiHostChina().then(host => {
                                    this.SyncTimeWithServer(host);
                                });
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
                        // 偵測房主換頁(含站內 SPA 換網址)：URL 一變就啟動最多 10 秒的人數凍結，
                        // 用換頁前的人數擋住「換頁延遲 + 伺服器同URL才算」造成的暫時掉到 1 人。
                        let _curUrl = this.linkWithoutState(window.location);
                        if (this._lastHostUrl !== undefined && this._lastHostUrl !== _curUrl) {
                            this._mcHoldUntil = Date.now() + VT_MC_FREEZE_MS;
                        }
                        this._lastHostUrl = _curUrl;
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
                            this.MaybeRemindViewersLoading();
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
                            // 觀眾即將跟隨房主跳到新頁：先啟動人數凍結，擋住「跳轉前一刻」伺服器因房主已換 URL 而回報的
                            // 假性掉人數（changeMemberCount 在凍結期內會擋掉比目前低的值），讓好的人數撐到新頁（與房主 _lastHostUrl 那段同款）。
                            this._mcHoldUntil = Date.now() + VT_MC_FREEZE_MS;
                            if (window.VideoTogetherStorage != undefined && window.VideoTogetherStorage.VideoTogetherTabStorageEnabled) {
                                let state = this.GetRoomState(newUrl);
                                sendMessageToTop(MessageType.SetTabStorage, state);
                                setInterval(() => {
                                    // 加防呆：擴充重載/尚未同步時 storage 可能為 undefined，避免噴 TypeError(reading 'VideoTogetherUrl')
                                    if (window.VideoTogetherStorage?.VideoTogetherTabStorage?.VideoTogetherUrl == newUrl) {
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
                            // 成員也每輪更新 session（時間戳保持新鮮），刷新才不會因「>60 秒過期」被踢出房間
                            this.SaveStateToSessionStorageWhenSameOrigin("");
                        }
                        if (this.PlayAdNow()) {
                            throw new Error("{$ad_playing$}");
                        }
                        let video = this.GetVideoDom();
                        if (video == undefined) {
                            // 無影片頁(選單/搜尋/首頁)也要送成員心跳登記在房——否則伺服器只算到房主、人數掉到 1。
                            // 每個 sync tick(約 2 秒)都會經過這裡，與有影片時同頻率持續回報，不會被伺服器當過期踢除。
                            sendMessageToTop(MessageType.UpdateMemberStatus, { isLoadding: false });
                            throw new Error("{$no_video_in_this_page$}");
                        } else {
                            sendMessageToTop(MessageType.SyncMemberVideo, { video: this.GetVideoDom(), roomName: this.roomName, password: this.password, room: room })
                        }
                        break;
                    }
                }
            } catch (e) {
                if (this.MaybeDemoteOnTakeover(e)) return; // 房主被接手 → 自動降為觀眾並跟隨新房主
                if (this.role !== this.RoleEnum.Null) this.UpdateStatusText(e, "red"); // 已退出則忽略飛行中 tick 殘留狀態
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

            // 房主也偵測自己畫面上的影片是否直播，讓房主的常駐角色列同步顯示「直播各自控制」。
            try { this.SetLiveContext(this.IsLiveStream(videoDom)); } catch (_) { }

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
                VoiceVolume: this.getVoiceVolume(),
                // 收/展跟著房間會話跨頁繼承（每個用戶端各自的；刻意不放 URL，避免傳染給觀眾）
                VideoTogetherMinimized: (window.videoTogetherFlyPannel && window.videoTogetherFlyPannel.minimized) ? 1 : 0,
                // 人數跨網域帶過去（TabStorage 通道）：換到別網站時 sessionStorage 會遺失，靠這個讓新頁也能還原並啟動凍結
                VideoTogetherLastMemberCount: this.ctxMemberCount,
                VideoTogetherLastMemberCountTime: Date.now()
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
                    window.sessionStorage.setItem("VideoTogetherMinimized",
                        (window.videoTogetherFlyPannel && window.videoTogetherFlyPannel.minimized) ? 1 : 0);
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

        // 直播(live)偵測。直播沒有跨裝置一致的 currentTime 原點：每個瀏覽器各自錨定自己的
        // DVR/直播時間軸，所以房主的 currentTime 與觀眾的 currentTime 對應的「同一直播時刻」是
        // 不同數字。用絕對時間同步會讓觀眾每個 tick 都被 seek（一直往回跳到房主的數字，又被
        // YouTube 推回直播邊緣，來回震盪）。偵測到直播時，改為只同步播放/暫停、不碰 currentTime。
        IsLiveStream(videoDom) {
            try {
                // 換影片/換頁就整個重置：避免「直播↔VOD」沿用舊狀態誤判（codex 指出的換台殘留）。
                // key=頁面URL+影片來源；YouTube 等 SPA 換片時 location.href（?v=）會變 → 自動重置。
                const key = (typeof location !== "undefined" ? location.href : "")
                    + "|" + ((videoDom && (videoDom.currentSrc || videoDom.src)) || "");
                if (key !== this._liveKey) {
                    this._liveKey = key;
                    this._liveProbe = undefined;
                    this._liveGrowHits = 0;
                    this._liveState = false;
                    this._liveOffStreak = 0;
                    this._liveToastShown = false; // 換到新影片 → 可再提示一次
                }

                // ── 這個 tick 的原始訊號：看起來像不像直播 ──
                let raw = false;
                const d = videoDom ? videoDom.duration : NaN;
                if (d === Infinity) {
                    // 1) 真·無限長度（無 DVR 直播）。只認 Infinity，不認 NaN：VOD 載入中 duration 會短暫是 NaN，
                    //    若把 NaN 也當直播，一般影片載入瞬間就會被誤判（這正是「一般 YT 影片卡在直播」的主因）。
                    raw = true;
                } else if (typeof document !== "undefined") {
                    // 2) 大平台快速路徑
                    const host = (typeof location !== "undefined" && location.hostname) || "";
                    if (host === "live.bilibili.com" || host.endsWith(".live.bilibili.com")) {
                        raw = true;
                    } else {
                        const badge = document.querySelector('.ytp-live-badge');
                        // 必須「可見」才算：YouTube 的播放器常留著 display:none 的徽章，VOD 也查得到 →
                        //  用 offsetWidth>0 排除隱藏徽章（自動隱藏控制列只改透明度、仍有寬度，不會誤判成非直播）。
                        if (badge && badge.offsetWidth > 0) raw = true;
                    }
                }
                // 3) 通用啟發式（不需 per-site）：duration 持續成長 ⇒ 直播（NaN 不算，仍在載入）。
                if (!raw && isFinite(d)) {
                    const now = Date.now();
                    const s = this._liveProbe;
                    if (!s) {
                        this._liveProbe = { d, t: now };
                    } else if (now - s.t > 500) {
                        const grew = d - s.d, elapsed = (now - s.t) / 1000;
                        if (grew > 0.5 * elapsed && grew > 0.2) this._liveGrowHits = (this._liveGrowHits || 0) + 1;
                        else if (grew < 0.05) this._liveGrowHits = 0;
                        this._liveProbe = { d, t: now };
                        if (this._liveGrowHits >= 2) raw = true;
                    }
                }

                // ── 雙向遲滯：raw=true 立刻判直播；raw=false 要「連續 4 次（~4s）」才退出。
                //    好處：直播卡頓那一兩 tick 不會閃回非直播；萬一誤判，也會在數秒內自癒，不會像硬鎖永久卡住。
                if (raw) {
                    this._liveOffStreak = 0;
                    this._liveState = true;
                } else if (this._liveState) {
                    this._liveOffStreak = (this._liveOffStreak || 0) + 1;
                    if (this._liveOffStreak >= 4) this._liveState = false;
                }
                return !!this._liveState;
            } catch (_) { }
            return false;
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
            let isLoading = (Math.abs(this.memberLastSeek - videoDom.currentTime) < 0.01);
            this.memberLastSeek = -1;
            // 直播：觀眾完全不被房主控制——不 seek、不同步播放/暫停、不同步倍速，各自看自己的直播邊緣
            //（直播 currentTime 原點跨裝置不一致，硬同步會來回震盪；且房主卡頓不該拖累觀眾）。
            // 仍會跟著房主「換台(URL)」，那段在外層 Member tick 處理、不受這裡影響。一般影片走原本同步。
            let isLive = this.IsLiveStream(videoDom);
            this.SetLiveContext(isLive);
            if (isLive) {
                videoDom.videoTogetherPaused = false; // 直播不由 VT 控制播放
                this.memberLastSeek = videoDom.currentTime;
            } else {
                if (waitForLoadding && !paused && !Var.isThisMemberLoading) {
                    paused = true;
                }
                // 防呆：同步目標明顯超過本影片長度時不要硬 seek。多半是「從直播/別支影片殘留的大 currentTime」
                //（直播 DVR 位置可達數千秒）。硬 seek 會被瀏覽器夾到結尾、且每個 tick 反覆把觀眾與房主的調整都拉回結尾
                //（使用者回報：從直播被帶到一般影片後卡在結尾）。等房主回報落在片長內的合理值再同步。
                let _vtDur = videoDom.duration;
                let _vtBeyond = (t) => (isFinite(_vtDur) && _vtDur > 0 && Number(t) > _vtDur + 1.5);
                if (paused == false) {
                    videoDom.videoTogetherPaused = false;
                    let _target = this.CalculateRealCurrent(room);
                    if (!_vtBeyond(_target) && Math.abs(videoDom.currentTime - _target) > 1) {
                        videoDom.currentTime = _target;
                    }
                    // play fail will return so here is safe
                    this.memberLastSeek = videoDom.currentTime;
                } else {
                    videoDom.videoTogetherPaused = true;
                    if (!_vtBeyond(room["currentTime"]) && Math.abs(videoDom.currentTime - room["currentTime"]) > 0.1) {
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
            }
            sendMessageToTop(MessageType.UpdateStatusText, isLive
                ? { text: "{$live_connected$}", color: "green" }   // 直播：只報「已連線」，不謊稱播放同步
                : { text: "{$sync_success$}", color: "green" });

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

                // 以「距右下角」定位（right/bottom），清掉 top/left：
                // 1) 視窗縮放時面板仍貼著右下角、不會飄到畫面中間
                // 2) 只設 bottom、不設 top → height:auto 不會被上下撐開變形（不需鎖高度）
                let r = target.getBoundingClientRect();
                let vw = document.documentElement.clientWidth;
                let vh = document.documentElement.clientHeight;
                target.style.top = "auto";
                target.style.left = "auto";
                target.startRight = Math.max(0, vw - r.right);
                target.startBottom = Math.max(0, vh - r.bottom);
                target.style.right = target.startRight + "px";
                target.style.bottom = target.startBottom + "px";

                let p = (e.clientX != undefined) ? e : e.touches[0];
                target.oldX = p.clientX;
                target.oldY = p.clientY;

                document.onmousemove = dr;
                document.ontouchmove = dr;
                document.onpointermove = dr;

                function dr(event) {
                    if (!target.videoTogetherMoving) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    let q = (event.clientX != undefined) ? event : event.touches[0];
                    let vw2 = document.documentElement.clientWidth;
                    let vh2 = document.documentElement.clientHeight;
                    let newRight = target.startRight - (q.clientX - target.oldX);
                    let newBottom = target.startBottom - (q.clientY - target.oldY);
                    let EDGE = 16; // 與視窗邊緣保留間隔，拖到角落也不貼死
                    newRight = Math.max(EDGE, Math.min(vw2 - target.offsetWidth - EDGE, newRight));
                    newBottom = Math.max(EDGE, Math.min(vh2 - target.offsetHeight - EDGE, newBottom));
                    target.style.right = newRight + "px";
                    target.style.bottom = newBottom + "px";
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
        // 補設「換頁還原的人數凍結」：建構式內部(2273)的 RecoveryState→InRoom 會在這行 extension 指派『之前』
        // 就還原房間並嘗試還原人數，那時 extension 還是 undefined → 守衛失敗、設不了 ctxMemberCount/_mcHoldUntil（只畫了 DOM）。
        // 此處 extension 已就緒，若確實在房間且 sessionStorage 有近 10 秒的人數，補上凍結與基準值，
        // 否則第一筆伺服器人數(常是 1)會因為沒有 hold 而把還原的數字洗掉（使用者回報的換頁後「2→1」）。
        try {
            if (extension.role != extension.RoleEnum.Null) {
                let sMc = window.sessionStorage.getItem("VideoTogetherLastMemberCount");
                let sT = parseFloat(window.sessionStorage.getItem("VideoTogetherLastMemberCountTime")) || 0;
                if (sMc != null && sMc !== "" && Date.now() - sT < VT_MC_CARRY_MAX_AGE_MS) {
                    extension.ctxMemberCount = sMc;
                    extension._mcHoldUntil = Date.now() + VT_MC_FREEZE_MS; // 從還原當下起算 6 秒
                } else {
                }
            }
        } catch (e) { }
        sendMessageToSelf(MessageType.ExtensionInitSuccess, {})
    }
    try {
        document.querySelector("#videoTogetherLoading").remove()
    } catch { }
})()
