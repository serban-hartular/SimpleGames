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

## Snake

Choose Snake from the menu. Click above/below the head while moving horizontally,
or left/right while moving vertically. The snake wraps at every edge. Apples
grow the snake by one square; touching its own body ends the game. Score equals
apples eaten. Use RESTART to play again or MENU to return to game selection.

Edit `src/game/config/snake.ts` to set `appleCount` (default 3) and `speed`
(default 3 squares per second), then reload. Lower `speed` values make the snake slower.
Apples occupy unique free interior cells, never the outermost rows or columns. Near a full board, their count is limited to
available interior cells. Filling the entire field wins the game.

## Caravel navigation

Choose Caravel from the menu. Click the ocean to set the ship's heading.
Each square has a fixed wind: arrows point downwind and longer arrows mean
stronger winds. The map contains an irregular clockwise oval gyre, with weak
winds inside and outside it. The ocean wraps at the map edges.

Edit `src/game/config/navigation.ts` to adjust `crosswindSpeedFactor` (0.25),
`leeway` (0.08), and `fullSpeed` (90 pixels/second at wind magnitude 1).
For angles up to 90°, the speed factor is
`crosswindSpeedFactor + (1 - crosswindSpeedFactor) * cos(angle)`.
Beyond 90°, the ship only drifts downwind at `leeway * fullSpeed * wind magnitude`.
The highlighted square and readout show the wind currently affecting the ship.

### Random navigation maps

`src/game/logic/NavigationMap.ts` generates two irregular continents, islands,
and coastline-aware gyre winds. Disconnected inland water is filled as land.
A streamfunction relaxation bends the circulation around land boundaries.
In `src/game/config/navigation.ts`, set `seed` to an integer for a repeatable map
or leave it `null` for a random map; `islandCount` controls island blobs (0–12,
fewer may be placed if there is insufficient room). NEW MAP regenerates the scene. The displayed seed can be saved.
The caravel's hull is blocked by land, including across wrapping map edges;
a bump message and brief shake signal contact. Steer away to continue sailing.

`landFineness` in the navigation config controls terrain resolution per wind
square (default 10, allowed 1–30). At 10, terrain uses a 160×120 grid while winds
remain 16×12. Coastline rendering and collision use the fine terrain; the wind
solver uses aggregated land coverage on its coarse grid.

Islands use smaller radii and reject placements within 1.5 wind cells of existing
land, leaving channels wider than the caravel. Generate a NEW MAP to see changes.

The `gyres` list in the navigation config sets normalized centers, horizontal and
vertical radii, direction (`clockwise` or `anticlockwise`), and optional strength.
Defaults form an upper clockwise gyre and a lower anticlockwise gyre. Their
combined field receives the coastline correction. Arrows are shown over mixed
land/water squares and hidden only over squares that are entirely land.

Continental coastal winds receive an offshore correction. `offshoreStrength`
(default 0.2; 0 disables it) controls the added offshore wind, and
`coastalInfluenceDistance` (default 1.5 wind squares) controls its smooth falloff.
In mixed continental cells, the inward component is removed and an outward
component added. A fine-grid continental distance field determines outward;
islands keep their existing bypass winds. Complex inlets still use one averaged
wind direction per coarse cell, so this reduces rather than eliminates trapping.

Visit Port1 (upper continental coast), Port2 (lower continental coast), and
Port3 (island) in any order to win. Sail into the highlighted water-side docking ring; ports
can be visited in any order; revisiting one does not add progress. The ship stops after all three visits.
Port placement is seeded. The mission requires at least one island, even when
islandCount is zero; unsuitable maps retry with successive seeds (shown on screen).

## Fox Raid

Steer with arrow keys or click relative to the fox (the dominant direction wins).
Turns are queued until the next square; the fox keeps moving until a wall stops it.
Collect every chicken and pie to win. One dog catching the fox ends the game.
Collection counts appear below the maze. Chickens wander and flee when they see
the fox along an unobstructed row or column. Dogs patrol highlighted straight
corridors and chase faster only while the fox is visible inside that corridor.

