let type = 'Safari'
const isSafari = (type == 'Safari')

function generateUUID() {
    if (crypto.randomUUID != undefined) {
        return crypto.randomUUID();
    }
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

async function cleanStorage(beginKey, endKey) {
    if (isSafari) {
        await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
            {
                source: "VideoTogether",
                type: 3009,
                id: generateUUID(),
                data: {
                    beginKey: beginKey,
                    endKey: endKey
                }
            })
    }
}

async function estimateStorageUsage() {
    if (isSafari) {
        const resp = await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
            {
                source: "VideoTogether",
                type: 3007,
                id: generateUUID(),
            })
        return resp['usage'];
    } else {
        return await chrome.storage.local.getBytesInUse()
    }
}

// don't call this
async function iosStorageSetRaw(key, value) {
    const resp = await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
        {
            source: "VideoTogether",
            type: 3001,
            id: generateUUID(),
            data: { key: key, value: value }
        })
    return resp
}

async function iosStorageGetRaw(key) {
    const resp = await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
        {
            source: "VideoTogether",
            type: 3003,
            id: generateUUID(),
            data: { key: key }
        })
    value = resp['value'] == '' ? undefined : resp['value']
    return value;
}

async function iosStorageDeleteRaw(key) {
    const resp = await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
        {
            source: "VideoTogether",
            type: 3005,
            id: generateUUID(),
            data: { key: key }
        })
    return resp;
}

async function iosStorageDeleteByPrefix(prefix) {
    const resp = await browser.runtime.sendNativeMessage("VideoTogether.VideoTogether",
        {
            source: "VideoTogether",
            type: 3010,
            id: generateUUID(),
            data: { prefix: prefix }
        })
    if(resp.type != 3011){
        throw 'delete by prefix failed'
    }
    return resp;
}

const chunkSize = 3 * 1024 * 1024;//3MB, iOS Safari extension has memory limitation
const chunkNumMagic = "VideoTogetherChunkNumber:"
function chunkNum(value) {
    if (value == undefined) {
        return 0;
    }
    if (value.startsWith(chunkNumMagic)) {
        return parseInt(value.replace(chunkNumMagic, ""))
    } else {
        return 1;
    }
}

async function storageSet(key, value) {
    if (isSafari) {
        const chunkNum = Math.ceil(value.length / chunkSize);
        if (chunkNum <= 1) {
            await iosStorageSetRaw(key, value);
        } else {
            await iosStorageSetRaw(key, chunkNumMagic + chunkNum);
            for (let i = 0; i < chunkNum; i++) {
                await iosStorageSetRaw(`${key}.${i}`, value.slice(i * chunkSize, Math.min((i + 1) * chunkSize, value.length)))
            }
        }
        return { [key]: value }
    } else {
        return await chrome.storage.local.set({ [key]: value })
    }
}

async function storageGet(key) {
    if (isSafari) {
        const value = await iosStorageGetRaw(key);
        const num = chunkNum(value)
        if (num <= 1) {
            return value
        } else {
            let full = ''
            for (let i = 0; i < num; i++) {
                const part = await iosStorageGetRaw(`${key}.${i}`)
                full = full + part;
            }
            return full;
        }
    } else {
        const result = await chrome.storage.local.get([key])
        return result[key]
    }
}

async function storageRemove(key) {
    if (isSafari) {
        // safari should call removePrefix
        return {}
        const value = await iosStorageGetRaw(key);
        const num = chunkNum(value)
        if (num <= 1) {
            await iosStorageDeleteRaw(key);
        } else {
            for (let i = 0; i < num; i++) {
                await iosStorageDeleteRaw(`${key}.${i}`)
            }
            await iosStorageDeleteRaw(key);
        }

        return {}
    } else {
        await chrome.storage.local.remove([key])
        return {}
    }
}

async function storageRemoveByPrefix(prefix) {
    if (isSafari) {
        await iosStorageDeleteByPrefix(prefix);
        return {}
    } else {
        return {}
    }
}

