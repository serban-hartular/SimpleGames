export type FoxSound = 'eatPie' | 'catchChicken' | 'chickenAlert' | 'dogAlert';
export type FoxFigure = 'fox' | 'chicken' | 'dog' | 'pie';
export type FigureAsset = {
    url: string;
    // Omit frame dimensions for a static image; provide both for a spritesheet.
    frameWidth?: number;
    frameHeight?: number;
    animation?: { start: number; end: number; frameRate: number };
};

export const foxConfig = {
    // Integer 1–10: height = 7 + 2 * zoom. 5 preserves the 25×17 maze.
    zoom: 3,
    // One player-controlled fox. All speeds are maze squares per second.
    speeds: { fox: 3, chickenWander: 1.4, chickenFlee: 2.3, dogPatrol: 1.8, dogChase: 3.5 },
    // Each count can be "auto" or an exact nonnegative integer.
    counts: { chickens: 'auto', pies: 'auto', dogs: 'auto' } as Record<'chickens' | 'pies' | 'dogs', number | 'auto'>,
    // null creates a new maze each game; an integer repeats the same setup.
    seed: null as number | null,
    // Example: chicken: { url: '/assets/chicken.png' }
    // Sprite: fox: { url: '/assets/fox.png', frameWidth: 32, frameHeight: 32,
    //                animation: { start: 0, end: 3, frameRate: 8 } }
    // Optional replacements, e.g. eatPie: '/assets/chomp.ogg'. Omitted sounds are synthesized.
    sounds: {} as Partial<Record<FoxSound, string>>,
    // Four animation rows in the generated 1254px atlas; 313px frame cells.
    assets: {
        fox: { url: '/assets/fox/farm-sprites-v1.png', frameWidth: 313, frameHeight: 313,
            animation: { start: 0, end: 3, frameRate: 8 } },
        chicken: { url: '/assets/fox/farm-sprites-v1.png', frameWidth: 313, frameHeight: 313,
            animation: { start: 4, end: 7, frameRate: 6 } },
        dog: { url: '/assets/fox/farm-sprites-v1.png', frameWidth: 313, frameHeight: 313,
            animation: { start: 8, end: 11, frameRate: 8 } },
        pie: { url: '/assets/fox/farm-sprites-v1.png', frameWidth: 313, frameHeight: 313,
            animation: { start: 12, end: 15, frameRate: 3 } }
    } as Partial<Record<FoxFigure, FigureAsset>>
};
