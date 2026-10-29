# Underfoot: night design (fear, shadow tiers, a reason to move)

Written 2026-10-14 from the user's notes after the visual pass, checked against the current source. This extends UNDERFOOT_REVIEW.md (milestone 1) and should be folded into that brief.

## 1. The town is afraid

What the code does now:
- Windows dim slowly during the approach (0.025 per second, game.js `updateStory`) and faster at the plant, but the Night look floors them at 40% lit (`winMin: 0.4`, looks.js), a crutch from when the player was unreadable. The window pools added in the visual pass then throw that light on the ground through the whole search.
- Chimney smoke (`updateSmoke`, game.js) runs every frame in every phase, a third of the chimneys.

What it should do:
- Windows go out in batches on the footfalls, not on a timer: each boom during the approach puts out a share of the windows (closest to the giant first), so the fear has a rhythm. By the plant everything is dark except 3 to 6 stragglers (see section 4). `winMin` 0 in the shipped look.
- Smoke thins over the approach and stops before the plant; none during the search; it returns in calm after the leave, house by house.
- Sound: shutters banging and a door slam or two on the first close footfalls (short wood bursts in sound.js next to the roof rattle).
- After it passes, the windows come back one by one over the leave. That is the win feedback. Houses that were taken stay dark for the rest of the run.

## 2. Deep and shallow shadow

Already true in the code: the lantern is held `LAN_OFF` 48 m to one side of the spot it lights, `LAN_Y` 70 m up, so the beam arrives at about 55 degrees and a 10 m house throws a 7 m shadow. The swing (`swing` in `updateGiant`) walks the lantern round the spot by up to 80 degrees either way, so shadows turn. `isLit` fires three rays from the player's head to points across the 40 m glass; a thin shadow blocks one or two, so you are partly lit and the eye fills slower. Deep versus shallow shadow exists physically. It is invisible: the rule is a smooth number, the drawn shadow is a hard 4-tap edge from a point, and the lantern never goes nearly overhead on purpose.

Make it two tiers:
- **Deep**: all three rays blocked. Safe indefinitely. Eye drains at 0.3 per second. Crouch.
- **Shallow**: one or two rays blocked. Eye fills at the full-light rate divided by k. Full light at the pool's centre catches in about 3.5 s; with k = 2 on night 1 shallow shadow lasts about 7 s, with k = 1.5 on night 3 about 5 s. In the user's words, x times 1.y with y between 0.5 and 1. You can cross or wait in shallow shadow, not stay.
- **Lit**: no ray blocked. Today's rate.

Make the lantern create both tiers on purpose: vary `LAN_OFF` over the search on a slow sine between about 20 m (nearly overhead: short shadows everywhere, move now) and 60 m (low: long shadows, breathing room), on top of the existing swing round the player. Four always-deep covers exist or can be made: the market hall (on posts), the church porch, the two gate arches, under the bridge. They are the "indefinite" hides, and section 4 is what keeps you from staying in them.

Make it visible (this is the part that must be good):
- The lantern's shadow gets a penumbra that matches the rule: a wide PCF kernel in the lantern shadow map whose radius is the 40 m glass projected (shaders.js `pcf4` on `uLtShadow`), dithered. The band you see on the ground is the shallow tier.
- Two ground values inside shadow: the penumbra lit by the lantern at about 35% of its colour, so shallow shadow is faintly amber and deep shadow is blue-black. "Not deep is closer to the light" is then literally what the picture shows.
- The ring under the player (added in the pass): blue in deep shadow; dim amber in shallow, pulsing, with an arc that shrinks as the shallow time runs out; bright amber when lit. The eye meter uses the same three colours.
- Sound: a faint tick in shallow shadow that quickens as the arc shrinks; the notice sting when lit.
- `isLit` returns the ray count alongside the light so the tier is explicit (`{ L, rays }`), and the HUD never has to guess.

## 3. The townsperson who is taken (the tutorial)

Night 1, about 5 s into the search: one figure running the existing curious autopilot brain (`autopilot`, the `daring` branch) walks out of a doorway into the square carrying a candle (a 2 px warm glow and a small ground pool, so he is the brightest thing in town). He stops in the pool and looks up. The beam narrows on him (the `narrow` term in `lanLight` already exists), a flash, a pop (a short dry burst in sound.js), and he is gone. A dark red-brown stain (the rust ramp) stays on the cobbles for the rest of the night with a ring of scorched ground round it, drawn as a decal in the near ground map the way footprints are. The light then returns to hunting you.

Later nights: two or three townspeople run the hider brain and hide badly; the light takes the ones it finds unless the player acts (section 4). Every stain stays. By night 3 the square tells the story of the run.

## 4. A reason to move: three options

**A. Put out the lights (recommended).** At the plant, 4 to 6 windows stay lit: the ones who did not hide. The lantern is drawn to light: when it has lost you (eye at 0 for 6 s) it goes to the nearest lit window before returning to your trail, and its aim sweeps toward lit windows anyway. Walk to the door of a lit house and hold the action key for one second: the window goes out, the house is saved. If the light reaches a lit house first, it is taken: the beam narrows on it, a flash, the window dies, a scorch on the wall and a stain on the step. Night card: saved / taken; a run total at the end. Why it works: it sends you across town exactly where the light is going (that is the tension), it uses the window, pool and aim systems that already exist, and it states the judgement as a rule the player can act on. Difficulty: more lit houses, further apart, a lantern that checks them sooner.

**B. Lead them to the church.** Two or three townspeople hide badly; walk past one and they follow you; get them to the church porch (deep cover). Expressive, but follower movement through a 0.5 m collision grid, lantern tests per follower and the chaos of three figures in a 10 px world make it the most work and the most bugs. Good for a later version.

**C. Just survive.** No objective. The lantern patrols the town in a pattern that visits every block, and the overhead/low cycle from section 2 forces movement. Least work, least game; the player has nothing to do between swings.

Recommendation: A, with the night 1 townsperson from section 3 as the wordless tutorial.

## 5. Numbers to start from

| Value | Night 1 | Night 3 |
| --- | --- | --- |
| Search length | 30 s | 40 s |
| Shallow divisor k | 2 (about 7 s) | 1.5 (about 5 s) |
| `LAN_OFF` range | 30 to 60 m | 20 to 60 m |
| Lit houses at the plant | 3 | 6 |
| Time before the lantern checks a lit house | 10 s | 6 s |
| Trail lag | 25 samples | 14 samples |

## 6. Where it goes

- game.js: `updateStory` (windows on footfalls, smoke gating), `isLit` (tier), `updatePlayer` (shallow rate), `updateGiant` (`LAN_OFF` sine, lit-window checks), a `people` list using the two autopilot brains, the stain decal writes, the action key, the night card.
- shaders.js: the penumbra kernel, the penumbra tint, the stain and scorch in the terrain and plaster branches.
- textures.js: stains written into the near ground map at run time (a small `texSubImage2D`).
- sound.js: shutters, the pop, the shallow tick.
- props.js: the candle on the townsperson.

## 7. What was built (2026-10-15)

*Superseded by section 8.* The put-out action, the door key, the mouse hold on a house, the saved count, the three-night ending and the plans `lights.json` and `mouse.json` described here were removed in the scope change; the shell, the town afraid, the shadow tiers and the townspeople stay as described.

Option A, in six commits on top of the visual pass (`git log`): the shell, the town afraid, the shadow tiers, the townspeople, put out the lights, and this tune. Each was checked with a plan under `plans/` (`shell`, `afraid`, `tiers`, `people`, `lights`, `playtest`, `docnight`) run through `tools/shot.mjs`, and night 1 was played in a real browser (Space on the title begins, sound starts, the autopilot stays off, the jump buttons are hidden without `?debug`).

The frames below are the game's own 384 x 216 pixels, from `plans/docnight.json`:

| Frame | What it shows |
| --- | --- |
| `docs/night/01_title.png` | the title that waits: the name, the line, the rule, "click or press any key" |
| `docs/night/02_approach_lights_out.png` | two booms into the approach: the windows nearest the boot are out, the stragglers still lit |
| `docs/night/03_curious_taken.png` | night 1, 11 s in: the beam narrowed on the curious one in the square |
| `docs/night/04_stain.png` | the stain and the scorched ring where he stood |
| `docs/night/05_shallow_ring.png` | shallow shadow: the amber band at a house's edge, the ring under the player dim amber with its arc closing, the eye meter the same colour |
| `docs/night/06_put_out.png` | at a lit door, holding E: the bar over the player's head |
| `docs/night/07_taken_house.png` | a taken house after night 3: soot up the walls from the eaves, black round the door, the stain on the step |
| `docs/night/08_card.png` | the ending card on the relit town |

### The numbers

The night table (`src/fall/nights.js`):

