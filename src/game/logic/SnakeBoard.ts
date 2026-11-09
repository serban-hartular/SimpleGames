export type Cell = { x: number; y: number };

/** Grid rules independent of rendering. Coordinates wrap at every edge. */
export class SnakeBoard {
    readonly width = 20;
    readonly height = 20;
    snake: Cell[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    apples: Cell[] = [];
    direction: Cell = { x: 1, y: 0 };
    private pending?: Cell;
    score = 0;
    ended = false;
    won = false;

    constructor(private readonly appleCount: number) {
        if (!Number.isInteger(appleCount) || appleCount < 1 || appleCount > (this.width - 2) * (this.height - 2) - this.snake.length) {
            throw new Error('Snake appleCount must be a whole number from 1 to 320.');
        }
        this.fillApples();
    }

    turn(x: number, y: number): void {
        if (this.ended || this.pending) return;
        // Accept one perpendicular turn per movement tick, never a reversal.
        if (Math.abs(x) + Math.abs(y) !== 1 || x * this.direction.x + y * this.direction.y !== 0) return;
        this.pending = { x, y };
    }

    turnToward(x: number, y: number): void {
        const head = this.snake[0];
        if (this.direction.x !== 0 && y !== head.y + 0.5) {
            this.turn(0, y < head.y + 0.5 ? -1 : 1);
        } else if (this.direction.y !== 0 && x !== head.x + 0.5) {
            this.turn(x < head.x + 0.5 ? -1 : 1, 0);
        }
    }

    step(): void {
        if (this.ended) return;
        if (this.pending) this.direction = this.pending;
        this.pending = undefined;
        const head = this.snake[0];
        const next = {
            x: (head.x + this.direction.x + this.width) % this.width,
            y: (head.y + this.direction.y + this.height) % this.height
        };
        const appleIndex = this.apples.findIndex(apple => apple.x === next.x && apple.y === next.y);
        const eating = appleIndex !== -1;
        // The tail vacates its cell on a non-growing step, so entering it is legal.
        const body = eating ? this.snake : this.snake.slice(0, -1);
        if (body.some(cell => cell.x === next.x && cell.y === next.y)) {
            this.ended = true;
            return;
        }
        this.snake.unshift(next);
        if (eating) {
            this.score++;
            this.apples.splice(appleIndex, 1);
        } else this.snake.pop();
        if (this.snake.length === this.width * this.height) {
            this.ended = true;
            this.won = true;
        }
        this.fillApples();
    }

    private fillApples(): void {
        const occupied = new Set([...this.snake, ...this.apples].map(cell => cell.y * this.width + cell.x));
        const free: Cell[] = [];
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (!occupied.has(y * this.width + x)) free.push({ x, y });
            }
        }
        while (this.apples.length < this.appleCount && free.length > 0) {
            const index = Math.floor(Math.random() * free.length);
            this.apples.push(free.splice(index, 1)[0]);
        }
    }
}
