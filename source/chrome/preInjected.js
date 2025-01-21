window.VideoTogetherFetch = window.fetch;

try {
    document.currentScript.remove();
} catch (e) { }

(() => {
    const blackList = ['yiyan.baidu.com']
    const hostname = window.location.hostname;
    if (blackList.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
        return;
    }
    if (window.VideoTogetherPreinjected) {
        return;
    }
    window.VideoTogetherPreinjected = true;

    setTimeout(() => {
        if (sessionStorage.getItem("VideoTogetherSuperEasyShare") === 'true') {
            console.log("VideoTogetherSuperEasyShare");
            let originalSetAttribute = HTMLVideoElement.prototype.setAttribute;
            HTMLVideoElement.prototype.setAttribute = function (name, value) {
                try {
                    if (name == 'src' && value.startsWith("http")) {
                        const controller = new AbortController();
                        fetch(value, { method: "GET", signal: controller.signal }).then(r => {
                            controller.abort();
                            if (this.getAttribute("src") != value) {
                                return;
                            }
                            console.log("use real media url", r.url);
                            originalSetAttribute.call(this, name, r.url);
                        }).catch(e => { })
                    }
                } catch (e) { }
                originalSetAttribute.call(this, name, value);
            }

            Object.defineProperty(HTMLVideoElement.prototype, 'src', {
                set: function (v) { this.setAttribute("src", v); },
                get: function () { return this.getAttribute('src') }
            })
        }
    }, 1);


    let MessageType = {
        UpdateM3u8Files: 1001,
    }

    const Global = {
        NativePostMessageFunction: null
    }

    function PostMessage(window, data) {
        if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.postMessage))) {
            window.postMessage(data, "*");
        } else {
            if (!Global.NativePostMessageFunction) {
                let temp = document.createElement("iframe");
                temp.style.display = 'none';
                document.body.append(temp);
                Global.NativePostMessageFunction = temp.contentWindow.postMessage;
            }
            Global.NativePostMessageFunction.call(window, data, "*");
        }
    }

    function sendMessageToTop(type, data) {
        PostMessage(window.top, {
            source: "VideoTogether",
            type: type,
            data: data
        });
    }

    function generateUUID() {
        if (crypto.randomUUID != undefined) {
            return crypto.randomUUID();
        }
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    const runId = generateUUID();
    const m3u8Files = [];

    // const isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
    // iOS, iPad OS won't use this code, we don't need to check device
    // disable all hls support
    // until https://bugs.chromium.org/p/chromium/issues/detail?id=1266991&q=android%20hls&can=2
    let originalCanPlayType = HTMLVideoElement.prototype.canPlayType;
    HTMLVideoElement.prototype.canPlayType = function (type) {
        const result = originalCanPlayType.call(this, type);
        console.log('canPlayType_vt_pre', type, result);
        try {
            let m3u8Type = ['application/x-mpegurl',
                'application/vnd.apple.mpegurl',
                'audio/mpegurl',
                'vnd.apple.mpegurl']
            if (m3u8Type.indexOf(type.toLowerCase()) != -1) {
                // Android Chrome hls player is shit!
                console.log('cant play', type)
                return "";
            }
        } catch {
        }
        return result;
    };

    const originalResponseText = Response.prototype.text;
    Response.prototype.text = async function () {
        const text = await originalResponseText.call(this);
        try {
            processResponseText(this.url, text);
        } catch (e) { console.error(e); }
        return text;
    }

    const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
        try {
            this.addEventListener("load", () => {
                try {
                    const text = this.responseText;
                    const url = this.responseURL;
                    processResponseText(url, text);
                } catch { }
            });
        } catch (e) { console.error(e); }
        return originalXMLHttpRequestOpen.apply(this, args);
    }

    let m3u8Updater = undefined;
    function processResponseText(url, textContent) {
        if (isM3U8(textContent)) {
            const duration = calculateM3U8Duration(textContent);
            m3u8Files.push({
                'm3u8Url': url,
                'm3u8Content': textContent,
                'duration': duration,
            })
            if (window.VideoTogetherEasyShare === 'disabled') {
                window.VideoTogetherM3u8Files = null;
            } else {
                window.VideoTogetherM3u8Files = m3u8Files;
            }
            sendMessageToTop(MessageType.UpdateM3u8Files, {
                id: runId,
                m3u8Files: m3u8Files
            })
            if (m3u8Updater == undefined) {
                m3u8Updater = setInterval(() => {
                    sendMessageToTop(MessageType.UpdateM3u8Files, {
                        id: runId,
                        m3u8Files: m3u8Files
                    })
                }, 2000);
            }
        }
    }

    function isM3U8(textContent) {
        return textContent.trim().startsWith('#EXTM3U');
    }

    function calculateM3U8Duration(textContent) {
        let totalDuration = 0;
        const lines = textContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
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
})();