const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript'), assert = require('node:assert/strict');
const cache = new Map();
function display() {
    const target = Object.assign(new EventEmitter(), { x: 0, y: 0, angle: 0, alpha: 1, input: { enabled: false }, text: '' });
    const object = new Proxy(target, {
        get: (target, name) => {
            if (['on', 'emit', 'listenerCount'].includes(name)) return target[name].bind(target);
            if (['x', 'y', 'angle', 'alpha', 'input', 'text'].includes(name)) return target[name];
            if (name === 'setPosition') return (x,y) => { target.x=x; target.y=y; return object; };
            if (name === 'setAngle') return angle => { target.angle=((angle+180)%360+360)%360-180; return object; };
            if (name === 'setAlpha') return alpha => { target.alpha=alpha; return object; };
            if (name === 'setText') return text => { target.text=text; return object; };
            if (name === 'setInteractive' || name === 'disableInteractive') return () => { target.input.enabled=name==='setInteractive'; return object; };
            return () => object;
        }
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
        this.cameras = { main: { setBackgroundColor() {}, shake() {} } };
        this.rectangles = [];
        this.add = { text: display, graphics: display, star: display, rectangle: () => {
            const object = display(); this.rectangles.push(object); return object;
        } };
        this.restarts = 0; this.destinationScene = null;
        this.scene = { restart: () => this.restarts++, start: key => this.destinationScene = key };
        this.pendingTweens = [];
        this.tweens = {
            add: config => this.pendingTweens.push(config),
            killTweensOf: target => { this.pendingTweens = this.pendingTweens.filter(tween => tween.targets !== target); }
        };
    }
    finishTween() {
        const tween = this.pendingTweens.shift(); assert(tween, 'Expected an animation');
        for (const key of ['x','y','angle','alpha']) if (typeof tween[key] === 'number') tween.targets[key] = tween[key];
        tween.onComplete();
        return tween;
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
        return load(path.resolve(path.dirname(filename), p + '.ts'));
    } });
    return exports;
}
const { StreetBoard } = load('src/game/logic/StreetBoard.ts');
const heading = (board, from, to) => {
    const a = board.coordinates(from), b = board.coordinates(to);
    return b.y < a.y ? 0 : b.x > a.x ? 1 : b.y > a.y ? 2 : 3;
};
function drivePath(board, path) {
    for (const to of path) {
        const wanted = heading(board, board.position, to);
        while (board.heading !== wanted) board.turn(1);
        assert.equal(board.forward(), to === board.destination ? 'won' : 'moved');
        assert.equal(board.position, to);
    }
}
const branchDepths = [], meanChoices = [];
function reachable(adjacency, from) {
    const seen = new Set([from]), queue = [from];
    for (let i = 0; i < queue.length; i++) for (const to of adjacency[queue[i]]) {
        if (!seen.has(to)) { seen.add(to); queue.push(to); }
    }
    return seen;
}
for (let difficulty = 1; difficulty <= 5; difficulty++) {
    let totalDepth = 0, totalChoices = 0, interiorStarts = 0, interiorGoals = 0;
    const starts = new Set(), goals = new Set();
    for (let seed = 0; seed < 50; seed++) {
        const board = new StreetBoard({ difficulty, seed });
        const dimensions = [[5,4],[5,4],[6,4],[6,5],[7,5]][difficulty - 1];
        assert.equal(board.width, dimensions[0]); assert.equal(board.height, dimensions[1]);
        assert.notEqual(board.start, board.destination); assert.equal(board.seed, seed);
        const count = board.width * board.height, active = new Set(board.roadSquares);
        assert.equal(active.size, board.roadSquares.length, 'No overlapping embedded nodes');
        assert(active.size < count, 'Sparse network leaves some map squares empty');
        assert(active.has(board.start) && active.has(board.destination));
        for (const cell of active) assert(Number.isInteger(cell) && cell >= 0 && cell < count);
        const legal = Array.from({ length: count }, () => []), reverse = Array.from({ length: count }, () => []);
        const physical = Array.from({ length: count }, () => []), seenEdges = new Set();
        for (const street of board.streets) {
            const a = board.coordinates(street.a), b = board.coordinates(street.b);
            assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y), 1, 'Embedded roads remain orthogonal, one square per step');
            assert(active.has(street.a) && active.has(street.b));
            const edgeKey = [street.a, street.b].sort((a,b)=>a-b).join(':');
            assert(!seenEdges.has(edgeKey), 'No duplicate edges'); seenEdges.add(edgeKey);
            physical[street.a].push(street.b); physical[street.b].push(street.a);
            legal[street.a].push(street.b); reverse[street.b].push(street.a);
            if (!street.oneWay) { legal[street.b].push(street.a); reverse[street.a].push(street.b); }
        }
        assert(board.streets.some(edge => edge.oneWay)); assert(board.streets.some(edge => !edge.oneWay));
        assert.equal(reachable(legal, board.start).size, active.size, 'Every road square is legally reachable');
        assert.equal(reachable(reverse, board.destination).size, active.size, 'Every road square has a legal escape to the goal');
        // Enumerate simple routes independently: loops and backtracking cannot
        // count as another successful route. The two genuine choices differ in length.
        const solutions = [], visited = new Set([board.start]);
        function search(cell, path) {
            if (cell === board.destination) { solutions.push([...path]); return; }
            for (const to of legal[cell]) if (!visited.has(to)) {
                visited.add(to); path.push(to); search(to, path); path.pop(); visited.delete(to);
            }
        }
        search(board.start, []);
        assert(solutions.length >= 2, 'Multiple distinct simple legal routes');
        assert(new Set(solutions.map(route=>route.length)).size >= 2, 'Shorter and longer successful routes');
        const distance = new Map([[board.destination,0]]), queue = [board.destination];
        for (let i=0;i<queue.length;i++) for (const from of reverse[queue[i]]) if (!distance.has(from)) {
            distance.set(from,distance.get(queue[i])+1); queue.push(from);
        }
        const goal = board.coordinates(board.destination), start = board.coordinates(board.start);
        const geometric = cell => { const p=board.coordinates(cell); return (p.x-goal.x)**2+(p.y-goal.y)**2; };
        const manhattan = Math.abs(start.x-goal.x)+Math.abs(start.y-goal.y);
        assert(distance.get(board.start)-manhattan >= (difficulty >= 4 ? 4 : 2), 'Physical proximity understates the real driving distance');
        let misleading = 0;
        for (const cell of active) if (legal[cell].length >= 2 && (cell === board.start || legal[cell].length >= 3)) {
            if (legal[cell].some(a=>legal[cell].some(b=>geometric(a)<geometric(b)&&distance.get(a)>distance.get(b)))) misleading++;
        }
        assert(misleading >= 1, 'A geometrically nearer choice can leave a longer legal route');
        totalChoices += misleading;
        const ends = [...active].filter(cell=>physical[cell].length===1);
        assert(ends.length >= 2, 'Some branches end without reaching the target');
        let longestBranch = 0;
        for (const leaf of ends) {
            assert.notEqual(leaf, board.destination);
            let previous=leaf, next=physical[leaf][0], length=1;
            assert(legal[leaf].includes(next) && legal[next].includes(leaf), 'Dead ends allow legal backtracking');
            while (physical[next].length===2) {
                const ahead=physical[next].find(to=>to!==previous);
                assert(legal[next].includes(ahead) && legal[ahead].includes(next));
                previous=next; next=ahead; length++;
            }
            longestBranch=Math.max(longestBranch,length);
        }
        assert(longestBranch >= 1+Math.floor((difficulty-1)/2), 'Harder searches have deeper branches');
        totalDepth += longestBranch;
        starts.add(board.start); goals.add(board.destination);
        if (start.x>0 && start.x<board.width-1 && start.y>0 && start.y<board.height-1) interiorStarts++;
        if (goal.x>0 && goal.x<board.width-1 && goal.y>0 && goal.y<board.height-1) interiorGoals++;
        drivePath(board, solutions[0]); assert(board.won); assert.equal(board.moves, solutions[0].length);
        const finalHeading=board.heading; board.turn(1); assert.equal(board.heading,finalHeading);
        assert.equal(board.forward(),'finished'); assert.equal(board.position,board.destination);
        board.retry(); assert.equal(board.position,board.start); assert.equal(board.heading,board.startHeading);
        assert.equal(board.moves,0); assert.equal(board.resets,0); assert(!board.won);
        drivePath(board,solutions[1]); assert(board.won);
    }
    assert(starts.size>=6 && goals.size>=6, 'Seeds vary both endpoint locations');
    assert(interiorStarts>0 && interiorGoals>0, 'Both endpoints can be inside the map');
    branchDepths.push(totalDepth/50); meanChoices.push(totalChoices/50);
}
assert(branchDepths[4]>=branchDepths[0]+2, 'Difficulty increases planning depth');
assert(meanChoices[4]>meanChoices[0], 'Harder layouts contain more misleading choices');
// Generation must stay bounded and playable even with an unhelpful random
// stream, including its deterministic fallback rather than endless retries.
const { generateStreetNetwork } = load('src/game/logic/StreetNetwork.ts');
for (const randomValue of [0, 0.999999999]) for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const [width,height] = [[5,4],[5,4],[6,4],[6,5],[7,5]][difficulty-1];
    const network = generateStreetNetwork(width,height,difficulty,()=>randomValue);
    const legal = Array.from({ length:width*height },()=>[]);
    assert.equal(new Set(network.roadSquares).size,network.roadSquares.length);
    for (const edge of network.streets) {
        assert.equal(Math.abs(edge.a%width-edge.b%width)+Math.abs(Math.floor(edge.a/width)-Math.floor(edge.b/width)),1);
        legal[edge.a].push(edge.b); if (!edge.oneWay) legal[edge.b].push(edge.a);
    }
    assert.equal(reachable(legal,network.start).size,network.roadSquares.length);
    assert(reachable(legal,network.destination).has(network.start), 'A legal return remains possible');
    const distance = new Map([[network.destination,0]]), queue = [network.destination];
    for (let i=0;i<queue.length;i++) for (const from of network.roadSquares) {
        if (!distance.has(from) && legal[from].includes(queue[i])) { distance.set(from,distance.get(queue[i])+1); queue.push(from); }
    }
    const goal=network.destination;
    const geometric=cell=>(cell%width-goal%width)**2+(Math.floor(cell/width)-Math.floor(goal/width))**2;
    assert(network.roadSquares.some(cell=>legal[cell].length>=2&&(cell===network.start||legal[cell].length>=3)
        &&legal[cell].some(a=>legal[cell].some(b=>geometric(a)<geometric(b)&&distance.get(a)>distance.get(b)))),
        'Even bounded fallback layouts contain a misleading fork');
}
for (const seed of [0, 1, 4294967295]) {
    assert.equal(JSON.stringify(new StreetBoard({ difficulty: 3, seed })),
        JSON.stringify(new StreetBoard({ difficulty: 3, seed })), 'Repeatable seeds, including endpoints');
}
const randomBoard = new StreetBoard({ difficulty: 2, seed: null });
assert.equal(JSON.stringify(randomBoard), JSON.stringify(new StreetBoard({ difficulty: 2, seed: randomBoard.seed })));
for (const difficulty of [0, 6, -1, 2.5, NaN, Infinity, '2']) {
    assert.throws(() => new StreetBoard({ difficulty, seed: 1 }));
}
for (const seed of [-1, 4294967296, 2.5, NaN, Infinity, undefined, '1']) {
    assert.throws(() => new StreetBoard({ difficulty: 2, seed }));
}
const board = new StreetBoard({ difficulty: 3, seed: 42 });
const initial = board.position;
board.turn(-1); assert.equal(board.heading, (board.startHeading + 3) % 4); assert.equal(board.position, initial);
board.turn(1); assert.equal(board.heading, board.startHeading);
for (const edge of board.streets) {
    for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
        board.won = false; board.position = from; board.heading = heading(board, from, to);
        const moves = board.moves, resets = board.resets;
        const result = board.forward();
        if (edge.oneWay && from === edge.b) {
            assert.equal(result, 'wrong-way');
            assert.equal(board.position, board.start); assert.equal(board.heading, board.startHeading);
            assert.equal(board.resets, resets + 1); assert.equal(board.moves, moves);
        } else {
            assert.equal(board.position, to); assert.equal(board.moves, moves + 1);
            assert.equal(board.resets, resets);
        }
    }
}
// Boundaries never wrap. Missing interior street segments also block without penalty.
for (let cell = 0; cell < board.width * board.height; cell++) {
    for (let direction = 0; direction < 4; direction++) {
        const p = board.coordinates(cell), d = [[0,-1],[1,0],[0,1],[-1,0]][direction];
        const x = p.x + d[0], y = p.y + d[1];
        if (x >= 0 && x < board.width && y >= 0 && y < board.height && board.streetBetween(cell, y*board.width+x)) continue;
        board.won = false; board.position = cell; board.heading = direction;
        const resets = board.resets, moves = board.moves;
        assert.equal(board.forward(), 'blocked'); assert.equal(board.position, cell);
        assert.equal(board.resets, resets); assert.equal(board.moves, moves);
    }
}
const { streetsConfig } = load('src/game/config/streets.ts'); streetsConfig.seed = 1;
const { StreetsGame } = load('src/game/scenes/StreetsGame.ts');
const game = new StreetsGame();
game.create();
const buttons = game.rectangles.filter(rectangle => rectangle.listenerCount('pointerdown') > 0);
assert.equal(buttons.length, 6);
const key = (key, repeat = false) => game.input.keyboard.emit('keydown', { key, repeat });
const pose = () => [game.board.position, game.board.heading, game.board.moves, game.board.resets];
const controlsEnabled = enabled => {
    assert.equal(game.animating, !enabled);
    for (const { background, label } of game.controls) {
        assert.equal(background.input.enabled, enabled);
        assert.equal(background.alpha, enabled ? 1 : 0.5);
        assert.equal(label.alpha, enabled ? 1 : 0.5);
    }
};
// A legal move changes the board once, but the car stays at its old visual
// position until the tween finishes. All six buttons and keyboard actions lock.
const initialCar = [game.car.x, game.car.y], initialHeading = game.board.heading;
key('ArrowUp');
assert.equal(game.board.moves, 1); assert.equal(game.board.heading, initialHeading);
assert.deepEqual([game.car.x, game.car.y], initialCar);
assert.equal(game.pendingTweens.length, 1); controlsEnabled(false);
const movingPose = pose();
for (const name of ['ArrowUp','ArrowLeft','ArrowRight']) key(name);
for (const button of buttons) button.emit('pointerdown');
assert.deepEqual(pose(), movingPose); assert.equal(game.pendingTweens.length, 1);
assert.equal(game.restarts, 0); assert.equal(game.destinationScene, null);
const moveTween = game.finishTween();
assert(moveTween.duration > 0);
const arrival = game.point(game.board.position);
assert.deepEqual([game.car.x, game.car.y], [arrival.x, arrival.y]); controlsEnabled(true);
assert.equal(game.pendingTweens.length, 0, 'Inputs while busy are discarded');
for (const name of ['ArrowUp','ArrowLeft','ArrowRight']) key(name, true);
key('ArrowDown'); key('x'); assert.equal(game.pendingTweens.length, 0);
// Both turns animate in place, including the north/west wrap: always 90°.
for (const direction of [1,-1,1,1,1,1,-1,-1,-1,-1]) {
    const before = pose(), angle = game.car.angle;
    key(direction === 1 ? 'ArrowRight' : 'ArrowLeft'); controlsEnabled(false);
    assert.equal(game.board.position, before[0]);
    assert.equal(game.board.heading, (before[1]+direction+4)%4);
    assert.equal(game.car.angle, angle);
    assert.equal(game.pendingTweens[0].angle-angle, direction*90);
    key('ArrowUp'); assert.equal(game.board.moves, before[2]);
    game.finishTween(); controlsEnabled(true);
    assert.equal((game.car.angle+360)%360, game.board.heading*90);
}
// The same animation locks apply to pointer steering.
buttons[2].emit('pointerdown'); controlsEnabled(false);
const pointerPose = pose(); buttons[1].emit('pointerdown'); buttons[0].emit('pointerdown');
assert.deepEqual(pose(), pointerPose); game.finishTween();
buttons[1].emit('pointerdown'); controlsEnabled(false); game.finishTween(); controlsEnabled(true);
// Wrong-way resets fade out, relocate, then fade in. The entire sequence locks.
const edge = game.board.streets.find(street => street.oneWay);
game.board.position = edge.b; game.board.heading = heading(game.board, edge.b, edge.a); game.refresh();
const wrongPosition = [game.car.x, game.car.y], resetsBefore = game.board.resets;
key('ArrowUp'); controlsEnabled(false);
assert.equal(game.board.position, game.board.start); assert.equal(game.board.resets, resetsBefore+1);
assert.deepEqual([game.car.x, game.car.y], wrongPosition);
game.finishTween(); controlsEnabled(false);
assert.equal(game.car.alpha, 0);
const startPoint = game.point(game.board.start);
assert.deepEqual([game.car.x, game.car.y], [startPoint.x, startPoint.y]);
key('ArrowRight'); assert.equal(game.board.heading, game.board.startHeading);
game.finishTween(); controlsEnabled(true); assert.equal(game.car.alpha, 1);
// A blocked action does not start a movement or lock the controls.
game.board.position = 0; game.board.heading = 0; game.refresh();
key('ArrowUp'); assert.equal(game.pendingTweens.length, 0); controlsEnabled(true);
assert.equal(game.board.position, 0);
// Winning is announced only once the car visibly reaches the star.
const goalNeighbor = game.board.neighbors(game.board.destination).find(from => game.board.canTravel(from, game.board.destination));
game.board.position = goalNeighbor; game.board.heading = heading(game.board, goalNeighbor, game.board.destination); game.refresh();
key('ArrowUp'); assert(game.board.won); controlsEnabled(false);
assert.notEqual(game.status.text, 'YOU WIN! Destination reached.');
game.finishTween(); controlsEnabled(true); assert.equal(game.status.text, 'YOU WIN! Destination reached.');
key('ArrowLeft'); assert.equal(game.pendingTweens.length, 0);
buttons[3].emit('pointerdown'); assert.equal(game.board.position, game.board.start); assert(!game.board.won);
buttons[4].emit('pointerdown'); assert.equal(game.restarts, 1);
buttons[5].emit('pointerdown'); assert.equal(game.destinationScene, 'MainMenu');
// Shutdown cancels an unfinished animation and removes keyboard captures.
key('ArrowRight'); assert.equal(game.pendingTweens.length, 1);
assert.equal(game.input.keyboard.captures.size, 3);
game.events.emit('shutdown');
assert.equal(game.pendingTweens.length, 0); assert.equal(game.animating, false);
assert.equal(game.input.keyboard.listenerCount('keydown'), 0);
assert.equal(game.input.keyboard.captures.size, 0);
game.create(); controlsEnabled(true); assert.equal(game.controls.length, 6);
game.events.emit('shutdown');
console.log('Street checks passed: 250 embedded route graphs, unequal solutions, misleading distances, varied endpoints, recoverable dead ends, seeds, animated driving/turning/reset, input locks, victory timing and scene cleanup.');
