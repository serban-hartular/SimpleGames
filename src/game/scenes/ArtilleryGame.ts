import { ArtillerySounds } from '../audio/ArtillerySounds';
import { Scene, GameObjects, Time } from 'phaser';
import { Terrain } from '../objects/Terrain';
import { Projectile } from '../objects/Projectile';

export class ArtilleryGame extends Scene {
    private sounds!: ArtillerySounds;
    private terrain!: Terrain;
    private cannon!: GameObjects.Graphics;
    private angleLabel!: GameObjects.Text;
    private status!: GameObjects.Text;
    private fireButton!: GameObjects.Text;
    private projectile?: Projectile;
    private angle = 45;
    private busy = false;
    private won = false;
    private shots = 0;
    private readonly cannonX = 90;
    private cannonY = 0;

    constructor() {
        super('ArtilleryGame');
    }

    create() {
        this.sounds = new ArtillerySounds();
        this.events.once('shutdown', () => this.sounds.destroy());
        this.angle = 45;
        this.busy = false;
        this.won = false;
        this.shots = 0;
        this.projectile = undefined;
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(40, 30, 'ARTILLERY', { fontFamily: 'Arial', fontSize: '32px', color: '#fff0ce' });
        this.add.text(40, 74, 'Adjust your angle. Land within the target’s golden zone.', {
            fontFamily: 'Arial', fontSize: '18px', color: '#b9cbd7'
        });
        this.terrain = new Terrain(this, this.scale.width, this.scale.height);
        this.cannonY = this.terrain.heightAt(this.cannonX) - 18;
        this.cannon = this.add.graphics();
        this.angleLabel = this.add.text(270, 649, '', {
            fontFamily: 'Arial', fontSize: '26px', color: '#fff0ce'
        }).setOrigin(0.5);
        this.status = this.add.text(512, 598, 'Ready for your first shot', {
            fontFamily: 'Arial', fontSize: '22px', color: '#fff0ce'
        }).setOrigin(0.5);
        this.button(895, 48, 'MENU', () => this.scene.start('MainMenu'));
        this.angleButton(160, '−', -1);
        this.angleButton(380, '+', 1);
        this.fireButton = this.button(535, 650, 'FIRE', () => this.fire());
        this.button(770, 650, 'NEW TARGET', () => this.scene.restart());
        this.add.text(512, 714, 'Dots mark equal time intervals • Wider gaps mean higher speed', {
            fontFamily: 'Arial', fontSize: '16px', color: '#b9cbd7'
        }).setOrigin(0.5);
        this.drawCannon();
        this.events.once('shutdown', () => this.projectile?.destroy());
    }

    private button(x: number, y: number, label: string, action: () => void): GameObjects.Text {
        const button = this.add.text(x, y, label, {
            fontFamily: 'Arial', fontSize: '24px', color: '#ffffff',
            backgroundColor: '#355773', padding: { x: 22, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        button.on('pointerdown', action);
        button.on('pointerover', () => button.setBackgroundColor('#476d8a'));
        button.on('pointerout', () => button.setBackgroundColor('#355773'));
        return button;
    }

    private angleButton(x: number, label: string, change: number): void {
        let repeat: Time.TimerEvent | undefined;
        const stop = () => {
            repeat?.remove();
            repeat = undefined;
        };
        const button = this.button(x, 650, label, () => {
            stop();
            if (this.busy || this.won) return;
            this.adjustAngle(change);
            // Preserve single-click precision, then repeat while held.
            repeat = this.time.delayedCall(300, () => {
                this.adjustAngle(change);
                repeat = this.time.addEvent({
                    delay: 70,
                    loop: true,
                    callback: () => {
                        if (this.busy || this.won) stop();
                        else this.adjustAngle(change);
                    }
                });
            });
        });
        button.on('pointerout', stop);
        this.input.on('pointerup', stop);
        this.input.on('pointerupoutside', stop);
        this.input.on('gameout', stop);
        this.game.events.on('blur', stop);
        this.events.once('shutdown', () => {
            stop();
            this.input.off('pointerup', stop);
            this.input.off('pointerupoutside', stop);
            this.input.off('gameout', stop);
            this.game.events.off('blur', stop);
        });
    }

    private adjustAngle(change: number): void {
        if (this.busy || this.won) return;
        this.angle = Math.max(10, Math.min(80, this.angle + change));
        this.drawCannon();
    }

    private muzzle(): { x: number; y: number } {
        const radians = this.angle * Math.PI / 180;
        return { x: this.cannonX + Math.cos(radians) * 44, y: this.cannonY - Math.sin(radians) * 44 };
    }

    private drawCannon(): void {
        const tip = this.muzzle();
        this.cannon.clear();
        this.cannon.lineStyle(16, 0x9eb4bf);
        this.cannon.lineBetween(this.cannonX, this.cannonY, tip.x, tip.y);
        this.cannon.fillStyle(0x101b28);
        this.cannon.fillCircle(this.cannonX, this.cannonY + 3, 19);
        this.cannon.fillStyle(0x8296a0);
        this.cannon.fillCircle(this.cannonX, this.cannonY + 3, 9);
        this.angleLabel.setText(`${this.angle}°`);
    }

    private fire(): void {
        if (this.busy || this.won) return;
        this.projectile?.destroy();
        this.busy = true;
        this.shots++;
        this.sounds.fire();
        this.fireButton.setAlpha(0.45);
        this.status.setText(`Shot ${this.shots} in flight…`);
        const tip = this.muzzle();
        this.projectile = new Projectile(this, tip.x, tip.y, this.angle, this.terrain, (x, y) => this.land(x, y));
    }

    private land(x: number, y: number): void {
        this.won = this.terrain.isTargetHit(x, y);
        this.sounds.land(this.won);
        if (this.won) this.explodeTarget();
        const explosion = this.add.circle(x, y, 8, this.won ? 0xffdd77 : 0xff914d, 0.9);
        this.tweens.add({
            targets: explosion, scale: this.terrain.hitRadius / 8, alpha: 0, duration: 650,
            onComplete: () => {
                explosion.destroy();
                this.busy = false;
                this.fireButton.setAlpha(this.won ? 0.45 : 1);
            }
        });
        const distance = Math.round(Math.abs(x - this.terrain.target.x));
        this.status.setText(this.won
            ? `You win! ${this.shots} shot${this.shots === 1 ? '' : 's'} — try a new target.`
            : `Missed ${distance}px ${x < this.terrain.target.x ? 'short' : 'long'}. Adjust your angle and try again.`);
    }

    private explodeTarget(): void {
        const { x, y } = this.terrain.target;
        const centerY = y - 30;
        const flash = this.add.circle(x, centerY, 12, 0xfff4bd).setDepth(10);
        this.tweens.add({
            targets: flash, scale: 6, alpha: 0, duration: 450, ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });
        const ring = this.add.circle(x, centerY, 14).setStrokeStyle(3, 0xffb347).setDepth(10);
        this.tweens.add({
            targets: ring, scale: 7, alpha: 0, duration: 700, ease: 'Cubic.Out',
            onComplete: () => ring.destroy()
        });
        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const distance = 55 + Math.random() * 55;
            const spark = this.add.circle(x, centerY, 3 + Math.random() * 3,
                i % 2 === 0 ? 0xffd166 : 0xff763b).setDepth(10);
            this.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                scale: 0, alpha: 0, duration: 500 + Math.random() * 300, ease: 'Cubic.Out',
                onComplete: () => spark.destroy()
            });
        }
    }

    update(_time: number, delta: number): void {
        this.projectile?.update(delta);
    }
}
