
export function PostMessage(window, data) {
    if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(window.postMessage))) {
        window.postMessage(data, "*");
    } else {
        GetNativeFunction();
        Global.NativePostMessageFunction.call(window, data, "*");
    }
}