//*/

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

let vtRefreshVersion = version + language;
try {
    let publicVtVersion = await getGM().getValue("PublicVtVersion")
    if (publicVtVersion != null) {
        vtRefreshVersion = vtRefreshVersion + String(publicVtVersion);
    }
} catch (e) { };
console.log(vtRefreshVersion)

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
                        script.src = getCdnPath(encodeFastlyJsdelivrCdn, "release/extension.website.user.js");
                        iframe.contentWindow.document.body.appendChild(script);
                        iframe.contentWindow.VideoTogetherParentInject = true;
                    }
                } catch (error) {
                }
            }
        })();
    }
}, 2000);


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
        fetch(getCdnPath(encodeFastlyJsdelivrCdn, `release/vt.${language}.${vtType}.js?vtRefreshVersion=${vtRefreshVersion}`))
            .then(r => r.text())
            .then(data => getGM().setValue('PrivateCachedVt', {
                'version': vtRefreshVersion,
                'data': data
            }))
            .catch(() => {
                getChinaCdnB().then(chinaCdnB => fetch(getCdnPath(chinaCdnB, `release/vt.${language}.${vtType}.js?vtRefreshVersion=${vtRefreshVersion}`)))
                    .then(r => r.text())
                    .then(data => getGM().setValue('PrivateCachedVt', {
                        'version': vtRefreshVersion,
                        'data': data
                    }))
            })
    }
} catch (e) { };

switch (type) {
    case "userscript":
        script.src = getCdnPath(encodeFastlyJsdelivrCdn, `release/vt.${language}.user.js?timestamp=${version}`);
        break;
    case "userscript_debug":
        script.src = `http://127.0.0.1:7000/release/vt.debug.${language}.user.js?timestamp=` + parseInt(Date.now());
        break;
    case "website":
        script.src = getCdnPath(encodeFastlyJsdelivrCdn, `release/vt.${language}.website.js?timestamp=${version}`);
        break;
    case "website_debug":
        script.src = `http://127.0.0.1:7000/release/vt.debug.${language}.website.js?timestamp=` + parseInt(Date.now());
        break;
}

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

// fallback to china service
setTimeout(async () => {
    try {
        document.querySelector("#videoTogetherLoading").remove()
    } catch { }
    if (type == "Chrome" || type == "Firefox" || type == "Safari") {
        return;
    }
    if (!ExtensionInitSuccess) {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        const chinaCdnB = await getChinaCdnB();
        script.src = getCdnPath(chinaCdnB, `release/vt.${language}.user.js`);
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

//