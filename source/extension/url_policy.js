(function () {
    if (globalThis.VideoTogetherUrlPolicy != undefined) {
        return;
    }

    const Mode = Object.freeze({
        All: "all",
        Allowlist: "allowlist",
        Blocklist: "blocklist"
    });

    const StorageKey = Object.freeze({
        Enabled: "vtEnabled",
        Mode: "VideoTogetherUrlMode",
        Allowlist: "VideoTogetherUrlAllowlist",
        Blocklist: "VideoTogetherUrlBlocklist"
    });

    const DefaultVideoPatterns = Object.freeze([
        "^https?://([^/]+\\.)?youtube\\.com(?::\\d+)?(?:/|$)",
        "^https?://youtu\\.be(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?bilibili\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?iqiyi\\.com(?::\\d+)?(?:/|$)",
        "^https?://v\\.qq\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?youku\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?mgtv\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?acfun\\.cn(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?netflix\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?disneyplus\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?primevideo\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?twitch\\.tv(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?vimeo\\.com(?::\\d+)?(?:/|$)",
        "^https?://pan\\.baidu\\.com(?::\\d+)?(?:/|$)",
        "^https?://([^/]+\\.)?aliyundrive\\.com(?::\\d+)?(?:/|$)"
    ]);

    function getBrowser() {
        if (globalThis.browser != undefined) {
            return globalThis.browser;
        }
        return globalThis.chrome;
    }

    function storageGet(keys) {
        if (globalThis.browser != undefined) {
            return getBrowser().storage.local.get(keys);
        }
        return new Promise((resolve, reject) => {
            try {
                getBrowser().storage.local.get(keys, result => {
                    const error = globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                    } else {
                        resolve(result);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    function storageSet(values) {
        if (globalThis.browser != undefined) {
            return getBrowser().storage.local.set(values);
        }
        return new Promise((resolve, reject) => {
            try {
                getBrowser().storage.local.set(values, () => {
                    const error = globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    function normalizePatterns(value, defaultValue) {
        if (!Array.isArray(value)) {
            return [...defaultValue];
        }
        return [...new Set(value.filter(item => typeof item == "string").map(item => item.trim()).filter(Boolean))];
    }

    async function getSettings() {
        const values = await storageGet(Object.values(StorageKey));
        const mode = Object.values(Mode).includes(values[StorageKey.Mode]) ? values[StorageKey.Mode] : Mode.All;
        return {
            enabled: values[StorageKey.Enabled] !== false,
            mode: mode,
            allowlist: normalizePatterns(values[StorageKey.Allowlist], DefaultVideoPatterns),
            blocklist: normalizePatterns(values[StorageKey.Blocklist], [])
        };
    }

    function matches(url, patterns) {
        return patterns.some(pattern => {
            try {
                return new RegExp(pattern).test(url);
            } catch {
                return false;
            }
        });
    }

    function removeMatchingPatterns(url, patterns) {
        return patterns.filter(pattern => !matches(url, [pattern]));
    }

    function isForcedEnabledUrl(urlString) {
        try {
            const url = new URL(urlString);
            return url.origin == "https://videotogether.github.io"
                && (url.pathname == "/setting" || url.pathname.startsWith("/setting/"));
        } catch {
            return false;
        }
    }

    function isUrlEnabled(url, settings) {
        if (isForcedEnabledUrl(url)) {
            return true;
        }
        if (!settings.enabled) {
            return false;
        }
        switch (settings.mode) {
            case Mode.Allowlist:
                return matches(url, settings.allowlist);
            case Mode.Blocklist:
                return !matches(url, settings.blocklist);
            default:
                return true;
        }
    }

    function getTopLevelUrl() {
        if (window.self == window.top) {
            return Promise.resolve(window.location.href);
        }
        if (globalThis.browser != undefined) {
            return getBrowser().runtime.sendMessage(JSON.stringify({ type: 5 }))
                .then(response => typeof response == "string" ? response : window.location.href)
                .catch(() => window.location.href);
        }
        return new Promise(resolve => {
            try {
                getBrowser().runtime.sendMessage(JSON.stringify({ type: 5 }), response => {
                    const error = globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError;
                    if (error || typeof response != "string") {
                        resolve(window.location.href);
                    } else {
                        resolve(response);
                    }
                });
            } catch {
                resolve(window.location.href);
            }
        });
    }

    async function isCurrentTabEnabled() {
        const [url, settings] = await Promise.all([getTopLevelUrl(), getSettings()]);
        return isUrlEnabled(url, settings);
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function patternForSite(urlString) {
        const url = new URL(urlString);
        if (url.protocol != "http:" && url.protocol != "https:") {
            throw new Error("Only HTTP and HTTPS pages are supported");
        }
        let hostname = url.hostname.toLowerCase();
        if (hostname.startsWith("www.")) {
            hostname = hostname.slice(4);
        }
        const subdomain = hostname == "localhost" || hostname.includes(":") ? "" : "([^/]+\\.)?";
        return `^https?://${subdomain}${escapeRegex(hostname)}(?::\\d+)?(?:/|$)`;
    }

    function validatePatterns(patterns) {
        const errors = [];
        patterns.forEach((pattern, index) => {
            try {
                new RegExp(pattern);
            } catch (error) {
                errors.push({ index: index, pattern: pattern, message: error.message });
            }
        });
        return errors;
    }

    globalThis.VideoTogetherUrlPolicy = Object.freeze({
        Mode: Mode,
        StorageKey: StorageKey,
        DefaultVideoPatterns: DefaultVideoPatterns,
        getSettings: getSettings,
        storageGet: storageGet,
        storageSet: storageSet,
        matches: matches,
        removeMatchingPatterns: removeMatchingPatterns,
        isForcedEnabledUrl: isForcedEnabledUrl,
        isUrlEnabled: isUrlEnabled,
        isCurrentTabEnabled: isCurrentTabEnabled,
        patternForSite: patternForSite,
        validatePatterns: validatePatterns
    });
})();
