export type StreetsConfig = {
    /** 1–5: deeper branches and a stronger mismatch between proximity and route length. */
    difficulty: number;
    /** Set an unsigned integer for a repeatable network, or null for a random one. */
    seed: number | null;
};

export const streetsConfig: StreetsConfig = {
    difficulty: 2,
    seed: null
};
