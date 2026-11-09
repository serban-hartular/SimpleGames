const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript'), assert = require('node:assert/strict');
const cache = new Map();
function display() {
    const object = new Proxy(new EventEmitter(), {
        get: (target, name) => name === 'on' ? target.on.bind(target) : () => object
    });
    return object;
}
class Scene {
    constructor() {
        this.events = new EventEmitter();
        this.input = { keyboard: new EventEmitter() };
        const captures = this.input.keyboard.captures = new Set();
        this.input.keyboard.addCapture = keys => keys.forEach(key => captures.add(key));
        this.input.keyboard.removeCapture = keys => keys.forEach(key => captures.delete(key));
        this.cameras = { main: { setBackgroundColor() {} } };
        this.zones = [];
        this.add = { text: display, graphics: display, zone: () => {
            const zone = new EventEmitter(); zone.setInteractive = () => zone;
            this.zones.push(zone); return zone;
        } };
    }
}
function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, { exports, require: p => {
        if (p === 'phaser') return { Scene };
        if (p === '../i18n') return { t: key => key };
        if (p === '../settings/dialog') return { installSettings() {} };
        if (p === '../audio/FoxSounds') return { FoxSounds: class { unlock() {} destroy() {} } };
        if (p === '../visuals/FoxFigures') return { FoxFigures: { create: display } };
        return load(path.resolve(path.dirname(filename), p + '.ts'));
    } });
    return exports;
}
const { foxConfig } = load('src/game/config/fox.ts');
const { FoxGame } = load('src/game/scenes/FoxGame.ts');
for (const arrowKeysOnly of [false, true]) {
    foxConfig.arrowKeysOnly = arrowKeysOnly; foxConfig.seed = 1;
    const game = new FoxGame();
    game.renderActors = () => {}; // Rendering is unrelated to input routing.
    game.create();
    assert.equal(game.zones.length, arrowKeysOnly ? 0 : 1);
    const turns = []; let stops = 0;
    game.board.steer = (x, y) => turns.push([x, y]);
    game.board.stop = () => stops++;
    for (const [key, x, y] of [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]]) {
        game.input.keyboard.emit('keydown', { key });
        assert.deepEqual(turns.at(-1), [x, y]);
    }
    game.input.keyboard.emit('keydown', { key: ' ', code: 'Space' });
    assert.equal(stops, 1);
    if (!arrowKeysOnly) {
        const x = game.px(game.board.fox.x), y = game.py(game.board.fox.y);
        game.zones[0].emit('pointerdown', { x: x + game.cell, y });
        assert(Math.abs(turns.at(-1)[0] - game.cell) < 1e-9);
        assert.equal(turns.at(-1)[1], 0);
        game.zones[0].emit('pointerdown', { x, y });
        assert.equal(stops, 2);
    }
    assert.equal(game.input.keyboard.captures.size, 5);
    game.events.emit('shutdown');
    assert.equal(game.input.keyboard.listenerCount('keydown'), 0);
    assert.equal(game.input.keyboard.captures.size, 0);
}
console.log('Fox control checks passed: arrows in both modes, click steering/stopping, arrows-only mode, Space stopping and keyboard cleanup.');
