import { Scene, GameObjects, Input } from 'phaser';
import { robotConfig } from '../config/robot';
import { RobotBoard, MAX_ROBOT_INSTRUCTIONS, type RobotInstruction } from '../logic/RobotBoard';
import { RobotSounds } from '../audio/RobotSounds';
import { drawRobot, drawRobotInstruction } from '../visuals/RobotFigure';
import { installSettings } from '../settings/dialog';
import { t } from '../i18n';

const instructionName = (instruction: RobotInstruction) => t({ forward: 'Move forward', left: 'Turn left', right: 'Turn right' }[instruction]);
type Drag = { piece: 'robot' | 'star'; pointer: number };

export class RobotGame extends Scene {
    private board!: RobotBoard;
    private sounds!: RobotSounds;
    private robot!: GameObjects.Graphics;
    private star!: GameObjects.Star;
    private terrain!: GameObjects.Graphics;
    private phaseControls!: GameObjects.Container;
    private panel!: GameObjects.Container;
    private status!: GameObjects.Text;
    private phase: 'design' | 'program' = 'design';
    private busy = false;
    private cursor = 0;
    private offset = 0;
    private active = -1;
    private cell = 50;
    private left = 80;
    private top = 170;
    private drag?: Drag;
    private pressedCell?: { cell: number; pointer: number };
    private celebration: GameObjects.Shape[] = [];
    private sadFace?: GameObjects.Graphics;
    private readonly pageSize = 18;

    constructor() { super('RobotGame'); }

