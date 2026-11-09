import { Scene, GameObjects } from 'phaser';
import { streetsConfig } from '../config/streets';
import { StreetBoard } from '../logic/StreetBoard';
import { t } from '../i18n';
import { installSettings } from '../settings/dialog';

export class StreetsGame extends Scene {
    private board!: StreetBoard;
    private car!: GameObjects.Graphics;
    private status!: GameObjects.Text;
    private counters!: GameObjects.Text;
    private cell = 0;
    private left = 0;
    private top = 0;
    private animating = false;
    private controls: { background: GameObjects.Rectangle; label: GameObjects.Text }[] = [];

    constructor() { super('StreetsGame'); }

    create(): void {
        this.animating = false;
        this.controls = [];
        this.board = new StreetBoard(streetsConfig);
        this.cell = Math.min(620 / this.board.width, 480 / this.board.height);
        this.left = 365 - this.board.width * this.cell / 2;
        this.top = 400 - this.board.height * this.cell / 2;
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(40, 26, t('STREET DRIVER'), {
            fontFamily: 'Arial', fontSize: '36px', color: '#fff0ce'
        });
        this.add.text(40, 80, t('Reach the star. ↑ drives one square; ← / → turn in place.'), {
            fontFamily: 'Arial', fontSize: '20px', color: '#b9cbd7', wordWrap: { width: 940 }
        });
        this.add.rectangle(365, 400, 650, 510, 0x244f46).setStrokeStyle(2, 0x65847d);
        this.drawCity();
        this.drawCar();
        this.add.rectangle(852, 400, 264, 510, 0x203950).setStrokeStyle(1, 0x54728a);
        this.add.text(742, 164, t('Difficulty: {0}/5', streetsConfig.difficulty), {
            fontFamily: 'Arial', fontSize: '21px', color: '#fff0ce'
        });
        this.button(852, 244, 220, 60, t('↑ Forward'), () => this.drive());
        this.button(794, 322, 104, 64, t('↶ Left'), () => this.turn(-1));
        this.button(910, 322, 104, 64, t('Right ↷'), () => this.turn(1));
        this.add.text(742, 377, t('Arrows: allowed direction.\nDashed lines: two way.\nNearer can mean a longer route.'), {
            fontFamily: 'Arial', fontSize: '18px', color: '#c9d9df', lineSpacing: 9,
            wordWrap: { width: 225 }
        });
        this.counters = this.add.text(742, 512, '', {
            fontFamily: 'Arial', fontSize: '20px', color: '#fff0ce', lineSpacing: 9
        });
        this.button(852, 610, 220, 48, t('TRY AGAIN'), () => {
            this.board.retry();
            this.refresh(t('Find a legal route to the star.'), '#b9cbd7');
        });
        this.status = this.add.text(40, 673, '', {
            fontFamily: 'Arial', fontSize: '21px', color: '#b9cbd7', wordWrap: { width: 650 }
        });
        this.add.text(40, 737, t('Map seed: {0}', this.board.seed), {
            fontFamily: 'Arial', fontSize: '15px', color: '#9bb5bb'
        });
        this.button(811, 710, 158, 52, t('NEW MAP'), () => this.scene.restart());
        this.button(944, 710, 96, 52, t('MENU'), () => this.scene.start('MainMenu'));

        const onKey = (event: KeyboardEvent) => {
            if (event.repeat) return;
            if (event.key === 'ArrowUp') this.drive();
            else if (event.key === 'ArrowLeft') this.turn(-1);
            else if (event.key === 'ArrowRight') this.turn(1);
        };
        this.input.keyboard?.addCapture(['UP', 'LEFT', 'RIGHT']);
        this.input.keyboard?.on('keydown', onKey);
        this.events.once('shutdown', () => {
            this.tweens.killTweensOf(this.car);
            this.animating = false;
            this.controls = [];
            this.input.keyboard?.off('keydown', onKey);
            this.input.keyboard?.removeCapture(['UP', 'LEFT', 'RIGHT']);
        });
        this.refresh(t('Find a legal route to the star.'), '#b9cbd7');
        installSettings(this, 'StreetsGame');
    }