| | Night 1 | Night 2 | Night 3 |
| --- | --- | --- | --- |
| Search length | 30 s | 35 s | 40 s |
| Eye fill in the light (share of the full rate; 1 catches in about 3 s) | 0.55 | 0.75 | 1.0 |
| Shallow divisor k | 2 | 1.75 | 1.5 |
| Lantern offset range (nearly overhead to low) | 30 to 60 m | 25 to 60 m | 20 to 60 m |
| Lit houses at the plant | 3 | 4 | 6 |
| Lantern checks a lit house after | 10 s | 8 s | 5 s |
| Trail lag | 25 samples (6 s) | 20 (5 s) | 10 (2.5 s) |
| Townspeople out | 1 (the curious one) | 2 bad hiders | 3 bad hiders |
| The light's mark walks / hunts at | 3.6 / 4.2 m/s | 4.2 / 5.4 | 5.0 / 6.5 |

The whole game plays on a mouse: a click begins, holding walks, and holding on a lit house walks you to its door and puts its light out (`houseAt()` in game.js picks the house under the pointer; moving the pointer more than 24 px drops it and you walk free again; `plans/mouse.json` checks it with a synthetic press).

Fixed (`src/fall/game.js`): deep shadow drains the eye at 0.3/s; the lantern offset drifts on a 36 s cycle; the light goes to other lights once it has lost you for 6 s; it must hold a townsperson in the light for 1.2 s before it narrows on them, and narrows for 1 s before the flash; a door is reachable within 2.6 m and takes 1 s of holding; each boom of the approach puts out 45% of the remaining lit windows; windows come back one every 0.8 s over the leave; a night card moves on by itself after 7 s. You walk at 4.6 m/s, so on night 1 the light's mark is slower than you and on night 3 it is faster once it has half seen you. Two changes to the section 5 table: the eye fill rate is scaled per night (without it a motionless player was caught in 5 s on night 1), and the lantern's walking speed is in the table (at the old fixed 4.3 m/s night 1 and night 3 felt the same).

### Scripted playtests