    create(): void {
        this.board = new RobotBoard(robotConfig);
        this.sounds = new RobotSounds();
        this.phase = 'design'; this.busy = false; this.cursor = 0; this.offset = 0; this.active = -1;
        this.drag = undefined; this.pressedCell = undefined; this.celebration = []; this.sadFace = undefined;
        this.cell = Math.min(560 / this.board.columns, 500 / this.board.rows);
        this.left = 330 - this.board.columns * this.cell / 2;
        this.top = 420 - this.board.rows * this.cell / 2;
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(40, 25, t('ROBOT ROUTE'), { fontFamily: 'Arial', fontSize: '34px', color: '#fff0ce' });
        this.add.text(40, 73, t('Design a board, then program a route to the star.'), {
            fontFamily: 'Arial', fontSize: '20px', color: '#b9cbd7'
        });
        const menu = this.add.container();
        this.button(menu, 565, 39, 100, 36, t('MENU'), () => this.scene.start('MainMenu'));
        this.phaseControls = this.add.container();
        this.add.rectangle(330, 420, 584, 524, 0x102b33).setStrokeStyle(2, 0x65847d);
        this.terrain = this.add.graphics();
        this.star = this.add.star(0, 0, 5, this.cell * 0.17, this.cell * 0.39, 0xffd166).setStrokeStyle(2, 0xfff0ce);
        this.robot = this.add.graphics(); drawRobot(this.robot, this.cell);
        this.add.zone(330, 420, this.board.columns * this.cell, this.board.rows * this.cell)
            .setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Input.Pointer) => this.boardDown(pointer));
        const move = (pointer: Input.Pointer) => {
            if (!this.drag || this.drag.pointer !== pointer.id) return;
            if (!pointer.isDown || this.phase !== 'design' || !this.scene.isActive()) { this.cancelDrag(); return; }
            const figure = this.drag.piece === 'robot' ? this.robot : this.star;
            figure.setPosition(pointer.x, pointer.y).setAlpha(0.7);
        };
        const up = (pointer?: Input.Pointer) => this.boardUp(pointer);
        const out = () => this.cancelDrag();
        this.input.on('pointermove', move);
        this.input.on('pointerup', up);
        this.input.on('gameout', out);
        this.events.on('pause', out);
        this.panel = this.add.container();
        this.status = this.add.text(40, 693, '', {
            fontFamily: 'Arial', fontSize: '19px', color: '#c8e7dd', wordWrap: { width: 560 }, lineSpacing: 4
        });
        this.renderBoard(); this.renderControls(); this.renderPanel();
        this.message(t('Drag the robot and star. Click squares to add or remove obstacles.'));
        this.events.once('shutdown', () => {
            this.time.removeAllEvents(); this.tweens.killAll();
            this.input.off('pointermove', move); this.input.off('pointerup', up); this.input.off('gameout', out);
            this.events.off('pause', out); this.sounds.destroy();
            this.drag = undefined; this.pressedCell = undefined;
        });
        installSettings(this, 'RobotGame', this.sounds);
    }

    private point(cell: number): { x: number; y: number } {
        return { x: this.left + (cell % this.board.columns + 0.5) * this.cell,
            y: this.top + (Math.floor(cell / this.board.columns) + 0.5) * this.cell };
    }

    private cellAt(pointer: Input.Pointer): number | undefined {
        const x = Math.floor((pointer.x - this.left) / this.cell), y = Math.floor((pointer.y - this.top) / this.cell);
        if (x < 0 || x >= this.board.columns || y < 0 || y >= this.board.rows) return undefined;
        return y * this.board.columns + x;
    }

    private boardDown(pointer: Input.Pointer): void {
        if (this.phase !== 'design' || this.busy || this.drag || this.pressedCell) return;
        this.sounds.unlock();
        const cell = this.cellAt(pointer);
        if (cell === undefined) return;
        if (cell === this.board.start || cell === this.board.target) {
            this.drag = { piece: cell === this.board.start ? 'robot' : 'star', pointer: pointer.id };
            (this.drag.piece === 'robot' ? this.robot : this.star).setAlpha(0.7);
        } else this.pressedCell = { cell, pointer: pointer.id };
    }

    private boardUp(pointer?: Input.Pointer): void {
        // The shared settings dialog emits a synthetic pointerup without a pointer.
        if (!pointer || !this.scene.isActive() || this.phase !== 'design') return;
        const cell = this.cellAt(pointer);
        if (this.drag?.pointer === pointer.id) {
            if (cell !== undefined && !this.board.movePiece(this.drag.piece, cell)) {
                this.message(t('Choose a free square for the robot or star.'), '#ffd199');
            }
            this.cancelDrag();
        } else if (this.pressedCell?.pointer === pointer.id) {
            if (cell === this.pressedCell.cell) this.board.toggleObstacle(cell);
            this.pressedCell = undefined; this.renderBoard();
        }
    }

    private cancelDrag(): void {
        if (!this.drag && !this.pressedCell) return;
        this.drag = undefined; this.pressedCell = undefined;
        this.robot.setAlpha(1); this.star.setAlpha(1); this.renderBoard();
    }

    private renderBoard(): void {
        const g = this.terrain.clear(), s = this.cell;
        for (let cell = 0; cell < this.board.columns * this.board.rows; cell++) {
            const p = this.point(cell), obstacle = this.board.obstacles.has(cell);
            g.fillStyle(obstacle ? 0x607387 : ((cell % this.board.columns + Math.floor(cell / this.board.columns)) % 2 ? 0x214e51 : 0x28595a));
            g.fillRect(p.x - s / 2 + 1, p.y - s / 2 + 1, s - 2, s - 2);
            if (obstacle) {
                g.lineStyle(Math.max(1, s * 0.03), 0x92a4af);
                g.strokeRoundedRect(p.x - s * 0.36, p.y - s * 0.36, s * 0.72, s * 0.72, s * 0.06);
                g.lineBetween(p.x - s * 0.2, p.y - s * 0.2, p.x + s * 0.2, p.y + s * 0.2);
                g.lineBetween(p.x + s * 0.2, p.y - s * 0.2, p.x - s * 0.2, p.y + s * 0.2);
            }
        }
        const start = this.point(this.board.start);
        g.lineStyle(Math.max(1, s * 0.04), 0x82dbc2);
        g.strokeCircle(start.x, start.y, s * 0.41);
        const p = this.point(this.board.position), target = this.point(this.board.target);
        this.robot.setPosition(p.x, p.y).setAngle(this.board.heading * 90);
        this.star.setPosition(target.x, target.y);
    }

    private button(parent: GameObjects.Container, x: number, y: number, width: number, height: number,
        text: string, action: () => void, enabled = true, selected = false): void {
        const background = this.add.rectangle(x, y, width, height, selected ? 0x4c7266 : 0x355773)
            .setStrokeStyle(selected ? 2 : 1, selected ? 0xffd166 : 0x7593a6).setAlpha(enabled ? 1 : 0.35);
        const label = this.add.text(x, y, text, { fontFamily: 'Arial', fontSize: '17px', color: '#fff0ce',
            align: 'center', wordWrap: { width: width - 8 } }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.4);
        parent.add([background, label]);
        if (enabled) background.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.sounds.unlock(); action();
        });
    }

    private text(parent: GameObjects.Container, x: number, y: number, text: string, size = 18, color = '#b9cbd7', width = 300): void {
        parent.add(this.add.text(x, y, text, { fontFamily: 'Arial', fontSize: `${size}px`, color, wordWrap: { width }, lineSpacing: 5 }));
    }

    private renderControls(): void {
        const controls = this.phaseControls; controls.removeAll(true);
        this.button(controls, 176, 122, 272, 42, t('1. Design the board'), () => this.setPhase('design'), true, this.phase === 'design');
        this.button(controls, 466, 122, 272, 42, t('2. Program the robot'), () => this.setPhase('program'), !this.busy, this.phase === 'program');
    }

    private setPhase(phase: 'design' | 'program'): void {
        if (this.busy) {
            if (phase !== 'design') return;
            this.stop();
        }
        if (phase === 'design') {
            this.board.program.length = 0;
            this.cursor = 0; this.offset = 0;
        }
        this.cancelDrag(); this.clearFeedback(); this.phase = phase; this.board.reset(); this.active = -1;
        this.renderBoard(); this.renderControls(); this.renderPanel();
        this.message(phase === 'design' ? t('Drag the robot and star. Click squares to add or remove obstacles.')
            : t('Choose an insertion line, then an instruction. GO runs from the starting square.'));
    }

    private renderPanel(): void {
        const panel = this.panel; panel.removeAll(true);
        if (this.phase === 'design') {
            panel.add(this.add.rectangle(818, 455, 340, 594, 0x203950).setStrokeStyle(1, 0x54728a));
            this.text(panel, 670, 178, t('BUILD YOUR CHALLENGE'), 23, '#fff0ce');
            this.text(panel, 670, 232, t('Drag the robot to its start.\nDrag the star to the target.\n\nClick an empty square to add a block. Click a block to remove it.'), 20);
            this.text(panel, 670, 433, t('The gold nose is the front.\nForward moves one square.\nTurns rotate in place.'), 20, '#d6f5e7');
            this.button(panel, 818, 554, 290, 46, t('Rotate starting direction'), () => { this.board.rotateStart(); this.renderBoard(); });
            this.button(panel, 818, 612, 290, 42, t('Clear obstacles'), () => { this.board.obstacles.clear(); this.renderBoard(); });
            this.button(panel, 818, 701, 290, 52, t('Program the robot →'), () => this.setPhase('program'));
            return;
        }
        panel.add(this.add.rectangle(818, 384, 340, 752, 0x203950).setStrokeStyle(1, 0x54728a));
        this.text(panel, 670, 18, t('PROGRAM · {0} instructions', this.board.program.length), 18, '#fff0ce', 255);
        const editable = !this.busy;
        for (const [index, instruction] of (['forward', 'left', 'right'] as const).entries()) {
            const x = 722 + index * 96;
            this.button(panel, x, 75, 89, 42, '', () => this.insert(instruction), editable && this.board.program.length < MAX_ROBOT_INSTRUCTIONS);
            const icon = this.add.graphics().setPosition(x, 75).setAlpha(editable ? 1 : 0.35);
            drawRobotInstruction(icon, instruction); panel.add(icon);
            this.text(panel, x - 45, 101, instructionName(instruction), 12, '#c9d9df', 94);
        }
        const end = Math.min(this.board.program.length, this.offset + this.pageSize);
        for (let i = this.offset; i <= end; i++) {
            const y = 128 + (i - this.offset) * 28;
            const selected = this.cursor === i;
            const line = this.add.rectangle(818, y, 282, 8, selected && editable ? 0x7d6841 : 0x203950);
            panel.add(line);
            const rule = this.add.graphics().lineStyle(selected ? 2 : 1, selected ? 0xffd166 : 0x54728a);
            rule.lineBetween(685, y, 951, y); panel.add(rule);
            this.text(panel, 672, y - 7, '+', 12, selected ? '#ffd166' : '#8daab9');
            if (editable) line.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.cursor = i; this.renderPanel(); });
            if (i === end) break;
            const instruction = this.board.program[i], active = this.active === i;
            const row = this.add.rectangle(818, y + 14, 282, 20, active ? 0x5e6740 : 0x2b4b62)
                .setStrokeStyle(active ? 2 : 1, active ? 0xffd166 : 0x355773);
            panel.add(row);
            if (editable) row.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.cursor = i + 1; this.renderPanel(); });
            this.text(panel, 685, y + 5, String(i + 1), 14, active ? '#ffd166' : '#a6bec9', 36);
            const icon = this.add.graphics().setPosition(733, y + 14).setScale(0.7); drawRobotInstruction(icon, instruction); panel.add(icon);
            this.text(panel, 755, y + 5, instructionName(instruction), 15, '#fff0ce', 155);
            this.button(panel, 940, y + 14, 24, 20, '×', () => {
                this.clearFeedback(); this.board.remove(i); this.cursor = Math.min(this.cursor, this.board.program.length);
                this.active = -1; this.offset = Math.min(this.offset, this.lastPage());
                this.renderBoard(); this.renderPanel();
            }, editable);
        }
        if (!this.board.program.length) this.text(panel, 687, 176, t('Add instructions with the three buttons above.\n\nSelect a + line to insert there. Use × to delete.'), 20, '#c9d9df', 264);
        this.button(panel, 698, 658, 46, 32, '‹', () => {
            this.offset -= this.pageSize; this.cursor = this.offset; this.renderPanel();
        }, editable && this.offset > 0);
        this.text(panel, 747, 646, t('Page {0}/{1}', this.offset / this.pageSize + 1, this.lastPage() / this.pageSize + 1), 16, '#b9cbd7', 160);
        this.button(panel, 940, 658, 46, 32, '›', () => {
            this.offset += this.pageSize; this.cursor = this.offset; this.renderPanel();
        }, editable && this.offset < this.lastPage());
        this.button(panel, 742, 698, 130, 36, t('Clear program'), () => {
            this.clearFeedback(); this.board.program.length = 0; this.board.reset();
            this.cursor = 0; this.offset = 0; this.active = -1; this.renderBoard(); this.renderPanel();
        }, editable && this.board.program.length > 0);
        this.button(panel, 897, 698, 130, 36, t('Reset robot'), () => {
            this.clearFeedback(); this.board.reset(); this.active = -1; this.renderBoard(); this.renderPanel();
            this.message(t('Ready. Edit your program or press GO.'));
        }, editable);
        this.button(panel, 818, 741, 290, 38, this.busy ? t('STOP') : t('GO'), () => {
            if (this.busy) this.stop(); else this.go();
        }, this.busy || this.board.program.length > 0, true);
    }

    private lastPage(): number { return Math.floor(Math.max(0, this.board.program.length - 1) / this.pageSize) * this.pageSize; }

    private insert(instruction: RobotInstruction): void {
        if (this.busy || !this.board.insert(this.cursor, instruction)) return;
        this.clearFeedback(); this.cursor++; this.active = -1;
        if (this.cursor > this.offset + this.pageSize || this.cursor < this.offset) this.offset = Math.min(Math.floor(this.cursor / this.pageSize) * this.pageSize, this.lastPage());
        this.renderBoard(); this.renderPanel();
    }

    private go(): void {
        if (this.busy || !this.board.run()) return;
        this.clearFeedback(); this.busy = true; this.renderBoard(); this.renderControls(); this.execute();
    }

    private execute(): void {
        if (!this.busy) return;
        this.active = this.board.nextInstruction;
        this.offset = Math.floor(this.active / this.pageSize) * this.pageSize;
        const instruction = this.board.program[this.active], angle = this.robot.angle;
        const result = this.board.step();
        this.renderPanel();
        this.message(t('Instruction {0}/{1}: {2}', this.active + 1, this.board.program.length, instructionName(instruction)));
        const duration = robotConfig.stepDuration * 0.72;
        if (result === 'collision') {
            this.sounds.bump();
            const dx = [0, 1, 0, -1][this.board.heading], dy = [-1, 0, 1, 0][this.board.heading];
            this.tweens.add({ targets: this.robot, x: this.robot.x + dx * this.cell * 0.14,
                y: this.robot.y + dy * this.cell * 0.14, duration: duration / 3, yoyo: true });
        } else if (instruction === 'forward') {
            this.sounds.move();
            this.tweens.add({ targets: this.robot, ...this.point(this.board.position), duration, ease: 'Sine.easeInOut' });
        } else {
            this.sounds.turn();
            this.tweens.add({ targets: this.robot, angle: angle + (instruction === 'left' ? -90 : 90), duration, ease: 'Sine.easeInOut' });
        }
        this.time.delayedCall(robotConfig.stepDuration, () => {
            if (!this.busy) return;
            if (result === 'running') this.execute();
            else this.finish(result);
        });
    }

    private finish(result: string): void {
        this.busy = false; this.cursor = this.active + 1; this.renderControls(); this.renderPanel();
        if (result === 'success') {
            this.message(t('SUCCESS! Your program reached the star!'), '#ffd166');
            this.sounds.victory(); this.celebrate();
        } else {
            this.sounds.miss();
            this.sadden();
            if (result === 'collision') {
                this.message(t('Bump! Instruction {0} hit a block or the edge. Edit your program and try GO again.', this.active + 1), '#ffb4a2');
            } else this.message(t('The program ended away from the star. Edit it and try GO again.'), '#ffd199');
        }
    }

    private stop(): void {
        this.busy = false; this.time.removeAllEvents(); this.clearFeedback();
        this.board.stop(); this.board.reset(); this.active = -1;
        this.renderBoard(); this.renderControls(); this.renderPanel();
        this.message(t('Stopped. Your program is kept. GO starts again from the beginning.'));
    }

    private celebrate(): void {
        const target = this.point(this.board.target);
        this.tweens.add({ targets: this.star, scale: 1.22, duration: 300, yoyo: true, repeat: 3 });
        for (let i = 0; i < 32; i++) {
            const angle = i * Math.PI * 2 / 32;
            const confetti = this.add.rectangle(target.x, target.y, 5 + i % 4, 10, [0xffd166, 0x70ded0, 0xf37b60, 0xffffff][i % 4]);
            this.celebration.push(confetti);
            this.tweens.add({ targets: confetti, x: target.x + Math.cos(angle) * (60 + i % 5 * 15),
                y: target.y + Math.sin(angle) * 65 + 45, angle: 240, alpha: 0,
                duration: 1100 + i % 3 * 150, ease: 'Cubic.easeOut', onComplete: () => confetti.destroy() });
        }
    }

    private sadden(): void {
        drawRobot(this.robot.clear(), this.cell, true);
        this.tweens.add({ targets: this.robot, y: this.robot.y + this.cell * 0.1,
            scaleX: 1.08, scaleY: 0.78, duration: 300, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: this.robot, angle: this.robot.angle + 7,
            duration: 150, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
        const face = this.sadFace = this.add.graphics().setPosition(this.robot.x, Math.max(185, this.robot.y - this.cell * 0.7 - 24));
        face.fillStyle(0x182c42, 0.95); face.fillCircle(0, 0, 24);
        face.lineStyle(2, 0xffd166); face.strokeCircle(0, 0, 20);
        // Drooping eyes, an upturned arch for a frown, and a tear.
        face.lineBetween(-12, -7, -5, -4); face.lineBetween(5, -4, 12, -7);
        face.beginPath(); face.arc(0, 12, 7, Math.PI, Math.PI * 2); face.strokePath();
        face.fillStyle(0x75c9f0); face.fillEllipse(12, 4, 4, 8);
        this.tweens.add({ targets: face, y: face.y - 9, duration: 400, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    }

    private clearFeedback(): void {
        this.sounds.stop();
        this.tweens.killTweensOf(this.robot); this.robot.setScale(1);
        drawRobot(this.robot.clear(), this.cell);
        if (this.sadFace) {
            this.tweens.killTweensOf(this.sadFace); this.sadFace.destroy(); this.sadFace = undefined;
        }
        this.tweens.killTweensOf(this.star); this.star.setScale(1);
        for (const figure of this.celebration) { this.tweens.killTweensOf(figure); figure.destroy(); }
        this.celebration = [];
    }

    private message(text: string, color = '#c8e7dd'): void { this.status.setText(text).setColor(color); }
}
