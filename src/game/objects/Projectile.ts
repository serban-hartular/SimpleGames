import { Scene, GameObjects } from 'phaser';
import { Terrain } from './Terrain';

/** Fixed-step ballistic motion in pixels and seconds, with a persistent trail. */
export class Projectile {
    static readonly speed = 570;
    static readonly gravity = 400;
    private readonly ball: GameObjects.Arc;
    private readonly trail: GameObjects.Graphics;
    private x: number;
    private y: number;
    private readonly vx: number;
    private vy: number;
    private accumulator = 0;
    private flying = true;
    private trailSteps = 0;
    // One dot every 8 physics steps = 1/15 second, independent of frame rate.
    private readonly stepsPerDot = 8;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        angle: number,
        private readonly terrain: Terrain,
        private readonly onLand: (x: number, y: number) => void
    ) {
        this.x = x;
        this.y = y;
        const radians = angle * Math.PI / 180;
        this.vx = Math.cos(radians) * Projectile.speed;
        this.vy = -Math.sin(radians) * Projectile.speed;
        this.trail = scene.add.graphics().fillStyle(0xffde91, 0.85);
        this.trail.fillCircle(x, y, 2.5);
        this.ball = scene.add.circle(x, y, 6, 0xfff3ce).setStrokeStyle(2, 0x243548);
    }

    update(delta: number): void {
        if (!this.flying) return;
        this.accumulator += delta / 1000;
        const step = 1 / 120;
        while (this.accumulator >= step && this.flying) {
            this.accumulator -= step;
            const nextX = this.x + this.vx * step;
            const nextY = this.y + this.vy * step + 0.5 * Projectile.gravity * step * step;
            this.vy += Projectile.gravity * step;
            let endX = nextX;
            let endY = nextY;
            const landed = nextY >= this.terrain.heightAt(nextX);
            if (landed) {
                // Locate contact along this short segment, also supporting sloped terrain.
                let low = 0;
                let high = 1;
                for (let i = 0; i < 12; i++) {
                    const t = (low + high) / 2;
                    const x = this.x + (nextX - this.x) * t;
                    const y = this.y + (nextY - this.y) * t;
                    if (y >= this.terrain.heightAt(x)) high = t;
                    else low = t;
                }
                endX = this.x + (nextX - this.x) * high;
                endY = this.terrain.heightAt(endX);
            }
            this.trailSteps++;
            if (!landed && this.trailSteps % this.stepsPerDot === 0) {
                this.trail.fillCircle(endX, endY, 2.5);
            }
            this.x = endX;
            this.y = endY;
            this.ball.setPosition(endX, endY);
            if (landed) {
                this.flying = false;
                this.ball.destroy();
                this.onLand(endX, endY);
            }
        }
    }

    destroy(): void {
        this.flying = false;
        this.ball.destroy();
        this.trail.destroy();
    }
}
