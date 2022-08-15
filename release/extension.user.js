// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    https://2gether.video/
// @version      1660571145
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
    try {
        Element.prototype.VideoTogetherAttachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function () {
            console.log('attachShadow');
            return this.VideoTogetherAttachShadow({ mode: "open" });
        };
    } catch (e) { };

    try {
        if (navigator.userAgent.indexOf("Firefox") > 0) {
            alert("Firefox is not supported by VideoTogether")
        }
    } catch (e) { };
    let version = '1660571145'
    let type = 'userscript'

    let languages = ['en-us', 'zh-cn'];
    let language = 'en-us';
    let prefixLen = 0;
    let settingLanguage = undefined;
    try {
        settingLanguage = await GM.getValue("DisplayLanguage");
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

    async function AppendKey(key) {
        let keysStr = await GM.getValue("VideoTogetherKeys", "[]");
        try {
            let keys = new Set(JSON.parse(keysStr));
            keys.add(key);
            await GM.setValue("VideoTogetherKeys", JSON.stringify(Array.from(keys)));
        } catch (e) {
            await GM.setValue("[]");
        }
    }

    async function GetKeys() {
        let keysStr = await GM.getValue("VideoTogetherKeys", "[]");
        try {
            let keys = new Set(JSON.parse(keysStr));
            return Array.from(keys);
        } catch (e) {
            await GM.setValue("[]");
            return [];
        }
    }

    function InsertInlineJs(url) {
        try {
            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function (response) {
                    let inlineScript = document.createElement("script");
                    inlineScript.textContent = response.responseText;
                    document.head.appendChild(inlineScript);
                }
            })
        } catch (e) { };
    }

    async function SetTabStorage(data) {
        try {
            let tabObj = await GM.getTab();
            tabObj.VideoTogetherTabStorage = data;
            await GM.saveTab(tabObj);
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
    window.addEventListener("message", async e => {
        if (e.data.source == "VideoTogether") {
            switch (e.data.type) {
                case 13: {
                    let url = new URL(e.data.data.url);
                    if (!url.hostname.endsWith("2gether.video") && !url.hostname.endsWith("chizhou.in") && !url.hostname.endsWith("panghair.com")) {
                        console.error("permission error", e.data);
                        return;
                    }
                    GM.xmlHttpRequest({
                        method: e.data.data.method,
                        url: e.data.data.url,
                        data: e.data.data.data,
                        onload: function (response) {
                            window.postMessage({
                                source: "VideoTogether",
                                type: 14,
                                data: {
                                    id: e.data.data.id,
                                    data: JSON.parse(response.responseText)
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
                        || e.data.data.key.startsWith("Public")) {
                        GM.setValue(e.data.data.key, e.data.data.value)
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
            }
        }
    });

    let isMain = window.self == window.top;

    async function PostStorage() {
        let keys = await GetKeys();
        let data = {}
        for (let i = 0; i < keys.length; i++) {
            data[keys[i]] = await GM.getValue(keys[i]);
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
            data["VideoTogetherTabStorage"] = (await GM.getTab()).VideoTogetherTabStorage;
        } catch (e) {
            data["VideoTogetherTabStorageEnabled"] = false;
        }
        window.top.postMessage({
            source: "VideoTogether",
            type: 16,
            data: data
        }, "*");
    }

    PostStorage();
    setInterval(() => {
        PostStorage();
    }, 1000);

    let wrapper = document.createElement("div");
    wrapper.innerHTML = `<div id="videoTogetherLoading">
    <div id="videoTogetherLoadingwrap">
        <img style="display: inline;" src="https://www.2gether.video/icon/favicon-16x16.png">
        <a target="_blank" href="http://2gether.video/guide/qa.html">loading ...</a>
    </div>
</div>

<style>
    #videoTogetherLoading {
        touch-action: none;
        height: 50px;
        border: 1px solid #c9c8c8;
        background: #ffffff;
        color: #212529;
        display: flex;
        align-items: center;
        z-index: 2147483646;
        position: fixed;
        bottom: 15px;
        right: 15px;
        width: 250px;
        text-align: center;
        box-shadow: 0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d;
        border-radius: 5px;
    }
    #videoTogetherLoadingwrap {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    #videoTogetherLoadingwrap img {
        margin-right: 12px;
    }
    #videoTogetherLoadingwrap a {
        color: #212529;
        text-decoration: none;
    }
    #videoTogetherLoadingwrap a:hover {
        color: #1890ff;
        text-decoration: underline;
    }
</style>
`
    document.getElementsByTagName('body')[0].appendChild(wrapper);
    let script = document.createElement('script');
    script.type = 'text/javascript';
    switch (type) {
        case "userscript":
            script.src = `https://2gether.video/release/vt.${language}.user.js?timestamp=` + parseInt(Date.now() / 1000 / 3600);
            break;
        case "Chrome":
            script.src = chrome.runtime.getURL(`vt.${language}.user.js`)
            break;
        case "userscript_debug":
            script.src = `http://127.0.0.1:7000/release/vt.debug.${language}.user.js?timestamp=` + parseInt(Date.now());
            break;
        case "userscript_beta":
            script.src = `https://raw.githubusercontent.com/VideoTogether/VideoTogether/main/release/vt.${language}.user.js?timestamp=` + parseInt(Date.now());
            break;
    }

    document.body.appendChild(script);
    try {
        InsertInlineJs(script.src);
        GM_addElement('script', {
            src: script.src,
            type: 'text/javascript'
        })
    } catch (e) { };

    // fallback to china service
    setTimeout(() => {
        if (!ExtensionInitSuccess) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.${language}.user.js`;
            document.body.appendChild(script);
            try {
                InsertInlineJs(script.src);
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