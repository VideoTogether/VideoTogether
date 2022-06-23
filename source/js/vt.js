// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match       *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

let video_together_host = "http://127.0.0.1:5000/"

window.VideoTogetherUpdateRoom = (name, password, playbackRate, current, paused) => {
    var url = new URL(video_together_host + "/room/update");
    url.searchParams.set("name", name);
    url.searchParams.set("password", password);
    url.searchParams.set("playbackRate", playbackRate);
    url.searchParams.set("current", current);
    url.searchParams.set("paused", paused);
    VideoTogetherRequest(url, "window.VideoTogetherUpdateRoomCallback");
}

window.VideoTogetherGetRoom = (name) => {
    var url = new URL(video_together_host + "/room/get");
    url.searchParams.set("name", name);
    VideoTogetherRequest(url, "window.VideoTogetherGetRoomCallback");
}

window.VideoTogetherResponseCheck = (data) => {
    if(data["errorMessage"] !== null && data["errorMessage"] !== undefined){
        window.VideoTogetherUpdateStatusText(data["errorMessage"], "red");
    }
}

window.VideoTogetherUpdateStatusText = (message, color) => {
    document.getElementById("videoTogetherStatusText").innerHTML = message;
    document.getElementById("videoTogetherStatusText").style = "color:" + color;
}

window.VideoTogetherGetRoomCallback = (room) => {
    window.VideoTogetherResponseCheck(room);
    console.log(room);
}

window.VideoTogetherUpdateRoomCallback = (room) => {
    window.VideoTogetherResponseCheck(room);
    console.log(room);
}

function VideoTogetherRequest(url, callback) {
    if (callback !== null || callback !== undefined) {
        url.searchParams.set("callback", callback);
    }
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.crossOrigin = 'anonymous';
    script.referrerpolicy = ''
    script.src = url;
    head.appendChild(script);
}


var videoTogetherFlyPannel,beasetag;
//创建新元素
videoTogetherFlyPannel = document.createElement("div");
videoTogetherFlyPannel.id = "videoTogetherFlyPannel"

createRoomButton = document.createElement('button');
createRoomButton.innerHTML = "建房"

joinRoomButton = document.createElement('button');
joinRoomButton.innerHTML = "加入"

inputRoomName = document.createElement('input');
inputRoomName.placeholder = "输入房间名"
inputRoomName.style = "margin-top:0px;margin-bottom:0px;margin-right:0px;margin-left:0px;padding:0px;"
inputRoomPassword = document.createElement("input");
inputRoomPassword.placeholder = "输入密码"
inputRoomPassword.style = "margin-top:0px;margin-bottom:0px;margin-right:0px;margin-left:0px;padding:0px;"
statusText  = document.createElement('p');
statusText.id = "videoTogetherStatusText"
createRoomButton.onclick = function(){
    roomName = inputRoomName.value;
    password = inputRoomPassword.value;
    window.VideoTogetherUpdateRoom(roomName, password, 1, 1, 0) 
};

videoTogetherFlyPannel.appendChild(statusText)
videoTogetherFlyPannel.appendChild(inputRoomName)
videoTogetherFlyPannel.appendChild(inputRoomPassword)
videoTogetherFlyPannel.appendChild(createRoomButton)
videoTogetherFlyPannel.appendChild(joinRoomButton)


//搜寻body元素
beasetag = document.querySelector("body");
//将新元素作为子节点插入到body元素的最后一个子节点之后
beasetag.appendChild(videoTogetherFlyPannel);
//可以通过videoTogetherFlyPannel.innerHTML = "<button type='button'>启动</button><br><button type='button'>关闭</button>"来写入其他元素，如多个按钮
// videoTogetherFlyPannel.innerHTML = "按钮";
//css样式为
//position:fixed;生成固定定位的元素，相对于浏览器窗口进行定位。元素的位置通过 "left", "top", "right" 以及 "bottom" 属性进行规定。
//bottom:15px;距窗口底部15px
//right:15px;距窗口右边15px
//width:60px;内容的宽度60px
//height:60px;内容的高度60px
//background:black;内边距的颜色和内容的颜色设置为黑色，不包括外边距和边框
//opacity:0.75;不透明度设置为0.75，1为完全不透明
//color:white;指定文本的颜色为白色
//text-align:center;指定元素文本的水平对齐方式为居中对齐
//line-height:60px;设置行高，通过设置为等于该元素的内容高度的值，配合text-align:center;可以使div的文字居中
//cursor:pointer;定义了鼠标指针放在一个元素边界范围内时所用的光标形状为一只手
videoTogetherFlyPannel.style = "z-index:9999;position:fixed;bottom:15px;right:15px;width:200px;height:200px;background:grey;color:white;text-align:center;line-height:60px;cursor:pointer;";
//通过匿名函数，设置点击该悬浮按钮后执行的函数


var dragBox = function (drag, wrap) {
    
    function getCss(ele, prop) {
         return parseInt(window.getComputedStyle(ele)[prop]);
    }

    var initX,
        initY,
        dragable = false,
        wrapLeft = getCss(wrap, "left"),
        wrapRight = getCss(wrap, "top");

    drag.addEventListener("mousedown", function (e) {
         dragable = true;
         initX = e.clientX;
         initY = e.clientY;
    }, false); 

   document.addEventListener("mousemove", function (e) {
         if (dragable === true ) {
             var nowX = e.clientX,
                 nowY = e.clientY,
                 disX = nowX - initX,
                 disY = nowY - initY;
             wrap.style.left = wrapLeft + disX + "px";
             wrap.style.top = wrapRight + disY + "px";
         }
    });

    drag.addEventListener("mouseup", function (e) {
         dragable = false;
         wrapLeft = getCss(wrap, "left");
         wrapRight = getCss(wrap, "top");
    }, false); 

 };

 dragBox(document.querySelector("#videoTogetherFlyPannel"), document.querySelector("#videoTogetherFlyPannel"));