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
assert(store.applySettings('SnakeGame', { speed: 4, appleCount: 5, arrowKeysOnly: true }));
assert.equal(store.configs.SnakeGame.speed, 4);
assert.equal(store.configs.SnakeGame.arrowKeysOnly, true);
assert.equal(JSON.stringify(store.defaults.SnakeGame), original);
store.configs.SnakeGame.speed = 1; store.configs.SnakeGame.arrowKeysOnly = false;
store.loadSettings(); assert.equal(store.configs.SnakeGame.speed, 4);
assert.equal(store.configs.SnakeGame.arrowKeysOnly, true);
assert.throws(() => store.applySettings('SnakeGame', { speed: 0, appleCount: 5, arrowKeysOnly: false }));
assert.throws(() => store.applySettings('SnakeGame', { speed: 4, appleCount: 5, arrowKeysOnly: 'true' }));
assert.equal(store.configs.SnakeGame.speed, 4);
assert.equal(store.configs.SnakeGame.arrowKeysOnly, true);
storage.set('simple-games.settings.v1.SnakeGame', JSON.stringify({ speed: 6, appleCount: 7 }));
store.loadSettings();
assert.equal(store.configs.SnakeGame.speed, 6);
assert.equal(store.configs.SnakeGame.appleCount, 7);
assert.equal(store.configs.SnakeGame.arrowKeysOnly, false);
assert.throws(() => store.validate('DivisibilityGame', { divisors: [] }));
store.validate('DivisibilityGame', { divisors: [10, 2, 10] });
const fox = store.clone(store.defaults.FoxGame); fox.counts = { chickens: 'auto', pies: 2, dogs: 0 }; store.validate('FoxGame', fox);
fox.arrowKeysOnly = true;
assert(store.applySettings('FoxGame', fox));
store.configs.FoxGame.arrowKeysOnly = false; store.loadSettings();
assert.equal(store.configs.FoxGame.arrowKeysOnly, true);
assert.throws(() => store.applySettings('FoxGame', { ...fox, arrowKeysOnly: 'true' }));
assert.equal(store.configs.FoxGame.arrowKeysOnly, true);
const legacyFox = store.clone(fox); delete legacyFox.arrowKeysOnly;
storage.set('simple-games.settings.v1.FoxGame', JSON.stringify(legacyFox));
store.loadSettings();
assert.equal(store.configs.FoxGame.arrowKeysOnly, false);
assert.equal(JSON.stringify(store.configs.FoxGame.counts), JSON.stringify(fox.counts));
assert.equal(JSON.stringify(store.configs.FoxGame.assets), JSON.stringify(fox.assets));
assert.equal(JSON.stringify(store.defaults.FoxGame.arrowKeysOnly), 'false');
fox.assets = { fox: { url: '/fox.png', animation: { start: 0, end: 2, frameRate: 8 } } };
assert.throws(() => store.validate('FoxGame', fox));
const nav = store.clone(store.defaults.NavigationGame); nav.gyres[0].radiusX = 0;
assert.throws(() => store.validate('NavigationGame', nav));
storage.set('simple-games.settings.v1.SnakeGame', '{broken'); store.loadSettings();
assert(store.applySettings('StreetsGame', { difficulty: 5, seed: 42 }));
store.configs.StreetsGame.difficulty = 1; store.loadSettings();
assert.equal(store.configs.StreetsGame.difficulty, 5);
assert.equal(store.configs.StreetsGame.seed, 42);
assert.equal(store.defaults.StreetsGame.difficulty, 2);
for (const difficulty of [0, 6, 2.5, '3']) {
    assert.throws(() => store.applySettings('StreetsGame', { difficulty, seed: null }));
    assert.equal(store.configs.StreetsGame.difficulty, 5);
}
assert.throws(() => store.validate('StreetsGame', { difficulty: 2, seed: -1 }));
assert.throws(() => store.validate('StreetsGame', { difficulty: 2, seed: null, unexpected: true }));
assert(store.applySettings('RobotGame', { columns: 12, rows: 8, stepDuration: 450 }));
store.configs.RobotGame.columns = 2; store.loadSettings();
assert.equal(store.configs.RobotGame.columns, 12);
assert.equal(store.configs.RobotGame.rows, 8);
assert.equal(store.configs.RobotGame.stepDuration, 450);
assert.equal(store.defaults.RobotGame.columns, 10);
for (const value of [1, 21, 3.5, '10']) {
    assert.throws(() => store.applySettings('RobotGame', { columns: value, rows: 10, stepDuration: 600 }));
    assert.equal(store.configs.RobotGame.columns, 12);
}
assert.throws(() => store.validate('RobotGame', { columns: 10, rows: 10, stepDuration: 0 }));
assert.throws(() => store.validate('RobotGame', { columns: 10, rows: 10, stepDuration: 600, unknown: 1 }));
localStorage.setItem = () => { throw new Error('unavailable'); };
assert.equal(store.applySettings('SnakeGame', { speed: 3, appleCount: 4, arrowKeysOnly: false }), false);
assert.equal(store.configs.SnakeGame.speed, 3);
console.log('Settings checks passed: all defaults, validation, persistence, immutable defaults, malformed storage, asset validation, and unavailable storage.');
