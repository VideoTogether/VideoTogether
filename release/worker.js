// 把 Worker 名字改成实际版本
const WORKER_HOSTNAME = '2gethervideo.xyz'

let real_url;


function getRealUrl() {
    return real_url;
}

function getReal(parsedUrl) {
    console.log('parsedUrl', parsedUrl);
    let u = new URL(parsedUrl);
    u.host = u.host.replaceAll('_', '.').replace('.' + WORKER_HOSTNAME, '');
    return u.toString();
}

function getProxyURL(origin) {
    // TODO no http or https
    if (origin.startsWith("/")) {
        return origin;
    }
    console.log("origin", origin);
    let url = new URL(origin);
    if (url.hostname.endsWith(WORKER_HOSTNAME)) {
        // TODO port
        return origin;
    }
    url.host = url.host.replaceAll(/\./g, '_') + `.${WORKER_HOSTNAME}`;
    return url.toString();
}
function Redirect(url) {
    let u = new URL(url);
    if (u.pathname.endsWith(".ts")
        || u.pathname.endsWith(".png")
        || u.pathname.endsWith(".jpg")
        || u.pathname.endsWith(".jpeg")
        || u.pathname.endsWith(".bmp")
        || u.pathname.endsWith(".gif")
        || u.pathname.endsWith(".js")
        || u.pathname.endsWith(".css")) {
        return true;
    }
    return false;
}
async function handleRequest(req) {
    console.log('--------------------------');
    let parsedUrl = req.url

    if (parsedUrl.startsWith(`https://${WORKER_HOSTNAME}`)) {
        return new Response(`
<html>

<head>
    <title>${WORKER_HOSTNAME}</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <script src="https://2gether.video/release/extension.website.user.js"></script>
</head>

<body>
    <script>
        const WORKER_HOSTNAME = "${WORKER_HOSTNAME}"

        function getProxyURL(origin, force = false) {
            if (origin.startsWith("/")) {
                return origin;
            }
            let url = new URL(origin);
            if (url.hostname.endsWith(WORKER_HOSTNAME)) {
                // TODO port
                return origin;
            }
            if (url.pathname.endsWith(".ts")) {
                return origin;
            }
            url.host = url.host.replaceAll(\/\\./g, '_') + '.' + WORKER_HOSTNAME;
            console.log("origin", origin, '->', url.toString());
            return url.toString();
        }
        function go() {
            let url = document.getElementById('urlInput').value;
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            url = url.replace("http://", "https://");
            window.location = getProxyURL(url);
        }
    </script>
    <p>无需安装插件,输入网址,点击前往,即可一起看视频</p>
    <p>在线版仅支持小部分网站,安装插件后可以在电脑手机平板上一起观看任意网站,访问插件主页获取安装说明<a href="http://2gether.video/">http://2gether.video/</a></p>
    <input id="urlInput" placeholder="输入视频网站地址" />
    <button onclick="go()">前往</button>
    <p>虽然本站不会存储你的任何信息,但是为了您的数据安全考虑,请不要在跳转后的页面输入密码或登录</p>
    <p>注意:所有内容由用户访问的网站提供,本站不存储提供任何数据以及内容</p>
    <p>如果您不希望用户通过本站访问你的网站,或用户访问的一些网站侵犯了您的权益,请立即联系我们禁止相关网页的访问</p>

</body>

</html>
        `, {
            headers: {
                "content-type": "text/html; charset=utf-8"
            }
        })
    }
    real_url = getReal(parsedUrl);
    if (Redirect(real_url)) {
        return new Response(null, { status: 301, headers: {
             "Location": real_url, 
             'Access-Control-Allow-Origin': '*',
             'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
             'Access-Control-Max-Age': '86400'
             } });
    }
    console.log("real", real_url)
    console.log(req.method)
    if (req.method == "POST") {
        console.log("...")
        const modifiedRequest = new Request(getRealUrl(), {
            body: req.body,
            headers: req.headers,
            method: req.method,
            redirect: req.redirect
        })
        const resp = await fetch(modifiedRequest);
        console.log(resp, resp.status, resp.url, resp.redirected)
        return resp;
    }

    let newReq = new Request(req);

    referer = req.headers.get("Referer");

    try {
        newReq.headers.set("Referer", getReal(referer))
        console.log("real_referer", real_url,getReal(referer) );
    } catch { }
    
    newReq.headers.delete('x-real-ip');
    newReq.headers.delete('cf-connecting-ip');
    newReq.headers.delete('cf-ipcountry');
    newReq.headers.delete('cf-ray');
    newReq.headers.delete('cf-visitor');
    const res = await fetch(getRealUrl(), {
        // TODO
        "redirect": "manual",
        body: req.body,
        headers: newReq.headers,
        method: req.method,
    })
    console.log(newReq);
    console.log(res);
    console.log(res.headers.get("Location"))
    // 去除 nosniff
    let clean_res
    // workaround miniflare bug
    if (res.status == 301 || res.status == 302) {
        clean_res = new Response(null, res)
        console.log("body: ", res.body)
    } else {
        clean_res = new Response(res.body, res)
    }

    clean_res.headers.set('Access-Control-Allow-Origin', '*');
    clean_res.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
    clean_res.headers.set('Access-Control-Max-Age', '86400');

    if (res.status == 301 || res.status == 302) {
        console.log("123");
        clean_res.headers.set("Location", getProxyURL(res.headers.get("Location")))
        console.log("345")
        console.log(clean_res)
        return clean_res;
    }

    clean_res.headers.delete("x-content-type-options")

    const Accept = req.headers.get("Accept") || ""
    const contentType = clean_res.headers.get("content-type") || ""

    if (contentType.indexOf("html") != -1) {
        return rewriter.transform(clean_res);
    } else {
        return clean_res;
    }
}