`plans/playtest.json` drives the player through `S.drive` with three brains: still (stands in the open), hider (the game's own hiding brain, a perfect player) and saver (goes to a lit door whenever the light is more than 18 m from it, otherwise hides). Fourteen runs on the final numbers:

| Night | Brain | Survived | Notes |
| --- | --- | --- | --- |
| 1 | still | 0 of 1 | caught at 18 s: standing in the open is death, by design |
| 1 | hider | 3 of 4 | the loss was a hide spot the lantern walked round at 30 m offset |
| 1 | saver | 2 of 4 | saved 1 of 3 twice; the losses walked to a door as the light arrived |
| 2 | hider | 2 of 3 | |
| 2 | saver | 2 of 4 | saved 1 |
| 3 | hider | 2 of 4 | max eye 0.28 on the wins: it is the lantern's visits that end you |
| 3 | saver | 2 of 3 | saved 1, taken 2 each time |
| 3 | still | 0 of 1 | caught at 5 s |

So night 1 is survivable by hiding alone and the curious one shows what the light does to someone who does not; night 3 takes a few tries even for the perfect hider. A human will be worse than the hider brain, so the fill and lag may want easing after real playtests.

### Not done, for later

- The look-up camera and the catch cinematic still play on every death; the review's short "burn" fail after the first death is not in.
- The give-up tell over the last five seconds of the search (the lantern lifting, the pool widening) is not in.
- No itch page template yet (page/itch.html, `build:itch`); page/game.html still has no doctype or charset, so served without a charset header it shows mojibake in the notes under the picture.
- The sound (shutters, the pop, the tick, the sting, the blow) has been heard once in a browser, not tuned by ear.
- Touch: holding a finger on a lit house walks you there and puts its light out (the same code as the mouse), and the put-out button sits beside the look-up button; the second-finger look-up from the review is not in. Neither has been tried on a phone.

## 8. Scope change: a score game for itch.io (2026-10-15)

The user's words: not canon, a simple score game about hiding where some things happen, ready for itch.io. Applied on top of section 7 in six commits (`git log`): the put-out action, its key, the mouse hold and the saved count are gone; the nights are endless; the score is the seconds you last in the searches plus 100 a night; the night 1 townsperson and the lantern taking lit houses stay as the things that happen; the itch page, build and zip are new.

Frames (384 x 216, `plans/docnight.json`): `docs/night/01_title.png` (the title with the rule), `02_approach_lights_out.png`, `03_curious_taken.png`, `04_stain.png`, `05_shallow_ring.png`, `08_card.png` (the night card with the score). The itch page itself: `plans` has no entry; `node tools/shot.mjs itch/index.html out/itch '<plan>'` with `QUERY='?hold'` renders it (the title shows the credit, the overlay buttons sit top right).

### The numbers

| | Night 1 | Night 2 | Night 3 | Night 4 | Night 5 | Night 8 and on |
| --- | --- | --- | --- | --- | --- | --- |
| Search length | 30 s | 35 s | 40 s | 44 s | 48 s | 60 s |
| Eye fill in the light (1 catches in about 3 s) | 0.55 | 0.75 | 1.0 | 1.0 | 1.0 | 1.0 |
| Shallow divisor k | 2 | 1.75 | 1.5 | 1.45 | 1.4 | 1.3 |
| Lantern offset low end (high end 60 m) | 30 m | 25 m | 20 m | 19 m | 18 m | 15 m |
| Trail lag (0.25 s samples) | 25 | 20 | 10 | 10 | 10 | 10 |   (section 16: 25 / 16 / 16, floor 12) |
| Townspeople | 1, the curious one | 2 | 3 | 3 | 3 | 3 |
| The light's mark walks / hunts at (you: 4.6 m/s) | 3.6 / 4.2 | 4.2 / 5.4 | 5.0 / 6.5 | 5.1 / 6.75 | 5.2 / 7.0 | 5.4 / 7.5 |   (section 16: 3.6 / 4.2, 3.9 / 4.3, then 4.0 / 4.4 for good) |

The lantern follows your trail and nothing else (a later user decision, below); the rows for lit houses and the lantern's visits to them are gone.

Score: +1 a second in the search, +100 a night passed, banked at the end of the leave; being caught loses the night's seconds. Best score in `localStorage` (`underfoot.best`). (Superseded in section 16: banked ten at a time, kept on a catch, +50 a night.)

The one tuning change against section 7: the lantern visits a lit window only when it has both lost you for the night's delay (6 s at least) and not visited one within that delay, and after a take it hunts your trail for the same time. Before that, once you hid well it went from window to window for the whole search and nights 4 to 6 were survived with the eye at zero.

### Scripted playtests (`plans/playtest.json`, the hider brain, a perfect player)

| Night | Runs | Survived | Max eye on the wins |
| --- | --- | --- | --- |
| 1 | 2 | 2 | 0.33 |
| 3 | 2 | 1 | 0.95 |
| 4 | 3 | 0 (caught at 17 to 22 s) | |
| 5 | 3 | 0 (caught at 12 to 26 s) | |
| 7 | 1 | 0 (caught at 19 s) | |
| 5, standing still | 1 | 0 (caught at 9 s) | |

So night 1 is survivable by hiding alone and nights 4 and 5 are hard even for the perfect hider. A human is worse than the hider brain; the first real playtests may want night 1's fill eased further.

### Shipping

`npm run zip:itch` makes `itch/underfoot-itch.zip` (about 67 KB) with `index.html` at its root; README section 13 has the itch project settings. The page: doctype, charset, viewport with `viewport-fit=cover`, a 16:9 screen at `min(100vw, 177.78vh)`, `touch-action: none`, no fonts, no picker; Sound and Fullscreen top right, a hold-to-look button on coarse pointers; the credit from `AUTHOR` in `src/itch.js`. Input: keys on the window by `e.code`, the right button from `e.buttons` and cleared on leave, a second finger for the look-up, the canvas focused at boot. Robustness: a 60 Hz cap with fixed 1/60 s steps (at most four a frame), the sound suspended while hidden or off screen, a message on a lost graphics context or a frame error, "Building the valley..." while the game is made. `tools/shot.mjs` no longer wraps a doctype round the page, so screenshots test what ships.

### The take, later

The flash and the pop that marked a take were removed (the user saw them as a glitch, since the take usually happens off screen). What remains of a take: the beam narrows on the target for a second, then the candle or the window simply dies, the townsperson is gone and a stain stays, a house goes dark with its scorch and the stain on its step. The catch cinematic keeps its own flashes.

### The search cannot end while it has you, and the give-up tell

A search used to end on its timer alone, so a player lit with the eye half full heard "It is passing" and watched it leave. Now the search ends only when its time is up and it has lost you (not lit, eye under 0.2); while it still has you it keeps hunting, the eye keeps filling and the score keeps counting, until it catches you or you break its line of sight, with a cap of 20 s past the time so a night never stalls. In the last 5 s before it can end, once it has lost you, it gives up: the chain is drawn up so the lantern rides about 40 m higher (through the chain's length, not the spring, so the hiding test reads the real, weaker light), the aim wanders wider and slower, the side offset grows a third, the drone softens, and the label reads "It is giving up"; finding you again brings it straight back down and the label back to "Hide". `plans/giveup.json`: lit from 26 s, the search runs past 30 s until the eye fills and the catch follows; hidden from 20 s, the lift begins at 25 s (72 to 111 m over the ground by 30 s), the label changes at 27 s and the leave comes at 30 s; held half seen forever, the cap ends it at 50 s.

### The town dark, the lantern on your trail only

The user's words: "Make the whole town dark at the plant and drop the lures; the lantern only follows my trail." So: no stragglers, every window is dark by the plant (the approach still puts them out in batches on the footfalls, the leave still brings them back one by one), and the lantern has nothing to visit: it walks your trail, comes straight at you once it has half seen you, and holds on a townsperson while it takes him. The house takes (the scorch, the door stain) are gone with the lures; the townspeople takes and their stains stay. The night table lost its lit-houses and check columns. `plans/dark.json` checks it.

### Skipped

- The night 2 and 3 bad hiders were already built in section 7, so they stay; nothing else from the townsperson step was added.
- The short burn-fail after the first death, the give-up tell in the last seconds of the search, and the switch to Ash and blood on a late night (review milestone 2) are not in.
- Not tried on a phone or a real GPU; the touch stick, the second finger and the Fullscreen button on iOS are unverified. The sound has not been tuned by ear.
- `AUTHOR` is "by ____": fill it in before the upload.

## 9. Pre-upload fixes (2026-10-15, from the review of 45fb786..cad169c)

Eight commits (`git log`), each checked with a plan under `plans/` and the chain re-run: `plans/pass.json` (the fixed cameras, the leave at 14, 17 and 20 s, the plant: no console errors, no discs) and `plans/playtest.json` (below). `dist`, `itch/index.html` and `itch/underfoot-itch.zip` rebuilt.

| Fix | What changed | Checked |
| --- | --- | --- |
| 1. The first night took 32 to 41 s to reach "Hide" | The full walk in is the title's. The first night starts at the last footfall (two booms' worth of windows out, the sky dim, the smoke mostly gone); later nights start two plants out with the look up at it coming, and their leave is 12 s instead of 21 | `plans/first.json`: click to "Hide" 13.2 s; night card to "Hide" 20.6 s; night 2 leave 12 s; restart card to "Hide" 3.9 s |
| 2. Fullscreen stretched the picture | Fullscreen on the document, so the screen keeps `min(100vw, 177.78vh)` and letterboxes; a `:fullscreen` rule keeps the dark background; the button toggles off and is hidden without the API | `plans/fullscreen.json` (a real click through the shot tool's new `{click}` step): 1152x648 stays 1152x648; 1280x1024 gives 1280x720 at top 152, 1.778 both |
| 3. Any key, Escape included, restarted a run | Only letters, digits, arrows, Space and Enter count; M only mutes | `plans/keys.json`: Escape, Tab, F11, Shift, Alt, a media key and M leave the title and the game-over card alone; X and 3 begin and restart |
| 4. The attract loop leaked into the run | The run is reset at the title cut (score, taken houses, stains); a night banks and touches the best only once begun and cut away | `plans/attract.json`: a night under the title leaves 0 stains and 0 taken; a click in the leave's last half second banks nothing and writes no best |
| 5. iOS audio stayed suspended after the first tap | `snd.init()` also on the canvas's pointerup and click and the document's touchend; the Sound button calls it too | Builds; the iOS behaviour itself needs a phone |
| 6. A 60 Hz display juddered zero-then-two steps | 2 ms of slack before a step, the remainder clamped at zero; a redraw after 100 ms without one | The arithmetic in Node: 16.6 and 16.7 ms frames step once each, 8.33 ms every other frame, 33 ms twice |
| Small | `plans/afraid.json` reads `HM`; `page/game.html` has a doctype, charset and viewport; section 7 marked superseded | `plans/afraid.json` runs |

### Playtests after the fixes (`plans/playtest.json`, the hider brain)

| Night | Runs | Survived |
| --- | --- | --- |
| 1 | 2 | 2 (max eye 0.21, 0.06) |
| 3 | 2 | 0 |
| 4 | 3 | 0 |
| 5 | 3 | 1 (max eye 0.55) |
| 7 | 1 | 0 |
| 5, standing still | 1 | 0 (caught at 9 s) |

Night 3 went from one survival in two to none; the runs are seeded by the moment of the search and the brain's own random numbers, so single runs vary by a night either way. The shape holds: night 1 is survivable by hiding, nights 4 and 5 are hard.

### Noted for later (after a phone test)

- Three full-size depth passes a frame: the 2048 x 2048 giant and land sun map redraws about 230k static terrain triangles every frame, and the lantern depth pass runs in calm, approach and leave for nothing.
- The dynamic mesh (chain, lantern, people, the mill sails) is rebuilt every frame, about 12.7k vertices and 1.4 ms of CPU, and its buffer reallocates on each new-maximum frame.

## 10. The town drawn by hand (2026-10-15, redrawn 2026-10-21)

The town is a map drawn by hand, `src/fall/townmap.js`: one character per 2 m cell, 76 across and 67 down over the walled ellipse, read by `src/fall/town.js` into everything the game used to make up at random: the houses (with the fields game.js, homes.js and people.js read), `STREETS`, `SQUARE` and the smaller `PLAZAS`, `HALL`, the wells, `CHURCH` (with its tower and porch), the towers, the wall segments, the trees inside the walls, the carts and barrels, the collision grid, the `OCCLUDERS`, the always-deep `COVERS`, and the paving in the near ground map. world.js still owns the ground, the river, the roads, the farms, the woods and the bridge. Nothing in game.js changed: the spawn is still (-12, 8), on the square; the hiding test still reads `S.lan.I`, the fixed cone and the night table.

The first drawing (2026-10-15) was a medieval tangle: lanes of one and two cells, courtyards, slots between houses. Players said "too many narrow alleys, I can't even figure out where I am, the light never reaches those places, and even walking around them is hard" and "there are many places where I can just stand and that's all, he can never put a light on it". The cause is the lamp's geometry: its light hangs 34 m up and 20 to 60 m to the west of the spot it looks at, so a 7 m house throws a shadow 5 to 10 m long and a 4 m lane between two houses is deep whatever the lamp does; a one-cell slot between two walls blocks all three rays from every placement. The 2026-10-21 redraw keeps the same walls, gates and landmarks and changes the width, the orientation and where the cover stands.

### The rules of the redraw

- **Nothing walkable narrower than 4 m.** The spine from the west gate through the square to the east gate is 12 m (10 m east of the square); the three cross streets (two north-south, the north street) are 8 to 10 m; every lane is 8 m; there are no alleys. A cell with no 2 x 2 walkable square round it is a slot and there are none left.
- **Cover stands in the open as islands, not between walls.** The hall, two stalls, the well, two trees and two carts on the square; the gate tree in the spine; carts and barrel stacks against the fronts of the wide streets; the arcade along the square's south front; a low wall and a tree in the tower yard; a tree on the green and one on the forecourt. The middle of every street is lit at some moment and its sides are in the houses' shadows, which swing as the lamp circles.
- **No two-wall corners open to the east.** A concave corner whose walls stand west and north (or west and south) of it is never lit, because the light never comes from the east. The map has 5 such cells left (the wall's corners at the north-west plaza and the tower yard, the arcade's west end, which is a cover anyway); the old map had 59.
- **The ground under the wall is scrub.** A garden between the wall and a house row is never lit from any swing (the wall shadows it from the west and north, the houses from the south), so those strips are hedge (`h`): bushes on every cell, not walkable. The same under the nave's east wall and in the corners the light could never reach.
- **The church lane is low on its west side.** One-storey houses along it, so it is deep from one side only. The yards' gaps are four cells wide with one-storey flanks.
- **A landmark per quarter.** Three tower houses (`S`, 13 m, stone, a parapet): in the west yard, on the north-east corner, at the square's south-east corner; the church tower with a lit belfry (its top 6 m takes the nave's wall material, so each face shows a lit window at night and the tower reads from across the town; they go dark with the rest on the footfalls); the chapel's bellcote on the green; the big tree at the west gate; the two wells. Districts: the north-west is built in stone, the north-east in timber with jettied fronts (`district()` in town.js, by cell), the south in one-storey cottages.

The map (a copy; edit the one in townmap.js, rows padded to 76 as they are read; the first row is blank):

```
    0         1         2         3         4         5         6         7     
    0123456789012345678901234567890123456789012345678901234567890123456789012345
 1                              ####################
 2                           ####hhhhhhhhhhhhhhhhhh##T#
 3                        ##T#hhhhhhhhhhhhhhhhhhhhhhhh####
 4                      ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
 5                    ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
 6                  ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
 7                 ##11112222bbbaaa333bbb2222aaa111333bbbaaa222##
 8               ###h11112222bbbaaa333bbb2222aaa111333bbbaaa222h###
 9              ##hhh11112222bbbaaa333bbb2222aaa111333bbbaaa222hhh##
10             ##hQQQ..............u..........................QQQQQQ#
11            ##hWQQQ.........................................QQQtQQ##
12           ##tQQQQQ.........................................QQQQQQh##
13          ##hQQQQQQ.....u........................u..........QQQQQQhh##
14         ##1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSSh##
15        #Th1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhT#
16        #hh1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhh#
17       T#2222bbb222....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhh##
18       #h2222bbb222....2222aaa111aaa1111o...1111aaa1111.....bbb111bbb222#
19      ##h2222bbb222....2222aaa111aaa1111....1111aaa1111u....bbb111bbb222##
20     ##QQQQQQQQQQQQ....2222aaa111aaa1111....1111aaa1111.....bbb111bbb222h##
21     #hQQQQQQQtQQQQ.........................................bbb111bbb222hh#
22     #hQQQQQQoQQQQQ....................................................hhh#
23    ##hQQQQQQQQQQuQ....................................................hhh##
24    #hhQQQQQQQQ---Q....................................................hhhh#
25    #hhQQQQQQQQQQQQ...o2222bbb2222bbb111....gggCCCCCChh................hhhh#
26   ##hhSSSSQQQQQQQQ....2222bbb2222bbb111....gggCCCCCChh.....2222bbb222bbbhh##
27   #hhhSSSSQQQQQQQQ....2222bbb2222bbb111....gtgCCCCCChh.....2222bbb222bbbhhh#
28   #hhhSSSSQQQQQQQQ....2222bbb2222bbb111....gggCCCCCChh.....2222bbb222bbbhhh#
29   #hhhSSSSQQQQQQQQ....hhhhhhhhhhhhhhhhh...ugggCCCCCChh.....hhkkkkk111aaahhh#
30   #h2222bbbbQQQQQQ....3333cccc333ccc111....gggCCCCCChh....ohhkkkkk111aaahhh#
31   #h2222bbbbQQQQQQ....3333cccc333ccc111....gtgCCCCCChh.....hhkkkkk111aaahhh#
32   #h2222bbbbQQQQQQ....3333cccc333ccc111....gggCCCCCChh.....QQQQQQQQQQ222hhh#
33   #h2222bbbboQQQQQ....3333cccc333ccc111....gggCCCCCChh.....QQQQQQQQQQ222hhh#
34   #..o....u..............QQQQQQQQQuQQQQQQQQQQQQKKKKQQQ.....QQQQQQQQQQ222hhh##
35   G......................QHHHHHHQQQQQQQQQQmmQQQKKKKQQQ.....QQQQQQQQQQ222hhh#
36   G......Y...............QHHHHHHQQQQQQQQQQmmQQQKKKKQQQ.....QQQQtQQQQQ222hhh#
37   #......................QHHHHHHQQQQQQQQQQQQQQQQPPQQQQ....uQQQQQQQQQQbbbhhh#
38   #......................QQQQQQQQQQQQQQQQQQQQQQQPPQQQQ.....QQQQQQQQQQbbbhhh#
39   #....u.................QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQbbbhhh#
40   #hhh111aaa111ggg....222QQQQQQQQQQQQQQQQQQQQQQQQQQQtQ.....QQQQQQQQQQbbbhhh#
41   ##hh111aaa111ggg....222QQQtQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQbbbhh##
42    #hh111aaa111ggg....222QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....o..............#
43    #hh------------====222QQQQQQQQQQQQQQWQQQQQQQQQQQQQQ....................#
44    ##hgggggggggggg....bbbQmmQQQQQQQQQQQQQQQQQQQQQQQQQQ...................G#
45     #hggggggtggggg....bbbQmmQQQQQtQQQQQQQQQQQQQQQQQQQQ...................G
46     #hgggggggggggg....bbbQQQQQQQQQQQQQQQQQQQQQuQQQQoQQ.........u...o.....#
47      #h-----------====bbbAAAAAAAAAAAA....SSSS222bbb222.....rrrrr22222hhh##
48      ##hh111aaa111....111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222hh##
49       #hh111aaa111....111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222hh#
50       ##h111aaa111...o111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222h##
51        #hhhhhhh..................................u...........o......hh#
52         #hhhhhh.....................................................h##
53         ##hhhhh.....................................................##
54          ##hhhh....................................................##
55           ##hhh1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222hhh##
56            #Thh1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222hh##
57             ##h1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222h##
58              ##hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhT#
59               ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
60                 ##hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh##
61                  ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
62                    ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
63                      ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
64                        ####hhhhhhhhhhhhhhhhhhhhhhhh####
65                           ####hhhhhhhhhhhhhhhhhh####
66                              ########T###########
```

The legend:

| Glyph | Means | What the game gets |
| --- | --- | --- |
| `#` `T` `G` | the wall, a tower on it, a gate (two cells) | the ring is walked round in order, smoothed and cut into chords of up to 10 m (44 segments); a round tower per `T` (8); a gatehouse per gate run, its arch an always-deep cover (2) |
| `.` `=` | a lane; a lane cell with steps | paving in the ground map; runs of four cells or more become `STREETS` for the strollers; five stone steps across each `=` cell, set into the slope |
| `Q` | a plaza | paving; each region is a plaza, the biggest is `SQUARE` (the square and the church forecourt join: 58 x 26 m) |
| `:` | yard paving (a courtyard) | paving at 0.6 (unused now) |
| space | ground: a yard, a garden bed, nothing | nothing |
| `1` `2` `3` | a house of one, two, three storeys (a rectangle of one glyph) | walls 4.3 to 5.0 m, 6.4 to 7.4, 9.0 to 10.0; the front is the side with the most paving beside it (ties go to +z, then +x, the sides the play camera sees); walls 0.25 m inside the cell edges so a terrace never shares a face; roof type, jetty, chimney, stone and tile from a seed of the cell, except in the stone and timber districts |
| `a` `b` `c` | the same three | to put two houses of one height side by side without them merging |
| `S` | a tall stone house | 12.5 to 13.5 m, stone, a flat top behind a parapet with merlons, a stair turret, a stack: a tower house, a landmark; three of them |
| `A` | an arcade along a house front | a lean-to roof at 3.3 to 4.5 m on stone posts along the open side; an always-deep cover |
| `H` | the market hall | 12 x 6 m on posts; always deep |
| `m` | a covered stall | a canvas hip on four posts over a counter; a roof-only occluder, so under it is deep by the rays alone |
| `C` `K` `P` | the church nave, its tower (touching the nave), its porch | the nave 12 x 18 m, wall 12 m, ridge 22 m; the tower 5.2 m square and 24 m with a spire and the cross, the belfry lit; the porch a gabled slate roof on four posts, 4 x 4 m, always deep |
| `k` | a chapel | a stone box 9.4 x 5.4 m, wall 5.6 m, a steep slate roof, a bellcote on the front gable |
| `r` | a ruin | four walls and no roof, the front wall split by a doorway, each wall in 1.2 m pieces of uneven height (2.8 to 5 m); each wall an occluder, so inside it is lit in the middle and dark against the walls |
| `W` | a well | 1.3 m of collision; the one nearest the square's centre is `WELL`; the other stands on the north-west corner plaza |
| `Y` `t` | the big tree (16 to 18 m, crown 6 m); a tree (9.5 to 12.5 m) | broadleaf; the crown is a box occluder, so under a tree is cover; the big tree's box is 1.3 x its crown radius (a normal tree's 1.9 x), so its lee is a few metres like any tree's |
| `g` | a garden | a bush on about two in five of its rim cells (the cells beside something built); the middle is grass you can cross; no cover |
| `h` | a hedge: scrub under the wall and in the corners | a bush on every cell along its edge, bare ground inside a thick band; the whole cell blocked; not an occluder |
| `u` | a cart | 1.8 x 2.8 m, along the street it stands in; collision, not an occluder |
| `o` | a stack of three barrels | collision, not an occluder |
| `-` `\|` | a low wall (a terrace, a yard) | 0.5 m thick and 2.1 m high, in runs; collision and an occluder (it blocks a ray only within half a metre of it) |

