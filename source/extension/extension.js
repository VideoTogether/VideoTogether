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
// @grant        GM_getTab
// @grant        GM_saveTab
// @connect      2gether.video
// @connect      api.2gether.video
// @connect      api.chizhou.in
// @connect      api.panghair.com
// @connect      vt.panghair.com
// ==/UserScript==

(function () {
    let version = '{{timestamp}}'
    let type = '{{{ {"": "./config/type_userscript","chrome":"./config/type_chrome_extension","debug":"./config/type_userscript_debug", "order":0} }}}'

    try {
        GM_getTab(function (tabObj) {
            tabObj.VideoTogetherTabStorageTest = true;
            GM_saveTab(tabObj);
            window.VideoTogetherTabStorage = tabObj.VideoTogetherTabStorage;
            window.VideoTogetherTabStorageEnabled = true;
        })
    } catch (e) { };

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

    function SetTabStorage(data) {
        try {
            GM_getTab(function (tabObj) {
                tabObj.VideoTogetherTabStorage = data;
                GM_saveTab(tabObj);
                window.VideoTogetherTabStorage = tabObj.VideoTogetherTabStorage;
                window.postMessage({
                    source: "VideoTogether",
                    type: 19,
                    data: tabObj.VideoTogetherTabStorage
                })
            });
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
                    if (!url.host.endsWith("2gether.video") && !url.host.endsWith("chizhou.in") && !url.host.endsWith("panghair.com")) {
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
                    if (window.location.host.endsWith("videotogether.gitee.io")
                        || window.location.host.endsWith("videotogether.github.io")
                        || window.location.host.endsWith("2gether.video")
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
                    SetTabStorage(e.data.data);
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
        data["LoaddingVersion"] = version;
        data["VideoTogetherTabStorageEnabled"] = window.VideoTogetherTabStorageEnabled;
        data["VideoTogetherTabStorage"] = window.VideoTogetherTabStorage;
        window.top.postMessage({
            source: "VideoTogether",
            type: 16,
            data: data
        }, "*");
    }
    function PostStorageWithTab() {
        try {
            GM_getTab(function (tabObj) {
                window.VideoTogetherTabStorage = tabObj.VideoTogetherTabStorage;
                PostStorage();
            });
        } catch (e) {
            PostStorage();
        };
    }
    PostStorageWithTab();
    setInterval(() => {
        PostStorageWithTab();
    }, 1000);

    let wrapper = document.createElement("div");
    wrapper.innerHTML = `{{{ {"user": "./html/loading.html", "order":1} }}}`
    document.getElementsByTagName('body')[0].appendChild(wrapper);
    let script = document.createElement('script');
    script.type = 'text/javascript';
    switch (type) {
        case "userscript":
            script.src = 'https://2gether.video/release/vt.user.js?timestamp=' + parseInt(Date.now() / 1000 / 3600);
            break;
        case "Chrome":
            script.src = chrome.runtime.getURL('vt.user.js')
            break;
        case "userscript_debug":
            script.src = 'http://127.0.0.1:7000/release/vt.debug.user.js?timestamp=' + parseInt(Date.now());
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
            script.src = 'https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.user.js';
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