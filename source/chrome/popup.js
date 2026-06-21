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
            'toggle_label': "在此浏览器启用",
            'state_on': "已开启",
            'state_off': "已关闭",
            'desc': "开启插件后，浏览器会出现 VideoTogether 面板，可和朋友同步观赏影片。关闭则完全不启用。",
            'refreshAfterChange': "切换后请重新整理网页才会生效"
        },
        'zh-tw': {
            'toggle_label': "在此瀏覽器啟用",
            'state_on': "已開啟",
            'state_off': "已關閉",
            'desc': "開啟插件後，瀏覽器會出現 VideoTogether 面板，可和朋友同步觀賞影片。關閉則完全不啟用。",
            'refreshAfterChange': "切換後請重新整理網頁才會生效"
        },
        'ja-jp': {
            'toggle_label': "このブラウザで有効化",
            'state_on': "オン",
            'state_off': "オフ",
            'desc': "有効にすると、ブラウザに VideoTogether パネルが表示され、友だちと動画を同期して視聴できます。オフのときは動作しません。",
            'refreshAfterChange': "変更後はページを再読み込みしてください"
        },
        'en-us': {
            'toggle_label': "Enable in this browser",
            'state_on': "On",
            'state_off': "Off",
            'desc': "When enabled, the VideoTogether panel appears in your browser so you can watch videos in sync with friends. When off, it stays inactive.",
            'refreshAfterChange': "Please refresh the page after changing this"
        }
    }

    const languages = ['en-us', 'zh-cn', 'zh-tw', 'ja-jp'];
    let language = 'en-us';
    let settingLanguage = undefined;
    try {
        settingLanguage = await getGM().getValue("DisplayLanguage");
    } catch (e) { };

    if (typeof settingLanguage != 'string' || settingLanguage.trim() === '' || settingLanguage.toLowerCase() === 'auto') {
        settingLanguage = navigator.language; // 空值／auto＝自動偵測瀏覽器語言（與 extension.js 一致；修正 popup 在 auto/空值時固定變英文）
    }
    if (typeof settingLanguage == 'string') {
        settingLanguage = settingLanguage.toLowerCase();
        if (languages.includes(settingLanguage)) {
            language = settingLanguage;
        } else if (settingLanguage.split('-')[0] === 'zh') {
            // 中文再細分:繁體（tw/hk/mo/hant）對到 zh-tw,其餘（cn/sg/hans…）對到 zh-cn
            language = /(^|-)(tw|hk|mo|hant)(-|$)/.test(settingLanguage) ? 'zh-tw' : 'zh-cn';
        } else {
            const settingLanguagePrefix = settingLanguage.split('-')[0];
            for (let i = 0; i < languages.length; i++) {
                const languagePrefix = languages[i].split('-')[0];
                if (settingLanguagePrefix === languagePrefix) {
                    language = languages[i];
                    break;
                }
            }
        }
    }


    let updateText = () => {
        let checked = document.querySelector("#extensionSwitch").checked;
        let s = strings[language];
        document.querySelector("#toggleLabel").textContent = s['toggle_label'];
        let st = document.querySelector("#stateText");
        st.textContent = checked ? s['state_on'] : s['state_off'];
        st.className = "vt-state " + (checked ? "on" : "off");
        document.querySelector("#desc").textContent = s['desc'];
        document.querySelector("#refreshAfterChange").textContent = s['refreshAfterChange'];
    }
    document.querySelector("#extensionSwitch").oninput = async (e) => {
        await getGM().setValue('vtEnabled', e.target.checked);
        updateText();
    }

    document.querySelector("#extensionSwitch").checked = !(await getGM().getValue('vtEnabled') === false);
    updateText();
})();