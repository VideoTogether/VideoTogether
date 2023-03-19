
(() => {
    if (window.VideoTogetherPreinjected) {
        return;
    }
    window.VideoTogetherPreinjected = true;

    let origin = Element.prototype.attachShadow;
    if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(origin))) {
        Element.prototype._vt_preattachShadow = origin;
        Element.prototype.attachShadow = function () {
            console.log('attachShadow');
            return this._vt_preattachShadow({ mode: "open" });
        };
    }

    // const isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
    // iOS, iPad OS won't use this code, we don't need to check device
    // disable all hls support
    // until https://bugs.chromium.org/p/chromium/issues/detail?id=1266991&q=android%20hls&can=2
    let originCanPlayType = HTMLVideoElement.prototype.canPlayType;

    if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(originCanPlayType))) {
        HTMLVideoElement.prototype._vt_preCanPlayType = originCanPlayType;
        HTMLVideoElement.prototype.canPlayType = function (type) {
            console.log('canPlayType_vt_pre', type);
            if (type == 'application/x-mpegURL' || type == 'application/vnd.apple.mpegURL' || type == 'application/vnd.apple.mpegurl') {
                // Android Chrome hls player is shit!
                return "";
            }
            return HTMLVideoElement.prototype._vt_preCanPlayType(type);
        };
    }

})();