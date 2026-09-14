import { artilleryConfig } from '../config/artillery';
import { Scene, Math as PhaserMath } from 'phaser';

/** Owns the ground surface and target placement. */
export class Terrain {
    readonly target: { x: number; y: number };
    readonly hitRadius = artilleryConfig.hitRadius;

    constructor(scene: Scene, width: number, height: number) {
        const ground = scene.add.graphics();
        ground.fillStyle(0x284b38);
        ground.beginPath();
        ground.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) {
            ground.lineTo(x, this.heightAt(x));
        }
        ground.lineTo(width, height);
        ground.closePath();
        ground.fillPath();
        ground.lineStyle(3, 0x81b875);
        ground.beginPath();
        ground.moveTo(0, this.heightAt(0));
        for (let x = 4; x <= width; x += 4) ground.lineTo(x, this.heightAt(x));
        ground.strokePath();

        const x = PhaserMath.Between(Math.round(width * 0.56), Math.round(width * 0.85));
        this.target = { x, y: this.heightAt(x) };
        scene.add.ellipse(x, this.target.y, this.hitRadius * 2, 12, 0xffcf70, 0.25);
        scene.add.rectangle(x, this.target.y - 24, 5, 48, 0xe8e2d0);
        scene.add.circle(x, this.target.y - 44, 20, 0xe76f51);
        scene.add.circle(x, this.target.y - 44, 13, 0xfff0ce);
        scene.add.circle(x, this.target.y - 44, 6, 0xe76f51);
    }

    // Replace this function to introduce hills; rendering and collision share it.
    heightAt(_x: number): number {
        return 550;
    }

    isTargetHit(x: number, y: number): boolean {
        return Math.hypot(x - this.target.x, y - this.target.y) <= this.hitRadius;
    }
}
