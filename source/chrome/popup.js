document.querySelector("#extensionSwitch").oninput = (e) => {
    chrome.storage.local.set({ vtEnabled: e.target.checked });
}

chrome.storage.local.get(['vtEnabled'], function (result) {
    if (result['vtEnabled'] === false) {
        document.querySelector("#extensionSwitch").checked = false;
    } else {
        document.querySelector("#extensionSwitch").checked = true;
    }
});