(async function () {
    const browserApi = globalThis.browser || globalThis.chrome;
    const policy = globalThis.VideoTogetherUrlPolicy;
    const language = navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const strings = {
        zh: {
            brandTagline: "一起看视频",
            globalLabel: "全局状态",
            enabled: "插件已启用",
            disabled: "插件已停用",
            refresh: "修改设置后，请刷新已经打开的网页使其生效。",
            allow: "在此网站启用",
            block: "在该网站禁用",
            settingsEntry: "网站匹配设置",
            active: host => `${host} 已允许加载插件`,
            inactive: host => `${host} 当前不会加载插件`,
            unsupported: "当前页面不支持网站匹配",
            addedAllowlist: "已将网站加入开启列表。",
            removedAllowlist: "已移除该网站相关的开启列表规则。",
            removedBlocklist: "已移除该网站相关的屏蔽列表规则。",
            addedBlocklist: "已将网站加入屏蔽列表。",
            unavailable: "请先在设置中选择开启列表或屏蔽列表模式。",
            failed: message => `操作失败：${message}`,
            settingsTitle: "网站匹配设置",
            settingsDescription: "使用完整 URL 的 JavaScript 正则表达式控制插件加载范围。",
            modeTitle: "启用策略",
            modeAll: "所有网站",
            modeAllDescription: "不使用列表限制",
            modeAllowlist: "仅开启列表",
            modeAllowlistDescription: "只在匹配网站启用",
            modeBlocklist: "排除屏蔽列表",
            modeBlocklistDescription: "其他网站保持启用",
            allowlistTitle: "开启列表",
            allowlistHint: "每行一个正则",
            blocklistTitle: "屏蔽列表",
            blocklistHint: "每行一个正则",
            save: "保存设置",
            saved: "设置已保存，请刷新网页使其生效。",
            invalid: (list, line, message) => `${list}第 ${line} 行不是有效正则：${message}`,
            allowlist: "开启列表",
            blocklist: "屏蔽列表",
            back: "返回"
        },
        en: {
            brandTagline: "Watch together",
            globalLabel: "Global status",
            enabled: "Extension enabled",
            disabled: "Extension disabled",
            refresh: "Refresh open pages after changing settings.",
            allow: "Enable on this site",
            block: "Disable on this site",
            settingsEntry: "Website matching",
            active: host => `${host} is allowed to load the extension`,
            inactive: host => `${host} will not load the extension`,
            unsupported: "Website matching is unavailable on this page",
            addedAllowlist: "Added this website to the allowlist.",
            removedAllowlist: "Removed all matching allowlist rules for this website.",
            removedBlocklist: "Removed all matching blocklist rules for this website.",
            addedBlocklist: "Added this website to the blocklist.",
            unavailable: "Choose allowlist or blocklist mode in settings first.",
            failed: message => `Failed: ${message}`,
            settingsTitle: "Website matching",
            settingsDescription: "Control extension loading with JavaScript regular expressions matched against full URLs.",
            modeTitle: "Activation policy",
            modeAll: "All websites",
            modeAllDescription: "Do not restrict by list",
            modeAllowlist: "Allowlist only",
            modeAllowlistDescription: "Enable only when matched",
            modeBlocklist: "Exclude blocklist",
            modeBlocklistDescription: "Enable on other websites",
            allowlistTitle: "Allowlist",
            allowlistHint: "One regex per line",
            blocklistTitle: "Blocklist",
            blocklistHint: "One regex per line",
            save: "Save settings",
            saved: "Settings saved. Refresh open pages to apply them.",
            invalid: (list, line, message) => `${list} line ${line} is not a valid regular expression: ${message}`,
            allowlist: "Allowlist",
            blocklist: "Blocklist",
            back: "Back"
        }
    }[language];

    const extensionSwitch = document.getElementById("extensionSwitch");
    const allowButton = document.getElementById("allowCurrentSite");
    const blockButton = document.getElementById("blockCurrentSite");
    const quickActions = document.getElementById("quickActions");
    const mainView = document.getElementById("mainView");
    const settingsView = document.getElementById("settingsView");
    const siteStatus = document.getElementById("siteStatus");
    const activeTabs = await browserApi.tabs.query({ active: true, currentWindow: true });
    const activeTab = activeTabs[0];
    const currentUrl = activeTab && activeTab.url;
    let currentUrlObject;

    try {
        currentUrlObject = new URL(currentUrl);
        if (currentUrlObject.protocol != "http:" && currentUrlObject.protocol != "https:") {
            currentUrlObject = undefined;
        }
    } catch {
        currentUrlObject = undefined;
    }

    const textBindings = {
        brandTagline: "brandTagline",
        globalLabel: "globalLabel",
        allowCurrentSite: "allow",
        blockCurrentSite: "block",
        settingsEntry: "settingsEntry",
        refreshNote: "refresh",
        settingsTitle: "settingsTitle",
        settingsDescription: "settingsDescription",
        modeTitle: "modeTitle",
        modeAll: "modeAll",
        modeAllDescription: "modeAllDescription",
        modeAllowlist: "modeAllowlist",
        modeAllowlistDescription: "modeAllowlistDescription",
        modeBlocklist: "modeBlocklist",
        modeBlocklistDescription: "modeBlocklistDescription",
        allowlistTitle: "allowlistTitle",
        allowlistHint: "allowlistHint",
        blocklistTitle: "blocklistTitle",
        blocklistHint: "blocklistHint",
        saveSettings: "save"
    };

    Object.entries(textBindings).forEach(([id, key]) => {
        document.getElementById(id).textContent = strings[key];
    });
    document.getElementById("backToMain").setAttribute("aria-label", strings.back);
    document.documentElement.lang = language == "zh" ? "zh-CN" : "en";

    function setMessage(id, message, isError = false) {
        const element = document.getElementById(id);
        element.textContent = message;
        element.classList.toggle("error", isError);
    }

    function showView(view) {
        const showSettings = view == "settings";
        mainView.hidden = showSettings;
        settingsView.hidden = !showSettings;
        document.documentElement.classList.toggle("settings-open", showSettings);
    }

    async function refreshMainState() {
        const settings = await policy.getSettings();
        extensionSwitch.checked = settings.enabled;
        document.getElementById("globalStatus").textContent = settings.enabled ? strings.enabled : strings.disabled;
        if (currentUrlObject == undefined) {
            siteStatus.textContent = strings.unsupported;
            siteStatus.dataset.state = "unsupported";
            quickActions.hidden = true;
            allowButton.disabled = true;
            blockButton.disabled = true;
            return;
        }

        quickActions.hidden = settings.mode == policy.Mode.All;
        allowButton.disabled = false;
        blockButton.disabled = false;

        const active = policy.isUrlEnabled(currentUrl, settings);
        siteStatus.textContent = active
            ? strings.active(currentUrlObject.hostname)
            : strings.inactive(currentUrlObject.hostname);
        siteStatus.dataset.state = active ? "active" : "inactive";
    }

    async function loadSettingsForm() {
        const settings = await policy.getSettings();
        document.querySelector(`input[name="mode"][value="${settings.mode}"]`).checked = true;
        document.getElementById("allowlist").value = settings.allowlist.join("\n");
        document.getElementById("blocklist").value = settings.blocklist.join("\n");
        setMessage("settingsMessage", "");
    }

    function readPatterns(id) {
        return [...new Set(document.getElementById(id).value
            .split("\n")
            .map(value => value.trim())
            .filter(Boolean))];
    }

    extensionSwitch.addEventListener("change", async () => {
        await policy.storageSet({ [policy.StorageKey.Enabled]: extensionSwitch.checked });
        setMessage("mainMessage", "");
        await refreshMainState();
    });

    async function updateCurrentSite(action) {
        try {
            const settings = await policy.getSettings();
            if (settings.mode == policy.Mode.All) {
                setMessage("mainMessage", strings.unavailable, true);
                return;
            }
            const pattern = policy.patternForSite(currentUrl);
            if (settings.mode == policy.Mode.Allowlist) {
                if (action == "enable") {
                    const allowlist = [...settings.allowlist];
                    if (!policy.matches(currentUrl, allowlist)) {
                        allowlist.push(pattern);
                    }
                    await policy.storageSet({
                        [policy.StorageKey.Allowlist]: allowlist
                    });
                    setMessage("mainMessage", strings.addedAllowlist);
                } else {
                    await policy.storageSet({
                        [policy.StorageKey.Allowlist]: policy.removeMatchingPatterns(currentUrl, settings.allowlist)
                    });
                    setMessage("mainMessage", strings.removedAllowlist);
                }
            } else {
                if (action == "enable") {
                    await policy.storageSet({
                        [policy.StorageKey.Blocklist]: policy.removeMatchingPatterns(currentUrl, settings.blocklist)
                    });
                    setMessage("mainMessage", strings.removedBlocklist);
                } else {
                    const blocklist = [...settings.blocklist];
                    if (!policy.matches(currentUrl, blocklist)) {
                        blocklist.push(pattern);
                    }
                    await policy.storageSet({
                        [policy.StorageKey.Blocklist]: blocklist
                    });
                    setMessage("mainMessage", strings.addedBlocklist);
                }
            }
            await refreshMainState();
        } catch (error) {
            setMessage("mainMessage", strings.failed(error.message), true);
        }
    }

    document.getElementById("openSettings").addEventListener("click", async () => {
        await loadSettingsForm();
        showView("settings");
    });

    document.getElementById("backToMain").addEventListener("click", async () => {
        await refreshMainState();
        showView("main");
    });

    document.getElementById("saveSettings").addEventListener("click", async () => {
        const allowlist = readPatterns("allowlist");
        const blocklist = readPatterns("blocklist");
        const allowlistErrors = policy.validatePatterns(allowlist);
        const blocklistErrors = policy.validatePatterns(blocklist);
        if (allowlistErrors.length > 0) {
            const error = allowlistErrors[0];
            setMessage("settingsMessage", strings.invalid(strings.allowlist, error.index + 1, error.message), true);
            return;
        }
        if (blocklistErrors.length > 0) {
            const error = blocklistErrors[0];
            setMessage("settingsMessage", strings.invalid(strings.blocklist, error.index + 1, error.message), true);
            return;
        }

        try {
            await policy.storageSet({
                [policy.StorageKey.Mode]: document.querySelector('input[name="mode"]:checked').value,
                [policy.StorageKey.Allowlist]: allowlist,
                [policy.StorageKey.Blocklist]: blocklist
            });
            setMessage("settingsMessage", strings.saved);
        } catch (error) {
            setMessage("settingsMessage", strings.failed(error.message), true);
        }
    });

    allowButton.addEventListener("click", () => updateCurrentSite("enable"));
    blockButton.addEventListener("click", () => updateCurrentSite("disable"));

    showView("main");
    await refreshMainState();
})();
