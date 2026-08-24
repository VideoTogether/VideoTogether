const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../source/extension/extension_loader.js"), "utf8");

async function runLoader(pageEnabled) {
    const messages = [];
    const context = vm.createContext({
        document: {},
        XMLDocument: class XMLDocument {},
        VideoTogetherUrlPolicy: {
            isCurrentTabEnabled: async () => pageEnabled
        },
        chrome: {
            runtime: {
                sendMessage: message => messages.push(JSON.parse(message))
            }
        }
    });

    await vm.runInContext(source, context);
    return messages;
}

test("disabled URLs stop at the lightweight extension loader", async () => {
    assert.deepEqual(await runLoader(false), [{ type: 4, enabled: false }]);
});

test("enabled URLs request the full extension bundle", async () => {
    assert.deepEqual(await runLoader(true), [
        { type: 4, enabled: true },
        { type: 7 }
    ]);
});
