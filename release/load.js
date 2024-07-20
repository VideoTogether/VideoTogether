
(function () {
    let version = '1721480832'

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


    const language = "zh-cn";

    const encodedChinaCdnA = 'aHR0cHM6Ly92aWRlb3RvZ2V0aGVyLm9zcy1jbi1oYW5nemhvdS5hbGl5dW5jcy5jb20='
    const encodeFastlyJsdelivrCdn = 'aHR0cHM6Ly9mYXN0bHkuanNkZWxpdnIubmV0L2doL1ZpZGVvVG9nZXRoZXIvVmlkZW9Ub2dldGhlckBsYXRlc3Q='
    function getCdnPath(encodedCdn, path) {
        const cdn = encodedCdn.startsWith('https') ? encodedCdn : atob(encodedCdn);
        return `${cdn}/${path}`;
    }
    async function getCdnConfig(encodedCdn) {
        return fetch(getCdnPath(encodedCdn, 'release/cdn-config.json')).then(r => r.json())
    }
    async function getChinaCdnB() {
        return getCdnConfig(encodedChinaCdnA).then(c => c.jsCdnHostChina)
    }

    if (window.videoTogetherExtension == undefined) {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        try {
            script.src = getCdnPath(encodeFastlyJsdelivrCdn, `release/vt.${language}.user.js?timestamp=${version}`);
        } catch {
            // this is a very secure site. don't inject
            document.querySelector("#videoTogetherLoading").remove();
        }
        try {
            document.body.appendChild(script);
        } catch { };
    }

    // fallback to china service
    setTimeout(async () => {
        try {
            document.querySelector("#videoTogetherLoading").remove()
        } catch { }

        if (window.videoTogetherExtension == undefined) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            const chinaCdnB = await getChinaCdnB();
            script.src = getCdnPath(chinaCdnB, `release/vt.${language}.user.js`);
            try {
                document.body.appendChild(script);
            } catch { };
        }
    }, 5000);
})()