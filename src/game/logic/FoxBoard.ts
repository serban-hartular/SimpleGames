export type Point = { x: number; y: number };
export type FoxSettings = {
    zoom: number;
    speeds: { fox: number; chickenWander: number; chickenFlee: number; dogPatrol: number; dogChase: number };
    counts: { chickens: number | 'auto'; pies: number | 'auto'; dogs: number | 'auto' };
    seed: number | null;
};
export type Actor = Point & { target?: Point; direction: Point; caught?: boolean; fleeing?: boolean; seesFox?: boolean };
export type Dog = Actor & { start: Point; end: Point; chasing: boolean };
const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export class FoxBoard {
    readonly width: number;
    readonly height: number;
    readonly walls: boolean[][];
    readonly fox: Actor = { x: 1, y: 1, direction: { x: 0, y: 0 } };
    readonly chickens: Actor[] = [];
    readonly pies: (Point & { caught?: boolean })[] = [];
    readonly dogs: Dog[] = [];
    readonly events: ('eatPie' | 'catchChicken' | 'chickenAlert' | 'dogAlert')[] = [];
    caughtChickens = 0;
    caughtPies = 0;
    ended = false;
    won = false;
    foxStopped = false;
    private desired = { x: 0, y: 0 };
    private state: number;

    constructor(readonly config: FoxSettings) {
        const { speeds, counts } = config;
        if (!Number.isInteger(config.zoom) || config.zoom < 1 || config.zoom > 10) throw new Error('Fox zoom must be an integer from 1 to 10.');
        this.height = 7 + 2 * config.zoom;
        this.width = 2 * Math.round((this.height * 800 / 544 - 1) / 2) + 1;
        this.walls = Array.from({ length: this.height }, () => Array<boolean>(this.width).fill(true));
        if (Object.values(speeds).some(v => !Number.isFinite(v) || v <= 0 || v > 20)
            || speeds.chickenWander >= speeds.chickenFlee || speeds.chickenFlee >= speeds.fox || speeds.dogChase <= speeds.fox) {
            throw new Error('Fox speeds must be in (0,20]; chickenWander < chickenFlee < fox, dog chase faster than fox.');
        }
        if (Object.values(counts).some(v => v !== 'auto' && (!Number.isInteger(v) || v < 0))) {
            throw new Error('Fox counts must be "auto" or nonnegative integers.');
        }
        if (config.seed !== null && !Number.isInteger(config.seed)) throw new Error('Fox seed must be an integer or null.');
        this.state = (config.seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
        this.generateMaze();
        const free: Point[] = [];
        for (let y = 1; y < this.height - 1; y++) for (let x = 1; x < this.width - 1; x++) {
            if (!this.walls[y][x] && x + y > 5) free.push({ x, y });
        }
        // Scale density from the baseline maze; explicit counts are never silently reduced.
        const density = ((this.width - 1) * (this.height - 1)) / (24 * 16);
        const dogCount = counts.dogs === 'auto' ? Math.max(1, Math.round(3 * density)) : counts.dogs;
        const segments: { start: Point; end: Point }[] = [];
        for (const axis of ['x', 'y'] as const) {
            for (const p of free) {
                const dx = axis === 'x' ? 1 : 0, dy = axis === 'y' ? 1 : 0;
                if (this.open(p.x - dx, p.y - dy)) continue;
                let end = { ...p };
                while (this.open(end.x + dx, end.y + dy)) end = { x: end.x + dx, y: end.y + dy };
                if (Math.abs(end.x - p.x) + Math.abs(end.y - p.y) >= 3) segments.push({ start: p, end });
            }
        }
        this.shuffle(segments);
        for (const segment of segments) {
            if (this.dogs.length >= dogCount) break;
            if (this.dogs.some(d => this.onSegment(segment.start, d.start, d.end)
                || this.onSegment(segment.end, d.start, d.end)
                || this.onSegment(d.start, segment.start, segment.end))) continue;
            this.dogs.push({ ...segment.start, ...segment, direction: { x: 0, y: 0 }, chasing: false });
        }
        if (counts.dogs !== 'auto' && this.dogs.length < dogCount) throw new Error('Not enough patrol corridors for this dog count/seed. Reduce dogs or change seed.');
        this.shuffle(free);
        const available = free.filter(p => !this.dogs.some(d => d.x === p.x && d.y === p.y));
        const explicit = (counts.chickens === 'auto' ? 0 : counts.chickens) + (counts.pies === 'auto' ? 0 : counts.pies);
        if (explicit > available.length) throw new Error('Explicit chicken/pie counts exceed the space in this maze.');
        let chickens = counts.chickens === 'auto' ? Math.max(1, Math.round(8 * density)) : counts.chickens;
        let pies = counts.pies === 'auto' ? Math.max(1, Math.round(10 * density)) : counts.pies;
        const spare = available.length - explicit;
        if (counts.chickens === 'auto' && counts.pies === 'auto' && chickens + pies > spare) {
            chickens = Math.round(spare * chickens / (chickens + pies)); pies = spare - chickens;
        } else {
            if (counts.chickens === 'auto') chickens = Math.min(chickens, spare);
            if (counts.pies === 'auto') pies = Math.min(pies, spare);
        }
        if (chickens + pies === 0) throw new Error('Configure at least one chicken or pie.');
        for (let i = 0; i < chickens; i++) this.chickens.push({ ...available.pop()!, direction: { x: 0, y: 0 } });
        for (let i = 0; i < pies; i++) this.pies.push(available.pop()!);
    }

    private random(): number { this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0; return this.state / 4294967296; }
    private shuffle<T>(items: T[]): void {
        for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    }
    open(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height && !this.walls[y][x]; }
    private generateMaze(): void {
        const stack = [{ x: 1, y: 1 }]; this.walls[1][1] = false;
        while (stack.length) {
            const p = stack[stack.length - 1], choices = [...directions]; this.shuffle(choices);
            const d = choices.find(d => p.x + d.x * 2 > 0 && p.x + d.x * 2 < this.width - 1
                && p.y + d.y * 2 > 0 && p.y + d.y * 2 < this.height - 1 && this.walls[p.y + d.y * 2][p.x + d.x * 2]);
            if (!d) { stack.pop(); continue; }
            this.walls[p.y + d.y][p.x + d.x] = false;
            const next = { x: p.x + d.x * 2, y: p.y + d.y * 2 }; this.walls[next.y][next.x] = false; stack.push(next);
        }
        // Add loops so patrols have alternate routes around them.
        for (let y = 1; y < this.height - 1; y++) for (let x = 1; x < this.width - 1; x++) {
            if (this.walls[y][x] && this.random() < 0.18 &&
                ((this.open(x - 1, y) && this.open(x + 1, y)) || (this.open(x, y - 1) && this.open(x, y + 1)))) this.walls[y][x] = false;
        }
    }
    stop(): void { this.foxStopped = true; }
    steer(dx: number, dy: number): void {
        if (!dx && !dy) return;
        const direction = Math.abs(dx) >= Math.abs(dy)
            ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
        if (this.foxStopped && (direction.x !== this.fox.direction.x || direction.y !== this.fox.direction.y)) {
            const x = Math.round(this.fox.x), y = Math.round(this.fox.y);
            // A blocked turn leaves the fox stopped instead of resuming its old heading.
            if (!this.open(x + direction.x, y + direction.y)) return;
            this.fox.x = x; this.fox.y = y;
            this.fox.target = undefined;
            this.fox.direction = direction;
        }
        this.desired = direction;
        this.foxStopped = false;
    }
    sees(a: Point, b: Point): boolean {
        const horizontal = Math.abs(a.y - b.y) < 0.01, vertical = Math.abs(a.x - b.x) < 0.01;
        if (!horizontal && !vertical) return false;
        const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 4);
        for (let i = 0; i <= steps; i++) {
            const t = steps ? i / steps : 0;
            if (!this.open(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t))) return false;
        }
        return true;
    }
    private onSegment(p: Point, start: Point, end: Point): boolean {
        return p.x >= start.x - 0.01 && p.x <= end.x + 0.01 && p.y >= start.y - 0.01 && p.y <= end.y + 0.01;
    }
    private move(actor: Actor, speed: number, dt: number, choose: () => Point | undefined): void {
        if (!actor.target) actor.target = choose();
        if (!actor.target) return;
        const dx = actor.target.x - actor.x, dy = actor.target.y - actor.y, distance = Math.hypot(dx, dy);
        actor.direction = { x: Math.sign(dx), y: Math.sign(dy) };
        const travel = Math.min(distance, speed * dt);
        if (distance > 0) { actor.x += dx / distance * travel; actor.y += dy / distance * travel; }
        if (travel >= distance - 1e-8) { actor.x = actor.target.x; actor.y = actor.target.y; actor.target = undefined; }
    }
    step(dt: number): void {
        this.events.length = 0;
        if (this.ended) return;
        // Preserve the current segment so resuming mid-cell stays on the maze grid.
        if (!this.foxStopped) this.move(this.fox, this.config.speeds.fox, dt, () => {
            const p = this.fox;
            const d = this.open(p.x + this.desired.x, p.y + this.desired.y) ? this.desired : p.direction;
            return (d.x || d.y) && this.open(p.x + d.x, p.y + d.y) ? { x: p.x + d.x, y: p.y + d.y } : undefined;
        });
        for (const chicken of this.chickens) if (!chicken.caught) {
            const fleeing = this.sees(chicken, this.fox);
            if (fleeing && !chicken.fleeing) this.events.push('chickenAlert');
            chicken.fleeing = fleeing;
            this.move(chicken, fleeing ? this.config.speeds.chickenFlee : this.config.speeds.chickenWander, dt, () => {
                const options = directions.map(d => ({ x: chicken.x + d.x, y: chicken.y + d.y })).filter(p => this.open(p.x, p.y));
                this.shuffle(options);
                if (chicken.fleeing) options.sort((a, b) => Math.hypot(b.x - this.fox.x, b.y - this.fox.y) - Math.hypot(a.x - this.fox.x, a.y - this.fox.y));
                return options[0];
            });
        }
        for (const dog of this.dogs) {
            const seesFox = this.sees(dog, this.fox);
            if (seesFox && !dog.seesFox) this.events.push('dogAlert');
            dog.seesFox = seesFox;
            dog.chasing = this.onSegment(this.fox, dog.start, dog.end) && this.sees(dog, this.fox);
            this.move(dog, dog.chasing ? this.config.speeds.dogChase : this.config.speeds.dogPatrol, dt, () => {
                const horizontal = dog.start.y === dog.end.y;
                let sign = horizontal ? dog.direction.x : dog.direction.y;
                if (dog.chasing) sign = Math.sign(horizontal ? this.fox.x - dog.x : this.fox.y - dog.y);
                else if (!sign || !this.onSegment({ x: dog.x + (horizontal ? sign : 0), y: dog.y + (horizontal ? 0 : sign) }, dog.start, dog.end)) sign = sign ? -sign : 1;
                const p = { x: dog.x + (horizontal ? sign : 0), y: dog.y + (horizontal ? 0 : sign) };
                return this.onSegment(p, dog.start, dog.end) ? p : undefined;
            });
            if (Math.hypot(dog.x - this.fox.x, dog.y - this.fox.y) < 0.65) { this.ended = true; return; }
        }
        for (const chicken of this.chickens) if (!chicken.caught && Math.hypot(chicken.x - this.fox.x, chicken.y - this.fox.y) < 0.55) { chicken.caught = true; this.caughtChickens++; this.events.push('catchChicken'); }
        for (const pie of this.pies) if (!pie.caught && Math.hypot(pie.x - this.fox.x, pie.y - this.fox.y) < 0.5) { pie.caught = true; this.caughtPies++; this.events.push('eatPie'); }
        if (this.caughtChickens === this.chickens.length && this.caughtPies === this.pies.length) { this.won = true; this.ended = true; }
    }
}
