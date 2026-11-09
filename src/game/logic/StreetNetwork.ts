/** Route topology is built before assigning any node to a map square. */
export type Street = { a: number; b: number; oneWay: boolean };
type Branch = { anchor: number; nodes: number[] };
type RoutePlan = { cycleLength: number; shortLength: number; branches: Branch[]; edges: Street[]; count: number };
type Network = { start: number; destination: number; streets: Street[]; roadSquares: number[] };
type Random = () => number;

function shuffled<T>(values: T[], random: Random): T[] {
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

function routePlan(difficulty: number, random: Random): RoutePlan {
    const shortLength = 3 + Math.floor(difficulty / 2) + Math.floor(random() * 2);
    const longLength = shortLength + 2 * (1 + Math.floor(difficulty / 2));
    const cycleLength = shortLength + longLength;
    const edges: Street[] = Array.from({ length: cycleLength }, (_, a) => ({ a, b: (a + 1) % cycleLength, oneWay: false }));
    const branchCount = 2 + Math.floor(difficulty / 3), depth = 1 + Math.floor((difficulty - 1) / 2);
    const anchors = shuffled(Array.from({ length: cycleLength - 1 }, (_, i) => i + 1).filter(i => i !== shortLength), random);
    let count = cycleLength;
    const branches: Branch[] = [];
    for (let i = 0; i < branchCount; i++) {
        const anchor = i === 0 ? 0 : anchors[i - 1];
        const length = i === 0 ? depth : 1 + Math.floor(random() * depth);
        const nodes = Array.from({ length }, () => count++);
        for (let j = 0; j < nodes.length; j++) edges.push({ a: j === 0 ? anchor : nodes[j - 1], b: nodes[j], oneWay: false });
        branches.push({ anchor, nodes });
    }
    // Restrict only the longer arc, in its start-to-goal direction. The shorter
    // arc and every dead end stay two-way, so every square has a legal escape.
    const longEdges = shuffled(Array.from({ length: longLength }, (_, i) => edges[cycleLength - i - 1]), random);
    for (const edge of longEdges.slice(0, 1 + Math.floor((difficulty - 1) / 2))) {
        [edge.a, edge.b] = [edge.b, edge.a]; edge.oneWay = true;
    }
    return { cycleLength, shortLength, branches, edges, count };
}

/** A closed orthogonal walk grows by folding an edge around two free squares. */
function embedCycle(length: number, width: number, height: number, random: Random): number[] | undefined {
    const x = Math.floor(random() * (width - 1)), y = Math.floor(random() * (height - 1));
    const cycle = [y * width + x, y * width + x + 1, (y + 1) * width + x + 1, (y + 1) * width + x];
    const used = new Set(cycle);
    while (cycle.length < length) {
        const folds: { index: number; a: number; b: number }[] = [];
        for (let i = 0; i < cycle.length; i++) {
            const a = cycle[i], b = cycle[(i + 1) % cycle.length];
            const ax = a % width, ay = Math.floor(a / width), bx = b % width, by = Math.floor(b / width);
            for (const side of [-1, 1]) {
                const dx = (by - ay) * side, dy = (ax - bx) * side;
                const nx = ax + dx, ny = ay + dy, mx = bx + dx, my = by + dy;
                const na = ny * width + nx, nb = my * width + mx;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height || mx < 0 || mx >= width || my < 0 || my >= height || used.has(na) || used.has(nb)) continue;
                folds.push({ index: i + 1, a: na, b: nb });
            }
        }
        if (!folds.length) return undefined;
        const fold = folds[Math.floor(random() * folds.length)];
        cycle.splice(fold.index, 0, fold.a, fold.b); used.add(fold.a); used.add(fold.b);
    }
    return cycle;
}

function adjacent(cell: number, width: number, height: number): number[] {
    const x = cell % width, y = Math.floor(cell / width), result: number[] = [];
    if (y > 0) result.push(cell - width);
    if (x < width - 1) result.push(cell + 1);
    if (y < height - 1) result.push(cell + width);
    if (x > 0) result.push(cell - 1);
    return result;
}

function embedBranches(plan: RoutePlan, places: number[], width: number, height: number, random: Random): boolean {
    const used = new Set(places);
    const goal = places[plan.shortLength];
    const geometric = (cell: number) => Math.hypot(cell % width - goal % width, Math.floor(cell / width) - Math.floor(goal / width));
    let budget = 160;
    const place = (index: number): boolean => {
        if (index === plan.branches.length) return true;
        if (--budget < 0) return false;
        const branch = plan.branches[index], paths: number[][] = [];
        const grow = (from: number, path: number[]) => {
            if (path.length === branch.nodes.length) { paths.push([...path]); return; }
            for (const to of adjacent(from, width, height)) {
                if (used.has(to) || path.includes(to)) continue;
                path.push(to); grow(to, path); path.pop();
            }
        };
        grow(places[branch.anchor], []);
        // Prefer leaves near the star, even though they add a trip back to their fork.
        shuffled(paths, random).sort((a, b) => geometric(a[a.length - 1]) - geometric(b[b.length - 1]));
        for (const path of paths) {
            path.forEach((cell, i) => { used.add(cell); places[branch.nodes[i]] = cell; });
            if (place(index + 1)) return true;
            path.forEach(cell => used.delete(cell));
            if (budget < 0) break;
        }
        return false;
    };
    return place(0);
}

