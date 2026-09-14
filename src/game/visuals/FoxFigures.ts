import { Scene, GameObjects } from 'phaser';
import { foxConfig, FoxFigure } from '../config/fox';

export class FoxFigures {
    static preload(scene: Scene): void {
        for (const kind of ['fox', 'chicken', 'dog', 'pie'] as FoxFigure[]) {
            const asset = foxConfig.assets[kind];
            const key = `farm-${kind}-asset`;
            if (scene.anims.exists(`${key}-walk`)) scene.anims.remove(`${key}-walk`);
            if (scene.textures.exists(key)) scene.textures.remove(key);
            if (!asset) continue;
            if (asset.frameWidth && asset.frameHeight) scene.load.spritesheet(`farm-${kind}-asset`, asset.url,
                { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
            else scene.load.image(`farm-${kind}-asset`, asset.url);
        }
    }

    static create(scene: Scene, kind: FoxFigure): GameObjects.Sprite {
        const asset = foxConfig.assets[kind], assetKey = `farm-${kind}-asset`, fallbackKey = `farm-${kind}-drawing`;
        if (!scene.textures.exists(fallbackKey)) {
            const g = scene.add.graphics();
            if (kind === 'pie') {
                g.fillStyle(0xb27443); g.fillEllipse(20, 24, 34, 23);
                g.fillStyle(0xf0c478); g.fillEllipse(20, 20, 32, 22);
                g.lineStyle(2, 0x956237); for (let x = 11; x <= 29; x += 9) g.lineBetween(x, 14, x - 3, 24);
            } else if (kind === 'chicken') {
                g.fillStyle(0xfff5d8); g.fillEllipse(19, 23, 25, 25); g.fillCircle(26, 12, 9);
                g.fillStyle(0xe25446); g.fillCircle(23, 4, 4); g.fillCircle(29, 4, 4);
                g.fillStyle(0xffb543); g.fillTriangle(33, 11, 40, 15, 32, 18);
                g.lineStyle(2, 0xffb543); g.lineBetween(15, 33, 15, 39); g.lineBetween(24, 33, 24, 39);
                g.fillStyle(0x182c42); g.fillCircle(29, 11, 2);
            } else {
                const fox = kind === 'fox';
                g.fillStyle(fox ? 0xe88a36 : 0x966344);
                g.fillTriangle(6, 16, 5, 0, 18, 10); g.fillTriangle(23, 10, 35, 0, 34, 18);
                g.fillEllipse(20, 22, 31, 30);
                g.fillStyle(fox ? 0xffeed1 : 0xd6b286); g.fillTriangle(5, 22, 35, 22, 20, 38);
                g.fillStyle(0x182c42); g.fillCircle(13, 18, 2.5); g.fillCircle(27, 18, 2.5); g.fillCircle(20, 31, 3);
            }
            g.generateTexture(fallbackKey, 40, 40); g.destroy();
        }
        const sprite = scene.add.sprite(0, 0, asset && scene.textures.exists(assetKey) ? assetKey : fallbackKey).setDisplaySize(28, 28);
        if (asset?.frameWidth && asset.frameHeight && asset.animation && sprite.texture.key === assetKey) {
            const key = `${assetKey}-walk`;
            if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(assetKey,
                { start: asset.animation.start, end: asset.animation.end }), frameRate: asset.animation.frameRate, repeat: -1 });
            sprite.play(key);
        }
        return sprite;
    }
}
