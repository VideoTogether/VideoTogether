(async function () {
    let extensionGM = {};
    let websiteGM = {};

    let type = 'Chrome'

    function getBrowser() {
        switch (type) {
            case 'Safari':
                return browser;
            case 'Chrome':
            case 'Firefox':
                return chrome;
        }
    }

    function getGM() {
        if (type == "website" || type == "website_debug") {
            return websiteGM;
        }
        if (type == "Chrome" || type == "Safari" || type == "Firefox") {
            return extensionGM;
        }
        return GM;
    }
    if (type == "Chrome" || type == "Safari" || type == "Firefox") {
        getGM().setValue = async (key, value) => {
            return await new Promise((resolve, reject) => {
                try {
                    let item = {};
                    item[key] = value;
                    getBrowser().storage.local.set(item, function () {
                        resolve();
                    });
                } catch (e) {
                    reject(e);
                }
            })
        }
        getGM().getValue = async (key) => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().storage.local.get([key], function (result) {
                        resolve(result[key]);
                    });
                } catch (e) {
                    reject(e);
                }

            })
        }
        getGM().getTab = async () => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().runtime.sendMessage(JSON.stringify({ type: 1 }), function (response) {
                        resolve(response);
                    })
                } catch (e) {
                    reject(e);
                }

            })
        }
        getGM().saveTab = async (tab) => {
            return await new Promise((resolve, reject) => {
                try {
                    getBrowser().runtime.sendMessage(JSON.stringify({ type: 2, tab: tab }), function (response) {
                        resolve(response);
                    })
                } catch (e) {
                    reject(e);
                }
            })
        }
        getGM().xmlHttpRequest = async (props) => {
            try {
                getBrowser().runtime.sendMessage(JSON.stringify({ type: 3, props: props }), function (response) {
                    if (response.error != undefined) {
                        throw response.error;
                    }
                    props.onload(response);
                })
            } catch (e) {
                props.onerror(e);
            }
        }
    }

    strings = {
        'zh-cn': {
            'enabled': "启用",
            'disabled': "停用",
            'refreshAfterChange': "启用或禁用后请刷新网页生效"
        },
        'en-us': {
            'enabled': "Enabled",
            'disabled': "Disabled",
            'refreshAfterChange': "Please refresh the page after change"
        }
    }

    let languages = ['en-us', 'zh-cn'];
    let language = 'en-us';
    let prefixLen = 0;
    let settingLanguage = undefined;
    try {
        settingLanguage = await getGM().getValue("DisplayLanguage");
    } catch (e) { };

    if (typeof settingLanguage != 'string') {
        settingLanguage = navigator.language;
    }
    if (typeof settingLanguage == 'string') {
        settingLanguage = settingLanguage.toLowerCase();
        for (let i = 0; i < languages.length; i++) {
            for (let j = 0; j < languages[i].length && j < settingLanguage.length; j++) {
                if (languages[i][j] != settingLanguage[j]) {
                    break;
                }
                if (j > prefixLen) {
                    prefixLen = j;
                    language = languages[i];
                }
            }
        }
    }


    let updateText = () => {
        let checked = document.querySelector("#extensionSwitch").checked;
        document.querySelector("#status").textContent = strings[language][checked ? 'enabled' : 'disabled'];
        document.querySelector("#refreshAfterChange").textContent = strings[language]['refreshAfterChange'];
    }
    document.querySelector("#extensionSwitch").oninput = async (e) => {
        await getGM().setValue('vtEnabled', e.target.checked);
        updateText();
    }

    document.querySelector("#extensionSwitch").checked = !(await getGM().getValue('vtEnabled') === false);
    updateText();
})();