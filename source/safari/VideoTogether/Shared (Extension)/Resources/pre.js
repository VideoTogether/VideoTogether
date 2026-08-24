async function injectScript() {
    if (document instanceof XMLDocument) {
        return;
    }
    if (!await globalThis.VideoTogetherUrlPolicy.isCurrentTabEnabled()) {
        return;
    }
    sessionStorage.removeItem("VideoTogetherSuperEasyShare");
    const result = await globalThis.VideoTogetherUrlPolicy.storageGet(["SuperEasyShare"]);
    if (result["SuperEasyShare"] == true) {
        sessionStorage.setItem("VideoTogetherSuperEasyShare", 'true');
    }
    const injectedScript = document.createElement('script');
    injectedScript.src = chrome.runtime.getURL('preInjected.js');
    (document.head || document.documentElement).appendChild(injectedScript);
}
injectScript();