### The plan

- **The spine.** West gate (the big tree 14 m inside it, the stone houses of the tower yard on the right) to the square, 44 m of 12 m street, then from the square's south-east past the church forecourt and the green to the east gate, 10 m. You can see from gate to square.
- **The square**, 40 x 26 m with the forecourt east of it: the hall in its north-west, the well in the middle, two stalls at opposite corners, two trees, the arcade along the whole south side, the great row of three-storey houses along the north, the church tower and porch at its north-east. You spawn near the middle, 11 m from the hall's corner, 12 m from the arcade, 6 m from a tree, with the well and the porch across open paving.
- **Three cross streets.** Cross street A (8 m) from the north-west corner plaza down the square's west side through the terraces to the south lane, with the stairs where it drops through the two terrace walls; cross street B (10 m) from the north-east corner plaza past the church's east side and the green to the south lane; the north street (8 m) between the two corner plazas, each with a tree, the western one with the second well. The middle lane (8 m) runs across the town north of the great row and the nave; the church lane (8 m) from the north street to the square between the low row and the churchyard; the east lane (8 m) splits the timber quarter; the south lane (8 m) runs under the south cottages; a short lane leaves the square's south-east corner.
- **The quarters.** North-west: the tower yard (24 x 20 m paved, the tower house in its south-west corner, a tree, a low wall, a cart) and stone houses round it. North-east: timber houses with jettied fronts, the corner tower house. East: the green (20 x 20 m) with the chapel on its north side, a tree, houses on its east, the ruin south of the spine. South: one-storey cottages on the terraces and the south lane, the south tower house at the square's corner, the terrace garden between two low walls. Centre: the great row, the church with its lit belfry.
- **Cover rhythm.** Along the spine and the cross streets an island every 8 to 14 m: a cart, a barrel stack, a tree, a stall, the well, the hall's and the arcade's deep edges, and the houses' own shadow bands along the fronts, which the lamp swings round.
- **The gates lead out to open ground.** As before: nothing to hide behind within 40 m of either gate outside the wall.
- **Rhythm in the roofscape.** 34 one-storey, 47 two-storey, 9 three-storey houses and 3 tower houses inside the walls (plus the 12 farm buildings outside); 23 stone houses (the north-west quarter and the towers), 26 jettied (the north-east); tile on about a third.

