(function () {
    try {
        Element.prototype.VideoTogetherAttachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function () {
            console.log('attachShadow');
            return this.VideoTogetherAttachShadow({ mode: "open" });
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

    let language = "zh-cn";

    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://2gether.video/release/vt.${language}.user.js?timestamp=` + parseInt(Date.now() / 1000 / 3600);
    document.body.appendChild(script);
    try {
        InsertInlineJs(script.src);
    } catch (e) { };

    // fallback to china service
    setTimeout(() => {
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }

        if (window.videoTogetherExtension != undefined) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.${language}.user.js`;
            document.body.appendChild(script);
            try {
                InsertInlineJs(script.src);
            } catch (e) { };
        }

    }, 5000);
})()