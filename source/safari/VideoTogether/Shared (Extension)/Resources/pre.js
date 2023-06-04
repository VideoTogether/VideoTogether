const injectedScript = document.createElement('script');
injectedScript.src = chrome.runtime.getURL('preInjected.js');
(document.head || document.documentElement).appendChild(injectedScript);
sessionStorage.removeItem("VideoTogetherSuperEasyShare");
browser.storage.local.get(["SuperEasyShare"], function (result) {
    if (result["SuperEasyShare"] == true) {
        sessionStorage.setItem("VideoTogetherSuperEasyShare", 'true');
    }
});
