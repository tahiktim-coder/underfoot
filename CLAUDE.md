# Underfoot: notes for Claude Code

A small WebGL2 game with no engine: a score game of nights in which you hide in a walled hill town from a giant about 2.9 km tall whose lantern searches the streets a few steps behind you; each night it asks more, until it finds you. The picture is drawn at 384 x 216 and snapped to a small palette with dithering. Seven "looks" (palette, light, fog, sky, post) can be switched at run time; the game itself is the same under all of them. README.md is the full description; read its sections 3 to 6 before changing gameplay or rendering.

## Commands

```bash
npm install                        # esbuild (build) and playwright (headless shots)
npx playwright install chromium    # once, for the shot tools
npm run build                      # dist/index.html (looks page) + dist/game.html (game alone)
npm run build:test                 # out/test.html: unminified bare canvas page for headless runs
npm run build:itch                 # itch/index.html: the shipped page (page/itch.html + src/itch.js, Night look, no picker)
npm run zip:itch                   # itch/underfoot-itch.zip for upload (index.html at the root)
npm run shots -- night             # four comparison frames for a look -> out/shots/night/*.png
npm run shots:cycle                # eight frames across one cycle -> out/cycle/*.png
VW=1152 VH=648 node tools/shot.mjs out/test.html out/town plans/town.json   # the town from the fixed cameras (after build:test)
```

There are no unit tests. Check changes by rendering frames and looking at them: run `npm run shots` or `npm run shots:cycle`, then read the PNGs. Headless rendering is SwiftShader, so a run takes 10 to 60 s. To try anything else, write a plan (see `plans/*.json`) and run `node tools/shot.mjs out/test.html out/<dir> <plan.json>`.

Pages open straight from disk. Address options: `?look=<id>`, `?night=<1-3>`, `?debug` (the jump buttons), `?nointro`, `?hold`.

## Where to change what

| To change | Edit |
| --- | --- |
| Phases, the hunt, the hiding test and its tiers, the eye meter, cameras, HUD text, the cards | `src/fall/game.js` |
| The night table (search length, fill, k, offset, lag, people, speeds), the card words, the best run | `src/fall/nights.js` |
| The houses: lit or dark; lights out on the footfalls, back one by one after | `src/fall/homes.js` |
| The townspeople and the brains (stroller, hider, curious) | `src/fall/people.js` |
| A look's palette, light, fog, sky, particles or post; add a look | `src/fall/looks.js` (`LOOKS`, `LOOK_ORDER`), plus a `data-look` button in `page/looks.html` and `page/game.html` |
| Render passes, shadow maps, what reaches the shaders | `src/fall/renderer.js` |
| Any GLSL: materials and lighting (`FS_MESH`), sky, clouds, palette snap (`FS_QUANT`), post (`FS_POST`) | `src/fall/shaders.js` |
| The giant's mesh, rig, face, walking | `src/fall/giant.js` |
| The town: which house stands where, the lanes, plazas, covers, landmarks | `src/fall/townmap.js` (the map, one character per 2 m cell; the legend is at the top), read by `src/fall/town.js` |
| Terrain, roads, what stands outside the walls, collision, hiding occluders, the covers | `src/fall/world.js`, `src/fall/mesh.js` (geometry, material ids `M`) |
| Lantern, chain, the player's figure | `src/fall/props.js` |
| Sound | `src/fall/sound.js` (all synthesized) |
| Page wiring: look bar, contact sheet, large view, buttons | `src/main.js`, `page/*.html` |
| The itch page: overlay buttons, the 60 Hz loop, sound on hide, the error messages, the credit (`AUTHOR`) | `src/itch.js`, `page/itch.html` |

## Things that must stay true

- Looks change only the picture. Gameplay never reads the look: the hiding test uses `S.lan.I` (1.5), the fixed cone and the night table, never `lanI`. Keep it that way so looks stay comparable.
- The hiding test is `isLit()` in game.js: three rays to the lantern's glass, and the tier is how many are blocked (deep 3, shallow 1 to 2, lit 0). The penumbra in the lantern shadow map (shaders.js `lanternLight`) is sized to the same 24 m ray spread, so the picture and the rule agree; change them together.
- The scene renders at 386 x 218 (384 x 216 visible, a 1 px border for the sub-pixel camera slide). The UI is a 384 x 216 2D canvas in the Wisp pixel font (`src/lib/wisp.js`).
- Palette uniforms are fixed-size: 8 greys and 4 ramps of 5. `buildPalette()` pads; `uNGrey` and `uNHue` say how many are real.
- Material ids in `mesh.js` `M` must match the `m ==` branches in `FS_MESH`.
- `maskZ` / `maskRelief` exist in both `giant.js` and `shaders.js`. Change them together.
- The town is the map in `townmap.js`; nothing inside the walls is placed at random. The spawn (-12, 8) in game.js must stay on an open cell (it is on the square). The seed decides only roof type, jetty, chimney, stone, tile and sub-metre jitter, keyed by the house's cell.
- Runs are deterministic: the game's random numbers come from `mulberry(4242)`. Shots boot with `?hold` so the frame loop does not advance time before the plan, and each look gets a fresh page. Do not add `Math.random()` to game logic. (Dust in `renderer.js` uses it, so frames with fresh dust can differ slightly between runs.)
- No runtime dependencies. esbuild bundles `src/main.js` into one IIFE at `__SCRIPT__` in a template.
- `window.__v16` is the test hook (the name is from Volume 16): `{ ready, hold, errors, game, step, force, view, setLook, begin }`. The headless tools steer the player through `game.S.drive = { x, y }` and the buttons through `S.actButton` / `S.lookButton`; `plans/playtest.json` shows how.

## Style of the user-facing words

Plain, short sentences. No em dashes. Name things the way a player would. Designs are original: no copied characters, logos or real games' assets.

## Status

- Volume 16 (the game) and Volume 17 (the seven looks) are published pages; links are at the top of README.md.
- The game is a score game of endless nights (UNDERFOOT_NIGHT_DESIGN.md section 8 has the numbers, the playtests and what was skipped). The itch page ships the Night look alone; page/game.html stays the dev page with the look bar.
- Nothing here is canon: the user wants a small thing to put on itch.io and see whether people like it.
- Known weak spots are in README section 16.
