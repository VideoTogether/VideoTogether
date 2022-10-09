browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);

    if (request.greeting === "hello")
        sendResponse({ farewell: "goodbye" });
});


let tabs = []

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg.type) {
        case 1:
            try {
                let tabId = `tab-${sender.tab.id}`;
                chrome.storage.session.get(tabId, tab => {
                    sendResponse(tab[tabId] == null ? {} : tab[tabId]);
                })
                return true;
            } catch (e) {
                console.log("fallback");
                if (tabs[sender.tab.id] == undefined) tabs[sender.tab.id] = {};
                sendResponse(tabs[sender.tab.id]);
            }
            break;
        case 2:
            try {
                let tabId = `tab-${sender.tab.id}`;
                let item = {};
                item[tabId] = msg.tab;
                chrome.storage.session.set(item, () => {
                    sendResponse(msg.tab);
                })
                return true;
            } catch (e) {
                tabs[sender.tab.id] = msg.tab;
                sendResponse(tabs[sender.tab.id]);
            }
            break;
        case 3:
            let props = msg.props;
            fetch(props.url, {
                method: props.method,
                body: props.method == "GET" ? undefined : JSON.stringify(props.data)
            })
                .then(r => r.text())
                .then(text => sendResponse({ responseText: text }))
                .catch(e => sendResponse({ error: e }));
            return true;
    }
});
