const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../source/extension/url_policy.js"), "utf8");

function loadPolicy(initialValues = {}) {
    const values = { ...initialValues };
    const pageWindow = {
        location: { href: "https://example.com/video" }
    };
    pageWindow.self = pageWindow;
    pageWindow.top = pageWindow;

    const context = vm.createContext({
        URL,
        console,
        window: pageWindow,
        chrome: {
            runtime: { lastError: null },
            storage: {
                local: {
                    get(keys, callback) {
                        const result = {};
                        keys.forEach(key => result[key] = values[key]);
                        callback(result);
                    },
                    set(update, callback) {
                        Object.assign(values, update);
                        callback();
                    }
                }
            }
        }
    });
    vm.runInContext(source, context);
    return { policy: context.VideoTogetherUrlPolicy, values };
}

test("defaults to all websites and includes common video websites", async () => {
    const { policy } = loadPolicy();
    const settings = await policy.getSettings();
    assert.equal(settings.enabled, true);
    assert.equal(settings.mode, policy.Mode.All);
    assert.equal(policy.matches("https://www.youtube.com/watch?v=1", settings.allowlist), true);
    assert.equal(policy.matches("https://www.bilibili.com/video/BV1", settings.allowlist), true);
});

test("allowlist mode enables only matching URLs", () => {
    const { policy } = loadPolicy();
    const settings = {
        enabled: true,
        mode: policy.Mode.Allowlist,
        allowlist: ["^https://video\\.example\\.com/"],
        blocklist: []
    };
    assert.equal(policy.isUrlEnabled("https://video.example.com/watch/1", settings), true);
    assert.equal(policy.isUrlEnabled("https://example.com/", settings), false);
});

test("blocklist mode disables only matching URLs", () => {
    const { policy } = loadPolicy();
    const settings = {
        enabled: true,
        mode: policy.Mode.Blocklist,
        allowlist: [],
        blocklist: ["^https://private\\.example\\.com/"]
    };
    assert.equal(policy.isUrlEnabled("https://private.example.com/account", settings), false);
    assert.equal(policy.isUrlEnabled("https://video.example.com/watch/1", settings), true);
});

test("removes every list rule matching the current URL", () => {
    const { policy } = loadPolicy();
    const patterns = [
        "^https://video\\.example\\.com/",
        "example\\.com",
        "^https://other\\.example\\.com/"
    ];
    assert.deepEqual(
        policy.removeMatchingPatterns("https://video.example.com/watch/1", patterns),
        ["^https://other\\.example\\.com/"]
    );
});

test("the official setting directory is enabled regardless of global and URL rules", () => {
    const { policy } = loadPolicy();
    const settings = {
        enabled: false,
        mode: policy.Mode.Blocklist,
        allowlist: [],
        blocklist: [".*"]
    };
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io/setting", settings), true);
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io/setting/v2.html", settings), true);
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io/setting/other/page.html?tab=1", settings), true);
});

test("the forced setting exception does not enable similar hosts or paths", () => {
    const { policy } = loadPolicy();
    const settings = {
        enabled: false,
        mode: policy.Mode.All,
        allowlist: [],
        blocklist: []
    };
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io/settings/v2.html", settings), false);
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io/setting-other/v2.html", settings), false);
    assert.equal(policy.isUrlEnabled("https://videotogether.github.io.example.com/setting/v2.html", settings), false);
    assert.equal(policy.isUrlEnabled("http://videotogether.github.io/setting/v2.html", settings), false);
});

test("current-site pattern matches the selected host and its subdomains", () => {
    const { policy } = loadPolicy();
    const pattern = policy.patternForSite("https://www.example.com/watch/1");
    assert.equal(policy.matches("https://example.com/", [pattern]), true);
    assert.equal(policy.matches("https://video.example.com/watch/2", [pattern]), true);
    assert.equal(policy.matches("https://not-example.com/", [pattern]), false);
});

test("invalid regular expressions are reported and never match", () => {
    const { policy } = loadPolicy();
    assert.equal(policy.validatePatterns(["[invalid"]).length, 1);
    assert.equal(policy.matches("https://example.com/", ["[invalid"]), false);
});