/** Rank embeddings by actual legal distance, never by decorative proximity alone. */
function mismatch(plan: RoutePlan, places: number[], width: number): { score: number; choices: number } {
    const incoming: number[][] = Array.from({ length: plan.count }, () => []);
    const outgoing: number[][] = Array.from({ length: plan.count }, () => []);
    for (const edge of plan.edges) {
        outgoing[edge.a].push(edge.b); incoming[edge.b].push(edge.a);
        if (!edge.oneWay) { outgoing[edge.b].push(edge.a); incoming[edge.a].push(edge.b); }
    }
    const distance = new Map([[plan.shortLength, 0]]), queue = [plan.shortLength];
    for (let i = 0; i < queue.length; i++) for (const from of incoming[queue[i]]) {
        if (!distance.has(from)) { distance.set(from, distance.get(queue[i])! + 1); queue.push(from); }
    }
    const goal = places[plan.shortLength];
    const geometric = places.map(cell => (cell % width - goal % width) ** 2 + (Math.floor(cell / width) - Math.floor(goal / width)) ** 2);
    let choices = 0, inversions = 0;
    for (let a = 0; a < plan.count; a++) {
        for (let b = 0; b < plan.count; b++) {
            if (geometric[a] < geometric[b] && distance.get(a)! > distance.get(b)!) inversions++;
        }
        if (outgoing[a].length < 2 || (a !== 0 && outgoing[a].length < 3)) continue;
        if (outgoing[a].some(b => outgoing[a].some(c => geometric[b] < geometric[c] && distance.get(b)! > distance.get(c)!))) choices++;
    }
    return { choices, score: choices * 100 + inversions / plan.count };
}

function materialize(plan: RoutePlan, places: number[]): Network {
    return {
        start: places[0], destination: places[plan.shortLength], roadSquares: [...places],
        streets: plan.edges.map(edge => ({ a: places[edge.a], b: places[edge.b], oneWay: edge.oneWay }))
    };
}

/** Generate bounded route choices, then search for a deliberately misleading layout. */
export function generateStreetNetwork(width: number, height: number, difficulty: number, random: Random): Network {
    let best: Network | undefined, bestScore = -Infinity, bestChoices = 0;
    const minimumDetour = difficulty >= 4 ? 4 : 2;
    const desiredChoices = difficulty >= 4 ? 2 : 1;
    for (let attempt = 0; attempt < 8; attempt++) {
        const plan = routePlan(difficulty, random);
        if (plan.count > width * height - 1) continue;
        for (let layout = 0; layout < 30; layout++) {
            const cycle = embedCycle(plan.cycleLength, width, height, random);
            if (!cycle) continue;
            const origins = shuffled(Array.from({ length: cycle.length }, (_, i) => i), random);
            for (const origin of origins) {
                const direction = random() < 0.5 ? 1 : -1;
                const places = Array.from({ length: cycle.length }, (_, i) => cycle[(origin + direction * i + cycle.length) % cycle.length]);
                const start = places[0], goal = places[plan.shortLength];
                const geometric = Math.abs(start % width - goal % width) + Math.abs(Math.floor(start / width) - Math.floor(goal / width));
                if (plan.shortLength - geometric < minimumDetour || !embedBranches(plan, places, width, height, random)) continue;
                const quality = mismatch(plan, places, width);
                if (quality.score > bestScore) { best = materialize(plan, places); bestScore = quality.score; bestChoices = quality.choices; }
                if (quality.choices >= desiredChoices) return materialize(plan, places);
            }
        }
    }
    if (best && bestChoices > 0) return best;
    // A known folded layout keeps the search bounded even for an unlucky RNG.
    // Its central dead end is one square from the star, behind a missing link.
    const hard = difficulty >= 4;
    const points = hard
        ? [[2,1],[2,0],[3,0],[4,0],[4,1],[3,1],[3,2],[3,3],[3,4],[2,4],[2,3],[1,3],[1,2],[1,1]]
        : [[2,1],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[1,2],[1,1]];
    const places = points.map(([x,y]) => y * width + x), goalIndex = hard ? 6 : 4;
    const streets: Street[] = places.map((a, i) => ({ a, b: places[(i + 1) % places.length], oneWay: false }));
    const restriction = streets[goalIndex];
    [restriction.a, restriction.b] = [restriction.b, restriction.a]; restriction.oneWay = true;
    const branch = (x: number, y: number, cells: number[][]) => {
        let from = y * width + x;
        for (const [nx, ny] of cells) {
            const to = ny * width + nx;
            streets.push({ a: from, b: to, oneWay: false }); places.push(to); from = to;
        }
    };
    branch(1, 2, [[2, 2]]);
    branch(1, 1, [[0,1],[0,2],[0,3]].slice(0, 1 + Math.floor((difficulty - 1) / 2)));
    if (difficulty >= 3) {
        if (hard) branch(4, 1, [[4, 2]]);
        else branch(3, 0, [[4, 0]]);
    }
    return { start: places[0], destination: places[goalIndex], roadSquares: places, streets };
}
