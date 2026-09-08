import { createWind, gyrePotential, Gyre, Wind } from './Navigation';

export type NavigationPort = { name: string; x: number; y: number; dockX: number; dockY: number; radius: number };

export type MapSettings = { seed: number; islandCount: number; landFineness: number; gyres: readonly Gyre[]; offshoreStrength: number; coastalInfluenceDistance: number };

/** Seeded terrain and obstacle-aware circulation on a wrapping grid. */
export class NavigationMap {
    readonly land: boolean[][];
    private readonly continents: boolean[][];
    readonly landFineness: number;
    readonly landColumns: number;
    readonly landRows: number;
    private readonly windLand: boolean[][];
    readonly winds: Wind[][];
    readonly spawn: { x: number; y: number };
    private state: number;
    private readonly gyres: readonly Gyre[];

    constructor(readonly columns: number, readonly rows: number, settings: MapSettings) {
        if (!Number.isInteger(settings.landFineness) || settings.landFineness < 1 || settings.landFineness > 30) {
            throw new Error('landFineness must be an integer from 1 to 30.');
        }
        this.gyres = settings.gyres;
        this.landFineness = settings.landFineness;
        this.landColumns = columns * this.landFineness;
        this.landRows = rows * this.landFineness;
        this.state = settings.seed >>> 0;
        this.land = Array.from({ length: this.landRows }, () => Array<boolean>(this.landColumns).fill(false));
        // Opposing continents frame a navigable central ocean basin.
        this.blob(columns * 0.08, rows * (0.4 + this.random() * 0.2), columns * 0.16, rows * 0.38);
        this.blob(columns * 0.92, rows * (0.4 + this.random() * 0.2), columns * 0.16, rows * 0.38);
        this.continents = this.land.map(row => [...row]);
        for (let i = 0; i < settings.islandCount; i++) {
            // Reject crowded placements instead of merging islands or narrowing channels.
            // 1.5 wind cells = 66 px, comfortably wider than the 46 px collision diameter.
            for (let attempt = 0; attempt < 200; attempt++) {
                const cx = columns * (0.25 + this.random() * 0.5);
                const cy = rows * (0.12 + this.random() * 0.76);
                const rx = 0.32 + this.random() * 0.26;
                const ry = 0.30 + this.random() * 0.25;
                // Account for distorted shores and the extent of rasterized land tiles.
                const outerRadius = 1.27 * Math.max(rx, ry) + Math.SQRT2 / (2 * this.landFineness);
                if (!this.canOccupy(cx, cy, outerRadius + 1.5)) continue;
                this.blob(cx, cy, rx, ry);
                break;
            }
        }
        this.keepMainOcean();
        // Aggregate fine terrain for the coarse wind solver only.
        this.windLand = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => {
            let occupied = 0;
            for (let dy = 0; dy < this.landFineness; dy++) for (let dx = 0; dx < this.landFineness; dx++) {
                if (this.land[y * this.landFineness + dy][x * this.landFineness + dx]) occupied++;
            }
            return occupied >= this.landFineness ** 2 / 2;
        }));
        this.winds = this.solveWinds(settings.gyres);
        this.correctContinentalWinds(settings.offshoreStrength, settings.coastalInfluenceDistance);
        let best = -1;
        this.spawn = { x: columns / 2 + 0.5, y: 0.5 };
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
            if (this.canOccupy(x + 0.5, y + 0.5, 0.55) && this.winds[y][x].magnitude > best) {
                best = this.winds[y][x].magnitude;
                this.spawn = { x: x + 0.5, y: y + 0.5 };
            }
        }
    }

    /** Push coastal winds toward increasing distance from continental land. */
    private correctContinentalWinds(strength: number, influenceDistance: number): void {
        if (!Number.isFinite(strength) || strength < 0 || strength > 1
            || !Number.isFinite(influenceDistance) || influenceDistance <= 0) {
            throw new Error('offshoreStrength must be in 0–1; coastalInfluenceDistance must be positive and finite.');
        }
        if (strength === 0) return;
        const w = this.landColumns, h = this.landRows, f = this.landFineness;
        const index = (x: number, y: number) => ((y + h) % h) * w + (x + w) % w;
        // Multi-source distance field on the wrapping fine grid. Islands are
        // deliberately excluded: they retain the existing bypass circulation.
        const distance = new Int32Array(w * h).fill(-1);
        const queue: number[] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (this.continents[y][x]) { const i = index(x, y); distance[i] = 0; queue.push(i); }
        }
        if (queue.length === 0) return;
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const i = queue[cursor], x = i % w, y = Math.floor(i / w);
            for (const n of [index(x - 1, y), index(x + 1, y), index(x, y - 1), index(x, y + 1)]) {
                if (distance[n] === -1) { distance[n] = distance[i] + 1; queue.push(n); }
            }
        }
        for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
            let nx = 0, ny = 0, nearest = Infinity, containsContinent = false;
            let bestDistance = -1, fallbackX = 0, fallbackY = 0;
            for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
                const x = col * f + dx, y = row * f + dy;
                containsContinent ||= this.continents[y][x];
                if (this.land[y][x]) continue;
                const d = distance[index(x, y)];
                nearest = Math.min(nearest, d / f);
                const gx = distance[index(x + 1, y)] - distance[index(x - 1, y)];
                const gy = distance[index(x, y + 1)] - distance[index(x, y - 1)];
                nx += gx / (d + 1); ny += gy / (d + 1);
                if (d > bestDistance && Math.hypot(gx, gy) > 0) {
                    bestDistance = d; fallbackX = gx; fallbackY = gy;
                }
            }
            if (nearest > influenceDistance) continue;
            // In concave bays, prefer the gradient at the most open water
            // sample if opposing shore normals cancel each other.
            if (Math.hypot(nx, ny) < 1e-8) { nx = fallbackX; ny = fallbackY; }
            const length = Math.hypot(nx, ny);
            if (length < 1e-8) continue;
            nx /= length; ny /= length;
            const t = containsContinent ? 1 : Math.max(0, 1 - nearest / influenceDistance);
            const blend = t * t * (3 - 2 * t);
            const wind = this.winds[row][col];
            let vx = wind.x * wind.magnitude, vy = wind.y * wind.magnitude;
            const inland = Math.min(0, vx * nx + vy * ny);
            vx += blend * (strength - inland) * nx;
            vy += blend * (strength - inland) * ny;
            const speed = Math.hypot(vx, vy);
            if (speed > 1e-8) this.winds[row][col] = {
                x: vx / speed, y: vy / speed, magnitude: Math.min(1, speed)
            };
        }
    }

    /** Coastal sites with water-side approach points clear of the ship's hull. */
    createPorts(): NavigationPort[] | undefined {
        const groups: NavigationPort[][] = [[], [], []];
        const f = this.landFineness;
        for (let row = 0; row < this.landRows; row++) for (let col = 0; col < this.landColumns; col++) {
            if (!this.land[row][col]) continue;
            const x = (col + 0.5) / f, y = (row + 0.5) / f;
            const group = this.continents[row][col] ? (y < this.rows / 2 ? 0 : 1) : 2;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (this.isLand(x + dx / f, y + dy / f)) continue;
                const dockX = x + dx * (1 + 0.5 / f), dockY = y + dy * (1 + 0.5 / f);
                if (dockX < 0.5 || dockX > this.columns - 0.5 || dockY < 0.5 || dockY > this.rows - 0.5) continue;
                // Select inward-facing shores beside a gyre, not polar coasts.
                const facingGyre = this.gyres.some(gyre => {
                    const cx = gyre.centerX * this.columns, cy = gyre.centerY * this.rows;
                    const rx = gyre.radiusX * this.columns, ry = gyre.radiusY * this.rows;
                    if (group < 2 && (cy < this.rows / 2 ? 0 : 1) !== group) return false;
                    const towardX = cx - x, towardY = cy - y;
                    const alignment = (towardX * dx + towardY * dy) / Math.max(1e-8, Math.hypot(towardX, towardY));
                    if (alignment < 0.65) return false;
                    // Continental ports belong on the flanks of the gyre.
                    if (group < 2 && Math.abs(y - cy) > ry * 0.65) return false;
                    const gx = (dockX - cx) / rx, gy = (dockY - cy) / ry;
                    const radius = Math.hypot(gx, gy);
                    if (radius < 0.4 || radius > 1.6) return false;
                    // Require an unobstructed hull-width connection to its circulation ring.
                    const ringX = cx + gx / radius * rx, ringY = cy + gy / radius * ry;
                    const steps = Math.max(1, Math.ceil(Math.hypot(ringX - dockX, ringY - dockY) * f * 2));
                    for (let step = 0; step <= steps; step++) {
                        const t = step / steps;
                        if (!this.canOccupy(dockX + (ringX - dockX) * t, dockY + (ringY - dockY) * t, 0.27)) return false;
                    }
                    return true;
                });
                if (!facingGyre) continue;
                // Keep the whole anchorage, plus the ship collision radius, clear of land.
                if (!this.canOccupy(dockX, dockY, 0.5 + 11.5 / 44)) continue;
                groups[group].push({ name: `Port${group + 1}`, x, y, dockX, dockY, radius: 0.5 });
            }
        }
        if (groups.some(group => group.length === 0)) return undefined;
        return groups.map(group => group[Math.floor(this.random() * group.length)]);
    }

    private random(): number {
        this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
        return this.state / 4294967296;
    }

    private blob(cx: number, cy: number, rx: number, ry: number): void {
        const phase = this.random() * Math.PI * 2;
        for (let y = 0; y < this.landRows; y++) for (let x = 0; x < this.landColumns; x++) {
            const dx = ((x + 0.5) / this.landFineness - cx) / rx;
            const dy = ((y + 0.5) / this.landFineness - cy) / ry;
            const angle = Math.atan2(dy, dx);
            const shore = 1 + 0.17 * Math.sin(angle * 3 + phase) + 0.1 * Math.cos(angle * 5 - phase);
            if (Math.hypot(dx, dy) < shore) this.land[y][x] = true;
        }
    }

    /** Hide arrows only when every fine tile in a wind square is land. */
    isWindCellFullyLand(column: number, row: number): boolean {
        for (let dy = 0; dy < this.landFineness; dy++) {
            for (let dx = 0; dx < this.landFineness; dx++) {
                if (!this.land[row * this.landFineness + dy][column * this.landFineness + dx]) return false;
            }
        }
        return true;
    }

    /** Coordinates are always in coarse wind-cell units. */
    isLand(x: number, y: number): boolean {
        const col = ((Math.floor(x * this.landFineness) % this.landColumns) + this.landColumns) % this.landColumns;
        const row = ((Math.floor(y * this.landFineness) % this.landRows) + this.landRows) % this.landRows;
        return this.land[row][col];
    }

    /** Circle versus fine terrain tiles, including wrapping seams. */
    canOccupy(x: number, y: number, radius: number): boolean {
        const f = this.landFineness;
        for (let row = Math.floor((y - radius) * f); row <= Math.floor((y + radius) * f); row++) {
            for (let col = Math.floor((x - radius) * f); col <= Math.floor((x + radius) * f); col++) {
                if (!this.isLand((col + 0.5) / f, (row + 0.5) / f)) continue;
                const nearX = Math.max(col / f, Math.min((col + 1) / f, x));
                const nearY = Math.max(row / f, Math.min((row + 1) / f, y));
                if (Math.hypot(x - nearX, y - nearY) <= radius) return false;
            }
        }
        return true;
    }

    private keepMainOcean(): void {
        const seen = new Set<number>();
        let largest: number[] = [];
        for (let y = 0; y < this.landRows; y++) for (let x = 0; x < this.landColumns; x++) {
            const start = y * this.landColumns + x;
            if (this.land[y][x] || seen.has(start)) continue;
            const region = [start]; seen.add(start);
            for (let i = 0; i < region.length; i++) {
                const cx = region[i] % this.landColumns, cy = Math.floor(region[i] / this.landColumns);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = (cx + dx + this.landColumns) % this.landColumns, ny = (cy + dy + this.landRows) % this.landRows;
                    const key = ny * this.landColumns + nx;
                    if (!this.land[ny][nx] && !seen.has(key)) { seen.add(key); region.push(key); }
                }
            }
            if (region.length > largest.length) largest = region;
        }
        const ocean = new Set(largest);
        for (let y = 0; y < this.landRows; y++) for (let x = 0; x < this.landColumns; x++) {
            if (!ocean.has(y * this.landColumns + x)) this.land[y][x] = true;
        }
    }

    private solveWinds(gyres: readonly Gyre[]): Wind[][] {
        if (gyres.length === 0 || gyres.some(g =>
            ![g.centerX, g.centerY].every(v => Number.isFinite(v) && v >= 0 && v <= 1)
            || ![g.radiusX, g.radiusY].every(v => Number.isFinite(v) && v > 0 && v <= 1)
            || !Number.isFinite(g.strength ?? 1) || (g.strength ?? 1) <= 0
            || !['clockwise', 'anticlockwise'].includes(g.direction))) {
            throw new Error('Configure at least one gyre with centers in 0–1, radii in (0, 1], a valid direction, and positive strength.');
        }
        // Streamfunction on grid vertices: a constant along every coastline
        // gives zero normal flow. Its rotated gradient follows the coastline.
        const w = this.columns, h = this.rows, count = w * h;
        const id = (x: number, y: number) => ((y + h) % h) * w + (x + w) % w;
        const parent = Array.from({ length: count }, (_, i) => i);
        const root = (i: number): number => {
            while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
            return i;
        };
        const fixed = new Set<number>();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (this.windLand[y][x]) {
            const corners = [id(x, y), id(x + 1, y), id(x, y + 1), id(x + 1, y + 1)];
            corners.forEach(i => { fixed.add(i); parent[root(i)] = root(corners[0]); });
        }
        const base = Array.from({ length: count }, (_, i) =>
            gyrePotential((i % w) / w, Math.floor(i / w) / h, gyres));
        const sums = new Map<number, { sum: number; count: number }>();
        fixed.forEach(i => { const r = root(i), s = sums.get(r) ?? { sum: 0, count: 0 }; s.sum += base[i]; s.count++; sums.set(r, s); });
        let psi = [...base];
        fixed.forEach(i => { const s = sums.get(root(i))!; psi[i] = s.sum / s.count; });
        for (let iteration = 0; iteration < 350; iteration++) {
            const next = [...psi];
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const i = id(x, y);
                if (fixed.has(i)) continue;
                const neighbors = [id(x - 1, y), id(x + 1, y), id(x, y - 1), id(x, y + 1)];
                const forcing = neighbors.reduce((sum, n) => sum + base[n], 0) - 4 * base[i];
                next[i] = (neighbors.reduce((sum, n) => sum + psi[n], 0) - forcing + 0.08 * base[i]) / 4.08;
            }
            psi = next;
        }
        return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {

            let vx = -(psi[id(x, y + 1)] + psi[id(x + 1, y + 1)] - psi[id(x, y)] - psi[id(x + 1, y)]) / 2;
            let vy = (psi[id(x + 1, y)] + psi[id(x + 1, y + 1)] - psi[id(x, y)] - psi[id(x, y + 1)]) / 2;
            // Keep the displayed cell-average vector tangent at adjacent land.
            if (this.windLand[y][(x - 1 + w) % w] || this.windLand[y][(x + 1) % w]) vx = 0;
            if (this.windLand[(y - 1 + h) % h][x] || this.windLand[(y + 1) % h][x]) vy = 0;
            const speed = Math.hypot(vx, vy);
            if (speed <= 1e-8) {
                // Coastline constraints can cancel both components. Keep a weak
                // background gyre wind so navigable parts never become windless.
                const background = createWind(x, y, w, h, gyres);
                return { x: background.x, y: background.y, magnitude: 0.12 };
            }
            return { x: vx / speed, y: vy / speed, magnitude: Math.min(1, 0.1 + speed * 0.6) };
        }));
    }
}
