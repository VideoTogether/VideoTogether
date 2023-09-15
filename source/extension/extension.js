// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    https://2gether.video/
// @version      {{timestamp}}
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://2gether.video/icon/favicon-32x32.png
// @grant        GM.xmlHttpRequest
// @grant        GM_addElement
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.getTab
// @grant        GM.saveTab
// @connect      2gether.video
// @connect      api.2gether.video
// @connect      api.chizhou.in
// @connect      api.panghair.com
// @connect      vt.panghair.com
// @connect      raw.githubusercontent.com
// @connect      videotogether.oss-cn-hangzhou.aliyuncs.com
// ==/UserScript==

(async function () {
    let isDevelopment = false;

    let version = '{{timestamp}}'
    let type = '{{{ {"": "./config/type_userscript","chrome":"./config/type_chrome_extension","firefox":"./config/type_firefox_extension","safari":"./config/type_safari_extension","debug":"./config/type_userscript_debug","website":"./config/type_website","website_debug":"./config/type_website_debug","beta":"./config/type_userscript_beta", "order":0} }}}'
    function getBrowser() {
        switch (type) {
            case 'Safari':
                return browser;
            case 'Chrome':
            case 'Firefox':
                return chrome;
        }
    }
    let isExtension = (type == "Chrome" || type == "Safari" || type == "Firefox");
    let isWebsite = (type == "website" || type == "website_debug");
    let isUserscript = (type == "userscript");
    let websiteGM = {};
    let extensionGM = {};

    function getGM() {
        if (type == "website" || type == "website_debug") {
            return websiteGM;
        }
        if (type == "Chrome" || type == "Safari" || type == "Firefox") {
            return extensionGM;
        }
        return GM;
    }
    setInterval(() => {
        if (isWebsite) {
            (function () {
                const iframes = document.getElementsByTagName('iframe');
                for (const iframe of iframes) {
                    try {
                        if (iframe.contentWindow.VideoTogetherParentInject != true &&
                            window.location.origin === iframe.contentWindow.location.origin) {
                            console.log("inject to iframe");
                            const script = document.createElement('script');
                            script.src = "https://2gether.video/release/extension.website.user.js";
                            iframe.contentWindow.document.body.appendChild(script);
                            iframe.contentWindow.VideoTogetherParentInject = true;
                        }
                    } catch (error) {
                    }
                }
            })();
        }
    }, 2000);

    if (type == "website" || type == "website_debug") {

        getGM().setValue = async (key, value) => {
            return localStorage.setItem(key, JSON.stringify(value));
        }

        getGM().getValue = async (key) => {
            return JSON.parse(localStorage.getItem(key));
        }

        getGM().getTab = async () => {
            let tab = sessionStorage.getItem('VideoTogetherTab');
            return tab == null ? {} : JSON.parse(tab);
        }

        getGM().saveTab = async (tab) => {
            return sessionStorage.setItem('VideoTogetherTab', JSON.stringify(tab));
        }

        getGM().xmlHttpRequest = async (props) => {
            try {
                fetch(props.url, {
                    method: props.method,
                    body: props.method == "GET" ? undefined : JSON.stringify(props.data)
                })
                    .then(r => r.text())
                    .then(text => props.onload({ responseText: text }))
                    .catch(e => props.onerror(e));
            } catch (e) {
                props.onerror(e);
            }
        }
    }
    if (type == "Chrome" || type == "Safari" || type == "Firefox") {
        getGM().setValue = async (key, value) => {
            return await new Promise((resolve, reject) => {
                try {
                    let item = {};
                    item[key] = value;
                    getBrowser().storage.local.set(item, function () {
                        resolve();
                    });
                } catch (e) {
                    reject(e);
                }
            })
        }
        getGM().getValue = async (key) => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().storage.local.get([key], function (result) {
                        resolve(result[key]);
                    });
                } catch (e) {
                    reject(e);
                }

            })
        }
        getGM().getTab = async () => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().runtime.sendMessage(JSON.stringify({ type: 1 }), function (response) {
                        resolve(response);
                    })
                } catch (e) {
                    reject(e);
                }

            })
        }
        getGM().saveTab = async (tab) => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().runtime.sendMessage(JSON.stringify({ type: 2, tab: tab }), function (response) {
                        resolve(response);
                    })
                } catch (e) {
                    reject(e);
                }
            })
        }
        getGM().xmlHttpRequest = async (props) => {
            try {
                getBrowser().runtime.sendMessage(JSON.stringify({ type: 3, props: props }), function (response) {
                    if (response.error != undefined) {
                        throw response.error;
                    }
                    props.onload(response);
                })
            } catch (e) {
                props.onerror(e);
            }
        }
    }

    if (isExtension) {
        let vtEnabled = await getGM().getValue('vtEnabled');
        if (vtEnabled === false) {
            getBrowser().runtime.sendMessage(JSON.stringify({ type: 4, enabled: false }));
            return;
        } else {
            getBrowser().runtime.sendMessage(JSON.stringify({ type: 4, enabled: true }));
        }
    }


    let languages = ['en-us', 'zh-cn'];
    let language = 'en-us';
    let prefixLen = 0;
    let settingLanguage = undefined;
    try {
        settingLanguage = await getGM().getValue("DisplayLanguage");
    } catch (e) { };

    if (typeof settingLanguage != 'string') {
        settingLanguage = navigator.language;
    }
    if (typeof settingLanguage == 'string') {
        settingLanguage = settingLanguage.toLowerCase();
        for (let i = 0; i < languages.length; i++) {
            for (let j = 0; j < languages[i].length && j < settingLanguage.length; j++) {
                if (languages[i][j] != settingLanguage[j]) {
                    break;
                }
                if (j > prefixLen) {
                    prefixLen = j;
                    language = languages[i];
                }
            }
        }
    }

    let vtRefreshVersion = version + language;
    try {
        let publicVtVersion = await getGM().getValue("PublicVtVersion")
        if (publicVtVersion != null) {
            vtRefreshVersion = vtRefreshVersion + String(publicVtVersion);
        }
    } catch (e) { };
    console.log(vtRefreshVersion)

    let cachedVt = null;
    try {
        let vtType = isWebsite ? "website" : "user";
        let privateCachedVt = await getGM().getValue("PrivateCachedVt");
        let cachedVersion = null;
        try {
            cachedVersion = privateCachedVt['version'];
        } catch { };
        if (cachedVersion == vtRefreshVersion) {
            cachedVt = privateCachedVt['data'];
        } else {
            console.log("Refresh VT");
            fetch(`https://2gether.video/release/vt.${language}.${vtType}.js?vtRefreshVersion=` + vtRefreshVersion)
                .then(r => r.text())
                .then(data => getGM().setValue('PrivateCachedVt', {
                    'version': vtRefreshVersion,
                    'data': data
                }))
                .catch(() => {
                    fetch(`https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.${language}.${vtType}.js?vtRefreshVersion=` + vtRefreshVersion)
                        .then(r => r.text())
                        .then(data => getGM().setValue('PrivateCachedVt', {
                            'version': vtRefreshVersion,
                            'data': data
                        }))
                })
        }
    } catch (e) { };

    async function AppendKey(key) {
        let keysStr = await getGM().getValue("VideoTogetherKeys");
        let keys = new Set(JSON.parse(keysStr));
        keys.add(key);
        await getGM().setValue("VideoTogetherKeys", JSON.stringify(Array.from(keys)));
    }

    async function GetKeys() {
        let keysStr = await getGM().getValue("VideoTogetherKeys");
        try {
            let keys = new Set(JSON.parse(keysStr));
            return Array.from(keys);
        } catch (e) {
            await getGM().setValue("VideoTogetherKeys", "[]");
            return [];
        }
    }

    function InsertInlineScript(content) {
        try {
            let inlineScript = document.createElement("script");
            inlineScript.textContent = content;
            document.head.appendChild(inlineScript);
        } catch { }
        try {
            if (isUserscript) {
                GM_addElement('script', {
                    textContent: content,
                    type: 'text/javascript'
                });
            }
        } catch { }
        try {
            if (isWebsite) {
                eval(content);
            }
        } catch { }
    }

    function InsertInlineJs(url) {
        try {
            getGM().xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function (response) {
                    InsertInlineScript(response.responseText);
                }
            })
        } catch (e) { };
    }

    async function SetTabStorage(data) {
        try {
            let tabObj = await getGM().getTab();
            tabObj.VideoTogetherTabStorage = data;
            await getGM().saveTab(tabObj);
            window.postMessage({
                source: "VideoTogether",
                type: 19,
                data: tabObj.VideoTogetherTabStorage
            })
        } catch (e) { };
    }

    if (window.VideoTogetherLoading) {
        return;
    }
    window.VideoTogetherLoading = true;
    let ExtensionInitSuccess = false;

    let isTrustPageCache = undefined;
    function isTrustPage() {
        if (isDevelopment) {
            return true;
        }
        if (window.location.protocol != 'https:') {
            return false
        }

        if (isTrustPageCache == undefined) {
            const domains = [
                '2gether.video', 'videotogether.github.io', 'videotogether.gitee.io'
            ];

            const hostname = window.location.hostname;
            isTrustPageCache = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        }
        return isTrustPageCache;
    }
    const indexedDbWriteHistory = {}
    function needTrustPage() {
        if (!isTrustPage()) {
            throw "not trust page"
        }
    }

    window.addEventListener("message", async e => {
        if (e.data.source == "VideoTogether") {
            switch (e.data.type) {
                case 13: {
                    let url = new URL(e.data.data.url);
                    if (!url.hostname.endsWith("2gether.video")
                        && !url.hostname.endsWith("chizhou.in")
                        && !url.hostname.endsWith("panghair.com")
                        && !url.hostname.endsWith("rpc.kraken.fm")
                        && !url.hostname.endsWith("aliyuncs.com")) {
                        console.error("permission error", e.data);
                        return;
                    }
                    getGM().xmlHttpRequest({
                        method: e.data.data.method,
                        url: e.data.data.url,
                        data: e.data.data.data,
                        onload: function (response) {
                            let data = null;
                            try {
                                data = JSON.parse(response.responseText);
                            } catch (e) { };
                            window.postMessage({
                                source: "VideoTogether",
                                type: 14,
                                data: {
                                    id: e.data.data.id,
                                    data: data,
                                    text: response.responseText
                                }
                            })
                        },
                        onerror: function (error) {
                            window.postMessage({
                                source: "VideoTogether",
                                type: 14,
                                data: {
                                    id: e.data.data.id,
                                    error: error,
                                }
                            })
                        }
                    })
                    break;
                }
                case 15: {
                    if (window.location.hostname.endsWith("videotogether.gitee.io")
                        || window.location.hostname.endsWith("videotogether.github.io")
                        || window.location.hostname.endsWith("2gether.video")
                        || e.data.data.key.startsWith("Public")
                        || isWebsite) {
                        getGM().setValue(e.data.data.key, e.data.data.value)
                        AppendKey(e.data.data.key);
                        break;
                    } else {
                        console.error("permission error", e.data);
                    }
                    break;
                }
                case 17: {
                    ExtensionInitSuccess = true;
                    break;
                }
                case 18: {
                    await SetTabStorage(e.data.data);
                    break;
                }
                case 2001: {
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data), response => {
                        if (indexedDbWriteHistory[e.data.data.table] == undefined) {
                            indexedDbWriteHistory[e.data.data.table] = {};
                        }
                        indexedDbWriteHistory[e.data.data.table][e.data.data.key] = true;
                        window.postMessage({
                            source: "VideoTogether",
                            type: 2003,
                            data: {
                                id: e.data.data.id,
                                table: e.data.data.table,
                                key: e.data.data.key,
                                error: response.error
                            }
                        })
                    })
                    break;
                }
                case 2002: {
                    try {
                        if (!indexedDbWriteHistory[e.data.data.table][e.data.data.key]) {
                            needTrustPage();
                        }
                    } catch {
                        needTrustPage();
                    }
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data), response => {
                        window.postMessage({
                            source: "VideoTogether",
                            type: 2004,
                            data: {
                                id: e.data.data.id,
                                table: e.data.data.table,
                                key: e.data.data.key,
                                data: response.data,
                                error: response.error
                            }
                        })
                    })
                    break;
                }
                case 2005: {
                    needTrustPage();
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data), response => {
                        window.postMessage({
                            source: "VideoTogether",
                            type: 2006,
                            data: {
                                id: e.data.data.id,
                                table: e.data.data.table,
                                regex: e.data.data.regex,
                                data: response.data,
                                error: response.error
                            }
                        })
                    })
                    break;
                }
                case 2007: {
                    needTrustPage();
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data), response => {
                        window.postMessage({
                            source: "VideoTogether",
                            type: 2008,
                            data: {
                                id: e.data.data.id,
                                table: e.data.data.table,
                                key: e.data.data.key,
                                error: response.error
                            }
                        })
                    })
                    break;
                }
                case 2009: {
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data), response => {
                        window.postMessage({
                            source: "VideoTogether",
                            type: 2010,
                            data: {
                                data: JSON.parse(response)
                            }
                        })
                    })
                    break;
                }
                case 3009: {
                    getBrowser().runtime.sendMessage(JSON.stringify(e.data))
                    break;
                }
            }
        }
    });

    let isMain = window.self == window.top;

    async function PostStorage() {
        try {
            let keys = await GetKeys();
            let data = {}
            for (let i = 0; i < keys.length; i++) {
                data[keys[i]] = await getGM().getValue(keys[i]);
                if (data[keys[i]] == 'true') {
                    data[keys[i]] = true;
                }
                if (data[keys[i]] == 'false') {
                    data[keys[i]] = false;
                }
            }
            data["UserscriptType"] = type;
            data["LoaddingVersion"] = version;
            data["VideoTogetherTabStorageEnabled"] = true;
            try {
                data["VideoTogetherTabStorage"] = (await getGM().getTab()).VideoTogetherTabStorage;
            } catch (e) {
                data["VideoTogetherTabStorageEnabled"] = false;
            }
            window.postMessage({
                source: "VideoTogether",
                type: 16,
                data: data
            }, "*");
        } catch { }
    }

    PostStorage();
    setInterval(() => {
        PostStorage();
    }, 1000);

    function insertJs(url) {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        (document.body || document.documentElement).appendChild(script);
    }

    let wrapper = document.createElement("div");
    wrapper.innerHTML = `{{{ {"user": "./html/loading.html", "order":1} }}}`;
    (document.body || document.documentElement).appendChild(wrapper);
    let script = document.createElement('script');
    script.type = 'text/javascript';
    switch (type) {
        case "userscript":
            script.src = `https://2gether.video/release/vt.${language}.user.js?timestamp=` + version;
            break;
        case "Chrome":
        case "Safari":
        case "Firefox":
            let inlineDisabled = false;
            let evalDisabled = false;
            let urlDisabled = false;
            let hotUpdated = false;
            document.addEventListener("securitypolicyviolation", (e) => {
                if (hotUpdated) {
                    return;
                }
                if (e.blockedURI.indexOf('2gether.video') != -1) {
                    urlDisabled = true;
                }
                if (urlDisabled) {
                    console.log("hot update is not successful")
                    insertJs(getBrowser().runtime.getURL(`vt.${language}.user.js`));
                    hotUpdated = true;
                }
            });
            if (isDevelopment) {
                script.src = getBrowser().runtime.getURL(`vt.${language}.user.js`);
            } else {
                script.src = getBrowser().runtime.getURL(`load.${language}.js`);
            }
            script.setAttribute("cachedVt", cachedVt);
            break;
        case "userscript_debug":
            script.src = `http://127.0.0.1:7000/release/vt.debug.${language}.user.js?timestamp=` + parseInt(Date.now());
            break;
        case "userscript_beta":
            script.src = `https://raw.githubusercontent.com/VideoTogether/VideoTogether/voice/release/vt.${language}.user.js?timestamp=` + parseInt(Date.now());
            break;
        case "website":
            script.src = `https://2gether.video/release/vt.${language}.website.js?timestamp=` + version;
            break;
        case "website_debug":
            script.src = `http://127.0.0.1:7000/release/vt.debug.${language}.website.js?timestamp=` + parseInt(Date.now());
            break;
    }

    if (isWebsite || isUserscript) {
        if (cachedVt != null) {
            InsertInlineScript(cachedVt);
        }
        setTimeout(() => {
            if (!ExtensionInitSuccess) {
                (document.body || document.documentElement).appendChild(script);
                if (isWebsite) {
                    // keep this inline inject because shark browser needs this
                    InsertInlineJs(script.src);
                }
                try {
                    GM_addElement('script', {
                        src: script.src,
                        type: 'text/javascript'
                    })
                } catch { }
            }
        }, 10);
    } else {
        (document.body || document.documentElement).appendChild(script);
    }

    // fallback to china service
    setTimeout(() => {
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }
        if (type == "Chrome" || type == "Firefox" || type == "Safari") {
            return;
        }
        if (!ExtensionInitSuccess) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.${language}.user.js`;
            (document.body || document.documentElement).appendChild(script);
            try {
                if (isWebsite) {
                    InsertInlineJs(script.src);
                }

                GM_addElement('script', {
                    src: script.src,
                    type: 'text/javascript'
                })
            } catch (e) { };
        }
    }, 5000);
    function filter(e) {
        let target = e.target;

        if (target.id != "videoTogetherLoading") {
            return;
        }

        target.moving = true;

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
            if (!target.moving) {
                return;
            }
            if (event.clientX) {
                target.distX = event.clientX - target.oldX;
                target.distY = event.clientY - target.oldY;
            } else {
                target.distX = event.touches[0].clientX - target.oldX;
                target.distY = event.touches[0].clientY - target.oldY;
            }

            target.style.left = Math.min(document.documentElement.clientWidth - target.clientWidth, Math.max(0, target.oldLeft + target.distX)) + "px";
            target.style.top = Math.min(document.documentElement.clientHeight - target.clientHeight, Math.max(0, target.oldTop + target.distY)) + "px";
        }

        function endDrag() {
            target.moving = false;
        }
        target.onmouseup = endDrag;
        target.ontouchend = endDrag;
    }
    document.onmousedown = filter;
    document.ontouchstart = filter;
})();