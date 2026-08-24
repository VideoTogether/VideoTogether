(async function () {
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

    chrome.runtime.sendMessage(JSON.stringify({ type: 6 }));
})();
