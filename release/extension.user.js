// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    http://vt.panghair.com
// @version      0.1
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://cdn.jsdelivr.net/gh/maggch97/VideoTogether/icon/favicon-32x32.png
// @downloadURL  https://raw.githubusercontent.com/maggch97/VideoTogether/main/source/js/extension.js
// @updateURL    https://raw.githubusercontent.com/maggch97/VideoTogether/main/source/js/extension.js
// @grant        none
// ==/UserScript==

(function () {
    let wrapper = document.createElement("div");
    wrapper.innerHTML = `<div id="videoTogetherLoading">
    <div style="width: 100%">
        <img style="display: inline;" src="https://cdn.jsdelivr.net/gh/maggch97/VideoTogether/icon/favicon-16x16.png">
        <a target="_blank" href="https://github.com/maggch97/VideoTogether/blob/main/README.MD" style="display: inline;color: black;">Video Together 加载中...</p>
    </div>
</div>

<style>
    #videoTogetherLoading {
        line-height: 16px;
        height: 80px;
        font-size: 16px;
        border: solid;
        border-width: 2px;
        border-bottom-color: #424242;
        border-right-color: #424242;
        border-left-color: #fff;
        border-top-color: #fff;
        background: silver;
        color: #212529;
        display: flex;
        align-items: center;
        z-index: 2147483646;
        position: fixed;
        bottom: 15px;
        right: 15px;
        width: 250px;
        text-align: center;
    }
</style>`
    document.getElementsByTagName('body')[0].appendChild(wrapper);
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdn.jsdelivr.net/gh/maggch97/VideoTogether@latest/release/vt.user.js';
    document.getElementsByTagName('body')[0].appendChild(script);
})();