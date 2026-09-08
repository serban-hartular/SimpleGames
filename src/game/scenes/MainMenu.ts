import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(512, 100, 'SIMPLE GAMES', {
            fontFamily: 'Arial', fontSize: '42px', color: '#fff0ce'
        }).setOrigin(0.5);
        this.add.text(512, 158, 'Choose a game to play', {
            fontFamily: 'Arial', fontSize: '22px', color: '#b9cbd7'
        }).setOrigin(0.5);

        const games = [
            { name: 'Artillery', scene: 'ArtilleryGame', preview: () => this.artilleryPreview() },
            { name: 'Divisibility Game', scene: 'DivisibilityGame', preview: () => this.divisibilityPreview() }
        ];
        const columns = Math.min(3, games.length);
        games.forEach((game, index) => {
            const row = Math.floor(index / columns);
            const rowCount = Math.min(columns, games.length - row * columns);
            const x = 512 + (index % columns - (rowCount - 1) / 2) * 300;
            const y = 350 + row * 330;
            const border = this.add.rectangle(0, 0, 256, 256, 0x182c42)
                .setStrokeStyle(2, 0x54728a);
            const preview = game.preview();
            const name = this.add.text(0, 160, game.name, {
                fontFamily: 'Arial', fontSize: '28px', color: '#fff0ce'
            }).setOrigin(0.5);
            const card = this.add.container(x, y, [border, preview, name]);
            // Include the name in the clickable area as well as the square preview.
            const hitArea = this.add.zone(0, 24, 256, 308).setInteractive({ useHandCursor: true });
            card.add(hitArea);
            hitArea.on('pointerover', () => {
                border.setStrokeStyle(3, 0xffd166);
                card.setScale(1.025);
            });
            hitArea.on('pointerout', () => {
                border.setStrokeStyle(2, 0x54728a);
                card.setScale(1);
            });
            hitArea.on('pointerdown', () => this.scene.start(game.scene));
        });
    }

    private divisibilityPreview(): GameObjects.Container {
        const preview = this.add.container(0, 0);
        preview.add(this.add.rectangle(0, 0, 250, 250, 0x233e56));
        const balloons = [
            { x: -65, y: -58, value: 12, color: 0x75c9f0 },
            { x: 57, y: -45, value: 25, color: 0xffc56e },
            { x: -10, y: 43, value: 30, color: 0xc7a5ed }
        ];
        balloons.forEach(({ x, y, value, color }) => {
            const string = this.add.graphics().lineStyle(2, 0xb9cbd7);
            string.lineBetween(x, y + 31, x - 4, y + 49);
            preview.add([
                string,
                this.add.ellipse(x, y, 57, 68, color),
                this.add.ellipse(x - 13, y - 16, 7, 13, 0xffffff, 0.35),
                this.add.text(x, y, String(value), {
                    fontFamily: 'Arial', fontSize: '23px', fontStyle: 'bold', color: '#182c42'
                }).setOrigin(0.5)
            ]);
        });
        return preview;
    }

    /** A miniature gameplay illustration, drawn without external image assets. */
    private artilleryPreview(): GameObjects.Graphics {
        const graphics = this.add.graphics();
        graphics.fillStyle(0x182c42);
        graphics.fillRect(-125, -125, 250, 250);
        graphics.fillStyle(0x284b38);
        graphics.fillRect(-125, 65, 250, 60);
        graphics.lineStyle(2, 0x81b875);
        graphics.lineBetween(-125, 65, 125, 65);

        graphics.lineStyle(10, 0x9eb4bf);
        graphics.lineBetween(-94, 52, -69, 27);
        graphics.fillStyle(0x101b28);
        graphics.fillCircle(-94, 54, 13);
        graphics.fillStyle(0x8296a0);
        graphics.fillCircle(-94, 54, 6);

        graphics.fillStyle(0xffde91, 0.85);
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            graphics.fillCircle(-69 + 160 * t, 27 - 280 * t + 318 * t * t, 2);
        }
        graphics.fillStyle(0xfff3ce);
        graphics.fillCircle(31, 27 - 280 * 0.625 + 318 * 0.625 ** 2, 4);

        graphics.fillStyle(0xffcf70, 0.25);
        graphics.fillEllipse(91, 65, 48, 8);
        graphics.fillStyle(0xe8e2d0);
        graphics.fillRect(89, 31, 3, 34);
        graphics.fillStyle(0xe76f51);
        graphics.fillCircle(91, 32, 14);
        graphics.fillStyle(0xfff0ce);
        graphics.fillCircle(91, 32, 9);
        graphics.fillStyle(0xe76f51);
        graphics.fillCircle(91, 32, 4);
        return graphics;
    }
}
