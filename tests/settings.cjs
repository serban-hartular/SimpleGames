const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), assert = require('node:assert/strict');
const cache = new Map(), storage = new Map();
const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
function load(filename) {
    filename = path.resolve(filename);
    if (!fs.existsSync(filename)) filename = filename.replace(/\.ts$/, '/index.ts');
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, { exports, localStorage, require: p => load(path.resolve(path.dirname(filename), p + '.ts')) });
    return exports;
}
const store = load('src/game/settings/store.ts');
for (const key of Object.keys(store.configs)) store.validate(key, store.defaults[key]);
const original = JSON.stringify(store.defaults.SnakeGame);
assert(store.applySettings('SnakeGame', { speed: 4, appleCount: 5 }));
assert.equal(store.configs.SnakeGame.speed, 4);
assert.equal(JSON.stringify(store.defaults.SnakeGame), original);
store.configs.SnakeGame.speed = 1; store.loadSettings(); assert.equal(store.configs.SnakeGame.speed, 4);
assert.throws(() => store.applySettings('SnakeGame', { speed: 0, appleCount: 5 }));
assert.equal(store.configs.SnakeGame.speed, 4);
assert.throws(() => store.validate('DivisibilityGame', { divisors: [] }));
store.validate('DivisibilityGame', { divisors: [10, 2, 10] });
const fox = store.clone(store.defaults.FoxGame); fox.counts = { chickens: 'auto', pies: 2, dogs: 0 }; store.validate('FoxGame', fox);
fox.assets = { fox: { url: '/fox.png', animation: { start: 0, end: 2, frameRate: 8 } } };
assert.throws(() => store.validate('FoxGame', fox));
const nav = store.clone(store.defaults.NavigationGame); nav.gyres[0].radiusX = 0;
assert.throws(() => store.validate('NavigationGame', nav));
storage.set('simple-games.settings.v1.SnakeGame', '{broken'); store.loadSettings();
localStorage.setItem = () => { throw new Error('unavailable'); };
assert.equal(store.applySettings('SnakeGame', { speed: 3, appleCount: 4 }), false);
assert.equal(store.configs.SnakeGame.speed, 3);
console.log('Settings checks passed: all defaults, validation, persistence, immutable defaults, malformed storage, asset validation, and unavailable storage.');
