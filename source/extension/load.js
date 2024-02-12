
(function () {
    let version = '{{timestamp}}'
    const isDevelopment = (`{{{ {"": "./config/false", "dev": "./config/true","order":97} }}}` == 'true');
    const isWrapperFrameEnabled = (`{{{ {"": "./config/false", "frame": "./config/true","order":98} }}}`== 'true');
    const language = "{$locale$}";
    const loadSrc = new URL(document.currentScript.getAttribute("src"));
    loadSrc.pathname = '/videotogether_wrapper.html'
    window.VideoTogetherWrapperIframeUrl = loadSrc.href;

    if (isDevelopment) {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        loadSrc.pathname = `/vt.v2${isWrapperFrameEnabled ? ".frame" : ""}.${language}.user.js`
        script.src = loadSrc.href;
        document.body.appendChild(script);
        return;
    }
    try {
        eval(document.currentScript.getAttribute("cachedvt"));
    } catch (e) { console.error(e) }

    try {
        if (window.videoTogetherExtension == undefined) {
            let inlineScript = document.createElement("script");
            inlineScript.textContent = document.currentScript.getAttribute("cachedvt");
            document.head.appendChild(inlineScript);
        }
    } catch (e) { console.error(e) }



    if (window.videoTogetherExtension == undefined) {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        try {
            script.src = `https://2gether.video/release/vt.v2${isWrapperFrameEnabled ? ".frame" : ""}.${language}.user.js?timestamp=` + version;
        } catch {
            // this is a very secure site. don't inject
            document.querySelector("#videoTogetherLoading").remove();
        }
        try {
            document.body.appendChild(script);
        } catch { };
    }

    // fallback to china service
    setTimeout(() => {
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }

        if (window.videoTogetherExtension == undefined) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.v2.${language}.user.js`;
            try {
                document.body.appendChild(script);
            } catch { };
        }
    }, 5000);
})()