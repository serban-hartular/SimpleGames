import { NavigationSounds } from '../audio/NavigationSounds';
import { NavigationMap, NavigationPort } from '../logic/NavigationMap';
import { Scene, GameObjects, Input } from 'phaser';
import { navigationConfig } from '../config/navigation';
import { sailingVelocity, Wind } from '../logic/Navigation';

export class NavigationGame extends Scene {
    private readonly ocean = { x: 32, y: 136, columns: 20, rows: 11, cell: 48 };
    private sounds!: NavigationSounds;
    private map!: NavigationMap;
    private ports: NavigationPort[] = [];
    private visitedPorts = new Set<number>();
    private portMarkers: GameObjects.Arc[] = [];
    private mission!: GameObjects.Text;
    private bumpedUntil = 0;
    private stationaryMs = 0;
    private sunk = false;
    private winds: Wind[][] = [];
    private ship!: GameObjects.Container;
    private readout!: GameObjects.Text;
    private highlight!: GameObjects.Rectangle;
    private readonly shipScale = 1;
    private readonly collisionRadius = 11.5;
    private heading = 0;
    private position = { x: 0, y: 0 };

    constructor() { super('NavigationGame'); }

    create(): void {
        const config = navigationConfig;
        if (!Number.isFinite(config.crosswindSpeedFactor) || config.crosswindSpeedFactor < 0 || config.crosswindSpeedFactor > 1
            || !Number.isFinite(config.leeway) || config.leeway < 0 || config.leeway > 1
            || !Number.isFinite(config.fullSpeed) || config.fullSpeed <= 0) {
            throw new Error('Navigation: speed factors must be between 0 and 1, and fullSpeed must be positive and finite.');
        }
        this.sounds = new NavigationSounds();
        this.sounds.unlock();
        this.events.once('shutdown', () => this.sounds.destroy());
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(32, 28, 'CARAVEL', { fontFamily: 'Arial', fontSize: '36px', color: '#fff0ce' });
        this.add.text(32, 82, 'Click the ocean to steer. Visit all three docking rings in any order.', {
            fontFamily: 'Arial', fontSize: '20px', color: '#b9cbd7'
        });
        const { x, y, columns, rows, cell } = this.ocean;
        if (!Number.isInteger(config.islandCount) || config.islandCount < 0 || config.islandCount > 12
            || (config.seed !== null && !Number.isInteger(config.seed))) {
            throw new Error('Use an integer seed (or null) and islandCount from 0 to 12.');
        }
        let seed = config.seed ?? Math.floor(Math.random() * 4294967296);
        this.ports = [];
        for (let attempt = 0; attempt < 30; attempt++) {
            this.map = new NavigationMap(columns, rows, { seed, islandCount: Math.max(1, config.islandCount),
                landFineness: config.landFineness, gyres: config.gyres,
                offshoreStrength: config.offshoreStrength, coastalInfluenceDistance: config.coastalInfluenceDistance });
            const ports = this.map.createPorts();
            if (ports) { this.ports = ports; break; }
            seed = (seed + 1) >>> 0;
        }
        if (this.ports.length !== 3) throw new Error('Could not generate three accessible ports. Try another map seed.');
        this.visitedPorts.clear();
        this.portMarkers = [];
        this.bumpedUntil = 0;
        this.stationaryMs = 0;
        this.sunk = false;
        const graphics = this.add.graphics();
        const arrows = this.add.graphics().setDepth(1);
        this.winds = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
            const wind = this.map.winds[row][column];
            graphics.fillStyle(0x133f58);
            graphics.fillRect(x + column * cell, y + row * cell, cell, cell);
            graphics.fillStyle(0x3299ae, wind.magnitude * 0.3);
            graphics.fillRect(x + column * cell, y + row * cell, cell, cell);
            graphics.lineStyle(1, 0x527b8d, 0.35);
            graphics.strokeRect(x + column * cell, y + row * cell, cell, cell);
            const cx = x + (column + 0.5) * cell;
            const cy = y + (row + 0.5) * cell;
            if (this.map.isWindCellFullyLand(column, row)) return wind;
            const length = 7 + 26 * wind.magnitude;
            const endX = cx + wind.x * length / 2;
            const endY = cy + wind.y * length / 2;
            arrows.lineStyle(2, 0xb8e6df, 0.55 + wind.magnitude * 0.4);
            arrows.lineBetween(cx - wind.x * length / 2, cy - wind.y * length / 2, endX, endY);
            for (const side of [-1, 1]) arrows.lineBetween(endX, endY,
                endX - wind.x * 5 - wind.y * side * 3, endY - wind.y * 5 + wind.x * side * 3);
            return wind;
        }));
        // Render terrain over the ocean, without outlining individual fine tiles.
        const terrain = this.add.graphics();
        const tile = cell / this.map.landFineness;
        for (let row = 0; row < this.map.landRows; row++) {
            for (let col = 0; col < this.map.landColumns; col++) {
                if (!this.map.land[row][col]) continue;
                const coastal = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) =>
                    !this.map.isLand((col + dx + 0.5) / this.map.landFineness,
                        (row + dy + 0.5) / this.map.landFineness));
                terrain.fillStyle(coastal ? 0xb4b67b : 0x527948);
                terrain.fillRect(x + col * tile, y + row * tile, tile + 0.1, tile + 0.1);
            }
        }
        this.highlight = this.add.rectangle(0, 0, cell, cell).setStrokeStyle(2, 0xffd166, 0.9);
        this.add.zone(x + columns * cell / 2, y + rows * cell / 2, columns * cell, rows * cell)
            .setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Input.Pointer) => {
                this.sounds.unlock();
                const dx = pointer.x - this.position.x;
                const dy = pointer.y - this.position.y;
                if (Math.hypot(dx, dy) > 3) this.heading = Math.atan2(dy, dx);
            });
        this.position = { x: x + this.map.spawn.x * cell, y: y + this.map.spawn.y * cell };
        const wind = this.localWind();
        this.heading = Math.atan2(wind.y, wind.x);
        const hull = this.add.graphics();
        hull.fillStyle(0x85502f);
        hull.lineStyle(2, 0xffd99b);
        hull.beginPath(); hull.moveTo(23, 0); hull.lineTo(8, -10); hull.lineTo(-18, -9);
        hull.lineTo(-21, 0); hull.lineTo(-18, 9); hull.lineTo(8, 10); hull.closePath();
        hull.fillPath(); hull.strokePath();
        hull.lineStyle(3, 0x422b22); hull.lineBetween(-5, -16, -5, 16);
        hull.fillStyle(0xfff0ce); hull.fillTriangle(-4, -16, 13, 0, -4, 16);
        hull.lineStyle(1, 0xc7aa78); hull.lineBetween(-4, -16, -4, 16);
        this.ship = this.add.container(this.position.x, this.position.y, [hull]).setScale(this.shipScale).setDepth(3);
        this.readout = this.add.text(32, 682, '', {
            fontFamily: 'Arial', fontSize: '19px', color: '#fff0ce', lineSpacing: 9
        });
        this.mission = this.add.text(320, 38, '', {
            fontFamily: 'Arial', fontSize: '21px', color: '#fff0ce', lineSpacing: 10
        });
        this.ports.forEach(port => {
            const px = x + port.x * cell, py = y + port.y * cell;
            const dockX = x + port.dockX * cell, dockY = y + port.dockY * cell;
            const pier = this.add.graphics().setDepth(4).lineStyle(4, 0xc49c65);
            pier.lineBetween(px, py, dockX, dockY);
            this.add.rectangle(px, py, 12, 12, 0xfff0ce).setStrokeStyle(2, 0x85502f).setDepth(4);
            this.portMarkers.push(this.add.circle(dockX, dockY, port.radius * cell, 0xffd166, 0.12)
                .setStrokeStyle(2, 0xffd166).setDepth(4));
            this.add.text(px, py - 23, port.name, { fontFamily: 'Arial', fontSize: '16px',
                color: '#ffffff', backgroundColor: '#182c42', padding: { x: 3, y: 2 }
            }).setOrigin(0.5).setDepth(5);
        });
        this.updateMission();
        this.add.text(884, 684, 'MENU', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff',
            backgroundColor: '#355773', padding: { x: 14, y: 8 }
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MainMenu'));
        this.add.text(32, 713, 'Land blocks the caravel. Map edges wrap. Gold marks the local wind.', {
            fontFamily: 'Arial', fontSize: '16px', color: '#b9cbd7'
        });
        this.add.text(724, 684, 'NEW MAP', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff',
            backgroundColor: '#355773', padding: { x: 14, y: 8 }
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart());
        this.add.text(32, 741, `Map seed: ${seed}`, { fontFamily: 'Arial', fontSize: '14px', color: '#b9cbd7' });
        this.update(0, 0);
    }

    private updateMission(): void {
        this.mission.setText(this.visitedPorts.size === this.ports.length ? 'YOU WIN! All ports visited.'
            : `Visited: ${this.visitedPorts.size}/${this.ports.length}    ` + this.ports.map((port, i) =>
                `${this.visitedPorts.has(i) ? '✓' : '○'} ${port.name}`).join('    '));
        this.portMarkers.forEach((marker, i) => {
            const visited = this.visitedPorts.has(i);
            const color = visited ? 0x7cddbc : 0xffd166;
            marker.setStrokeStyle(visited ? 2 : 3, color).setFillStyle(color, 0.16);
        });
    }

    private celebratePort(port: NavigationPort): void {
        const x = this.ocean.x + port.dockX * this.ocean.cell;
        const y = this.ocean.y + port.dockY * this.ocean.cell;
        this.sounds.victory();
        for (let i = 0; i < 3; i++) {
            const ring = this.add.circle(x, y, port.radius * this.ocean.cell)
                .setStrokeStyle(4, 0xffd166).setDepth(10).setAlpha(0);
            this.tweens.add({
                targets: ring, scale: { from: 1, to: 3 }, alpha: { from: 1, to: 0 },
                delay: i * 180, duration: 1000, ease: 'Cubic.Out',
                onComplete: () => ring.destroy()
            });
        }
        const label = this.add.text(x, y - 45, `${port.name} reached!`, {
            fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: '#ffdf80',
            stroke: '#182c42', strokeThickness: 4
        }).setOrigin(0.5).setDepth(11);
        this.tweens.add({ targets: label, y: y - 80, alpha: 0,
            delay: 500, duration: 1100, onComplete: () => label.destroy() });
    }

    private checkPort(): void {
        const { x, y, cell } = this.ocean;
        let changed = false;
        this.ports.forEach((port, i) => {
            if (this.visitedPorts.has(i)) return;
            if (Math.hypot(this.position.x - (x + port.dockX * cell),
                this.position.y - (y + port.dockY * cell)) <= port.radius * cell) {
                this.visitedPorts.add(i);
                this.celebratePort(port);
                changed = true;
            }
        });
        if (changed) this.updateMission();
    }

    private localWind(): Wind {
        const { x, y, cell } = this.ocean;
        return this.winds[Math.floor((this.position.y - y) / cell)][Math.floor((this.position.x - x) / cell)];
    }

    private checkStuck(delta: number, moved: boolean): void {
        if (this.sunk || this.visitedPorts.size === this.ports.length) return;
        this.stationaryMs = moved ? 0 : this.stationaryMs + delta;
        if (this.stationaryMs < 10_000) return;
        this.sunk = true;
        this.add.rectangle(512, 400, 640, 150, 0x102438, 0.96)
            .setStrokeStyle(2, 0xffd166).setDepth(20);
        this.add.text(512, 380, 'You sank and drowned!', {
            fontFamily: 'Arial', fontSize: '36px', color: '#fff0ce'
        }).setOrigin(0.5).setDepth(21);
        this.add.text(512, 435, 'Restarting…', {
            fontFamily: 'Arial', fontSize: '20px', color: '#b9cbd7'
        }).setOrigin(0.5).setDepth(21);
        this.time.delayedCall(2500, () => this.scene.restart());
    }

    update(_time: number, delta: number): void {
        if (this.sunk) return;
        let moved = false;
        const { x, y, columns, rows, cell } = this.ocean;
        let remaining = this.visitedPorts.size === this.ports.length ? 0 : Math.min(delta / 1000, 0.1);
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / 120);
            const velocity = sailingVelocity(this.heading, this.localWind(), navigationConfig);
            const width = columns * cell;
            const height = rows * cell;
            const nextX = x + ((this.position.x - x + velocity.x * step) % width + width) % width;
            const nextY = y + ((this.position.y - y + velocity.y * step) % height + height) % height;
            // A smaller collision circle makes narrow channels more forgiving.
            if (this.map.canOccupy((nextX - x) / cell, (nextY - y) / cell, this.collisionRadius / cell)) {
                moved ||= Math.hypot(velocity.x * step, velocity.y * step) > 1e-8;
                this.position = { x: nextX, y: nextY };
                this.checkPort();
                if (this.visitedPorts.size === this.ports.length) break;
            } else {
                if (this.time.now >= this.bumpedUntil) this.cameras.main.shake(100, 0.002);
                this.bumpedUntil = this.time.now + 180;
                break;
            }
            remaining -= step;
        }
        this.checkStuck(delta, moved);
        this.ship.setPosition(this.position.x, this.position.y).setRotation(this.heading);
        const column = Math.floor((this.position.x - x) / cell);
        const row = Math.floor((this.position.y - y) / cell);
        this.highlight.setPosition(x + (column + 0.5) * cell, y + (row + 0.5) * cell);
        const wind = this.localWind();
        const velocity = sailingVelocity(this.heading, wind, navigationConfig);
        this.readout.setText(this.visitedPorts.size === this.ports.length ? 'VOYAGE COMPLETE'
            : this.time.now < this.bumpedUntil ? 'BUMP! TURN AWAY'
                : velocity.drifting ? 'DRIFTING DOWNWIND' : 'SAILING');

    }
}
