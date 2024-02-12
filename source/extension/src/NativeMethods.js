
export const Global = {
    inited: false,
    NativePostMessageFunction: null,
    NativeAttachShadow: null,
    NativeFetch: null
}

export function GetNativeFunction() {
    try{
        if (Global.inited) {
            return;
        }
        let temp = document.createElement("iframe");
        hide(temp);
        document.body.append(temp);
        Global.NativePostMessageFunction = temp.contentWindow.postMessage;
        Global.NativeAttachShadow = temp.contentWindow.Element.prototype.attachShadow;
        Global.NativeFetch = temp.contentWindow.fetch;
        Global.inited = true;
    }catch(e){
        console.error(e);
    }
}