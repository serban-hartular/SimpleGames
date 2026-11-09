import type { GameObjects } from 'phaser';

/** Local north is forward; the gold nose projects beyond the body. */
export function drawRobot(g: GameObjects.Graphics, size: number, sad = false): void {
    g.fillStyle(0x102438);
    for (const side of [-1, 1]) {
        g.fillRoundedRect(side * size * 0.32 - size * 0.08, -size * 0.26, size * 0.16, size * 0.56, size * 0.04);
        g.lineStyle(size * 0.025, 0x87a9b8);
        for (let y = -2; y <= 2; y++) g.lineBetween(side * size * 0.32 - size * 0.05, y * size * 0.09,
            side * size * 0.32 + size * 0.05, y * size * 0.09);
    }
    g.fillStyle(0x70ded0);
    g.fillRoundedRect(-size * 0.26, -size * 0.29, size * 0.52, size * 0.61, size * 0.09);
    g.lineStyle(size * 0.025, 0xd2fff4);
    g.strokeRoundedRect(-size * 0.26, -size * 0.29, size * 0.52, size * 0.61, size * 0.09);
    g.fillStyle(0x17374a);
    g.fillRoundedRect(-size * 0.2, -size * 0.22, size * 0.4, size * 0.19, size * 0.04);
    g.fillStyle(0xffffff);
    for (const x of [-0.1, 0.1]) {
        if (sad) {
            g.lineStyle(size * 0.035, 0xffffff);
            g.lineBetween((x - 0.04) * size, -size * 0.15, (x + 0.04) * size, -size * 0.11);
        } else g.fillCircle(x * size, -size * 0.15, size * 0.045);
    }
    g.fillStyle(0xffd166);
    g.fillTriangle(0, -size * 0.49, -size * 0.16, -size * 0.27, size * 0.16, -size * 0.27);
    if (sad) {
        g.lineStyle(size * 0.035, 0xffd166);
        g.beginPath(); g.arc(0, size * 0.15, size * 0.09, Math.PI, Math.PI * 2); g.strokePath();
    } else g.fillTriangle(0, -size * 0.01, -size * 0.11, size * 0.13, size * 0.11, size * 0.13);
    g.fillStyle(0x368c91);
    g.fillRect(-size * 0.12, size * 0.23, size * 0.24, size * 0.035);
}

/** Clear geometric icons, independent of platform arrow glyphs. */
export function drawRobotInstruction(g: GameObjects.Graphics, instruction: 'forward' | 'left' | 'right'): void {
    g.lineStyle(3, 0xffd166);
    if (instruction === 'forward') {
        g.lineBetween(0, 9, 0, -9);
        g.lineBetween(0, -9, -7, -2); g.lineBetween(0, -9, 7, -2);
    } else {
        const side = instruction === 'left' ? -1 : 1;
        g.beginPath(); g.moveTo(-side * 7, 9); g.lineTo(-side * 7, -5); g.lineTo(side * 8, -5); g.strokePath();
        g.lineBetween(side * 8, -5, side, -12); g.lineBetween(side * 8, -5, side, 2);
    }
}
