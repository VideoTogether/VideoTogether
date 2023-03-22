let type = 'Firefox'

function getBrowser() {
    switch (type) {
        case 'Safari':
            return browser;
        case 'Chrome':
        case 'Firefox':
            return chrome;
    }
}

let tabs = []

getBrowser().runtime.onMessage.addListener(function (msgText, sender, sendResponse) {
    let msg = JSON.parse(msgText);
    switch (msg.type) {
        case 1:
            try {
                let tabId = `tab-${sender.tab.id}`;
                getBrowser().storage.session.get(tabId, tab => {
                    sendResponse(tab[tabId] == null ? {} : tab[tabId]);
                })
                return true;
            } catch (e) {
                if (tabs[sender.tab.id] == undefined) tabs[sender.tab.id] = {};
                sendResponse(tabs[sender.tab.id]);
            }
            break;
        case 2:
            try {
                let tabId = `tab-${sender.tab.id}`;
                let item = {};
                item[tabId] = msg.tab;
                getBrowser().storage.session.set(item, () => {
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
        case 4:
            if (msg.enabled) {
                getBrowser().action.setIcon({
                    path: "/icon/vt_64x64.png",
                    tabId: sender.tab.id
                });
            } else {
                getBrowser().action.setIcon({
                    path: "/icon/vt_gray_64x64.png",
                    tabId: sender.tab.id
                });
            }
            sendResponse();
    }
});