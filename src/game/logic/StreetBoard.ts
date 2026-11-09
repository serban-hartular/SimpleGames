import type { StreetsConfig } from '../config/streets';
import { generateStreetNetwork, type Street } from './StreetNetwork';
export type { Street } from './StreetNetwork';

export type Heading = 0 | 1 | 2 | 3; // North, east, south, west.
export type DriveResult = 'moved' | 'blocked' | 'wrong-way' | 'won' | 'finished';
const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

export function validateStreetsConfig(config: StreetsConfig): void {
    if (!Number.isInteger(config.difficulty) || config.difficulty < 1 || config.difficulty > 5) {
        throw new Error('Street difficulty must be a whole number from 1 to 5.');
    }
    if (config.seed !== null && (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295)) {
        throw new Error('Street seed must be an integer from 0 to 4294967295 or null.');
    }
}

/** Seeded graph generation and discrete driving rules, independent of Phaser. */
export class StreetBoard {
    readonly width: number;
    readonly height: number;
    readonly seed: number;
    readonly start: number;
    readonly destination: number;
    readonly startHeading: Heading;
    readonly streets: Street[];
    readonly roadSquares: number[];
    position: number;
    heading: Heading;
    moves = 0;
    resets = 0;
    won = false;
    private readonly links = new Map<string, Street>();

    constructor(config: StreetsConfig) {
        validateStreetsConfig(config);
        this.width = 5 + Math.floor((config.difficulty - 1) / 2);
        this.height = 4 + Math.floor((config.difficulty - 1) / 3);
        this.seed = config.seed ?? Math.floor(Math.random() * 4294967296);
        let state = this.seed;
        const random = () => {
            state = (state + 0x6D2B79F5) >>> 0;
            let n = Math.imul(state ^ (state >>> 15), state | 1);
            n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
            return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
        };
        const network = generateStreetNetwork(this.width, this.height, config.difficulty, random);
        this.start = network.start;
        this.destination = network.destination;
        this.streets = network.streets;
        this.roadSquares = network.roadSquares;
        for (const street of this.streets) this.links.set(this.key(street.a, street.b), street);
        const first = this.neighbors(this.start).find(to => this.canTravel(this.start, to))!;
        this.startHeading = directions.findIndex(d => this.start + d.y * this.width + d.x === first) as Heading;
        this.position = this.start;
        this.heading = this.startHeading;
    }

    coordinates(cell: number): { x: number; y: number } {
        return { x: cell % this.width, y: Math.floor(cell / this.width) };
    }

    neighbors(cell: number): number[] {
        const { x, y } = this.coordinates(cell);
        return directions.flatMap(d => {
            const nx = x + d.x, ny = y + d.y;
            return nx >= 0 && nx < this.width && ny >= 0 && ny < this.height ? [ny * this.width + nx] : [];
        });
    }

    streetBetween(a: number, b: number): Street | undefined { return this.links.get(this.key(a, b)); }

    canTravel(from: number, to: number): boolean {
        const street = this.streetBetween(from, to);
        return !!street && (!street.oneWay || street.a === from);
    }

    turn(direction: -1 | 1): void {
        if (!this.won) this.heading = ((this.heading + direction + 4) % 4) as Heading;
    }

    forward(): DriveResult {
        if (this.won) return 'finished';
        const { x, y } = this.coordinates(this.position), d = directions[this.heading];
        const nx = x + d.x, ny = y + d.y;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return 'blocked';
        const next = ny * this.width + nx;
        if (!this.streetBetween(this.position, next)) return 'blocked';
        if (!this.canTravel(this.position, next)) {
            this.resets++;
            this.position = this.start;
            this.heading = this.startHeading;
            return 'wrong-way';
        }
        this.position = next;
        this.moves++;
        this.won = next === this.destination;
        return this.won ? 'won' : 'moved';
    }

    retry(): void {
        this.position = this.start;
        this.heading = this.startHeading;
        this.moves = 0;
        this.resets = 0;
        this.won = false;
    }

    private key(a: number, b: number): string { return a < b ? `${a}:${b}` : `${b}:${a}`; }
}
