# Underfoot: notes for Claude Code

A small WebGL2 game with no engine: you hide in a walled hill town from a giant about 2.9 km tall whose lantern searches the streets a few steps behind you. The picture is drawn at 384 x 216 and snapped to a small palette with dithering. Seven "looks" (palette, light, fog, sky, post) can be switched at run time; the game itself is the same under all of them. README.md is the full description; read its sections 3 to 6 before changing gameplay or rendering.

## Commands

```bash
npm install                        # esbuild (build) and playwright (headless shots)
npx playwright install chromium    # once, for the shot tools
npm run build                      # dist/index.html (looks page) + dist/game.html (game alone)
npm run build:test                 # out/test.html: unminified bare canvas page for headless runs
npm run shots -- night             # four comparison frames for a look -> out/shots/night/*.png
npm run shots:cycle                # eight frames across one cycle -> out/cycle/*.png
```

There are no unit tests. Check changes by rendering frames and looking at them: run `npm run shots` or `npm run shots:cycle`, then read the PNGs. Headless rendering is SwiftShader, so a run takes 10 to 60 s. To try anything else, write a plan (see `plans/*.json`) and run `node tools/shot.mjs out/test.html out/<dir> <plan.json>`.

Pages open straight from disk. Address options: `?look=<id>`, `?nointro`, `?hold`.

## Where to change what

| To change | Edit |
| --- | --- |
| Phases, the hunt, the hiding test, the eye meter, cameras, HUD text | `src/fall/game.js` |
| A look's palette, light, fog, sky, particles or post; add a look | `src/fall/looks.js` (`LOOKS`, `LOOK_ORDER`), plus a `data-look` button in `page/looks.html` and `page/game.html` |
| Render passes, shadow maps, what reaches the shaders | `src/fall/renderer.js` |
| Any GLSL: materials and lighting (`FS_MESH`), sky, clouds, palette snap (`FS_QUANT`), post (`FS_POST`) | `src/fall/shaders.js` |
| The giant's mesh, rig, face, walking | `src/fall/giant.js` |
| Terrain, town layout, collision, hiding occluders | `src/fall/world.js` (layout), `src/fall/mesh.js` (geometry, material ids `M`) |
| Lantern, chain, the player's figure | `src/fall/props.js` |
| Sound | `src/fall/sound.js` (all synthesized) |
| Page wiring: look bar, contact sheet, large view, buttons | `src/main.js`, `page/*.html` |

## Things that must stay true

- Looks change only the picture. Gameplay never reads the look: the hiding test uses `S.lan.I` (1.5) and the fixed cone, never `lanI`. Keep it that way so looks stay comparable.
- The scene renders at 386 x 218 (384 x 216 visible, a 1 px border for the sub-pixel camera slide). The UI is a 384 x 216 2D canvas in the Wisp pixel font (`src/lib/wisp.js`).
- Palette uniforms are fixed-size: 8 greys and 4 ramps of 5. `buildPalette()` pads; `uNGrey` and `uNHue` say how many are real.
- Material ids in `mesh.js` `M` must match the `m ==` branches in `FS_MESH`.
- `maskZ` / `maskRelief` exist in both `giant.js` and `shaders.js`. Change them together.
- Runs are deterministic: the game's random numbers come from `mulberry(4242)`. Shots boot with `?hold` so the frame loop does not advance time before the plan, and each look gets a fresh page. Do not add `Math.random()` to game logic. (Dust in `renderer.js` uses it, so frames with fresh dust can differ slightly between runs.)
- No runtime dependencies. esbuild bundles `src/main.js` into one IIFE at `__SCRIPT__` in a template.
- `window.__v16` is the test hook (the name is from Volume 16): `{ ready, hold, errors, game, step, force, view, setLook }`.

## Style of the user-facing words

Plain, short sentences. No em dashes. Name things the way a player would. Designs are original: no copied characters, logos or real games' assets.

## Status

- Volume 16 (the game) and Volume 17 (the seven looks) are published pages; links are at the top of README.md.
- No look has been picked yet. The candidates: Night lantern (clearest light and shadow), Ash and blood (most dread), Ashwake grey (the current default). Switching looks along the cycle is an open idea (README section 16).
- Known weak spots are in README section 16.
