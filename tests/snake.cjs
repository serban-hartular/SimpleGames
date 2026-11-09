const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript'), assert = require('node:assert/strict');
const cache = new Map();

class Scene {
    constructor() {
        this.events = new EventEmitter();
        this.input = { keyboard: new EventEmitter() };
        const captures = this.input.keyboard.captures = new Set();
        this.input.keyboard.addCapture = keys => keys.forEach(key => captures.add(key));
        this.input.keyboard.removeCapture = keys => keys.forEach(key => captures.delete(key));
        this.cameras = { main: { setBackgroundColor() {} } };
        this.zones = [];
        this.add = {
            text: () => new Proxy(new EventEmitter(), {
                get: (target, name) => name === 'on' ? target.on.bind(target) : () => target
            }),
            rectangle: () => ({ setStrokeStyle() {} }),
            graphics: () => {
                const graphics = new Proxy({}, { get: () => () => graphics });
                return graphics;
            },
            zone: () => {
                const zone = new EventEmitter();
                zone.setInteractive = () => zone;
                this.zones.push(zone);
                return zone;
            }
        };
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
        if (p === '../audio/SnakeSounds') return { SnakeSounds: class { unlock() {} destroy() {} } };
        return load(path.resolve(path.dirname(filename), p + '.ts'));
    } });
    return exports;
}

const { SnakeBoard } = load('src/game/logic/SnakeBoard.ts');
function reset(board, x = 1, y = 0) {
    board.direction = { x, y };
    board.snake = Array.from({ length: 4 }, (_, i) => ({ x: 10 - x * i, y: 10 - y * i }));
    board.apples = [{ x: 1, y: 1 }];
}
const board = new SnakeBoard(1);
reset(board);
board.turn(-1, 0); // Reverse and straight inputs must not block a later valid turn.
board.turn(1, 0);
board.turn(0, -1);
board.turn(-1, 0); // A second rapid key cannot reverse within the same tick.
board.step();
assert.equal(board.direction.y, -1);
assert.equal(board.snake[0].y, 9);
board.turn(-1, 0); board.step();
assert.equal(board.snake[0].x, 9);
reset(board);
board.turnToward(10.5, 15);
board.turn(0, -1); board.step();
assert.equal(board.direction.y, 1); // Pointer and keyboard share the pending turn.
reset(board);
board.turn(0, -1);
board.turnToward(10.5, 15); board.step();
assert.equal(board.direction.y, -1);
board.ended = true;
const ended = JSON.stringify(board);
board.turn(1, 0); board.step();
assert.equal(JSON.stringify(board), ended);

const { snakeConfig } = load('src/game/config/snake.ts');
const { SnakeGame } = load('src/game/scenes/SnakeGame.ts');
for (const arrowKeysOnly of [false, true]) {
    snakeConfig.arrowKeysOnly = arrowKeysOnly;
    const game = new SnakeGame(); game.create();
    assert.equal(game.zones.length, arrowKeysOnly ? 0 : 1);
    assert.equal(game.input.keyboard.captures.size, 4);
    for (const [key, x, y] of [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]]) {
        reset(game.board, y !== 0 ? 1 : 0, y !== 0 ? 0 : 1);
        game.input.keyboard.emit('keydown', { key }); game.board.step();
        assert.equal(game.board.snake[0].x, 10 + x);
        assert.equal(game.board.snake[0].y, 10 + y);
    }
    reset(game.board);
    game.input.keyboard.emit('keydown', { key: 'w' }); game.board.step();
    assert.equal(game.board.direction.x, 1);
    if (!arrowKeysOnly) {
        reset(game.board);
        game.zones[0].emit('pointerdown', { x: 334, y: 200 }); game.board.step();
        assert.equal(game.board.direction.y, -1);
    }
    game.events.emit('shutdown');
    assert.equal(game.input.keyboard.listenerCount('keydown'), 0);
    assert.equal(game.input.keyboard.captures.size, 0);
    game.create();
    assert.equal(game.input.keyboard.listenerCount('keydown'), 1);
    game.events.emit('shutdown');
}
console.log('Snake checks passed: all arrow directions, click steering, arrows-only mode, turn locking, reversal protection, ended games and keyboard cleanup.');
