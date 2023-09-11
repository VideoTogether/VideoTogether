let type = 'Chrome'

function openDB() {
    const openRequest = indexedDB.open("VideoTogether", 3);

    openRequest.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos');
        }
        if (!db.objectStoreNames.contains('m3u8s')) {
            db.createObjectStore('m3u8s');
        }
        if (!db.objectStoreNames.contains('videos-mini')) {
            db.createObjectStore('videos-mini');
        }
        if (!db.objectStoreNames.contains('m3u8s-mini')) {
            db.createObjectStore('m3u8s-mini');
        }
    };
    return openRequest;
}

function saveToIndexedDB(table, key, data) {
    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (e) {
            rej()
        }
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table, "readwrite");
            const store = transaction.objectStore(table);
            const addRequest = store.put(data, key);
            addRequest.onsuccess = function () {
                res()
            };
            addRequest.onerror = function () {
                rej()
            }
        };
    })
}

function regexMatchKeysDb(table, regex) {
    return new Promise((res, rej) => {
        let matchedKeys = []
        let re = new RegExp(regex);
        const openRequest = openDB()
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table);
            const objectStore = transaction.objectStore(table);
            const request = objectStore.openCursor();

            request.onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    if (re.test(key)) {
                        matchedKeys.push(key);
                    }
                    cursor.continue();
                } else {
                    res(matchedKeys)
                }
            };

            request.onerror = function (event) {
                rej(event.target.error);
            };
        };

        openRequest.onerror = function (event) {
            rej(event.target.error);
        };
    })
}

function readFromIndexedDB(table, key) {
    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (event) {
            rej()
        }
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table);
            const store = transaction.objectStore(table);

            const getRequest = store.get(key);
            getRequest.onsuccess = function (event) {
                const data = event.target.result;
                res(data);
            };
            getRequest.onerror = function (event) {
                rej()
            }
        };
    })
}

function deleteFromIndexedDB(table, key) {
    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (event) {
            rej()
        }
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table, "readwrite");
            const store = transaction.objectStore(table);

            const request = store.delete(key);
            request.onsuccess = function (event) {
                res();
            };
            request.onerror = function (event) {
                rej()
            }
        };
    })
}

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
            break;
        case 2001:
            saveToIndexedDB(msg.data.table, msg.data.key, msg.data.data).then(() => {
                sendResponse({ error: 0 })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2002:
            readFromIndexedDB(msg.data.table, msg.data.key).then(data => {
                sendResponse({ error: 0, data: data })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2005:
            regexMatchKeysDb(msg.data.table, msg.data.regex).then(data => {
                sendResponse({ error: 0, data: JSON.stringify(data) })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2007:
            deleteFromIndexedDB(msg.data.table, msg.data.key).then(() => {
                sendResponse({ error: 0 })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2009:
            navigator.storage.estimate().then(data => {
                sendResponse(JSON.stringify(data))
            }).catch(r => sendResponse({ error: r }))
            return true;
    }
});