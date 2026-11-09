import type { RobotConfig } from '../config/robot';

export type RobotInstruction = 'forward' | 'left' | 'right';
export type RobotHeading = 0 | 1 | 2 | 3; // North, east, south, west.
export type RobotResult = 'ready' | 'running' | 'collision' | 'miss' | 'success' | 'stopped';
export const MAX_ROBOT_INSTRUCTIONS = 1000;

export function validateRobotConfig(config: RobotConfig): void {
    if (![config.columns, config.rows].every(n => Number.isInteger(n) && n >= 2 && n <= 20)) {
        throw new Error('Robot board dimensions must be whole numbers from 2 to 20.');
    }
    if (!Number.isFinite(config.stepDuration) || config.stepDuration < 200 || config.stepDuration > 2000) {
        throw new Error('Robot step duration must be between 200 and 2000 milliseconds.');
    }
}

/** Board design, editable program and discrete execution; independent of Phaser. */
export class RobotBoard {
    readonly columns: number;
    readonly rows: number;
    readonly obstacles = new Set<number>();
    readonly program: RobotInstruction[] = [];
    start: number;
    target: number;
    startHeading: RobotHeading = 0;
    position: number;
    heading: RobotHeading = 0;
    nextInstruction = 0;
    result: RobotResult = 'ready';

    constructor(config: RobotConfig) {
        validateRobotConfig(config);
        this.columns = config.columns;
        this.rows = config.rows;
        this.start = (this.rows - 1) * this.columns;
        this.target = this.columns - 1;
        this.position = this.start;
    }

    private validCell(cell: number): boolean {
        return Number.isInteger(cell) && cell >= 0 && cell < this.columns * this.rows;
    }

    movePiece(piece: 'robot' | 'star', cell: number): boolean {
        if (this.result === 'running' || !this.validCell(cell) || this.obstacles.has(cell)
            || cell === (piece === 'robot' ? this.target : this.start)) return false;
        if (piece === 'robot') this.start = cell;
        else this.target = cell;
        this.reset();
        return true;
    }

    toggleObstacle(cell: number): boolean {
        if (this.result === 'running' || !this.validCell(cell) || cell === this.start || cell === this.target) return false;
        if (this.obstacles.has(cell)) this.obstacles.delete(cell);
        else this.obstacles.add(cell);
        this.reset();
        return true;
    }

    rotateStart(): void {
        if (this.result === 'running') return;
        this.startHeading = ((this.startHeading + 1) % 4) as RobotHeading;
        this.reset();
    }

    insert(index: number, instruction: RobotInstruction): boolean {
        if (this.result === 'running' || !Number.isInteger(index) || index < 0 || index > this.program.length
            || this.program.length >= MAX_ROBOT_INSTRUCTIONS || !['forward', 'left', 'right'].includes(instruction)) return false;
        this.program.splice(index, 0, instruction);
        this.reset();
        return true;
    }

    remove(index: number): boolean {
        if (this.result === 'running' || !Number.isInteger(index) || index < 0 || index >= this.program.length) return false;
        this.program.splice(index, 1);
        this.reset();
        return true;
    }

    reset(): void {
        this.position = this.start;
        this.heading = this.startHeading;
        this.nextInstruction = 0;
        this.result = 'ready';
    }

    run(): boolean {
        if (this.result === 'running' || this.program.length === 0) return false;
        this.reset();
        this.result = 'running';
        return true;
    }

    stop(): void { if (this.result === 'running') this.result = 'stopped'; }

    step(): RobotResult {
        if (this.result !== 'running') return this.result;
        const instruction = this.program[this.nextInstruction++];
        if (instruction === 'left' || instruction === 'right') {
            this.heading = ((this.heading + (instruction === 'left' ? 3 : 1)) % 4) as RobotHeading;
        } else {
            const dx = [0, 1, 0, -1][this.heading], dy = [-1, 0, 1, 0][this.heading];
            const x = this.position % this.columns + dx, y = Math.floor(this.position / this.columns) + dy;
            const cell = y * this.columns + x;
            if (x < 0 || x >= this.columns || y < 0 || y >= this.rows || this.obstacles.has(cell)) {
                return this.result = 'collision';
            }
            this.position = cell;
        }
        if (this.nextInstruction === this.program.length) {
            this.result = this.position === this.target ? 'success' : 'miss';
        }
        return this.result;
    }
}
