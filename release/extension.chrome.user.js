// ==UserScript==
// @name         Video Together 一起看视频
// @namespace    http://vt.panghair.com
// @version      0.1
// @description  Watch video together 一起看视频
// @author       maggch@outlook.com
// @match        *://*/*
// @icon         https://2gether.video/icon/favicon-32x32.png
// @grant        GM.xmlHttpRequest
// @grant        GM_addElement
// @connect      api.2gether.video
// @connect      api.chizhou.in
// @connect      api.panghair.com
// @connect      vt.panghair.com
// ==/UserScript==

(function () {
    window.addEventListener("message",e=>{
        if(e.data.source == "VideoTogether"){
            switch(e.data.type){
                case 13:
                    GM.xmlHttpRequest({
                        method:e.data.data.method,
                        url: e.data.data.url,
                        data: e.data.data.data,
                        onload: function(response){
                            window.postMessage({
                                source:"VideoTogether",
                                type:14,
                                data:{
                                    id:e.data.data.id,
                                    data:JSON.parse(response.responseText)
                                }
                            })
                        },
                        onerror: function(error) {
                            window.postMessage({
                                source:"VideoTogether",
                                type:14,
                                data:{
                                    id:e.data.data.id,
                                    error:error,
                                }
                            })
                        }
                    })
                    break;
            }
        }
    });
    if (window.VideoTogetherLoading) {
        return;
    }
    window.VideoTogetherLoading = true;
    let wrapper = document.createElement("div");
    wrapper.innerHTML = `<div id="videoTogetherLoading">
    <div id="videoTogetherLoadingwrap">
        <img style="display: inline;" src="https://www.2gether.video/icon/favicon-16x16.png">
        <a target="_blank" href="http://2gether.video/guide/qa.html">Video Together 加载中...</a>
    </div>
</div>

<style>
    #videoTogetherLoading {
        touch-action: none;
        height: 50px;
        border: 1px solid #c9c8c8;
        background: #ffffff;
        color: #212529;
        display: flex;
        align-items: center;
        z-index: 2147483646;
        position: fixed;
        bottom: 15px;
        right: 15px;
        width: 250px;
        text-align: center;
        box-shadow: 0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d;
        border-radius: 5px;
    }
    #videoTogetherLoadingwrap {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    #videoTogetherLoadingwrap img {
        margin-right: 12px;
    }
    #videoTogetherLoadingwrap a {
        color: #212529;
        text-decoration: none;
    }
    #videoTogetherLoadingwrap a:hover {
        color: #1890ff;
        text-decoration: underline;
    }
</style>
`
    document.getElementsByTagName('body')[0].appendChild(wrapper);
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = chrome.runtime.getURL('vt.user.js');
    document.getElementsByTagName('body')[0].appendChild(script);
    try{
        GM_addElement('script', {
            src: script.src,
            type: 'text/javascript'
          })
    }catch(e){};

    // fallback to china service
    setTimeout(() => {
        if(window.videoTogetherFlyPannel == undefined){
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://videotogether.oss-cn-hangzhou.aliyuncs.com/release/vt.user.js';
            document.getElementsByTagName('body')[0].appendChild(script);
            try{
                GM_addElement('script', {
                    src: script.src,
                    type: 'text/javascript'
                  })
            }catch(e){};
        }
    }, 5000);
    function filter(e) {
        let target = e.target;

        if (target.id != "videoTogetherLoading") {
            return;
        }

        target.moving = true;

        if (e.clientX) {
            target.oldX = e.clientX;
            target.oldY = e.clientY;
        } else {
            target.oldX = e.touches[0].clientX;
            target.oldY = e.touches[0].clientY;
        }

        target.oldLeft = window.getComputedStyle(target).getPropertyValue('left').split('px')[0] * 1;
        target.oldTop = window.getComputedStyle(target).getPropertyValue('top').split('px')[0] * 1;

        document.onmousemove = dr;
        document.ontouchmove = dr;

        function dr(event) {
            if (!target.moving) {
                return;
            }
            if (event.clientX) {
                target.distX = event.clientX - target.oldX;
                target.distY = event.clientY - target.oldY;
            } else {
                target.distX = event.touches[0].clientX - target.oldX;
                target.distY = event.touches[0].clientY - target.oldY;
            }

            target.style.left = Math.min(document.documentElement.clientWidth - target.clientWidth, Math.max(0, target.oldLeft + target.distX)) + "px";
            target.style.top = Math.min(document.documentElement.clientHeight - target.clientHeight, Math.max(0, target.oldTop + target.distY)) + "px";
        }

        function endDrag() {
            target.moving = false;
        }
        target.onmouseup = endDrag;
        target.ontouchend = endDrag;
    }
    document.onmousedown = filter;
    document.ontouchstart = filter;
})();