    private button(x: number, y: number, width: number, height: number, label: string, action: () => void): void {
        const background = this.add.rectangle(x, y, width, height, 0x355773)
            .setStrokeStyle(1, 0x7593a6).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', align: 'center',
            wordWrap: { width: width - 8 }
        }).setOrigin(0.5);
        this.controls.push({ background, label: text });
        background.on('pointerover', () => background.setFillStyle(0x496e89));
        background.on('pointerout', () => background.setFillStyle(0x355773));
        background.on('pointerdown', () => { if (!this.animating) action(); });
    }

    private point(cell: number): { x: number; y: number } {
        const p = this.board.coordinates(cell);
        return { x: this.left + (p.x + 0.5) * this.cell, y: this.top + (p.y + 0.5) * this.cell };
    }

    private drawCity(): void {
        const g = this.add.graphics(), size = this.cell;
        // Small city blocks sit between the road squares.
        for (let y = 1; y < this.board.height; y++) {
            for (let x = 1; x < this.board.width; x++) {
                const px = this.left + x * size, py = this.top + y * size;
                const park = (x * 7 + y * 11 + this.board.seed % 17) % 5 === 0;
                g.fillStyle(park ? 0x3f7653 : 0x6c8e84);
                g.fillRoundedRect(px - size * 0.16, py - size * 0.16, size * 0.32, size * 0.32, size * 0.04);
                g.fillStyle(park ? 0x8ab578 : 0xb5c5b0, 0.7);
                if (park) g.fillCircle(px, py, size * 0.09);
                else g.fillRect(px - size * 0.1, py - size * 0.1, size * 0.12, size * 0.05);
            }
        }
        for (const [width, color] of [[0.58, 0x9cae9f], [0.47, 0x374956]]) {
            g.lineStyle(size * width, color);
            for (const street of this.board.streets) {
                const a = this.point(street.a), b = this.point(street.b);
                g.lineBetween(a.x, a.y, b.x, b.y);
            }
            g.fillStyle(color);
            for (const cell of this.board.roadSquares) {
                const p = this.point(cell);
                g.fillRect(p.x - size * width / 2, p.y - size * width / 2, size * width, size * width);
            }
        }
        for (const street of this.board.streets) {
            const a = this.point(street.a), b = this.point(street.b);
            const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
            const dx = (b.x - a.x) / size, dy = (b.y - a.y) / size;
            const r = size * 0.14;
            if (street.oneWay) {
                g.lineStyle(Math.max(2, size * 0.04), 0xffd166);
                g.lineBetween(x - dx * r, y - dy * r, x + dx * r, y + dy * r);
                g.lineBetween(x + dx * r, y + dy * r, x - dy * r * 0.65, y + dx * r * 0.65);
                g.lineBetween(x + dx * r, y + dy * r, x + dy * r * 0.65, y - dx * r * 0.65);
            } else {
                g.lineStyle(2, 0xd9e5de, 0.7);
                for (const offset of [-0.14, 0.06]) {
                    g.lineBetween(x + dx * size * offset, y + dy * size * offset,
                        x + dx * size * (offset + 0.08), y + dy * size * (offset + 0.08));
                }
            }
        }
        // Dots mark the individual squares: each forward action advances one dot.
        g.fillStyle(0xa7bbbd, 0.7);
        for (const cell of this.board.roadSquares) {
            const p = this.point(cell); g.fillCircle(p.x, p.y, 2);
        }
        const start = this.point(this.board.start), goal = this.point(this.board.destination);
        g.lineStyle(3, 0x99e6c1);
        g.strokeRoundedRect(start.x - size * 0.29, start.y - size * 0.29, size * 0.58, size * 0.58, 5);
        const [labelX, labelY] = [[0,1],[0,-1],[-1,0],[1,0]].find(([dx,dy]) =>
            !this.board.streetBetween(this.board.start, this.board.start + dy * this.board.width + dx)) ?? [0,1];
        this.add.text(start.x + labelX * size * 0.42, start.y + labelY * size * 0.42, t('START'), {
            fontFamily: 'Arial', fontSize: `${Math.max(10, size * 0.14)}px`, color: '#c8ffe3',
            stroke: '#182c42', strokeThickness: 3
        }).setOrigin(0.5);
        this.add.star(goal.x, goal.y, 5, size * 0.13, size * 0.29, 0xffd166).setStrokeStyle(2, 0xfff0ce);
    }

    private drawCar(): void {
        const g = this.car = this.add.graphics(), s = this.cell;
        g.fillStyle(0x101d2b);
        for (const x of [-0.22, 0.15]) {
            for (const y of [-0.2, 0.13]) g.fillRoundedRect(x * s, y * s, s * 0.07, s * 0.14, 2);
        }
        g.fillStyle(0xf37b60);
        g.fillRoundedRect(-s * 0.18, -s * 0.32, s * 0.36, s * 0.64, s * 0.08);
        g.lineStyle(1.5, 0xffd0a9);
        g.strokeRoundedRect(-s * 0.18, -s * 0.32, s * 0.36, s * 0.64, s * 0.08);
        g.fillStyle(0xbde7e5);
        g.fillRoundedRect(-s * 0.13, -s * 0.15, s * 0.26, s * 0.16, 2);
        g.fillStyle(0x203950);
        g.fillRect(-s * 0.12, s * 0.16, s * 0.24, s * 0.08);
        g.fillStyle(0xfff3b5);
        for (const x of [-0.13, 0.07]) g.fillRect(x * s, -s * 0.29, s * 0.06, s * 0.04);
        g.fillTriangle(0, -s * 0.28, -s * 0.05, -s * 0.2, s * 0.05, -s * 0.2);
    }

    private turn(direction: -1 | 1): void {
        if (this.animating || this.board.won) return;
        // Use a relative angle so crossing north still turns just 90 degrees.
        const angle = this.car.angle + direction * 90;
        this.board.turn(direction);
        this.animateCar({ angle }, 180, () => this.refresh());
    }

    private drive(): void {
        if (this.animating) return;
        const result = this.board.forward();
        switch (result) {
            case 'blocked': this.refresh(t('No street ahead. Turn left or right.'), '#ffd199'); break;
            case 'wrong-way':
                this.cameras.main.shake(160, 0.004);
                this.animateCar({ alpha: 0 }, 100, () => {
                    this.refresh(t('Wrong way! Returned to the start.'), '#ffb4a2');
                    this.animateCar({ alpha: 1 }, 120, () => this.refresh());
                });
                break;
            case 'won':
            case 'moved': {
                const p = this.point(this.board.position);
                this.animateCar({ x: p.x, y: p.y }, 240, () => this.refresh(
                    result === 'won' ? t('YOU WIN! Destination reached.') : t('Plan your turns before entering a side street.'),
                    result === 'won' ? '#b7efaa' : '#b9cbd7'));
                break;
            }
            case 'finished': break;
        }
    }

    private animateCar(properties: { x?: number; y?: number; angle?: number; alpha?: number }, duration: number, complete: () => void): void {
        this.setAnimating(true);
        this.tweens.add({
            targets: this.car, ...properties, duration, ease: 'Sine.easeInOut',
            onComplete: () => {
                this.setAnimating(false);
                complete();
            }
        });
    }

    private setAnimating(value: boolean): void {
        this.animating = value;
        for (const { background, label } of this.controls) {
            background.setAlpha(value ? 0.5 : 1).setFillStyle(0x355773);
            label.setAlpha(value ? 0.5 : 1);
            if (value) background.disableInteractive();
            else background.setInteractive({ useHandCursor: true });
        }
    }

    private refresh(message?: string, color?: string): void {
        const p = this.point(this.board.position);
        this.car.setPosition(p.x, p.y).setAngle(this.board.heading * 90);
        this.counters.setText(t('Squares driven: {0}\nWrong turns: {1}', this.board.moves, this.board.resets));
        if (message) this.status.setText(message).setColor(color ?? '#b9cbd7');
    }
}
