import { t } from '../i18n';
import { artilleryConfig } from '../config/artillery';
import { divisibilityConfig } from '../config/divisibility';
import { snakeConfig } from '../config/snake';
import { navigationConfig } from '../config/navigation';
import { foxConfig } from '../config/fox';
import { FoxBoard } from '../logic/FoxBoard';
import { NavigationMap } from '../logic/NavigationMap';

export const configs = { ArtilleryGame: artilleryConfig, DivisibilityGame: divisibilityConfig,
    SnakeGame: snakeConfig, NavigationGame: navigationConfig, FoxGame: foxConfig };
export type SettingsKey = keyof typeof configs;
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const defaults = clone(configs);
const storageKey = (key: SettingsKey) => `simple-games.settings.v1.${key}`;

function number(value: unknown, name: string, min: number, max: number, integer = false): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw new Error(t("{0}: enter {1} between {2} and {3}.", name, integer ? t('a whole number') : t('a number'), min, max));
    }
}
function shape(value: unknown, template: unknown, path = ''): void {
    if (path === 'seed' || template === null) { if (value !== null) number(value, path, 0, 4294967295, true); return; }
    if (template === 'auto') { if (value !== 'auto') number(value, path, 0, 10000, true); return; }
    if (Array.isArray(template)) {
        if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error(t("{0}: use 1–100 entries.", path));
        value.forEach(v => shape(v, template[0], path)); return;
    }
    if (typeof template === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t("{0}: expected an object.", path));
        const expected = template as Record<string, unknown>, actual = value as Record<string, unknown>;
        if (path === 'assets' || path === 'sounds' || Object.keys(expected).length === 0) return;
        for (const key of Object.keys(expected)) shape(actual[key], expected[key], `${path ? path + '.' : ''}${key}`);
        for (const key of Object.keys(actual)) if (!(key in expected)) throw new Error(t("Unknown setting: {0}.{1}", path, key));
        return;
    }
    if (typeof value !== typeof template) throw new Error(t("{0}: invalid value type.", path));
}
export function validate(key: SettingsKey, value: unknown): void {
    // Config defaults provide the shape; count fields allow both literal and automatic values.
    const template = clone(defaults[key]);
    if (key === 'FoxGame') (template as typeof foxConfig).counts = { chickens: 'auto', pies: 'auto', dogs: 'auto' };
    shape(value, template);
    if (key === 'ArtilleryGame') {
        const c = value as typeof artilleryConfig;
        number(c.launchSpeed, t("Launch speed"), 100, 1200); number(c.gravity, t("Gravity"), 50, 1000);
        number(c.initialAngle, t("Initial angle"), 10, 80, true); number(c.hitRadius, t("Hit radius"), 10, 100);
        // Make sure every target can be reached by one of the allowed integer angles.
        const landings = Array.from({ length: 71 }, (_, i) => {
            const a = (i + 10) * Math.PI / 180, vy = -c.launchSpeed * Math.sin(a);
            const height = 18 + 44 * Math.sin(a);
            const t = (-vy + Math.sqrt(vy * vy + 2 * c.gravity * height)) / c.gravity;
            return 90 + 44 * Math.cos(a) + c.launchSpeed * Math.cos(a) * t;
        });
        for (let x = 573; x <= 870; x++) if (Math.min(...landings.map(v => Math.abs(v - x))) > c.hitRadius) {
            throw new Error(t("This speed/gravity/hit-radius combination makes some targets unreachable. Increase launch speed or hit radius, or reduce gravity."));
        }
    } else if (key === 'SnakeGame') {
        const c = value as typeof snakeConfig;
        number(c.appleCount, t("Apple count"), 1, 320, true); number(c.speed, t("Speed"), 0.2, 20);
    } else if (key === 'DivisibilityGame') {
        (value as typeof divisibilityConfig).divisors.forEach(v => number(v, t("Divisor"), 2, 100, true));
    } else if (key === 'NavigationGame') {
        const c = value as typeof navigationConfig;
        number(c.islandCount, t("Island count"), 0, 12, true); number(c.landFineness, t("Land fineness"), 1, 30, true);
        number(c.crosswindSpeedFactor, t("Crosswind factor"), 0, 1); number(c.leeway, t("Leeway"), 0, 1);
        number(c.fullSpeed, t("Full speed"), 1, 300); number(c.offshoreStrength, t("Offshore strength"), 0, 1);
        number(c.coastalInfluenceDistance, t("Coastal influence distance"), 0.1, 10);
        if (c.gyres.length > 8) throw new Error(t("Use at most eight gyres."));
        const map = new NavigationMap(20, 11, { ...c, seed: c.seed ?? 12345, islandCount: Math.max(1, c.islandCount) });
        if (!map.createPorts()) throw new Error(t("These settings did not produce three usable ports. Adjust the gyres or seed."));
    } else {
        const c = value as typeof foxConfig;
        for (const seed of c.seed === null ? [1, 2, 3] : [c.seed]) new FoxBoard({ ...c, seed });
        for (const [kind, url] of Object.entries(c.sounds)) {
            if (!['eatPie', 'catchChicken', 'chickenAlert', 'dogAlert'].includes(kind) || typeof url !== 'string' || !url.trim()) throw new Error(t("Sounds: use known sound names and nonempty URLs."));
        }
        for (const [kind, asset] of Object.entries(c.assets)) {
            if (!['fox', 'chicken', 'dog', 'pie'].includes(kind) || !asset || typeof asset.url !== 'string' || !asset.url.trim()) throw new Error(t("Assets: use fox/chicken/dog/pie and a nonempty url."));
            if (asset.frameWidth !== undefined || asset.frameHeight !== undefined) {
                number(asset.frameWidth, t("Frame width"), 1, 4096, true); number(asset.frameHeight, t("Frame height"), 1, 4096, true);
            }
            if (asset.animation) {
                if (!asset.frameWidth || !asset.frameHeight) throw new Error(t("Animations need frame dimensions."));
                number(asset.animation.start, t("First frame"), 0, 10000, true); number(asset.animation.end, t("Last frame"), asset.animation.start, 10000, true);
                number(asset.animation.frameRate, t("Frame rate"), 1, 120);
            }
        }
    }
}
export function applySettings(key: SettingsKey, value: unknown): boolean {
    validate(key, value);
    Object.assign(configs[key], clone(value));
    try { localStorage.setItem(storageKey(key), JSON.stringify(value)); return true; } catch { return false; }
}
export function loadSettings(): void {
    for (const key of Object.keys(configs) as SettingsKey[]) {
        try {
            const stored = localStorage.getItem(storageKey(key));
            if (stored) { const value: unknown = JSON.parse(stored); validate(key, value); Object.assign(configs[key], value); }
        } catch { /* Invalid or outdated saved settings do not prevent starting a game. */ }
    }
}
