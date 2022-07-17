
function b64EncodeUnicode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

chrome.webRequest.onBeforeRequest.addListener(
    // need to upload the missing script url
    function (details) {
        console.log(details);
        return {
            redirectUrl: "https://videotogether.github.io/VideoBridge/bridge/" + b64EncodeUnicode(details.url)
        }
    },
    { urls: ["https://nd-static.bdstatic.com/m-static/base/thirdParty/video-player/_nomd5_nomod/video-player_*.js"] },
    ["blocking"]
)