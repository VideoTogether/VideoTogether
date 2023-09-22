setTimeout(() => {
    function isM3U8(textContent) {
        return textContent.trim().startsWith('#EXTM3U');
    }

    if (sessionStorage.getItem("VideoTogetherSuperEasyShare") === 'true') {
        function limitStream(stream, limit) {
            const reader = stream.getReader();
            let bytesRead = 0;
            let isM3U8 = false;
            let buffer = new Uint8Array();

            return new ReadableStream({
                async pull(controller) {
                    const { value, done } = await reader.read();

                    if (done) {
                        controller.close();
                        return;
                    }

                    if (!isM3U8 && buffer.length < 7) {
                        const tmp = new Uint8Array(buffer.length + value.byteLength);
                        tmp.set(buffer, 0);
                        tmp.set(value, buffer.length);
                        buffer = tmp;
                    }

                    if (!isM3U8 && buffer.length >= 7) {
                        const textChunk = new TextDecoder().decode(buffer.slice(0, 7));
                        if (textChunk === "#EXTM3U") {
                            isM3U8 = true;
                        }
                    }

                    if (!isM3U8 && bytesRead >= limit) {
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
        console.log("VideoTogetherSuperEasyShare");
        // do I need to overwrite setAttribute?
        Object.defineProperty(HTMLVideoElement.prototype, 'src', {
            set: function (v) {
                let realUrl = undefined
                fetch(v, { method: "GET" }).then(r => {
                    realUrl = r.url
                    const limitedStream = limitStream(r.body, 1024); // Limit to 1024 bytes
                    const resp =  new Response(limitedStream, { headers: r.headers });
                    resp.__vtRealUrl = realUrl;
                    return resp;
                }).then(r => r.text()).then(text => {
                    if (isM3U8(text)) {
                        const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' });
                        const blobUrl = URL.createObjectURL(blob);
                        const source = document.createElement("source");
                        source.type = "application/vnd.apple.mpegurl"
                        source.src = blobUrl;
                        this.removeAttribute('src')
                        this.appendChild(source)
                    } else {
                        this.setAttribute('src', realUrl);
                    }
                }).catch(e => {
                    if (realUrl) {
                        this.setAttribute('src', realUrl);
                    } else {
                        this.setAttribute('src', v);
                    }
                })
            },
            get: function () { return this.getAttribute('src') }
        })

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        let video = undefined
                        if (node instanceof HTMLElement) {
                            video = node.querySelector("video");
                        }
                        if (node instanceof HTMLVideoElement) {
                            video = node;
                        }
                        if (video) {
                            video.src = video.src
                        }
                    });
                }
            });
        });
        observer.observe(document, {
            childList: true,
            subtree: true,
        });
    }
}, 1);

window.VideoTogetherFetch = window.fetch;

(() => {
    function isM3U8(textContent) {
        return textContent.trim().startsWith('#EXTM3U');
    }

    let MessageType = {
        UpdateM3u8Files: 1001,
    }

    if (window.VideoTogetherPreinjected) {
        return;
    }
    window.VideoTogetherPreinjected = true;

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

    let originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (shadowRootInit = {}) {
        let modifiedShadowRootInit = {
            ...shadowRootInit,
            mode: 'open'
        };
        return originalAttachShadow.call(this, modifiedShadowRootInit);
    };

    const originalResponseText = Response.prototype.text;
    Response.prototype.text = async function () {
        const text = await originalResponseText.call(this);
        try {
            let realUrl = undefined;
            try {
                if (this.__vtRealUrl) {
                    realUrl = this.__vtRealUrl;
                }
            } catch { }
            processResponseText(realUrl ? realUrl : this.url, text);
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