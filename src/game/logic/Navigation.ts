export type Wind = { x: number; y: number; magnitude: number };
export type SailingConfig = { crosswindSpeedFactor: number; leeway: number; fullSpeed: number };

/** Centers and ellipse radii are fractions of the map width/height. */
export type Gyre = {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    direction: 'clockwise' | 'anticlockwise';
    strength?: number;
};

/** Additive streamfunction: its rotated gradient is the prevailing wind. */
export function gyrePotential(x: number, y: number, gyres: readonly Gyre[]): number {
    return gyres.reduce((sum, gyre) => {
        // Use wrapping distances to match the ocean's boundary behavior.
        const dx = ((x - gyre.centerX + 1.5) % 1 - 0.5) / gyre.radiusX;
        const dy = ((y - gyre.centerY + 1.5) % 1 - 0.5) / gyre.radiusY;
        const radius = Math.hypot(dx, dy);
        const sign = gyre.direction === 'clockwise' ? 1 : -1;
        return sum + sign * (gyre.strength ?? 1) * 2 * Math.tanh((radius - 1) / 0.3);
    }, 0);
}

export function createWind(column: number, row: number, columns: number, rows: number,
    gyres: readonly Gyre[]): Wind {
    const x = (column + 0.5) / columns, y = (row + 0.5) / rows;
    const epsilon = 0.001;
    const vx = -(gyrePotential(x, y + epsilon, gyres) - gyrePotential(x, y - epsilon, gyres)) / rows;
    const vy = (gyrePotential(x + epsilon, y, gyres) - gyrePotential(x - epsilon, y, gyres)) / columns;
    const magnitude = Math.hypot(vx, vy);
    return magnitude > 1e-10
        ? { x: vx / magnitude, y: vy / magnitude, magnitude: 0.12 }
        : { x: 1, y: 0, magnitude: 0.12 };
}

export function sailingVelocity(heading: number, wind: Wind, config: SailingConfig) {
    const x = Math.cos(heading);
    const y = Math.sin(heading);
    const alignment = Math.max(-1, Math.min(1, x * wind.x + y * wind.y));
    const fullSpeed = config.fullSpeed * wind.magnitude;
    // Tolerate floating-point noise at exactly 90 degrees.
    const drifting = alignment < -1e-10;
    const speed = fullSpeed * (drifting ? config.leeway
        : config.crosswindSpeedFactor + (1 - config.crosswindSpeedFactor) * Math.max(0, alignment));
    return { x: (drifting ? wind.x : x) * speed, y: (drifting ? wind.y : y) * speed,
        speed, drifting, angle: Math.acos(alignment) * 180 / Math.PI };
}
