import type { GameObjects } from 'phaser';

/** Friendly yellow helper with goggles, overalls and little boots; origin at its feet. */
export function drawYellowFriend(g: GameObjects.Graphics, size: number, happy = false): void {
    g.fillStyle(0x172b3d);
    for (const side of [-1, 1]) g.fillRoundedRect(side * size * 0.14 - size * 0.09, -size * 0.05, size * 0.2, size * 0.1, size * 0.04);
    g.fillStyle(0xffd84f);
    g.fillRoundedRect(-size * 0.28, -size * 1.02, size * 0.56, size * 0.99, size * 0.27);
    g.lineStyle(size * 0.065, 0xffd84f);
    for (const side of [-1, 1]) g.lineBetween(side * size * 0.24, -size * 0.47,
        side * size * 0.4, -size * (happy ? 0.7 : 0.3));
    g.fillStyle(0x4f9fcd); g.fillRoundedRect(-size * 0.28, -size * 0.35, size * 0.56, size * 0.31, size * 0.07);
    g.fillRect(-size * 0.15, -size * 0.48, size * 0.3, size * 0.25);
    g.fillStyle(0xffd84f); g.fillCircle(0, -size * 0.32, size * 0.035);
    g.fillStyle(0x203950); g.fillRect(-size * 0.28, -size * 0.78, size * 0.56, size * 0.08);
    for (const side of [-1, 1]) {
        const x = side * size * 0.13, y = -size * 0.74;
        g.fillStyle(0xb1cbd6); g.fillCircle(x, y, size * 0.15);
        g.fillStyle(0xffffff); g.fillCircle(x, y, size * 0.112);
        g.fillStyle(0x5a4433); g.fillCircle(x - size * 0.035, y, size * 0.054);
        g.fillStyle(0x142738); g.fillCircle(x - size * 0.045, y, size * 0.028);
    }
    g.lineStyle(size * 0.025, 0x5a4433);
    g.beginPath(); g.arc(0, -size * 0.57, size * 0.09, 0, Math.PI); g.strokePath();
    g.lineStyle(size * 0.025, 0x203950);
    for (const side of [-1, 1]) g.lineBetween(side * size * 0.06, -size * 1.0, side * size * 0.11, -size * 1.11);
}

/** A side-facing purple monster, with a larger mouth for the final cartoon gulp. */
export function drawMonster(g: GameObjects.Graphics, size: number, hungry = false): void {
    g.fillStyle(0x426b73);
    g.fillTriangle(-size * 0.4, -size * 0.45, -size * 0.7, -size * 0.1, -size * 0.3, -size * 0.15);
    g.fillStyle(0xac86d5); g.fillEllipse(-size * 0.03, -size * 0.39, size * 0.91, size * 0.93);
    g.fillStyle(0x7c5ea7); g.fillEllipse(-size * 0.12, -size * 0.17, size * 0.62, size * 0.34);
    g.fillStyle(0xbbe199);
    for (const x of [-0.3, 0.07]) g.fillTriangle(x * size, -size * 0.77, (x + 0.04) * size, -size * 1.06, (x + 0.19) * size, -size * 0.77);
    g.fillStyle(0x705392);
    for (const x of [-0.24, 0.19]) g.fillRoundedRect((x - 0.12) * size, -size * 0.05, size * 0.25, size * 0.12, size * 0.055);
    for (const [x, y] of [[0.06, -0.64], [0.3, -0.59]]) {
        g.fillStyle(0xffffff); g.fillCircle(x * size, y * size, size * 0.13);
        g.fillStyle(0x273b4a); g.fillCircle((x + 0.045) * size, y * size, size * 0.065);
    }
    g.fillStyle(0x302335);
    g.fillEllipse(size * 0.28, -size * 0.29, size * (hungry ? 0.62 : 0.37), size * (hungry ? 0.55 : 0.23));
    g.fillStyle(0xfff3db);
    for (const x of [0.16, 0.35]) g.fillTriangle((x - 0.04) * size, -size * (hungry ? 0.48 : 0.38),
        (x + 0.04) * size, -size * (hungry ? 0.48 : 0.38), x * size, -size * (hungry ? 0.33 : 0.28));
}