### Measurements

How to repeat them: `node tools/shot.mjs out/test.html out/<dir> plans/townlight.json` (the never-lit sample and the shares round a pinned mark), `plans/townplay.json` (the hider, nights 1, 1, 1, 3, 3, 3, 5), `plans/town.json` (the frames); the map widths, the distance histogram, the corners and the collision checks read `town.js` and `world.js` in node (the script is in the session notes; the definitions are below). Before is the 2026-10-15 map, after is this one.

**The map's own widths.** For every walkable cell, the largest all-walkable square through it:

| Width | 2 m (a slot) | 4 m | 6 m | 8 m | 10 m | 12 m | 14 m | 16 m or more |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before (2,605 cells) | 4.9% | 8.1% | 13.6% | 14.4% | 19.0% | 8.2% | 12.1% | 19.8% |
| after (1,830 cells) | 0 | 0.8% | 4.9% | 34.8% | 11.6% | 3.9% | 7.3% | 36.8% |

Cells with no 2 x 2 walkable square round them: 127 before, 0 after. Regions of 4 m passages: 35 before (the longest 39, 17 and 14 cells), 5 after (6, 2, 2, 2, 2 cells; the six are where the north street meets the wall's diagonal at the north-west corner plaza). Two-wall corners (a walkable cell with tall things on two perpendicular sides): 111 before, of which 59 open east (never lit); 12 after, of which 5 open east.

**Distance from every walkable cell to the nearest blocked cell** (the 0.5 m collision grid, the free cells inside the walls reachable from the spawn):

| | under 2 m | 2 to 4 m | 4 to 6 m | over 6 m | mean |
| --- | --- | --- | --- | --- | --- |
| before (10,331 m2 walkable) | 44.8% | 38.2% | 13.9% | 3.1% | 2.34 m |
| after (7,404 m2 walkable) | 33.6% | 39.7% | 19.0% | 7.6% | 2.87 m |

The share under 2 m has a floor: in an 8 m street the 2 m bands along both fronts are half the street, and the carts, barrels, trees and stall posts the brief asks for all count as blocked. After: streets are 60% of the walkable area and 32% of that is under 2 m; plazas 32% and 27%; the two walkable gardens 4% and 72%; under the roofs on posts 4% and 74%. Before, 63% of the walkable area was unpaved yard (50% of it under 2 m) and 21% street. The walkable area is smaller because the slots, the strips behind houses and the ground under the wall became hedge.

**Never lit.** A night-1 search with `S.attn`, `S.aim` and `S.aimS` pinned to each of a 5 x 5 grid of marks 25 m apart across the town (28 s of updates each, `S.player.seen` held at 0, the player parked on the square), `isLit` sampled at every walkable 2 m cell every 2 s: a cell is never lit if no sample came back `lit`.

| | walkable 2 m cells | never lit | never out of deep |
| --- | --- | --- | --- |
| before | 2,702 | 766 (28.3%) | 144 (5.3%) |
| after | 1,907 | 278 (14.6%) | 76 (4.0%) |

What the 278 are, nearest first: 106 under or within 2.5 m of a tree's crown (eleven trees; the crown is cover by the legend; the big tree alone keeps about 18 cells round its trunk); 65 against a building's wall (within 1.6 m: the east face of every house and the foot of its south face, which the lamp, always west of the mark, never reaches whatever the map does); 43 under a cover (the hall, the arcade, the porch, the gate arches: deep by rule); 29 within 4 m of a building (the lee of the tower houses and the church tower, 13 to 24 m tall); 16 under the town wall; 19 other. Before the redraw the never-lit cells were the slots between houses, the courtyards, the lane between the block and the nave, the gardens along the wall and the lee of the big tree; none of those shapes is left.

**Deep, shallow and lit round the mark**, the 60 m square round each pinned mark, at 14 s (the lamp 60 m to the side) and 28 s (50 m) of the search, over the 25 marks:

| | at 14 s: deep | shallow | lit | at 28 s: deep | shallow | lit |
| --- | --- | --- | --- | --- | --- | --- |
| before | 44 to 85 (median 72) | 8 to 33 (19) | 2 to 34 (10) | 33 to 76 (55) | 16 to 33 (24) | 4 to 41 (21) |
| after | 34 to 84 (median 68) | 6 to 42 (19) | 0 to 52 (13) | 25 to 71 (45) | 9 to 42 (19) | 12 to 63 (31) |

The hider-driven night-1 search (the mark moving along the trail), the same square at 5, 12, 20 and 27 s: before 80/12/8, 63/27/9, 70/19/11, 68/14/18; after 51/41/8, 53/20/27, 70/23/7, 56/17/27. The target was deep 35 to 45%, shallow 10 to 15%, lit the rest: met in the open quarters at the 50 m offset (the east: 25 to 33% deep, 47 to 63% lit), not at the 60 m offset anywhere. That is the lamp, not the map: with the light 34 m up and 60 m to the side a 7 m house throws a 9.5 m shadow, so a 10 m street is in shadow across its whole width at the far offset and half lit at 50 m. If the shares matter at the far offset, `offHi` in the night table or the light's height are the levers.

**The hider brain** (`plans/townplay.json`, `Math.random` in its choices, so the runs vary; six runs each in a second pass):

| Night | before (3 runs) | after (6 runs) |
| --- | --- | --- |
| 1 | survived 2 of 3 (max eye 0.35, 0.11; the catch at 14.5 s in cover) | survived 3 of 6 (max eye 0.23, 0.07, 0.41; the catches after 9.3, 3.7 and 6.0 s lit) |
| 3 | survived 0 of 3 | survived 1 of 6 (max eye 0.49) |
| 5 | caught | caught |

The hider is a bad player: it walks to the nearest dark spot against a house and waits. In the old map that spot was often a slot the light could never reach; now it is a shadow band the lamp swings round, and the walk to the next one crosses lit paving. Night 1 is harder for it (3 of 6 against 2 of 3). A real player on night 1 has the hall, the arcade and the porch within 12 m of the spawn and the lamp's drift to read; whether night 1 needs a softer `fill` or `offHi` is a night-table question (section 8), not a map one.

**Checks.** Every walkable map cell has a free quarter point in the collision grid (0 blocked; the old map had 33, tree trunks and bushes at cell centres) and every one is reachable from the spawn (0 unreachable); no free point inside any of the 93 house footprints (0 of 1,488 sampled); the spawn (-12, 8) is on the square (cell 34, 41, `Q`); both gates lead out to the fields. `plans/town.json`, `plans/townlight.json` and `plans/townplay.json` run with no console errors. `npm run build` and `npm run build:itch` are green.

**The frames** (`docs/town/`, Night, from `plans/town.json`): the town camera, the overhead by day and by night, and the play camera on the square (the spawn), at the west gate under the big tree, in the tower yard, on the north street, on the green, on the south lane and on the church forecourt. The question each answers is "do I know where I am": the church belfry's lit windows are in four of the six play frames, the tower house or the south tower in two, the wall and a round tower in three.

Counts, read in node: 93 houses inside the walls (3 towers), 184 occluders, 7 covers, 44 wall segments, 8 towers, 2 gates, 11 trees inside the walls (1 big), 10 garden bushes, 639 hedge cells (341 drawn), 8 stair cells, 3 low walls, 2 stalls, 1 arcade, 1 chapel, 1 ruin, 2 wells, 13 carts, 11 barrel stacks, 5 plazas.

### Notes for whoever tunes next

- The arcade, the porch, the hall and the gate arches are always-deep covers, so they are "indefinite" hides; section 4's reason to move still applies. If they turn out too generous, drop them from `COVERS` in world.js and they fall back to the rays.
- The map is the source: to move a house, draw it; to add a cover type, add a glyph to `LEGEND` in town.js, a reader there, and a builder in mesh.js. The seed only decides roof type, jetty, chimney, stone, tile and the sub-metre inset, keyed by the house's cell so edits elsewhere do not reshuffle it; `district()` overrides stone and jetty by quarter.
- Keep the drawing rules at the top of townmap.js: two cells or wider everywhere, no east-opening corners, hedge under the wall. The quick check is the 2 x 2 rule: a walkable cell with no 2 x 2 walkable square round it is a slot.
- The east face of every building is never lit while the lamp always hangs west of its mark. The lamp change in hand (circle the mark fully, peer into the spot it sits on) is what removes those 65 cells and the lee of the towers; the map cannot.
- Stairs are drawn, not walked: the ground is still the height function, which is a smooth hill (about 10% at the steepest), so the steps are a picture of a slope you walk up anyway.
- The hedge bands under the wall are 639 blocked cells; if they ever read as a wall of bushes from the play camera, the band's inner cells (`bare` in `readBushes`) can all be bare and only the edge drawn.

## 11. The light reaches everywhere, the alert, and the catch without the face (2026-10-21)

From a playtest: "there are many places where I can just stand and he can never put a light on it", "when half seen or seen he should adjust the light to see us better", "the ending of seeing his face takes me out of the mystery". Three changes in `game.js` (constants at the top), one in `nights.js`:

- **The lamp goes all the way round.** Its swing round the mark was limited to about 77 degrees either side of the direction to the giant, so the far side of every wall was dark for the whole search. It now turns a full circle in `spin` seconds (night 1: 26, night 3: 18, floor 14) with a wobble, on top of the low-to-overhead drift. Measured with the mark pinned for 40 s: the lamp covers all 12 bearing sectors and lights three quarters of the open cells within 20 m at some point (the rest are under roofs or inside footprints).
- **No spot is safe forever.** When the mark sits within `DWELL_R` 7 m of you for `DWELL` 5 s, it peers in: deep shadow counts as half seen until you move out from under it. Measured: Hidden at 4 s, Half seen at 5 s, the eye filling from then; 10 m away it is deep again.
- **The alert.** Half seen: the mark drifts toward where you are now and the beam tightens by a tenth. Seen: the lamp pulls in from the side to `ALERT_OFF` 8 m, nearly overhead (section 16: 24 m), so the cover under you shrinks, the beam tightens and brightens by `ALERT_NARROW` 30% (only once the mark is within 8-20 m, so it never narrows itself past you), the head turns to you, the drone and the chain quicken. The alert falls only after it has lost you for `ALERT_LOST` 2 s, slowly, so the release is visible. Measured: standing lit, alert 0.85 and the lamp from 52 m to 15 m within 1.5 s; after breaking line of sight, back out past 40 m in 5 s.
- **The catch, from the street.** No cut to the face. The play camera pushes in from 29 m to 12 m over 2.6 s, the beam narrows on you to a point, "it sees you" shows for a moment, at 2.4 s you flare (a glow and a white-hot figure) and come apart through the dither over 1.2 s while the ash in the beam rises, a stain and scorch ring stay where you stood, the horn swells to a hard cut to black at 4.4 s with the hit, and the card follows at 5 s. `tiltEye` and `faceEye` remain only for the dev cameras. Looking up on L during play stays the player's choice.

## 12. After the critique (2026-10-21)

A four-critic pass (first minutes, level, hunt, readability) measured the build at 91fe14c. What changed in answer, same day:

- **Camping is a timer, not a win.** The dwell rule now measures from the mark's centre (10 m) so its loops do not reset it, and peers in after 4 s. Night 1 starts the light 40 m off (was 48), later nights 8 m nearer each, floor 24.
- **A catch-up gear.** A mark more than 20 m behind your trail closes at up to 1.5x its walking speed, so running only buys time. Overtime scores at half. (Section 16: measured along the path, 4 m to 14 m, up to 2x, after 8 s.)
- **No sky flash.** Nothing counts as lit until the lantern is within 30 m of its hang height and the pose has settled, and the beam's tail beyond 45 m of the mark never counts. A still player at the spawn is Hidden through the whole descent.
- **Pace.** Later nights start from the last footfall (13 s to the search, no second wide shot), night 1's leave is 15 s, the night card holds 4 s.
- **The dash is felt.** The eye empties twice as fast in deep shadow while you are still moving. Shallow divisors: night 1 1.6, night 2 1.9, night 3 2.2 (floor 1.6), so shallow is a clock on every night; trail lag on night 3 is 6 samples (section 16: 16).
- **Reading the picture.** The word over the helm never blinks (pulse 0.7 to 1); the outline hull is at least a tenth of a metre at play zoom; the lantern's light on roofs and timber is half desaturated before the snap, so lit roofs go amber or grey, never red; the pool's inner third is a step brighter than its rim; the beam is not drawn from the play camera at all; giving up dims the drawn light as it lifts.
- **HUD and cards.** "It is looking" instead of "Hide" (a state, like the word over the head); the label plate keeps its width and the eye slot is always drawn, so nothing slides; the score is labelled; the pupil is always a dot. Night card: "38 s + 100. Score 138." Over card: "It found you." first, then the night and nights survived, the score, "Best" or "New best". Prompts name the click; touch screens get their own words.
- **Title and hints.** Every title line is drawn over its own shadow; "Something is walking the valley." / "It takes what its light finds." / "Stay in the dark."; the credit shows only when filled in. The controls hint stays up until twelve seconds into the first search; touch screens read "Drag: move / Hold the button: look up". Walking is frozen under the wide boot shot and the look up at it passing is cancelled only by a held key.

## 13. The split stride, the take you can see, the knight, and 480 x 270 (2026-10-21)

- **The high knee.** The walk in was planned forward from the valley and its last two plants swapped for the stance, so one stride could come out 2.45 km long; for a second the feet were 1.5 km apart, the pelvis sank 340 m and the thigh swung 56 degrees forward. `walkPlan` now plans backward from the stance, so every stride is the same length (1.9 to 2.1 km measured); feet never more than 1.2 km apart, the knee never nearer than 468 m below the hip, the sharpest knee anywhere 143 degrees (in the leave).
- **The take, seen where it happens.** The townsperson the light takes now flares (a glow over them), comes apart upward through the dither over 1.2 s with the same burn as the catch, and leaves a stain; a faint dry crackle, placed, only when they are within 70 m. No full-screen flash.
- **The look up at it passing** is never cut short by a held key or button any more; walking is frozen under it.
- **The knight** is 1.8x life size (was 1.6), with wide pauldrons, a red crest along the helm, and a cape twice as thick, wider and lower, so the red shows from the side and from above, not only from behind. Checked from four angles and from the play camera in `out/check4/`.
- **The picture is 480 x 270** (was 384 x 216): a whole 4x on a 1080p screen, so fullscreen no longer shows 5-pixel blocks, and the knight has a third more pixels. The itch page snaps the picture to a whole multiple of 480 x 270 whenever that fills most of the window, and fills the window otherwise. On itch.io use a 960 x 540 or 1440 x 810 viewport.

## 14. The picture's size is chosen at run time (2026-10-21)

The user: fullscreen "looks ugly, pixels too big, the game feels stretched to a larger screen". The picture had 480 dots across; a 1080p screen has 1920, so each dot was a 4 x 4 block. Now `src/itch.js` picks 960 x 540 on a large screen (2 x 2 blocks at 1080p) and 480 x 270 on a small one; `?res=WxH` forces a size on both pages. The HUD stays a 480 x 270 canvas whatever the picture is. The page shows the picture at a whole multiple of its size whenever one fills most of the window, and the canvas's backing store stays a whole multiple too (Windows at 125% scaling would otherwise make it 2.5x). Because 960 x 540 costs about 26 ms a frame on an integrated GPU (480 x 270: 15 ms, both measured on a 1080p canvas), the loop times its first hundred frames after warm-up and drops to 480 x 270 if they average slower than 50 a second (`R.setPicture` remakes the three picture-sized targets). The knight got a belt, a sword at the hip and a ragged three-strip cape.

## 15. It steps over the town on your own camera (2026-10-22)

The user: "the video when he steps over at the end of the night: his legs are weird and they go through buildings. Maybe we don't need that video; we just see from our perspective how he steps over."

- **No cut.** The leave's 9.6 s look-up (the street shot from under it) is gone. The end of a night stays on the play camera: the lantern lifts off the streets, the roofs go amber under it, the boot's shadow sweeps across the lanes, the houses light up again, the card. Holding L still looks up at it.
- **The boots clear the town.** A plant in the plan may name its own `lift`; the first step over the town lifts the sole 90 m, the second 60 m (the church tower is 31 m, the belfry top 40). Measured over the whole leave against every roof and tower inside the boot's outline: never nearer than 14 m over the town, 17 m outside it. The first boot lands at (480, 20), east of the farms (at (360, 10) it came down on one).
- **Its cloak was in the lens.** With the look-up gone, the play camera showed a flat lit wall for 1.5 s at 13 to 14.5 s of the leave: not the boot (which passes above what the camera can see) but the hem of the cloak, 430 to 600 m up, hanging between the camera and the town as the body crossed the camera's line. The play camera is a 2-degree lens 1.5 km out; its near plane is now 1.2 km from the eye (was 500 m), so nothing hanging in the air between the camera and the street is drawn. Nothing legitimate was that near: the boots over the town, the lantern and the chain all sit within 300 m of the street along the line of sight.
- **What you see of the step-over** is the shadow and the light, not the boot: from 48 degrees up, the picture reaches only about 36 m above the street at its top edge, and a boot that clears the tower is above that. Frames in `out/leave3/`.

## 16. Hiding that works, and seconds you keep (2026-10-22)

The critique of the same day (UNDERFOOT_CRITIQUE_2026-10-22.md) measured the build at 8f3780c with eight kinds of scripted player over 130 searches: the best passed night 1 about 1 in 4 and night 3 never, every survivor was a runner, and nearly every over card read "Score 0". The user chose its first two proposals. What changed, measured again by a second eight-lens pass (out/measure/) and tuned on its numbers:

- **It walks your trail, round your corners.** The mark walks the trail sample by sample (`S.trailI` is the one it goes to next), so it takes the corners you took and never cuts through a house. It may come as far as the night's `lag` samples behind you (25 / 16 / 16, floor 12 later; night 3 had 8, a 2 s tail that stood on a hider's spot two seconds after they stopped). A catch-up gear measured along the path (so a standing player pulls it no faster) closes at up to 2x when more than 4 m of your walking behind the head (full at 14 m), only after `GEAR_FROM` 8 s. Its speeds stay under yours on every night: walk 3.6 / 3.9 / 4.0, hunt 4.2 / 4.3 / 4.4, never faster (nights tighten by search length, fill, k, offset, lag, spin and a third townsperson instead).
- **Seen is a chase you can win.** Lit, it comes along your path `CHASE_LAG` 2 samples (0.5 s) behind you at the hunt speed, or straight at you when you are within 12 m with nothing between. Half seen, or just after it lost you (the eye above a tenth but you deep), it goes to `S.lastSeen`, the last place it saw you, and waits there until the lag lets it follow. The lamp pulls in to `ALERT_OFF` 24 m (was 8, nearly overhead, where a house threw a metre of shadow), `ALERT_LOST` 1.5 s, and the alert lets go twice as fast once you are dark with the eye under a tenth. Light fainter than `DIM_LIT` 0.3 (the pool's edge, which the picture draws nearly black) counts as half seen, never seen, so a hunt never starts from black ground.
- **The peer resets when you leave.** The dwell counts while the mark's centre is within 10 m; moving `DWELL_MOVE` 8 m from where you last stood still resets it, and the mark's centre moving off zeroes it. A cover (hall, arcade, porch, bridge, gates) is one spot however long: under a roof the radius is 20 m and nothing resets until you step out (a 10 m loop under the market hall had passed 13 of 17 nights with no light at all).
- **Night 3 is night 2's row with a 40 s search** (fill 0.8, k 2.2, offLo 25, lag 16, people 2, spin 22). Measured at n=10: night 3 with the old row 0 to 3 in 10 for every careful driver; with night 2's row 5 to 6 in 10; putting back any one of fill 1.0, offLo 20 or lag 8 made it 0 to 2 in 10 again, while k 2.2 and the speeds cost nothing. The search starts the mark `max(32, 40 - 4 (night - 1))` m off (night 3 had 24 m, walked in 6 s: the first word on the square was "Seen").
- **The seconds are yours as you earn them.** They bank ten at a time as they tick (a soft chime, the score plate flashes amber for half a second); the plate shows the banked tens only, so what you see is what you keep. A catch keeps them and loses the seconds since the last ten; `NIGHT_BONUS` is 50 (a round hundred dwarfed the seconds). The over card: "It found you." / "Night 3. You lasted 27 s, your best 31 s." / why / "Score 140. Best 265." or "New best 140.". The why is one of four, counted over the stretch that ended the night (the counters clear once it has lost you): "You stayed too long under it." (the dwell past 5 s at the catch, or most of the eye filled under the peer), "It chased you down." (more than 20 m really run with the alert high), "Caught in the half light.", "Caught in the open.". The night card: "30 s + 50. Score 80." Best seconds per night in `localStorage` (`underfoot.best.secs.N`).
- **The hider brain leaves.** The townspeople's hider brain, which the title's autopilot and `plans/playtest.json` also use, now leaves when the mark comes within 9 m, for a dark spot 9 to 21 m away and at least 12 m from the mark. Before, it shuffled 1 to 3 m round the same nook and was a poor witness of the rules.

Measurement harness: `out/measure/harness.js`, loaded as a plan's first eval step; `measureRun(driver, night, seed)` runs one search through the real flow with 'still', 'hider', 'runner', 'evader', 'camper', 'dasher' or a function, and returns what happened. The game's own random draws advance across runs within one page, so a driver and seed can differ by their place in the sequence.

Measured after the tuning (the second pass, 20 scripted searches a cell through the real flow, `out/measure2/`): the drivers are the game's own hider brain, an evader (stands deep, leaves for a dark spot 10 to 24 m off when half seen, peered at or crowded), a shadow router (picks the darkest route, the best scripted player), a runner (always away from the mark, round the walls) and a dasher.

| Night (search) | Hider brain | Evader | Shadow router | Runner | Still / camper |
| --- | --- | --- | --- | --- | --- |
| 1 (30 s) | 17/20 | 20/20 | 19/20 | 19/20 | 0/6, 1/6 |
| 2 (35 s) | 4/20 | 14/20 | 12/20 | 11/20 | 0/6, 0/6 |
| 3 (40 s) | 12/46 | 14/46 | 30/40 | 18/46 | 0/6, 0/6 |
| 4 (44 s) | 1/12 | 3/12 | | 7/12 | |
| 6 (52 s) | 1/12 | 0/12 | | 0/12 | |
| 8 (60 s) | 0/6 | 0/6 | | 1/6 | |

Against the targets: night 1 passed 93% by the careful drivers (target about 3 in 4; the old rules 25%); night 3 28% for the simple careful drivers and 75% for the shadow router (target about half; the old rules 0); night 6 4% (rarely); escapes after "Seen" on night 3 37 to 60% (target 1 in 3; the old rules 16%); the runner loses to the hide-and-move drivers on night 2 and is within noise of them on night 3 (the old rules: every survivor was a runner). Standing still, camping, a loop under the market hall and the 23 m arcade walk are all caught now (the old rule let the hall loop pass 13 of 17). Over 400 catch cards the seconds, the banked tens and the best lines were right; the cause line was wrong for a still player lit in the open (the dwell clause fired with no peer fill) and is fixed; the night card now counts the scored seconds so it always adds up.

Known and left for the next round, after strangers have played: stepping 9 m out of a roof and back every 3 s on alternate sides is never caught (21 of 21 runs), because the open ground 9 m out drains the eye faster than the peer fills it; the fix wants the lamp over the peered roof and no drain at its edge, measured on its own. Night 4 measured no harder than night 3 at the first ramp (fill +0.05 a night), so the ramp past the table is now fill +0.1 and k -0.15 a night, unmeasured. The game's own hider brain (the title's autopilot) still walks lit streets between spots and dies on night 2 four times in five; teaching it the dark route is a witness change, not a rule change.

