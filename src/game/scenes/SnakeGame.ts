import { t } from '../i18n';
import { installSettings } from '../settings/dialog';
import { SnakeSounds } from '../audio/SnakeSounds';
import { Scene, GameObjects, Input } from 'phaser';
import { snakeConfig } from '../config/snake';
import { SnakeBoard } from '../logic/SnakeBoard';

export class SnakeGame extends Scene {
    private sounds!: SnakeSounds;
    private board!: SnakeBoard;
    private drawing!: GameObjects.Graphics;
    private scoreLabel!: GameObjects.Text;
    private elapsed = 0;
    private stepDuration = 0;
    private readonly cellSize = 28;
    private readonly left = 40;
    private readonly top = 146;

    constructor() {
        super('SnakeGame');
    }

    create(): void {
        if (!Number.isFinite(snakeConfig.speed) || snakeConfig.speed <= 0) {
            throw new Error(t("Snake speed must be a positive, finite number of squares per second."));
        }
        this.sounds = new SnakeSounds();
        this.sounds.unlock();
        this.events.once('shutdown', () => this.sounds.destroy());
        this.stepDuration = 1000 / snakeConfig.speed;
        this.board = new SnakeBoard(snakeConfig.appleCount);
        this.elapsed = 0;
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(40, 30, t("SNAKE"), { fontFamily: 'Arial', fontSize: '36px', color: '#fff0ce' });
        this.add.text(40, 86, t("Click the field to turn. Cross an edge to wrap around."), {
            fontFamily: 'Arial', fontSize: '20px', color: '#b9cbd7'
        });
        this.add.rectangle(320, 426, 564, 564, 0x10251f).setStrokeStyle(2, 0x81b875);
        const grid = this.add.graphics().lineStyle(1, 0x284337, 0.5);
        for (let i = 1; i < 20; i++) {
            grid.lineBetween(this.left + i * 28, this.top, this.left + i * 28, this.top + 560);
            grid.lineBetween(this.left, this.top + i * 28, this.left + 560, this.top + i * 28);
        }
        this.drawing = this.add.graphics();
        this.add.zone(320, 426, 560, 560).setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer: Input.Pointer) => {
                this.sounds.unlock();
                this.board.turnToward((pointer.x - this.left) / this.cellSize, (pointer.y - this.top) / this.cellSize);
            });
        this.scoreLabel = this.add.text(650, 160, '', { fontFamily: 'Arial', fontSize: '30px', color: '#fff0ce' });
        this.add.text(650, 240,
            t("Eat apples to grow.\nAvoid your own body.\n\nMoving left or right?\nClick above or below.\n\nMoving up or down?\nClick left or right."),
            { fontFamily: 'Arial', fontSize: '21px', color: '#b9cbd7', lineSpacing: 8 });
        this.button(650, 555, t("RESTART"), () => this.scene.restart());
        this.button(650, 635, t("MENU"), () => this.scene.start('MainMenu'));
        this.drawBoard();
        installSettings(this, 'SnakeGame', this.sounds);
    }

    private button(x: number, y: number, label: string, action: () => void): void {
        this.add.text(x, y, label, {
            fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', backgroundColor: '#355773',
            padding: { x: 24, y: 14 }
        }).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    }

    private drawBoard(): void {
        const graphics = this.drawing.clear();
        this.board.apples.forEach(apple => {
            const x = this.left + (apple.x + 0.5) * this.cellSize;
            const y = this.top + (apple.y + 0.5) * this.cellSize;
            graphics.fillStyle(0xf26b63);
            graphics.fillCircle(x, y + 2, 9);
            graphics.fillStyle(0xa9dc76);
            graphics.fillEllipse(x + 3, y - 9, 9, 5);
        });
        this.board.snake.forEach((cell, index) => {
            graphics.fillStyle(index === 0 ? 0xd1f08c : 0x79bb68);
            graphics.fillRoundedRect(this.left + cell.x * 28 + 2, this.top + cell.y * 28 + 2, 24, 24, 4);
        });
        const head = this.board.snake[0];
        const direction = this.board.direction;
        const x = this.left + (head.x + 0.5) * 28;
        const y = this.top + (head.y + 0.5) * 28;
        graphics.fillStyle(0x10251f);
        for (const side of [-1, 1]) {
            graphics.fillCircle(x + direction.x * 6 - direction.y * side * 5,
                y + direction.y * 6 + direction.x * side * 5, 2.5);
        }
        this.scoreLabel.setText(t("Apples eaten: {0}", this.board.score));
    }

    update(_time: number, delta: number): void {
        if (this.board.ended) return;
        // Avoid a sudden leap after a browser tab has been inactive.
        this.elapsed += Math.min(delta, 200);
        while (this.elapsed >= this.stepDuration && !this.board.ended) {
            this.elapsed -= this.stepDuration;
            const previousDirection = this.board.direction;
            const previousScore = this.board.score;
            this.board.step();
            if (this.board.direction.x !== previousDirection.x || this.board.direction.y !== previousDirection.y) {
                this.sounds.swish();
            }
            if (this.board.score > previousScore) this.sounds.crunch();
            this.drawBoard();
            if (this.board.ended) {
                this.add.rectangle(320, 426, 500, 200, 0x182c42, 0.96).setStrokeStyle(2, 0xffd166);
                this.add.text(320, 426,
                    t("{0}\n\nApples eaten: {1}", this.board.won ? t('FIELD CLEARED!') : t('GAME OVER'), this.board.score),
                    { fontFamily: 'Arial', fontSize: '30px', color: '#fff0ce', align: 'center' }).setOrigin(0.5);
            }
        }
    }
}
