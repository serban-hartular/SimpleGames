import { t } from '../i18n';
import { installSettings } from '../settings/dialog';
import { FoxSounds } from '../audio/FoxSounds';
import { Scene, GameObjects, Input } from 'phaser';
import { foxConfig, FoxFigure } from '../config/fox';
import { FoxBoard, Actor, Point } from '../logic/FoxBoard';
import { FoxFigures } from '../visuals/FoxFigures';

export class FoxGame extends Scene {
    private sounds!: FoxSounds;
    private alerts: { chicken: Actor; label: GameObjects.Text }[] = [];
    private board!: FoxBoard;
    private figures: { entity: Point & { caught?: boolean }; sprite: GameObjects.Sprite }[] = [];
    private counters!: GameObjects.Text;
    private accumulator = 0;
    private announced = false;
    private cell = 32;
    private left = 112;
    private top = 112;

    constructor() { super('FoxGame'); }
    preload(): void { FoxFigures.preload(this); FoxSounds.preload(this); }
    create(): void {
        this.board = new FoxBoard(foxConfig);
        this.cell = Math.min(800 / this.board.width, 544 / this.board.height);
        this.left = (1024 - this.board.width * this.cell) / 2;
        this.top = 112 + (544 - this.board.height * this.cell) / 2;
        this.sounds = new FoxSounds(this);
        this.sounds.unlock();
        this.events.once('shutdown', () => this.sounds.destroy());
        this.figures = []; this.accumulator = 0; this.announced = false;
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(112, 24, t("FOX RAID"), { fontFamily: 'Arial', fontSize: '34px', color: '#fff0ce' });
        this.add.text(112, 73, t("Arrows or click to steer • Steal every chicken and pie • Avoid the dogs"), {
            fontFamily: 'Arial', fontSize: '18px', color: '#b9cbd7'
        });
        const maze = this.add.graphics();
        for (let y = 0; y < this.board.height; y++) for (let x = 0; x < this.board.width; x++) {
            maze.fillStyle(this.board.walls[y][x] ? 0x547448 : 0x302e29);
            maze.fillRect(this.left + x * this.cell, this.top + y * this.cell, this.cell, this.cell);
            if (this.board.walls[y][x]) { maze.lineStyle(1, 0x72945e); maze.strokeRect(this.left + x * this.cell + 2, this.top + y * this.cell + 2, this.cell - 4, this.cell - 4); }
        }
        maze.lineStyle(5, 0xe87563, 0.35);
        for (const dog of this.board.dogs) maze.lineBetween(this.px(dog.start.x), this.py(dog.start.y), this.px(dog.end.x), this.py(dog.end.y));
        this.add.zone(512, this.top + this.board.height * this.cell / 2, this.board.width * this.cell, this.board.height * this.cell)
            .setInteractive({ useHandCursor: true }).on('pointerdown', (p: Input.Pointer) => {
                this.sounds.unlock();
                const dx = p.x - this.px(this.board.fox.x), dy = p.y - this.py(this.board.fox.y);
                if (Math.abs(dx) <= this.cell * 0.4375 && Math.abs(dy) <= this.cell * 0.4375) this.board.stop();
                else this.board.steer(dx, dy);
            });
        const add = (entity: Point & { caught?: boolean }, kind: FoxFigure) => this.figures.push({ entity, sprite: FoxFigures.create(this, kind).setDisplaySize(this.cell * 0.875, this.cell * 0.875) });
        this.board.pies.forEach(p => add(p, 'pie')); this.board.chickens.forEach(p => add(p, 'chicken'));
        this.board.dogs.forEach(p => add(p, 'dog')); add(this.board.fox, 'fox');
        this.alerts = this.board.chickens.map(chicken => ({ chicken, label: this.add.text(0, 0, '!', {
            fontFamily: 'Arial', fontSize: `${this.cell * 0.56}px`, fontStyle: 'bold', color: '#ffdc65', stroke: '#302e29', strokeThickness: 3
        }).setOrigin(0.5).setDepth(3) }));
        const onKey = (event: KeyboardEvent) => {
            if (event.code === 'Space') { this.board.stop(); return; }
            const keys: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
                ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
            const d = keys[event.key]; if (d) { this.sounds.unlock(); this.board.steer(d.x, d.y); }
        };
        this.input.keyboard?.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
        this.input.keyboard?.on('keydown', onKey);
        this.events.once('shutdown', () => { this.input.keyboard?.off('keydown', onKey); this.input.keyboard?.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']); });
        this.counters = this.add.text(112, 681, '', { fontFamily: 'Arial', fontSize: '23px', color: '#fff0ce' });
        this.add.text(112, 723, t("Space or click the fox to stop. Red paths mark dog patrols."), { fontFamily: 'Arial', fontSize: '16px', color: '#b9cbd7' });
        this.button(635, t("NEW MAZE"), () => this.scene.restart()); this.button(832, t("MENU"), () => this.scene.start('MainMenu'));
        this.renderActors();
        installSettings(this, 'FoxGame', this.sounds);
    }
    private px(x: number): number { return this.left + (x + 0.5) * this.cell; }
    private py(y: number): number { return this.top + (y + 0.5) * this.cell; }
    private button(x: number, label: string, action: () => void): void {
        this.add.text(x, 674, label, { fontFamily: 'Arial', fontSize: '19px', color: '#ffffff', backgroundColor: '#355773',
            padding: { x: 14, y: 12 } }).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    }
    private renderActors(): void {
        this.figures.forEach(({ entity, sprite }) => {
            sprite.setPosition(this.px(entity.x), this.py(entity.y)).setVisible(!entity.caught);
            const actor = entity as Actor;
            if (actor.direction?.x) sprite.setFlipX(actor.direction.x < 0);
            if (sprite.anims.currentAnim) {
                if (this.board.ended || (entity === this.board.fox && this.board.foxStopped) || ('direction' in entity && !actor.target)) sprite.anims.pause();
                else sprite.anims.resume();
                sprite.anims.timeScale = actor.fleeing ? 1.5 : ('chasing' in entity && entity.chasing) ? 1.4 : 1;
            }
        });
        this.alerts.forEach(({ chicken, label }) => {
            const fleeing = !!chicken.fleeing && !chicken.caught;
            label.setPosition(this.px(chicken.x), this.py(chicken.y) - this.cell * 0.53).setVisible(fleeing);
            const sprite = this.figures.find(figure => figure.entity === chicken)!.sprite;
            if (fleeing) sprite.setTint(0xffbc75); else sprite.clearTint();
        });
        this.board.dogs.forEach(dog => {
            const sprite = this.figures.find(figure => figure.entity === dog)!.sprite;
            if (dog.chasing) sprite.setTint(0xff9b8a); else sprite.clearTint();
        });
        this.counters.setText(t("Chickens: {0}/{1}    Pies: {2}/{3}", this.board.caughtChickens, this.board.chickens.length, this.board.caughtPies, this.board.pies.length));
    }
    update(_time: number, delta: number): void {
        this.accumulator += Math.min(delta / 1000, 0.1);
        while (this.accumulator >= 1 / 120 && !this.board.ended) { this.board.step(1 / 120);
            new Set(this.board.events).forEach(event => this.sounds.play(event));
            this.accumulator -= 1 / 120; }
        this.renderActors();
        if (this.board.ended && !this.announced) {
            this.announced = true;
            this.add.rectangle(512, 360, 580, 160, 0x182c42, 0.96).setStrokeStyle(2, 0xffd166).setDepth(10);
            this.add.text(512, 360, this.board.won ? t("YOU WIN!\nEverything stolen!") : t("CAUGHT BY A DOG!\nTry a new maze."), {
                fontFamily: 'Arial', fontSize: '30px', color: '#fff0ce', align: 'center', lineSpacing: 12
            }).setOrigin(0.5).setDepth(11);
        }
    }
}
