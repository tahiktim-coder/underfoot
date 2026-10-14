# Underfoot: visual critique and plan

Written 2026-10-14 from close-up frames of the built 1.2 game (player, lantern, giant from nine fixed cameras, town, every phase), the mesh and shader source, and two live experiments in the browser: disabling the dust billboards, and re-tuning the Night look's data without touching code. Files named below are under src/ in the zip.

## 1. The circles and the checkerboard (bug, confirmed)

The discs you see in the calm town and the full-screen checkerboard during "It is passing" are the giant's **footfall dust puffs**. Every footfall spawns 40 billboards in a ring 150 to 350 m round the sole; each starts 30 m across and grows to 80 to 160 m across over 6 to 10 s (game.js, `footfall()`, the `R.puff` calls; renderer.js `puff()`; shaders.js `VS_PUFF`/`FS_PUFF`). When the boot lands just east of the town during the leave, the ring overlaps the town, and from the near-orthographic play camera, which sees only 43 m of ground, one of those billboards is a wall covering the whole picture. Its soft disc alpha reads as a circle while it is small; its blocky noise texture reads as a checkerboard once it is big. Turning `R.puff` into a no-op removes both (verified).

Fix, in order of simplicity:
- In `footfall()`, skip ring puffs whose spawn point is within ~150 m of the player, and never spawn them inside the town ellipse (`townR(x, z) < 1.2`).
- In `VS_PUFF`, collapse any puff whose radius is larger than ~1.5x the camera half-height (pass `uHH`), so dust can never be bigger than the frame.
- Longer term: dust at the giant's feet should be a ground-hugging decal or a low flat disc, not a camera-facing billboard, so it never stands up in front of the lens.

## 2. The player ("I barely see our guy")

Why he vanishes:
- His coat is hard-coded near black in the shader (`FS_MESH`, material 50: albedo 0.16) and the Night ground is the darkest grey in the palette. Same value, same hue. In Ashwake grey the pale ground gives contrast; in Night there is none.
- He is 1.3x life size, which is about 10 px tall and 3 px wide at the play zoom, and the search camera widens by 1.38x (game.js `playCam`, `hh * 1.38`) exactly when you need to see him, dropping him to 7 px.
- Tilt-shift blur smears the top and bottom thirds of the frame at canvas resolution, so a pixel figure near the edge becomes a smudge.
- Nothing on him changes when the light finds him; the only tell is the eye meter in the corner.

