
(function () {
    let version = '{{timestamp}}'

    function generateUUID() {
        if (crypto.randomUUID != undefined) {
            return crypto.randomUUID();
        }
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    try {
        let originalAttachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (shadowRootInit = {}) {
            let modifiedShadowRootInit = {
                ...shadowRootInit,
                mode: 'open'
            };
            return originalAttachShadow.call(this, modifiedShadowRootInit);
        };
    } catch (e) { };

    let NativePostMessageFunction = undefined;
    function PostMessage(window, data) {
        if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.postMessage))) {
            window.postMessage(data, "*");
        } else {
            if (!NativePostMessageFunction) {
                let temp = document.createElement("iframe");
                document.body.append(temp);
                NativePostMessageFunction = temp.contentWindow.postMessage;
            }
            NativePostMessageFunction.call(window, data, "*");
        }
    }

    function InsertInlineJs(url) {
        PostMessage(window.self, {
            source: "VideoTogether",
            type: 13,
            data: {
                id: "vt_load83x" + generateUUID(),
                url: url.toString(),
                method: "GET",
                data: null,
            }
        })
    }

    window.addEventListener('message', message => {
        if (message.data.type == 14 && message.data.data.id.startsWith("vt_load83x")) {
            let inlineScript = document.createElement("script");
            inlineScript.textContent = message.data.data.text;
            try {
                document.head.appendChild(inlineScript);
            } catch (e) { }

            try {
                eval(message.data.data.text);
            } catch (e) { }
        }
    });

    let language = "{$locale$}";

    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://2gether.video/release/vt.${language}.user.js?timestamp=` + version;
    try {
        document.body.appendChild(script);
    } catch { };
    // try {
    //     InsertInlineJs(script.src);
    // } catch { };

    // fallback to china service
    setTimeout(() => {
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }

        if (window.videoTogetherExtension == undefined) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.${language}.user.js`;
            try {
                document.body.appendChild(script);
            } catch { };
            // try {
            //     InsertInlineJs(script.src);
            // } catch { };
        }

    }, 5000);
})()