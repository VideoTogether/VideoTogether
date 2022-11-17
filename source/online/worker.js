// 把 Worker 名字改成实际版本
const WORKER_HOSTNAME = '{{{ {"":"./WORKER_HOSTNAME", "order":1} }}}'

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
{{{ {"":"./index.html", "order":1} }}}
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
{{{ {"":"./dependency.html", "order":1} }}}
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