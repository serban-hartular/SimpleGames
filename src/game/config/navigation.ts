import type { Gyre } from '../logic/Navigation';

/** Sailing factors are fractions of the local wind's full sailing speed. */
export const navigationConfig = {
    // null generates a fresh map; use an integer to replay a map.
    seed: null as number | null,
    islandCount: 4,
    // Land tiles per wind-cell side (1–30). 10 gives 100 terrain tiles per wind cell.
    landFineness: 10,
    // Normalized centers/radii (0–1); Y increases down the screen.
    gyres: [
        { centerX: 0.5, centerY: 0.25, radiusX: 0.28, radiusY: 0.19, direction: 'clockwise', strength: 1 },
        { centerX: 0.5, centerY: 0.75, radiusX: 0.28, radiusY: 0.19, direction: 'anticlockwise', strength: 1 }
    ] satisfies Gyre[],
    // Offshore wind added at continental shores (0 disables the correction).
    offshoreStrength: 0.2,
    // Blend correction over this many coarse wind squares offshore.
    coastalInfluenceDistance: 1.5,
    crosswindSpeedFactor: 0.25,
    leeway: 0.08,
    // Pixels per second at wind magnitude 1, sailing directly downwind.
    fullSpeed: 50
};
