/**
 * Divisibility Game rounds, played from left to right.
 * Add, remove, reorder, or repeat values to customize the game.
 * Use whole numbers from 2 to 100. Balloon numbers range from 1–999.
 * Each round starts with six below 100 and six at or above 100.
 * Keep at least one round. Save and reload the game after editing.
 */
export const divisibilityConfig = {
    divisors: [2, 10, 5, 3]
};

export function getDivisors(): number[] {
    const { divisors } = divisibilityConfig;
    if (divisors.length === 0 || divisors.some(value => !Number.isInteger(value) || value < 2 || value > 100)) {
        throw new Error('Divisibility configuration: specify at least one divisor, using whole numbers from 2 to 100.');
    }
    return [...divisors];
}
