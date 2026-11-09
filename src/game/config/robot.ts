export type RobotConfig = { columns: number; rows: number; stepDuration: number };

export const robotConfig: RobotConfig = {
    columns: 10,
    rows: 10,
    /** Milliseconds per instruction, including a short pause between actions. */
    stepDuration: 600
};
