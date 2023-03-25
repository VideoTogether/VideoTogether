let type = '{{{ {"chrome":"./config/type_chrome_extension","firefox":"./config/type_firefox_extension","safari":"./config/type_safari_extension", "order":0} }}}'

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

async function getTabData(id) {
    let tabId = `tab-${id}`;
    return new Promise((resolve) => {
        try {
            getBrowser().storage.session.get(tabId, tab => {
                resolve(tab[tabId] == null ? {} : tab[tabId]);
            })
            return true;
        } catch (e) {
            if (tabs[tabId] == undefined) tabs[tabId] = {};
            resolve(tabs[tabId]);
        }
    })
}

async function setTabData(id, data) {
    let tabId = `tab-${id}`;
    return new Promise((resolve) => {
        try {
            let item = {};
            item[tabId] = data;
            getBrowser().storage.session.set(item, () => {
                resolve(data);
            })
            return true;
        } catch (e) {
            tabs[tabId] = data;
            resolve(tabs[tabId]);
        }
    })
}

getBrowser().runtime.onMessage.addListener(function (msgText, sender, sendResponse) {
    let msg = JSON.parse(msgText);
    switch (msg.type) {
        case 1:
            getTabData(sender.tab.id).then(d => sendResponse(d));
            return true;
            break;
        case 2:
            setTabData(sender.tab.id, msg.tab).then(d => sendResponse(d));
            return true;
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

function getTopLevelDomainFromUrl(url) {
    const urlObject = new URL(url);
    const domain = urlObject.hostname;
    const domainParts = domain.split('.');
    const topLevelDomain = domainParts.slice(-2).join('.');
    return topLevelDomain;
}

getBrowser().webNavigation.onDOMContentLoaded.addListener((details) => {
    if (details.frameId === 0) {
        getBrowser().tabs.get(details.tabId, async (tab) => {
            if (tab.openerTabId) {
                const tabData = await getTabData(tab.openerTabId);
                if (tabData.VideoTogetherTabStorage.VideoTogetherRole != 2) {
                    return;
                }
                getBrowser().tabs.get(tab.openerTabId, (openerTab) => {
                    const newTabDomain = getTopLevelDomainFromUrl(tab.url);
                    const openerTabDomain = getTopLevelDomainFromUrl(openerTab.url);

                    if (newTabDomain === openerTabDomain) {
                        getBrowser().tabs.remove(tab.id, () => {
                            getBrowser().tabs.update(openerTab.id, { url: tab.url });
                        });
                    }
                });
            }
        });
    }
});