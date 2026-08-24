(async function () {
    if (document instanceof XMLDocument) {
        return;
    }

    const enabled = await globalThis.VideoTogetherUrlPolicy.isCurrentTabEnabled();
    chrome.runtime.sendMessage(JSON.stringify({ type: 4, enabled: enabled }));
    if (!enabled) {
        return;
    }

    chrome.runtime.sendMessage(JSON.stringify({ type: 7 }));
})();