## 17. Looking at the picture (2026-10-29)

The user asked for the screenshots to be looked at, so the game can be made clearer and better to look at, and said the look up at the giant breaks the spell because the model is seen whole. Eighteen moments of a run were rendered at 960 x 540 (`out/look/` before, `out/look3/` after) and read like a stranger would.

- **The town is no longer flooded amber under "Hidden".** For the first six seconds of a search the lamp is still high and its wide beam lit the whole town, while the word said Hidden (the hiding test counts nothing until the lamp is within 30 m of its floor). The drawn light now follows the lamp down the same way: a quarter at 150 m above its floor, full at 30 m. The wide boot shot's beam over the fields is fainter for it.
- **The pool's rim is a tone, not red noise.** The beam's faint tail drew as scattered red dots over the black ground (the darkest step of the red ramp dithered against black) and read as nothing a player could name. The tail below the test's floor (0.12) draws nothing now, the rim between 0.12 and 0.3 (where the test says half seen) is one flat step, and the dim part of the light is pushed to the greys before the snap, as roofs already were. The rim still dithers out, amber, not red.
- **The look up keeps the giant in the murk.** On the look camera the air is three times thicker and thins half as fast with height, the sky is at two fifths and the cloud bands at a third. The body is a dark shape with a pale edge, the lantern a point, the helm a dim mass; the chain and the near leg stay sharp from under it. A colossus seen whole is a model; half seen it is a thing.
- **The birds roost on open ground.** Fourteen of the twenty-six were placed inside houses and rose out of roofs when the footfalls came; one in five landed inside a house. They roost and land on open cells only (over a house a bird holds its height and flies on).

