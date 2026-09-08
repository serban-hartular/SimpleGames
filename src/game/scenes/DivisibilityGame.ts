import { DivisibilitySounds } from '../audio/DivisibilitySounds';
import { Scene, GameObjects, Math as PhaserMath, Utils } from 'phaser';
import { getDivisors } from '../config/divisibility';

type Balloon = { value: number; view: GameObjects.Container; slot: number };

export class DivisibilityGame extends Scene {
    private sounds!: DivisibilitySounds;
    private divisors: number[] = [];
    private round = 0;
    private balloons: Balloon[] = [];
    private gridSize = 4;
    private startedAt = 0;
    private finished = false;
    private results: number[] = [];
    private prompt!: GameObjects.Text;
    private timer!: GameObjects.Text;
    private remaining!: GameObjects.Text;
    private resultPanel?: GameObjects.Container;
    private readonly board = { x: 40, y: 138, size: 580 };

    constructor() {
        super('DivisibilityGame');
    }

    create(): void {
        this.sounds = new DivisibilitySounds();
        this.events.once('shutdown', () => this.sounds.destroy());
        this.divisors = getDivisors();
        this.round = 0;
        this.results = [];
        this.balloons = [];
        this.resultPanel = undefined;
        this.cameras.main.setBackgroundColor('#182c42');
        this.prompt = this.add.text(40, 30, '', {
            fontFamily: 'Arial', fontSize: '28px', color: '#fff0ce'
        });
        this.add.text(40, 78, 'Divizibilitate • Găsește numerele potrivite!', {
            fontFamily: 'Arial', fontSize: '18px', color: '#b9cbd7'
        });
        this.add.rectangle(330, 428, 580, 580, 0x233e56).setStrokeStyle(2, 0x54728a);
        this.timer = this.add.text(660, 155, '', { fontFamily: 'Arial', fontSize: '30px', color: '#fff0ce' });
        this.remaining = this.add.text(660, 210, '', { fontFamily: 'Arial', fontSize: '21px', color: '#b9cbd7' });
        this.add.text(660, 280,
            'Apasă pe baloanele cu\nnumere divizibile cu N.\n\nO greșeală adaugă două\nbaloane: unul potrivit\nși unul nepotrivit.\n\nRunda se încheie când\nnu mai sunt baloane\ncu numere potrivite.',
            { fontFamily: 'Arial', fontSize: '19px', color: '#b9cbd7', lineSpacing: 6 });
        this.add.text(660, 640, 'MENIU', {
            fontFamily: 'Arial', fontSize: '24px', color: '#ffffff',
            backgroundColor: '#355773', padding: { x: 24, y: 14 }
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MainMenu'));
        this.startRound();
    }

    private startRound(): void {
        this.resultPanel?.destroy();
        this.resultPanel = undefined;
        this.balloons.forEach(balloon => balloon.view.destroy());
        this.balloons = [];
        this.gridSize = 4;
        this.finished = false;
        this.prompt.setText(`Sparge baloanele cu numere divizibile la ${this.divisors[this.round]}`);
        // Six from each number range and six divisible overall. Large divisors
        // may have fewer than three distinct multiples below 100.
        const lowMatches = Math.min(3, Math.floor(99 / this.divisors[this.round]));
        const initial = Array.from({ length: 6 }, (_, i) => ({
            below100: true, divisible: i < lowMatches
        })).concat(Array.from({ length: 6 }, (_, i) => ({
            below100: false, divisible: i < 6 - lowMatches
        })));
        Utils.Array.Shuffle(initial).forEach(({ divisible, below100 }) => this.spawnBalloon(divisible, below100));
        this.startedAt = this.time.now;
        this.updateRemaining();
        this.timer.setText('Timp: 0.0 s');
    }

    private spawnBalloon(divisible: boolean, below100?: boolean): void {
        const divisor = this.divisors[this.round];
        const usedNumbers = new Set(this.balloons.map(balloon => balloon.value));
        const available = Array.from({ length: 999 }, (_, i) => i + 1)
            .filter(value => !usedNumbers.has(value) && (value % divisor === 0) === divisible);
        const lowCount = this.balloons.filter(balloon => balloon.value < 100).length;
        const highCount = this.balloons.length - lowCount;
        const preferLow = below100 ?? (lowCount === highCount ? Math.random() < 0.5 : lowCount < highCount);
        let candidates = available.filter(value => (value < 100) === preferLow);
        if (candidates.length === 0) candidates = available;
        // A finite pool can run out after many penalties. Never duplicate a
        // live number or exceed 999 in that case.
        if (candidates.length === 0) return;
        const value = Utils.Array.GetRandom(candidates);
        if (this.balloons.length === this.gridSize ** 2) {
            this.gridSize++;
            // Expand the placement grid when mistakes fill it; every balloon stays clickable.
            const slots = Utils.Array.Shuffle(Array.from({ length: this.gridSize ** 2 }, (_, i) => i));
            this.balloons.forEach((balloon, i) => {
                balloon.slot = slots[i];
                this.positionBalloon(balloon);
            });
        }
        const freeSlots = Array.from({ length: this.gridSize ** 2 }, (_, i) => i)
            .filter(slot => !this.balloons.some(balloon => balloon.slot === slot));
        const view = this.add.container(0, 0);
        const color = Utils.Array.GetRandom([0x75c9f0, 0xffc56e, 0xc7a5ed, 0x7cddbc, 0xffa8b8]);
        const string = this.add.graphics().lineStyle(2, 0xb9cbd7, 0.7);
        string.lineBetween(0, 34, -4, 45);
        string.lineBetween(-4, 45, 1, 54);
        const body = this.add.ellipse(0, 0, 66, 78, color)
            .setStrokeStyle(2, 0xffffff, 0.4).setInteractive({ useHandCursor: true });
        const knot = this.add.triangle(0, 38, 0, 8, 5, 0, 10, 8, color);
        const shine = this.add.ellipse(-17, -20, 9, 17, 0xffffff, 0.35);
        const label = this.add.text(0, 0, String(value), {
            fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#182c42'
        }).setOrigin(0.5);
        view.add([string, body, knot, shine, label]);
        const balloon = { value, view, slot: Utils.Array.GetRandom(freeSlots) };
        this.balloons.push(balloon);
        this.positionBalloon(balloon);
        body.on('pointerdown', () => this.popBalloon(balloon));
    }

    private positionBalloon(balloon: Balloon): void {
        const cell = this.board.size / this.gridSize;
        const scale = Math.min(1, cell / 120);
        const jitter = Math.max(0, (cell - 108 * scale) / 2);
        balloon.view.setScale(scale).setPosition(
            this.board.x + (balloon.slot % this.gridSize + 0.5) * cell + PhaserMath.FloatBetween(-jitter, jitter),
            this.board.y + (Math.floor(balloon.slot / this.gridSize) + 0.5) * cell - 6 * scale
                + PhaserMath.FloatBetween(-jitter, jitter)
        );
    }

    private popBalloon(balloon: Balloon): void {
        if (this.finished || !this.balloons.includes(balloon)) return;
        const correct = balloon.value % this.divisors[this.round] === 0;
        if (correct) this.sounds.pop();
        else this.sounds.wrong();
        const { x, y } = balloon.view;
        this.balloons.splice(this.balloons.indexOf(balloon), 1);
        balloon.view.destroy();
        const burst = this.add.circle(x, y, 20).setStrokeStyle(3, correct ? 0xa9f0cd : 0xff6575).setDepth(5);
        this.tweens.add({ targets: burst, scale: 2.3, alpha: 0, duration: 300,
            onComplete: () => burst.destroy() });
        if (!correct) {
            const cross = this.add.text(x, y, '✕', {
                fontFamily: 'Arial', fontSize: '56px', fontStyle: 'bold', color: '#ff334d',
                stroke: '#182c42', strokeThickness: 4
            }).setOrigin(0.5).setDepth(6);
            this.tweens.add({ targets: cross, alpha: 0, delay: 450, duration: 250,
                onComplete: () => cross.destroy() });
            this.spawnBalloon(true);
            this.spawnBalloon(false);
        }
        this.updateRemaining();
        if (!this.balloons.some(item => item.value % this.divisors[this.round] === 0)) this.finishRound();
    }

    private updateRemaining(): void {
        const count = this.balloons.filter(balloon => balloon.value % this.divisors[this.round] === 0).length;
        this.remaining.setText(`Runda ${this.round + 1}/${this.divisors.length}\nBaloane potrivite: ${count}`);
    }

    private finishRound(): void {
        this.finished = true;
        this.sounds.victory();
        const seconds = (this.time.now - this.startedAt) / 1000;
        this.results.push(seconds);
        this.timer.setText(`Timp: ${seconds.toFixed(1)} s`);
        const lastRound = this.round === this.divisors.length - 1;
        const panel = this.add.rectangle(330, 428, 548, 360, 0x102438, 0.98).setStrokeStyle(2, 0xffd166);
        const title = this.add.text(330, 290, lastRound ? 'Felicitări!' : 'Bravo!', {
            fontFamily: 'Arial', fontSize: '32px', color: '#fff0ce'
        }).setOrigin(0.5);
        const message = lastRound
            ? this.divisors.map((divisor, i) => `Divizibile la ${divisor}: ${this.results[i].toFixed(1)} s`).join('\n')
            : `Ai spart toate baloanele potrivite\nîn ${seconds.toFixed(1)} secunde!`;
        const result = this.add.text(330, 410, message, {
            fontFamily: 'Arial', fontSize: '23px', color: '#b9cbd7', align: 'center', lineSpacing: 12
        }).setOrigin(0.5);
        if (result.height > 190) result.setScale(190 / result.height);
        const next = this.add.text(330, 540, lastRound ? 'JOACĂ DIN NOU' : `CONTINUĂ → ${this.divisors[this.round + 1]}`, {
            fontFamily: 'Arial', fontSize: '23px', color: '#ffffff',
            backgroundColor: '#355773', padding: { x: 22, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        next.on('pointerdown', () => {
            if (lastRound) this.scene.restart();
            else {
                this.round++;
                this.startRound();
            }
        });
        this.resultPanel = this.add.container(0, 0, [panel, title, result, next]).setDepth(10);
    }

    update(): void {
        if (!this.finished) this.timer.setText(`Timp: ${((this.time.now - this.startedAt) / 1000).toFixed(1)} s`);
    }
}