function openDB() {
    const openRequest = indexedDB.open("VideoTogether", 9);

    openRequest.onupgradeneeded = function (event) {
        const oldVersion = event.oldVersion;
        console.log("upgrade from", oldVersion);
        const db = event.target.result;
        const upgradeTransaction = event.target.transaction;

        if (oldVersion < 8) {
            const existingStores = Array.from(db.objectStoreNames);
            for (const storeName of existingStores) {
                db.deleteObjectStore(storeName);
            }
        }

        let videosStore;
        if (!db.objectStoreNames.contains('videos')) {
            videosStore = db.createObjectStore('videos');
        } else {
            videosStore = upgradeTransaction.objectStore('videos');
        }
        if (!videosStore.indexNames.contains("m3u8Id")) {
            videosStore.createIndex("m3u8Id", "m3u8Id", { unique: false });
        }

        let m3u8sStore;
        if (!db.objectStoreNames.contains('m3u8s')) {
            m3u8sStore = db.createObjectStore('m3u8s');
        } else {
            m3u8sStore = upgradeTransaction.objectStore('m3u8s');
        }
        if (!m3u8sStore.indexNames.contains("m3u8Id")) {
            m3u8sStore.createIndex("m3u8Id", "m3u8Id", { unique: false });
        }


        let futureStore;
        if (!db.objectStoreNames.contains('future')) {
            futureStore = db.createObjectStore('future');
        } else {
            futureStore = upgradeTransaction.objectStore('future');
        }
        if (!futureStore.indexNames.contains("m3u8Id")) {
            futureStore.createIndex("m3u8Id", "m3u8Id", { unique: false });
        }

    };
    return openRequest;
}

function saveToIndexedDB(table, key, record) {

    let localData = undefined
    if (table.endsWith('-mini')) {
        localData = undefined
        record.data = undefined
        table = table.replace('-mini', '')
    } else if (record.data != undefined) {
        localData = record.data
        record.data = undefined
        record.hasData = true
    }
    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (e) {
            rej("indexedDB error")
        }

        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table, "readwrite");
            const store = transaction.objectStore(table);
            const addRequest = store.put(record, key);
            addRequest.onsuccess = async function () {
                if (localData != undefined) {
                    try {
                        await storageSet(table + key, localData)
                        res()
                    } catch (e) {
                        // the inserted record will not be deleted,
                        // caller should deal with the failure
                        rej("storage.local error")
                    }
                } else {
                    res();
                }
            };
            addRequest.onerror = function (event) {
                rej(event.target.error);
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
            // optimize by index
            let request = undefined
            if (regex.startsWith('^-m3u8Id-') && regex.endsWith('-end-')) {
                console.log('optimize query for ', regex);
                var index = objectStore.index("m3u8Id");
                const m3u8Id = regex.slice(9, -5);
                request = index.openCursor(IDBKeyRange.only(m3u8Id));
            } else {
                request = objectStore.openCursor();
            }

            request.onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.primaryKey;
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
    let readLocalData = true
    if (table.endsWith('-mini')) {
        table = table.replace('-mini', '')
        readLocalData = false
    }

    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (event) {
            rej(event.target.error)
        }
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table);
            const store = transaction.objectStore(table);

            const getRequest = store.get(key);
            getRequest.onsuccess = async function (event) {
                const record = event.target.result;
                const localKeys = table + key;
                if (readLocalData) {
                    try {
                        const value = await storageGet(localKeys)
                        record.data = value
                        res(record);
                    } catch (e) {
                        rej("storage.local error")
                    }
                } else {
                    res(record);
                }
            };
            getRequest.onerror = function (event) {
                rej(event.target.error)
            }
        };
    })
}

function deleteFromIndexedDB(table, key) {
    return new Promise((res, rej) => {
        const openRequest = openDB()
        openRequest.onerror = function (event) {
            rej(event.target.error)
        }
        openRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(table, "readwrite");
            const store = transaction.objectStore(table);

            const request = store.delete(key);
            request.onsuccess = async function (event) {
                // the hasData field may not correct,
                // so delete the data every time
                try {
                    await storageRemove(table + key)
                    res();
                } catch {
                    rej('storage.local remove error');
                }
            };
            request.onerror = function (event) {
                rej(event.target.error)
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
                sendResponse({ error: 0, data: data })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2007:
            deleteFromIndexedDB(msg.data.table, msg.data.key).then(() => {
                sendResponse({ error: 0 })
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 2009:
            estimateStorageUsage().then(data => {
                sendResponse(JSON.stringify(data))
            }).catch(r => sendResponse({ error: r }))
            return true;
        case 3009:
            cleanStorage(msg.data.beginKey, msg.data.endKey).then(data => {
                sendResponse(JSON.stringify(data))
            }).catch(r => sendResponse({ error: r }));
            return true;
        case 3010:
            storageRemoveByPrefix(msg.data.prefix).then(data => {
                sendResponse({ error: 0 })
            }).catch(r => sendResponse({ error: r }));
            return true;
    }
});