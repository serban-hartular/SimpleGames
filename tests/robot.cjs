const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const cache = new Map();
function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, { exports, require: p => load(path.resolve(path.dirname(filename), p + '.ts')) });
    return exports;
}
const { RobotBoard, validateRobotConfig, MAX_ROBOT_INSTRUCTIONS } = load('src/game/logic/RobotBoard.ts');
const config = { columns: 10, rows: 10, stepDuration: 600 };
const board = new RobotBoard(config);
assert.equal(board.start, 90); assert.equal(board.target, 9); assert.equal(board.heading, 0);
assert.equal(board.run(), false, 'An empty program cannot run');
assert(board.toggleObstacle(21)); assert(board.obstacles.has(21));
assert(board.toggleObstacle(21)); assert(!board.obstacles.has(21));
for (const cell of [-1, 100, 2.5, NaN, board.start, board.target]) assert.equal(board.toggleObstacle(cell), false);
board.toggleObstacle(21);
assert.equal(board.movePiece('robot', 21), false);
assert.equal(board.movePiece('star', board.start), false);
assert.equal(board.movePiece('robot', board.target), false);
assert.equal(board.movePiece('star', 100), false);
assert(board.movePiece('robot', 22)); assert(board.movePiece('star', 12));
assert(board.insert(0, 'forward')); assert(board.run());
assert.equal(board.insert(0, 'right'), false); assert.equal(board.remove(0), false);
assert.equal(board.movePiece('robot', 33), false); assert.equal(board.toggleObstacle(33), false);
assert.equal(board.run(), false, 'GO cannot restart a running program');
board.rotateStart(); assert.equal(board.startHeading, 0);
assert.equal(board.step(), 'success'); assert.equal(board.position, 12);
assert.equal(board.step(), 'success', 'Finished attempts do not execute again');
assert(board.run()); assert.equal(board.position, 22, 'Retries restore the designed starting square');
assert.equal(board.step(), 'success');

// Visiting the star earlier is not success if the complete program leaves it.
assert(board.insert(1, 'forward')); assert(board.run());
assert.equal(board.step(), 'running'); assert.equal(board.position, board.target);
assert.equal(board.step(), 'miss'); assert.equal(board.position, 2);
assert.equal(board.program.length, 2, 'A failed attempt preserves the instructions');
assert(board.remove(1)); assert(board.insert(0, 'right')); assert(board.insert(1, 'left'));
assert.equal(board.program.join(','), 'right,left,forward', 'Insertion shifts following commands');
assert(board.remove(1)); assert.equal(board.program.join(','), 'right,forward');
assert.equal(board.remove(-1), false); assert.equal(board.insert(0.5, 'left'), false);
assert.equal(board.insert(99, 'left'), false); assert.equal(board.insert(0, 'bad'), false);
board.rotateStart(); assert.equal(board.startHeading, 1);
assert(board.run()); assert.equal(board.heading, 1);
assert.equal(board.step(), 'running'); assert.equal(board.heading, 2);
board.stop(); assert.equal(board.result, 'stopped');
assert.equal(board.step(), 'stopped'); assert.equal(board.program.length, 2);
assert(board.run()); assert.equal(board.nextInstruction, 0); assert.equal(board.heading, 1);

// All four edges block movement without wrapping, including east/west row seams.
for (const [start, heading] of [[0, 0], [9, 1], [99, 2], [90, 3]]) {
    const b = new RobotBoard(config);
    if (b.target === start) b.movePiece('star', 1);
    assert(b.movePiece('robot', start));
    for (let i = 0; i < heading; i++) b.rotateStart();
    b.insert(0, 'forward'); b.run();
    assert.equal(b.step(), 'collision'); assert.equal(b.position, start);
    assert.equal(b.nextInstruction, 1);
}
const blocked = new RobotBoard(config);
blocked.toggleObstacle(80); blocked.insert(0, 'forward'); blocked.insert(1, 'right'); blocked.run();
assert.equal(blocked.step(), 'collision'); assert.equal(blocked.position, 90);
assert.equal(blocked.step(), 'collision'); assert.equal(blocked.heading, 0, 'No command runs after a collision');

// An independent coordinate simulation checks complete runs on varied rectangular boards.
let state = 918273;
const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
for (let sample = 0; sample < 400; sample++) {
    const columns = 2 + random(19), rows = 2 + random(19);
    const b = new RobotBoard({ ...config, columns, rows });
    for (let i = 0; i < columns * rows / 4; i++) b.toggleObstacle(random(columns * rows));
    for (let i = 0, turns = random(4); i < turns; i++) b.rotateStart();
    const program = Array.from({ length: 1 + random(40) }, () => ['forward', 'left', 'right'][random(3)]);
    program.forEach((instruction, i) => b.insert(i, instruction));
    let x = b.start % columns, y = Math.floor(b.start / columns), direction = b.startHeading, result = 'miss', executed = 0;
    const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const instruction of program) {
        executed++;
        if (instruction === 'left') direction = (direction + 3) % 4;
        else if (instruction === 'right') direction = (direction + 1) % 4;
        else {
            const nx = x + vectors[direction][0], ny = y + vectors[direction][1];
            if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || b.obstacles.has(ny * columns + nx)) { result = 'collision'; break; }
            x = nx; y = ny;
        }
    }
    if (result !== 'collision' && y * columns + x === b.target) result = 'success';
    b.run();
    for (let i = 0; i < program.length && b.result === 'running'; i++) b.step();
    assert.equal(b.result, result); assert.equal(b.position, y * columns + x);
    assert.equal(b.heading, direction); assert.equal(b.nextInstruction, executed);
}
const full = new RobotBoard(config);
for (let i = 0; i < MAX_ROBOT_INSTRUCTIONS; i++) assert(full.insert(i, 'left'));
assert.equal(full.insert(0, 'forward'), false);
for (const dimension of [1, 21, 2.5, '10', NaN, Infinity]) {
    assert.throws(() => validateRobotConfig({ ...config, columns: dimension }));
    assert.throws(() => validateRobotConfig({ ...config, rows: dimension }));
}
for (const duration of [0, 199, 2001, NaN, Infinity, '600']) assert.throws(() => validateRobotConfig({ ...config, stepDuration: duration }));
validateRobotConfig({ columns: 2, rows: 20, stepDuration: 200 });
validateRobotConfig({ columns: 20, rows: 2, stepDuration: 2000 });
console.log('Robot checks passed: design placement, protected squares, insertion/deletion, start heading, retries, final-position success, collisions at every edge, stop, execution locks, 400 independent simulations and settings limits.');
