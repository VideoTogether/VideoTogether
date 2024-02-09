const Global = {
    inited: false,
    NativePostMessageFunction: null,
    NativeAttachShadow: null,
    NativeFetch: null
}

function GetNativeFunction() {
    if (Global.inited) {
        return;
    }
    Global.inited = true;
    let temp = document.createElement("iframe");
    hide(temp);
    document.body.append(temp);
    Global.NativePostMessageFunction = temp.contentWindow.postMessage;
    Global.NativeAttachShadow = temp.contentWindow.Element.prototype.attachShadow;
    Global.NativeFetch = temp.contentWindow.fetch;
}

/*delete-this-begin*/
module.exports = { Global, GetNativeFunction};
/*delete-this-end*/