Edit `src/game/config/fox.ts` for chicken, pie, and dog counts, movement speeds,
and a repeatable seed. There is always one player-controlled fox. Counts must
fit the maze and available patrol corridors. NEW MAZE restarts with a random
layout unless a seed is configured.

The `assets` mapping optionally replaces each Phaser-drawn figure with an image
or spritesheet. Supply `url` for an image; add `frameWidth`, `frameHeight`, and
`animation: { start, end, frameRate }` for a looping animation. Missing assets
fall back to the procedural figures. See commented examples in the config.
Rules live in `src/game/logic/FoxBoard.ts`, presentation in `FoxGame.ts`, and
figure loading/rendering in `src/game/visuals/FoxFigures.ts`.
Run `node tests/fox.cjs` for maze and gameplay regression checks.

Fox Raid chickens use `speeds.chickenWander` (1.4) and `speeds.chickenFlee` (2.3).
Fleeing chickens have an orange tint and an exclamation mark. Configure
`chickenWander < chickenFlee < fox` so they remain catchable.
Generated effects cover pie eating, chicken catching, new chicken sightings,
and new dog sightings. Sustained sight does not repeatedly trigger an alert.
Replace individual effects with audio files through `sounds` in the fox config:

```ts
sounds: {
    eatPie: '/assets/chomp.ogg',
    catchChicken: '/assets/catch.ogg',
    chickenAlert: '/assets/squawk.ogg',
    dogAlert: '/assets/bark.ogg'
}
```

Omit any entry to use its generated sound. Audio stops on scene exit/restart.

Fox Raid `zoom` is an integer from 1 to 10. Height is `7 + 2 * zoom`; width is
proportional and rounded to an odd number. Zoom 5 retains 25×17. The maze,
figures, click area and chicken alert markers scale to the available play area.
Each `counts` entry accepts `"auto"` or an exact nonnegative integer, for example:

```ts
zoom: 5,
counts: { chickens: 'auto', pies: 12, dogs: 'auto' }
```

Auto counts scale from 8 chickens, 10 pies and 3 dogs at zoom 5, and are limited
by available space/patrol corridors. Literal counts are honored exactly;
unavailable space or patrol capacity produces a configuration error. At least
one edible is required. Save and start a new maze after editing.

## In-game settings (all five games)

Click **⚙ Settings** while a game is open. Gameplay, timers, held angle controls,
and audio pause while the HTML dialog is open. **Cancel** (or Escape) resumes;
**Apply & Restart** validates the configuration and starts that game again.
**Restore Defaults** fills the form with the TypeScript defaults, and needs Apply
before it changes the game. Divisors and gyres support adding, removing and
reordering entries. Fox counts offer Auto/Number choices. Fox graphics and sound
asset mappings are editable as JSON under Advanced, with inline format guidance.

Runtime settings are saved per game in this browser's localStorage. They override
the source defaults on later visits; they do not edit `.ts` files. Use Restore
Defaults after changing a source default if you already have a saved override.
Export/Import JSON saves or transfers setups. Invalid imports/settings show an
error and leave the current game intact. If browser storage is unavailable,
settings still apply for the current session. Artillery settings live in
`src/game/config/artillery.ts`; other defaults remain in their existing files.

Shared implementation: `src/game/settings/store.ts` and `dialog.ts`.
Run `node tests/settings.cjs` for validation/storage checks and
`node tests/fox.cjs` for the maze gameplay regression suite.


## Language

Romanian is the default for all games. Choose **Română** or **English** on the
main menu, or change **Language** in any game's settings and apply/restart.
The choice applies to all games and is remembered in this browser. The source
default is `src/game/config/global.ts`; saved browser preferences override it.
Game instructions, counters, results, menu cards and settings use the shared
translation catalogs in `src/game/i18n/ro.ts` and `en.ts`.

To add a language, copy a catalog, translate its values (keep keys and `{0}`,
`{1}` placeholders), then import and register it in `src/game/i18n/index.ts`
with its native display name. Both language selectors pick it up automatically.
Missing translations fall back to English. Run `node tests/i18n.cjs` to check
catalog coverage, interpolation, the default language and saved preferences.