class AttributeRewriter {
    constructor(attributeName) {
        this.attributeName = attributeName
    }
    element(element) {
        const attribute = element.getAttribute(this.attributeName)
        if (attribute == null) {

        } else if (attribute.startsWith('https://')) {
            element.setAttribute(
                this.attributeName,
                getProxyURL(attribute)
            )
        }
    }
}
class Injecter {

    element(element) {
        console.log(element)
        element.prepend('<script src="https://2gether.video/release/extension.website.user.js"></script>', { html: true })
    }
}

class Dependency {
    element(element) {
        element.prepend(`
<script>
    const WORKER_HOSTNAME = "${WORKER_HOSTNAME}"

    function getProxyURL(origin, force = false) {
        let url = new URL(origin, window.location.href);
        if (origin.startsWith("/")) {
            return origin;
        }
        if (url.hostname.endsWith(WORKER_HOSTNAME)) {
            // TODO port
            return origin;
        }
        if(url.hostname.endsWith("2gether.video")){
            return origin;
        }
        if(url.pathname.endsWith(".ts")){
            return origin;
        }
        url.host = url.host.replaceAll(\/\\./g, '_') + '.' + WORKER_HOSTNAME;
        console.log("origin", origin ,'->',url.toString());
        return url.toString();
    }
    window._fetch = window.fetch

    window.fetch = async function (url, options) {
        return await window._fetch(getProxyURL(url), options)
    }

    XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (a, url, c, d, e) {
        return this._open(a, getProxyURL(url), c, d, e);
    }

    setInterval(() => {
        let iframs = document.getElementsByTagName("iframe");
        for (let i = 0; i < iframs.length; i++) {
            try {
                if (iframs[i].src != getProxyURL(iframs[i].src, true)) {
                    iframs[i].src = getProxyURL(iframs[i].src, true)
                }
            } catch { }

        }
    }, 2000);

</script>
    `, { html: true })
    }
}

class RemoveReferrer {
    element(element) {
        if (element.getAttribute('name') == 'referrer') {
            // element.setAttribute('content', 'unsafe-url');
            console.log(element, 'referrer');
        }
    }
}

class DisableLocationChange {
    text(text) {
        let a = text.text;
        let b = text.text.replace(/window.location.href *=/g, 'window.location.href==');
        if(a!=b){
            console.log(b);
            text.replace(b);
        }
    }
}

const rewriter = new HTMLRewriter()
    .on("head", new Dependency())
    .on("meta", new RemoveReferrer())
    .on("head", new Injecter())
    .on("body", new Injecter())
    .on("script", new DisableLocationChange())
    .on("a", new AttributeRewriter("href"))
    // .on("img", new AttributeRewriter("src"))
    .on("link", new AttributeRewriter("href"))
    // .on("script", new AttributeRewriter("src"))
    .on("iframe", new AttributeRewriter("src"))

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request))
})