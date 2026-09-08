# Artillery

Minimal project created with the official Phaser generator, selecting Web Bundler → Vite → Minimal → TypeScript.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:8080 and choose Artillery from the main menu to play. Use − and + to set the launch angle, then FIRE.
Land within 38 pixels of the target to win. NEW TARGET starts a fresh round. MENU returns to game selection.

## Check and build

```sh
npm run typecheck
npm run build
```

The production build is written to `dist/`.
The scene and controls live in `src/game/scenes/ArtilleryGame.ts`.
`src/game/objects/Terrain.ts` owns terrain height, rendering, and random target placement.
`src/game/objects/Projectile.ts` handles fixed-step ballistic motion, ground contact, and the visible trail.

`src/game/scenes/MainMenu.ts` displays the game selection cards and their previews.

## Divisibility Game

Choose Divisibility Game from the menu. Rounds use divisors 2, 3, 5, and 10,
in that order. Pop the matching numbered balloons; an incorrect pop shows a
red X and adds one matching balloon and one distractor. Each round ends as soon
as all matching balloons are gone, with the elapsed time displayed. Continue to
the next divisor, then review the round times or play again. MENIU returns to the
main menu. The scene lives in `src/game/scenes/DivisibilityGame.ts`.

### Configure the rounds

Edit `src/game/config/divisibility.ts` and change `divisors`, for example:

```ts
divisors: [10, 5, 3, 2, 7]
```

Rounds follow that exact order. Repeated values are allowed. Use at least one
whole number from 2 to 100; this range ensures both matching and nonmatching
balloons can be generated. Balloon numbers range from 1–999 and remain unique on the board. Each round
starts with six below 100 and six at or above 100. Replacements favor the less
populated range when eligible numbers are available. If a divisibility pool is
fully exhausted, no balloon of that type is added. Save and reload the game.