Seen and left: the knight is small and grey from above (the red cape barely shows); the lit windows' warm pools on the title read as neon strips along the house fronts; the step-over's shadow is nearly invisible because the town is already dark during the leave (the step needs to be felt: the shake, the dust, the hit); the over card sits on plain black.

## 18. Seven nights to dawn, the knight's record, and a face never seen whole (2026-10-29)

The user agreed to try two of the "what the epic ones have" points: a shape (an ending) and a story, linked to his world the Verdant Reach; and asked that the giant's face never be shown fully.

- **Dawn.** After the seventh night's search the leave is 24 s instead of 12: from 6 s the light goes toward a grey-gold morning (`S.dawn`, mixed into the look's light after the overcast lifts, so every look dawns in its own palette), at 10 s the birds go up, the label reads "Dawn", and at the end the dawn card: "Dawn." / "Seven nights. It has gone north, to the Cavern of Giants." / the score, with `DAWN_BONUS` 100 on top of the night. Any key starts a new run; there is no night 8. The title's fourth line says so: "Seven nights to dawn."
- **The knight's record.** Each night card carries one line (`RECORD` in nights.js): "It came from the north, lantern first." ... "One more night." The knight is a Verdant Knight (the red cape), the giant one of the ancient giants of the Reach, the town on an Elder Frontier. All of it is written as a proposal in the bible, `C:/Users/farha/Verdant Reach/19-underfoot.md` (pushed), tagged [STUDIO PROPOSAL] and [GAME TEXT]; nothing is canon until he marks it. The game never says what it is.
- **Its face is never seen whole.** From the shoulders up (rest height 2250 to 2600 m) the giant's shading goes to the colour of the cloud, with the embers of the eyes at 40%, from every camera: the title's valley shot, the look up, the dev face camera. The old catch already showed no face. Frames: `out/dawn/`.
- **After the check** (three lenses: the picture, a seven-night run, the words against the bible; `out/dawncheck/`): the dawn card can say "New best" (the best was read after it was set); the dawn is slower (up by 22 s) and greyer, with the ground light lifted so the lanes come up too and the exposure kept (lowering it had darkened everything); the stars go out with it; from the play camera nothing of the giant above its boots is drawn (`uPlayCam`: the cloak's hem had hung as a grey plane across the town once the dawn lit it); there is no look up once the dawn is coming (a white-out); the records say "down the valley" and "back up the valley" rather than north, so the town is not placed against the atlas, and the dawn card says it went "toward" the Cavern, the knight's belief, tagged [LEGEND] in the bible.

## 19. One new thing a night: the plan (2026-10-30, not built)

The third of the "what the epic ones have" points: the giant progresses, not the player. The rule (stay out of the light) and the two controls (move, look up) stay. The night table still sets how hard a night is; the tricks are what you see and fear, and only two of them touch the rules. Everything is driven by the search clock and the lamp's mark, never by a random number.

What the street camera can show: the play camera looks down on a patch of about 107 by 60 m round the knight, and from it nothing of the giant above 180 m is drawn (the `uPlayCam` discard that hides the cloak). So a trick reaches the street only through what comes down into that patch: the boots, the lamp, the shadows, the shake, dust, sound, the word in the corner, and now a hand. The whole giant is seen only on the look up.

| Night | It does | From the street | Rule | Cost |
| --- | --- | --- | --- | --- |
| 1 | stands and looks (as now) | the boot at the wall, the lamp down, the take, the step over | as now | built |
| 2 | kneels | a second boom from the west as the lamp starts down, 3 s of shake, a sheet of dust along the west lanes, the birds, the shutters, the last windows out; "It is kneeling"; the lamp on a shorter chain stops sharper and swings less. Look up: the knee at the wall, the body leaning over the town, the head in cloud far nearer | none new: the table's night 2 (lag 16, spin 22) is what the kneel explains; the lantern spring stiffer (0.9 to about 1.3) | a day, mostly the pose |
| 3 | its hand comes down | about 10 s in: "It is reaching", a groan of iron overhead, the shake builds, a shadow the size of the square slides over the square; 3 s later a fingertip lands: a boom bigger than the knee, dust down every lane, the lamp swings. On the square stands a rounded plate of black iron about 25 m across (the built fingers are 22 to 32 m thick), lit on one side, rising out of the top of the picture toward the west. The lamp keeps looking; its light cannot pass the finger, so a long shadow lies behind it. About 8 s later the groan, clods, the fingertip lifts out of the picture and leaves a round print. Later in the search it comes again wherever the light is looking, if the ground there is open | under it when it lands: black, the hit, the card "Its hand came down on you." It lands only where 10 m round is open (the square, the plazas, the fields, a wide crossing), so never on someone against a wall: a hazard of the open, where you were already dying. Where it rests it is a new wall to hide behind. Night 3 is harder by the table, not by the hand | a day or two: the crouch and reach, the landing, the crush, the finger as an occluder and in the lamp's shadow map, the tell, the sound, the hand up before the step over, the discard by part |
| 4 | lifts the roofs | at the search's start the hand comes down over the market hall (the square's west end): two fingertips close on its roof from above, the roof goes up out of the picture, the lamp's light falls in where the shade was; the posts stand bare for the run. From then on, 4 s under any wooden roof on posts (the hall, the arcade on the square's south side, the church porch) with the light on it: "It is reaching", 3 s to get out before that roof goes too. Stone stays (the gate arches, the bridge) | the peer under a cover becomes a thing you see coming; each roof taken is gone for the run, so there are fewer safe places by night 6. Cause: "It took the roof off you." | a day, reusing the hand: the cover roofs drawn as their own pieces, the cover and its occluder removed as the roof leaves, the trigger on the dwell |
| 5 | the town has learned | it walks in over a town already black: no window to put out, no smoke, no doors, no candles crossing the lanes; the pool is the only light. Nobody is out, so no take, and the take was the breather | people 0 from night 5 (the ramp adds a third person there now; reversed). Fits the night 4 card: "It does not take the ones who stay dark." | an hour, then re-measure |
| 6 | all of it, quicker | the hand every 12 s, the roofs at 3 s, the town black, the search 52 s. "One more night." Optional, later: it steps in, one boot on the east fields against the wall, the east ends of the lanes closed with iron: a picture only | the sum | tuning |
| 7 | the same, then dawn | built | built | built |