Fixes (props.js `person()`, shaders.js materials 50-54, game.js `render()`, looks.js):
- Per-look player colours. Give each look a `player` entry (coat, hood, scarf) and pass it through the `look` argument `person()` already takes. Night: a pale bone or grey-blue coat (`#a9b4c6` range) with a warm scarf, so he is the one pale figure on a dark ground, and he turns amber the moment the lantern hits him.
- Outline. Draw him twice: once normally, once slightly inflated with front faces culled in the darkest palette grey (inverted hull, about 100 triangles, no new shader). A 1 px dark rim is what makes a 10 px sprite readable on any background.
- Scale to 1.6x and cut the search widening to about 1.15x. He becomes 14 px tall and the view still shows two houses either side.
- A soft ground ring under his feet (a flat 1.5 m disc in the pale grey, dithered), stronger when crouched and hidden. It also doubles as the "you are here" marker during the plant wide shot.
- Lit tell: coat material swaps to a brighter variant while `P.lit`, plus the eye dot drawn above his head (see the review's milestone 1).
- Drop the tilt-shift (`tilt: 0` in every shipped look). Pixel art should be crisp edge to edge.

## 3. The giant ("chunky")

What the frames show: from the valley and the look-up cameras it is a smooth pillar with a bucket on top; the cloak hangs as a stiff cone; arms are tubes; at distance the whole body dissolves into dither noise; from the street the face reads, but the helm and gorget read as a bucket on a barrel. The README already calls this the "toy robot" problem.

Why, in the code:
- Every part is a smooth lofted tube or ellipsoid with 40 to 46 segments and averaged normals (giant.js `surface()`, `loft()`, `shell()`). Smooth gradients are the worst case for an 8-grey palette with edge dithering: every pixel is "near a band edge", so the giant is noise everywhere instead of flat plates with clean steps.
- The iron is near black (albedo ~0.09) with seams and rust that are only visible up close. At night the body is one value.
- The lantern lights the giant at 0.06 strength (shaders.js, the `uIsGiant` block). A colossus holding a lantern should be lit from below by it: the forearm, the chest, the underside of the helm and the face should glow amber while it searches. That one light is the difference between a silhouette and a character.
- The eyes only glow when it has caught you (`uEye`). From far away there is no face at all.
- No secondary motion on the cloak or the shoulders' woods; only the chain moves.

Fixes, cheapest first (giant.js, shaders.js):
- Flat shading and fewer segments. Build the giant with 16 to 24 segments and flat per-face normals (a `flat` flag in `surface()` that writes the face normal instead of the average). Deliberate low-poly plates read as armour in a dithered palette; smooth ones read as mush. This is a few lines and a visual rebuild, not a remodel.
- Lantern uplight as a real point light on the giant: in the `uIsGiant` block, replace the 0.06 constant with a lantern-position falloff (`1 / (1 + (dist/600)^2)`) at strength ~1.2 in the look's lantern colour, no shadow map needed. Face and right arm go amber from below during the search and the catch.
- Always-on embers: `uEye` floor of 0.15 so two warm pixels mark the eyes at any distance; brighten as the eye meter fills.
- Value separation: face mask one step paler than the helm, cloak a dark red-brown that survives the chroma threshold, plate edges with a brighter lip (the seam lip exists; widen it and let it survive `lodF` at distance).
- Silhouette: shoulders wider than hips (bigger pauldron radius, narrower faulds), the helm taller with a crest or a deep hood that breaks the "bucket" top, the cloak flared at the hem with ragged tails driven by a wind sine in `pose()` (two or three bones' worth of sway on the lower cloak rows via the skin weights that already exist).
- Keep the polygon budget where it is or lower. None of this needs more triangles.

## 4. The lantern (a key element that currently reads as a cabinet)

From the street and from the side it is a black eight-sided box with two white doors. Why (props.js `lantern()`, shaders.js materials 37-40):
- Eight panes, each about 11 m wide, separated by 2.6 m black bars, with a flat stepped cap and no finial, hook, ribs or ornament.
- The glass is a flat emissive surface at `lanCol^2 * 1.05`, which tone-maps to near white; above the chroma threshold it loses its colour and the palette snaps it to the palest grey, not amber. So the panes are white rectangles. The flame geometry inside is never seen because the glass is opaque.
- The screen halo (`glows()` in game.js, radius `900 / distance`) is tiny from the street and dimmed by the depth test whenever the cage is in front of it.

Fixes:
- Shape: 12 to 16 narrow panes with 1 m bars, a horizontal mid-band, a tall spire or finial on the cap, a hook ring at the top, a pointed drip at the base. A taller, narrower body (height 1.8x width) reads as a hanging lantern at every scale.
- Glass: emission as a gradient from a hot core (`exp(-d^2)` from the pane's centre), peaking around 0.75 after tone mapping so it stays inside the amber ramp, with a tiny white-hot core only at the flame. Dither the glass at 50% (Bayer discard) so the flame triangles show through it. The flame already flickers (`t * 9`).
- Light in the air: reuse the sun-shaft march in `FS_QUANT` with the lantern's screen position as a second source, so a cone of light hangs under it in the fog and ash. The ash motes already glow in the beam; set Night's ash brightness to ~0.12 so they are invisible outside the beam and the beam becomes visible dust.
- Halo: bigger, warmer and not occluded by the cage itself (test depth against the lantern's centre depth plus a margin).

## 5. The location ("should make sense")

From the wide shots the town is sound: a walled ellipse on a hill, two gates, a church, a square with a market hall and a well, a river and bridge, farms and a mill outside. The problem is that none of it is visible from the play camera:
- At the play zoom you see 43 m, two or three houses, and the ground. The walls, the gates, the church tower and the square never enter the frame, so the player has no idea where they are or that there is anywhere to go.
- At night the ground is one flat darkest grey. Streets, yards and the square have no value difference, so the houses float on a void. In daylight (Ashwake) the streets read; in Night they do not.
- Lit windows are emissive rectangles with no light on the ground, so the houses do not sit on the street.
- The 26 carts and barrels and the well exist but are invisible at night for the same reason.
- The ash motes drifting everywhere look like snow or static over the whole picture.
- Every house is the same size and the same two roof types at the same pitch; from above it is a field of identical wedges.

Fixes (world.js, mesh.js, shaders.js terrain branch, looks.js):
- Night ground with two values: streets and the square one grey lighter than yards and gardens, cobbles visible up close (the near map already knows where streets are; the terrain shader just needs a stronger street albedo under moonlight).
- Window pools: a small warm disc of light on the ground under each lit window (a per-house emissive ring in the near ground map, or a few extra point lights folded into the terrain shader by house). This alone makes the town look inhabited at night.
- Landmarks in frame: a taller church tower (50 m, visible over roofs from anywhere), one or two three-storey houses, and lower vignette so the edges of the frame are usable.
- Camera: play half-height ~26 instead of 21.6, no search widening, so a street and the next corner are always visible.
- Chimney smoke from a few houses (the `chimneyTop` points exist and are unused).
- Houses: vary width, height and roof pitch more, add a few L-shaped and gable-and-hip combinations, and give stone houses darker roofs so the roofscape has rhythm.

## 6. Night look tuning (data only, verified live)

These values were changed at run time on `LOOKS.night` and compared frame for frame. The result removes the "static" over the picture, sharpens the pixels, and makes the lantern pool read as amber instead of white:

| Field | Now | Try |
| --- | --- | --- |
| `ash.lum` | 0.55 | 0.12 (motes only visible inside the beam) |
| `tilt` | 1 | 0 |
| `bloom` | 0.35 | 0.55 |
| `lanI` | 1.6 | 2.1 |
| `grain` | 0.05 | 0.03 |
| `vignette` | 0.55 | 0.35 |
| `light.sun` | y 0.24 | y 0.36 (a higher moon, more lit roof faces) |
| `light.sunCol` | 0.42, 0.5, 0.74 | 0.7, 0.8, 1.15 |
| `light.skyCol` | 0.06, 0.075, 0.13 | 0.08, 0.1, 0.17 |
| `light.exposure` | 2.0 | 2.2 |
| `contrast` | 1.08 | 1.15 |

## 7. Order of work

1. Dust puff fix (an hour). Removes the circles and the checkerboard.
2. Night data tune and tilt off (an hour).
3. Player: colours per look, outline, scale, ground ring, no search widening (half a day).
4. Lantern: shape, glass gradient and dither, halo, light shaft (a day).
5. Giant: flat shading and segment counts, lantern uplight, ember eyes, value separation (a day); silhouette and cloak motion (another day).
6. Town at night: ground values, window pools, church tower, smoke, house variety (a day).

Check every step with `npm run shots -- night` and the fixed cameras (`__v16.view('face')`, `'up3'`, `'hero'`, `'foot3'`, `'town'`) so each change is judged on the same frames.
