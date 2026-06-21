// 單元測試：抽出 vt.js 內的純函式 VideoTogetherResolveMinimized 並驗證真值表。
// 無框架，用 Node 內建 assert。執行：node test/extension/collapse-state.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const vtPath = path.join(__dirname, '..', '..', 'source', 'extension', 'vt.js');
const src = fs.readFileSync(vtPath, 'utf8');
const START = '// === collapse-state:start';
const END = '// === collapse-state:end';
const s = src.indexOf(START);
const e = src.indexOf(END);
assert.ok(s !== -1 && e !== -1 && e > s,
    'sentinel 區塊未找到：請確認 vt.js 內有 collapse-state:start/end');
// eslint-disable-next-line no-eval
eval(src.slice(s, e)); // 定義 VideoTogetherResolveMinimized 於本作用域

function expect(state, want, msg) {
    assert.strictEqual(VideoTogetherResolveMinimized(state), want, msg);
}

// 在房間：繼承 carried，無則展開
expect({ inRoom: true, carried: 1 }, true, '在房間 carried=1 → 收合');
expect({ inRoom: true, carried: "1" }, true, '在房間 carried="1" → 收合');
expect({ inRoom: true, carried: 0 }, false, '在房間 carried=0 → 展開');
expect({ inRoom: true, carried: "0" }, false, '在房間 carried="0" → 展開');
expect({ inRoom: true, carried: true }, true, '在房間 carried=true → 收合');
expect({ inRoom: true, carried: false }, false, '在房間 carried=false → 展開');
expect({ inRoom: true, carried: null }, false, '在房間 無carried → 展開（觀眾首次進房）');
expect({ inRoom: true, carried: undefined }, false, '在房間 carried undefined → 展開');
// 不在房間：純看設定，未知收合（安全）
expect({ inRoom: false, minimiseDefault: true }, true, '不在房間 設定開 → 收合');
expect({ inRoom: false, minimiseDefault: false }, false, '不在房間 設定關 → 展開');
expect({ inRoom: false, minimiseDefault: null }, true, '不在房間 設定未知 → 收合（安全）');
expect({ inRoom: false }, true, '不在房間 無設定資訊 → 收合（安全）');
// 防呆：state 缺失也走安全收合
expect(null, true, 'state=null → 收合（安全）');
expect(undefined, true, 'state=undefined → 收合（安全）');

console.log('collapse-state: 全部通過');