Honest notes.

- A hand cannot feel along the streets at this scale: a fingertip is a row of houses wide. So one fingertip, on open ground only, standing slanted over the roofs, with the contact about the size of a plaza. The square is 58 by 26 m, the other plazas 20 to 28 m across; the hall is 12 by 6 m at the square's west end, the arcade 24 by 2 m along its south side, the porch 4 by 4 m at its east.
- The hand helps a hidden player a little (a new shadow) and threatens only the open. That is fine for night 3 if the table carries the difficulty; it is said plainly so nobody expects the hand to be the ramp.
- Reach: standing, the left hand cannot come within 1.5 km of the town (the shoulder is 2.4 km up and 850 m west, the arm reaches 1 km). The giant must crouch low (pelvis near 450 to 500 m) and lean hard (about 1.2 rad) with the knee down at the wall. The rig can do it (two-bone IK, the knee cap off for that leg, the pelvis placed over the knee, the foot laid behind, the chest leaned); whether it looks right on a 3 km body is the first thing to check, with frames, before anything else, because nights 2, 3 and 4 hang on that pose.
- From the play camera only the bottom 60 to 80 m of the finger is ever in frame (anything 100 m up is off the top), so the 180 m cut never shows; but the discard must become per part (cloak only) so the hand is drawn.
- The finger must be in both the rule and the picture: an occluder box for `isLit` and `segmentBlocked`, and the giant drawn into the lantern's shadow map if it is not already (it is in the sun's).
- Order: the pose check, then nights 2 and 3 together (one piece of work), the empty town, the roofs, then the harness on nights 3 to 6 (`out/measure/harness.js`), then night 6's tuning. About four to five days of sessions in all.
