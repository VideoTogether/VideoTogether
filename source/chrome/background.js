let tabs = []

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg.type) {
        case 1:
            if (tabs[sender.tab.id] == undefined) tabs[sender.tab.id] = {};
            sendResponse(tabs[sender.tab.id]);
            break;
        case 2:
            tabs[sender.tab.id] = msg.tab;
            sendResponse(tabs[sender.tab.id]);
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