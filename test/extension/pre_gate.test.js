const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../source/chrome/pre.js"), "utf8");

async function runPreScript({ pageEnabled, superEasyShare = false }) {
    const messages = [];
    const session = new Map();
    const context = vm.createContext({
        document: {},
        XMLDocument: class XMLDocument {},
        sessionStorage: {
            getItem: key => session.get(key),
            setItem: (key, value) => session.set(key, value),
            removeItem: key => session.delete(key)
        },
        VideoTogetherUrlPolicy: {
            isCurrentTabEnabled: async () => pageEnabled,
            storageGet: async () => ({ SuperEasyShare: superEasyShare })
        },
        chrome: {
            runtime: {
                sendMessage: message => messages.push(JSON.parse(message))
            }
        }
    });

    await vm.runInContext(source, context);
    return { messages, session };
}

test("does not request main-world injection when the current URL is disabled", async () => {
    const result = await runPreScript({ pageEnabled: false, superEasyShare: true });
    assert.deepEqual(result.messages, []);
    assert.equal(result.session.has("VideoTogetherSuperEasyShare"), false);
});

test("requests main-world injection only after policy and settings are ready", async () => {
    const result = await runPreScript({ pageEnabled: true, superEasyShare: true });
    assert.deepEqual(result.messages, [{ type: 6 }]);
    assert.equal(result.session.get("VideoTogetherSuperEasyShare"), "true");
});
