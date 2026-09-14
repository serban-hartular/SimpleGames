const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/game/logic/FoxBoard.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: moduleExports });
const { FoxBoard } = moduleExports;
const config = { zoom: 5, speeds: { fox: 3, chickenWander: 1.4, chickenFlee: 2.3, dogPatrol: 1.8, dogChase: 4.2 },
    counts: { chickens: 8, pies: 10, dogs: 3 }, seed: 1 };
for (let seed = 0; seed < 30; seed++) {
    const board = new FoxBoard({ ...config, seed });
    const seen = new Set(['1,1']), queue = [{ x: 1, y: 1 }];
    for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = queue[i].x + dx, y = queue[i].y + dy, key = `${x},${y}`;
        if (board.open(x, y) && !seen.has(key)) { seen.add(key); queue.push({ x, y }); }
    }
    for (const item of [...board.chickens, ...board.pies, ...board.dogs]) assert(seen.has(`${item.x},${item.y}`));
    assert.equal(board.chickens.length, 8); assert.equal(board.pies.length, 10); assert.equal(board.dogs.length, 3);
    for (let step = 0; step < 1000; step++) board.step(1 / 120);
    for (const dog of board.dogs) {
        assert(dog.x >= dog.start.x && dog.x <= dog.end.x && dog.y >= dog.start.y && dog.y <= dog.end.y);
        assert(board.open(Math.round(dog.x), Math.round(dog.y)));
    }
}
function fixture() {
    const b = new FoxBoard({ ...config, counts: { chickens: 0, pies: 1, dogs: 0 } });
    for (let y = 1; y < b.height - 1; y++) for (let x = 1; x < b.width - 1; x++) b.walls[y][x] = false;
    b.fox.x = 5; b.fox.y = 5; return b;
}
const sight = fixture(); assert(sight.sees({ x: 2, y: 5 }, sight.fox));
sight.walls[5][3] = true; assert(!sight.sees({ x: 2, y: 5 }, sight.fox));
assert(!sight.sees({ x: 2, y: 4 }, sight.fox));
const chicken = fixture(); chicken.chickens.push({ x: 7, y: 5, direction: { x: 0, y: 0 } });
chicken.step(1 / 120); assert(chicken.chickens[0].target.x > 7);
const patrol = fixture(); patrol.fox.x = 10; patrol.fox.y = 5;
patrol.dogs.push({ x: 3, y: 5, direction: { x: 1, y: 0 }, start: { x: 2, y: 5 }, end: { x: 8, y: 5 }, chasing: false });
patrol.step(1 / 120); assert(!patrol.dogs[0].chasing);
patrol.fox.x = 7; patrol.step(1 / 120); assert(patrol.dogs[0].chasing);
const loss = fixture(); loss.dogs.push({ x: 5, y: 5, direction: { x: 1, y: 0 }, start: { x: 2, y: 5 }, end: { x: 8, y: 5 }, chasing: false });
loss.step(1 / 120); assert(loss.ended && !loss.won);
const win = fixture(); win.pies[0] = { x: 5, y: 5 }; win.step(1 / 120); assert(win.ended && win.won); assert.equal(win.caughtPies, 1);
const control = fixture(); control.steer(100, -20); control.step(1 / 120); assert(control.fox.x > 5); assert.equal(control.fox.y, 5);
assert.equal(JSON.stringify(new FoxBoard(config)), JSON.stringify(new FoxBoard(config)));
console.log('Fox tests passed: 30 connected mazes, configured counts, patrol confinement, sightlines, fleeing, chase territory, controls, win/loss, reproducible seeds.');
const fleeing = fixture();
fleeing.chickens.push({ x: 7, y: 5, direction: { x: 0, y: 0 } });
fleeing.step(1 / 120);
assert(fleeing.chickens[0].fleeing);
assert(fleeing.events.includes('chickenAlert'));
assert(Math.abs(fleeing.chickens[0].x - 7 - config.speeds.chickenFlee / 120) < 1e-8);
fleeing.step(1 / 120); assert(!fleeing.events.includes('chickenAlert'));
fleeing.fox.y = 6; const previousX = fleeing.chickens[0].x;
fleeing.step(1 / 120); assert(!fleeing.chickens[0].fleeing);
assert(Math.abs(fleeing.chickens[0].x - previousX - config.speeds.chickenWander / 120) < 1e-8);
fleeing.fox.y = 5; fleeing.step(1 / 120); assert(fleeing.events.includes('chickenAlert'));
const barking = fixture(); barking.dogs.push({ x: 8, y: 5, direction: { x: -1, y: 0 }, start: { x: 2, y: 5 }, end: { x: 9, y: 5 }, chasing: false });
barking.step(1 / 120); assert(barking.events.includes('dogAlert'));
barking.step(1 / 120); assert(!barking.events.includes('dogAlert'));
assert(win.events.includes('eatPie'));
const catchBird = fixture(); catchBird.chickens.push({ x: 5, y: 5, direction: { x: 0, y: 0 } });
catchBird.step(1 / 120); assert(catchBird.events.includes('catchChicken'));
console.log('Flee/wander speeds and one-shot sighting/collection events passed.');

for (let zoom = 1; zoom <= 10; zoom++) {
    for (let seed = 0; seed < 5; seed++) {
        const b = new FoxBoard({ ...config, zoom, seed, counts: { chickens: 'auto', pies: 'auto', dogs: 'auto' } });
        assert.equal(b.height, 7 + 2 * zoom); assert.equal(b.width % 2, 1);
        assert(b.chickens.length > 0 && b.pies.length > 0);
        assert(b.chickens.every(p => b.open(p.x, p.y)));
    }
}
const explicit = new FoxBoard({ ...config, zoom: 1, counts: { chickens: 2, pies: 3, dogs: 0 } });
assert.equal(explicit.chickens.length, 2); assert.equal(explicit.pies.length, 3); assert.equal(explicit.dogs.length, 0);
assert.throws(() => new FoxBoard({ ...config, zoom: 0 }));
assert.throws(() => new FoxBoard({ ...config, counts: { chickens: 9999, pies: 1, dogs: 0 } }));
console.log('All 10 zoom levels, auto populations, explicit counts and invalid settings passed.');
const stopped = fixture();
stopped.pies[0] = { x: 20, y: 10 };
stopped.steer(1, 0); stopped.step(0.1);
const beforeStop = { x: stopped.fox.x, y: stopped.fox.y };
assert(beforeStop.x > 5 && beforeStop.x < 6);
stopped.stop();
for (let i = 0; i < 120; i++) stopped.step(1 / 120);
assert.equal(stopped.fox.x, beforeStop.x); assert.equal(stopped.fox.y, beforeStop.y);
stopped.steer(0, 1);
for (let i = 0; i < 80; i++) stopped.step(1 / 120);
assert.equal(stopped.fox.x, 5);
assert(stopped.fox.y > 5);
console.log('Fox stop/resume mid-cell regression passed.');

const blockedStop = fixture();
blockedStop.pies[0] = { x: 20, y: 10 };
blockedStop.steer(1, 0); blockedStop.step(0.1); blockedStop.stop();
blockedStop.walls[6][5] = true;
blockedStop.steer(0, 1); blockedStop.step(0.1);
assert.equal(blockedStop.fox.x, 5.3);
assert(blockedStop.foxStopped);
blockedStop.steer(-1, 0); blockedStop.step(0.1);
assert(blockedStop.fox.x < 5);
assert.equal(blockedStop.fox.y, 5);
console.log('Stopped turns, reversals and blocked turns passed.');
