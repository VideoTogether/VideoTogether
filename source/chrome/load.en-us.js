(function () {
    try {
        let origin = Element.prototype.attachShadow;
        if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(origin))) {
            Element.prototype._attachShadow = origin;
            Element.prototype.attachShadow = function () {
                console.log('attachShadow');
                return this._attachShadow({ mode: "open" });
            };
        }
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
                id: Date.now(),
                url: url.toString(),
                method: "GET",
                data: null,
            }
        })
    }

    window.addEventListener('message', message => {
        if (message.data.type == 14) {
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

    let language = "en-us";

    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://2gether.video/release/vt.${language}.user.js?timestamp=` + parseInt(Date.now() / 1000 / 3600);
    try {
        document.body.appendChild(script);
    } catch { };
    try {
        InsertInlineJs(script.src);
    } catch { };

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
            try {
                InsertInlineJs(script.src);
            } catch { };
        }

    }, 5000);
})()