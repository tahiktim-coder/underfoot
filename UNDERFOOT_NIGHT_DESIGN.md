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
| Trail lag (0.25 s samples) | 25 | 20 | 10 | 10 | 10 | 10 |
| Townspeople | 1, the curious one | 2 | 3 | 3 | 3 | 3 |
| The light's mark walks / hunts at (you: 4.6 m/s) | 3.6 / 4.2 | 4.2 / 5.4 | 5.0 / 6.5 | 5.1 / 6.75 | 5.2 / 7.0 | 5.4 / 7.5 |

The lantern follows your trail and nothing else (a later user decision, below); the rows for lit houses and the lantern's visits to them are gone.

Score: +1 a second in the search, +100 a night passed, banked at the end of the leave; being caught loses the night's seconds. Best score in `localStorage` (`underfoot.best`).

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

## 10. The town drawn by hand (2026-10-15)

The last big weakness named was the town: houses scattered at random along six straight streets, so no place was anywhere and cover was luck. It is now a map drawn by hand, `src/fall/townmap.js`: one character per 2 m cell, 76 across and 67 down over the walled ellipse, read by `src/fall/town.js` into everything the game used to make up at random: the houses (with the fields game.js, homes.js and people.js read), `STREETS`, `SQUARE` and the smaller `PLAZAS`, `HALL`, `WELL`, `CHURCH` (with its tower and porch), the towers, the wall segments, the trees inside the walls, the props, the collision grid, the `OCCLUDERS`, the always-deep `COVERS`, and the paving in the near ground map. world.js still owns the ground, the river, the roads, the farms, the woods and the bridge. Nothing in game.js changed: the spawn is still (-12, 8), which the map keeps on the square; the hiding test still reads `S.lan.I`, the fixed cone and the night table.

The map (a copy; edit the one in townmap.js, rows padded to 76 as they are read):

```
    0         1         2         3         4         5         6         7     
    0123456789012345678901234567890123456789012345678901234567890123456789012345
 0                              ####################
 1                           ####                  ##T#
 2                        ##T#          ..            ####
 3                      ###    t        .. 3333          ###t
 4                    ###        2222   .. 3333     2222   ###
 5                  ###     111  2222111.. 3333 111 2222 111 ###
 6                 ##    t  111  2222111.. 3333 111 2222 111  t##
 7               ###        111  2222111.. 3333 111 2222 111    ###
 8              ##            ......................              ##
 9             ##             ......................             ggg#
10            ##              ..      ....      .... 111 2222    ggg##
11           ##               ..2222  .. 3333111.... 111 2222    gggt##
12          ##                ..2222  .. 3333111.... 111 2222         ##
13         ##                 ..2222  .. 3333111..  ...........        ##
14        #T     --------..   ..2222  .. 3333   ..  ...........         T#
15        #      |::::::|..   ..      .. 3333   ..      3333 .. 111      #
16       T#      |:SSSS:|....... bbbb ..        .. 2222 3333 .. 111      ##
17       #     t |:SSSS::....... bbbb .. 2222111.. 2222 3333 .. 111       #
18      ##       |:SSSS::..      bbbb .. 2222111.. 2222 3333 ..           ##
19     ##    ggg |:SSSS:|..     tbbbb .. 2222111.. 2222 3333t.. 2222       ##
20     #     ggg |::::::|..           .. 2222   ..           .. 2222        #
21     #     ggg --------..      ...............      ......... 2222        #
22    ##                 ..      ...............      ......... 2222        ##
23    #                  ..........           ..CCCCCC..                     #
24    #                  ..........           ..CCCCCC.. 2222         t      #
25   ##         2222111    111 2222 111 2222  ..CCCCCC.. 2222  111           ##
26   #          2222111    111 2222 111 222211..CCCCCC.. 2222  111            #
27   #          2222111    111 2222 111 2222  ..CCCCCC.. 2222  111            #
28   #      111 2222     2222           2222 t..CCCCCC..                      #
29   #      111 QQQQQQQQQ2222111              ..CCCCCC..                      #
30   #  2222111 QQQQQQQQQ2222111   2222    333..CCCCCC..2222                  #
31   #  2222    QQQQQQQQQ2222111   2222 111333..CCCCCC..2222 111 2222     t   #
32   #  2222  ..QQQQYQQQQ.......   2222 111333..CCCCCC..2222 111 2222         #
33   #  2222  ..QQQQQQQQQ.......   2222 111333..CCCCCC..2222 111 2222         ##
34   G..........QQQQQQQQQ     ..           333...KKKK............2222         #
35   G..........QQQQQQQQQ2222 ..              ...KKKK............             #
36   #  111     QQQQQQQQQ2222 ..              ...KKKK...     ..kkkk           #
37   #  111 2222  .. 22222222 ...QmmQQQQHHHHHHQQ.KKKK...     ..kkkk 2222      #
38   #  111 2222  .. 22222222 ...QmmQQQQHHHHHHQQQQPP....     ..kkkk 2222      #
39   #      2222  .. 2222 111    QQQQQQQHHHHHHQQQQPP..bb3333 ..kkkk 2222111   #
40   ##     2222  .. 2222 1113333QQQQQQQQQQQQQQQQQQQbbbb3333 ..kkkk 2222111  ##
41    #  111      ..      1113333QQQQQQQQQQQQQQQQQQQbbbb3333 QQQQQQQQQ  111  #
42    #  111 2222 .. bbbb aaa3333QQQQQQQWQQQQQQQQQQQbbbb3333 QQQQQQQQQ       #
43    ## 111 2222 .. bbbb aaa3333QQQQQQQQQQQQQQQQQQQ.....===.QQQQQQQQQ......G#
44     #     2222 .. bbbb aaa    QQQQQQQQQQQQQQQQQQQ.....===.QQQQQQQQQ......G
45     #     2222 ...............QQQQQQQQQQQQQQQmmQQ..111    QQQQQQQQQ111   #
46      #   t     ...............QQQQQQQQQQQQQQQmmQQ..111    QQQQQQQQQ111  ##
47      ##               3333  ..  AAAAAAAAAA       ..111    QQQQQQQQQ111 ##
48       #      2222 111 3333  ..  2222bbb3333      ..       111          #
49       ##     2222 111 3333  ==  2222bbb3333     t.. 2222  111  rrrrr  ##
50        #     2222 111 3333  ==  2222bbb33332222  .. 2222 t111  rrrrr  #
51         #    2222ggg -------..--2222   33332222  .. 2222       rrrrr ##
52         ##       ggg        ..........     2222  .. 2222       rrrrr##
53          ##            111  ..........     2222  ..                ##
54           ##       111 111  == 111   ..............  111          ##
55            #T      111 111  == 111   ..............  111     t   ##
56             ##     111      .. 111                   111        ##
57              ##       ------..--------           111           T#
58               ###               2222   111 2222  111  t      ###
59                 ##              2222ggg111 2222  111        ##
60                  ###            2222ggg111 2222t          ###
61                    ###          2222ggg    2222         ###
62                      ###                              ###
63                        ####                        ####
64                           ####                  ####
65                              ########T###########
```

The legend:

| Glyph | Means | What the game gets |
| --- | --- | --- |
| `#` `T` `G` | the wall, a tower on it, a gate (two cells) | the ring is walked round in order, smoothed and cut into chords of up to 10 m (44 segments); a round tower per `T` (8); a gatehouse per gate run, its arch an always-deep cover (2) |
| `.` `=` | a lane; a lane cell with steps | paving in the ground map; runs of four cells or more become `STREETS` for the strollers; five stone steps across each `=` cell, set into the slope |
| `Q` | a plaza | paving; each region is a plaza, the biggest is `SQUARE` |
| `:` | yard paving (a courtyard) | paving at 0.6 |
| space | ground: a yard, a garden bed, nothing | nothing |
| `1` `2` `3` | a house of one, two, three storeys (a rectangle of one glyph) | walls 4.3 to 5.0 m, 6.4 to 7.4, 9.0 to 10.0; the front is the side with the most paving beside it (ties go to +z, then +x, the sides the play camera sees); walls 0.25 m inside the cell edges so a terrace never shares a face; roof type, jetty, chimney, stone and tile from a seed of the cell |
| `a` `b` `c` | the same three | to put two houses of one height side by side without them merging |
| `S` | a tall stone house | 12.5 to 13.5 m, stone, a flat top behind a parapet with merlons, a stair turret, a stack: the tower house, a landmark |
| `A` | an arcade along a house front | a lean-to roof at 3.3 to 4.5 m on stone posts along the open side; an always-deep cover |
| `H` | the market hall | as before (12 x 6 m here); always deep |
| `m` | a covered stall | a canvas hip on four posts over a counter; a roof-only occluder, so under it is deep by the rays alone |
| `C` `K` `P` | the church nave, its tower (touching the nave), its porch | the nave 12 x 20 m, wall 12 m, ridge 22 m; the tower 7.2 m square and 24 m with a 7.2 m spire and the cross; the porch a gabled slate roof on four posts, 4 x 4 m, always deep. The church turns to put the tower where the map has it |
| `k` | a chapel | a stone box 9.4 x 7.4 m, wall 5.6 m, a steep slate roof, a bellcote on the front gable |
| `r` | a ruin | four walls and no roof, the front wall split by a doorway, each wall in 1.2 m pieces of uneven height (2.8 to 5 m); each wall an occluder, so inside it is lit in the middle and dark against the walls |
| `W` | the well | as before |
| `Y` `t` | the big tree (16 to 18 m, crown 6 m); a tree (9.5 to 12.5 m) | broadleaf; the crown is a box occluder, so under a tree is cover |
| `g` | a garden | a bush on about half the cells; no cover |
| `-` `\|` | a low wall (a courtyard, a terrace, a garden) | 0.5 m thick and 2.1 m high, in runs; collision and an occluder (it blocks a ray only within half a metre of it) |

### The plan

- **Three plazas you must cross.** The square (38 x 20 m, the hall on its north edge, two stalls at opposite corners, the well, the arcade row on its south side, the church porch at its north-east corner). The west yard (18 x 16 m) inside the west gate with the big tree in the middle. The east green (18 x 14 m) with the chapel on its north side and the ruin at its south-east, two stair cells on the street down to it.
- **Cover every 8 to 10 m, never in a line.** Houses along every lane stand flush or one cell back, with a yard or a tree between runs, so the deep band behind one house does not join the next: you cross a shallow or lit gap each time. One- and two-storey houses mix along the same lane; the three-storey houses stand where a long shadow helps (the arcade row's east end, the lane west of the church, the tanner lane block, the east of the square, two in the north).
- **Deep covers with open sides.** The hall, the arcade (20 m along the square's south side), the church porch, the two gate arches, under the bridge. The arcade and the porch are new and sit on the square's edges, so a dash across the square has somewhere to end.
- **Chokepoints and courtyards.** The tower house stands in a walled courtyard in the north-west with one gap in its east wall onto a lane; the lanes from the west yard to the square jog twice; the stair street from the square to the east green narrows to two cells; the steps lane from the square's south-west corner drops through two terrace walls with stairs in the gaps.
- **Landmarks from the play camera.** The church tower (31 m over its ground, with the cross) north-east of the square; the tower house in the north-west; the big tree in the west yard; the well in the square; the chapel's bellcote on the east green; the round towers on the wall at the edge of every frame.
- **No dead ends without cover.** Every lane ends at a plaza, another lane or a house that is itself cover; the three short spurs (the courtyard gap, the alley east of the square, the lane behind the arcade row) end against walls with a house beside them.
- **The gates lead out to open ground.** No tree, haystack or building stands within 40 m of either gate outside the wall; the fields there have nothing to hide behind, so a run out of the gate puts you in the light with nothing to do but come back.
- **Rhythm in the roofscape.** 32 one-storey, 32 two-storey, 8 three-storey houses and the tower house inside the walls (plus the 12 farm buildings outside); walls 4.3 to 12.9 m; gable or hip from the seed; stone houses at 15 to 25 % by kind; tile on about a third.

### Measurements

Read in node (`world.js` and `town.js` import without a browser): 73 houses inside the walls, 177 occluders, 7 covers, 44 wall segments, 8 towers, 2 gates, 18 trees inside the walls (1 big), 17 bushes, 14 stair cells, 9 low walls, 2 stalls, 1 arcade, 1 chapel, 1 ruin.

The hider brain (`plans/townplay.json`, which also samples the ground round the lantern's mark every 2.5 s: a 24 m disc, free points, by tier):

| Night | Result | Max eye | Lit / shallow (s) | Deep / shallow / lit round the mark (%), moments through the search |
| --- | --- | --- | --- | --- |
| 1 | survived | 0.09 | 0.0 / 2.7 | 66/33/2, 54/32/13, 60/20/20, 68/7/25, 49/23/28, 38/33/29 |
| 1 | survived | 0.12 | 0.2 / 4.8 | 76/24/0, 71/10/19, 38/32/30, 53/15/32, 45/33/22, 38/37/25 |
| 1 | survived | 0.19 | 0.8 / 3.8 | 61/26/13, 61/28/11, 45/27/28, 48/20/31, 56/33/11, 55/32/13 |
| 3 | caught | 1.00 | 0.8 / 5.3 | 77/18/4, 59/37/4, 45/25/30 |
| 3 | caught | 1.00 | 3.8 / 0.0 | 66/18/16, 65/28/7, 47/24/29 |
| 3 | survived | 0.90 | 0.8 / 5.9 | 40/31/29, 53/19/28, 57/11/32, 60/23/17, 49/27/24, 49/42/9, 45/47/9, 27/34/38 |
| 5 | caught | 1.00 | 4.6 / 5.5 | 68/27/6, 59/33/8, 54/14/31, 62/33/5, 62/19/19 |

So night 1 is survived by hiding alone, night 3 is pressed (one in three, and that one at 0.90), as before the map (section 9: night 1 two of two, night 3 none of two). Round the mark about half the free ground is deep, a quarter shallow and a quarter lit, and the shares swing with the lantern's offset and swing: the shallow band is a third to a half of the ground at moments.

Checks:

- Every point inside a house footprint is blocked (0 free of 2,125 sampled); every walkable cell inside the walls is reachable from the spawn on the 0.5 m collision grid itself, except 8 lane cells a cart fills edge to edge (the other half of each of those two-cell lanes is open); both gates lead out to the fields; the spawn (-12, 8) is on the square.
- `plans/pass.json` and `plans/town.json` (the town camera, an overhead, and the play camera on the square, the west yard, the east green, the church, the south steps and the north quarter, in Night and in Ashwake) run with no console errors. `npm run build` and `npm run build:itch` are green.
- The lantern now rides 56 m over the ground under it (f669d31), with the drip 37 m and the glass bottom 31 m below the ring: 19 m and 25 m over the ground. Over their own ground the tallest things are the church cross at 33.3 m, the nave ridge at 21.9 m, the tower house's turret cap at 17.8 m and a three-storey gable at up to 15.4 m. So the church tower goes through the glass and the nave ridge touches the drip when the lantern is straight over them; every house clears it. The tower was 50 m before this map; at 24 m with a 7.2 m spire it is still twice the height of anything else in town. If the clip matters, the clean fix is in game.js's `stepLantern`: never lower than the tallest `OCCLUDERS` ridge within about 8 m of the point under the lantern plus 38 m.

### Notes for whoever tunes next

- The arcade and the porch are always-deep covers like the hall, so they are "indefinite" hides; section 4's reason to move still applies. If they turn out too generous, drop them from `COVERS` in world.js and they fall back to the rays (the roof blocks the rays from most angles anyway).
- The map is the source: to move a house, draw it; to add a cover type, add a glyph to `LEGEND` in town.js, a reader there, and a builder in mesh.js. The seed only decides roof type, jetty, chimney, stone, tile and the sub-metre inset, keyed by the house's cell so edits elsewhere do not reshuffle it.
- Stairs are drawn, not walked: the ground is still the height function, which is a smooth hill (about 10 % at the steepest), so the steps are a picture of a slope you walk up anyway.
- `plans/town.json` renders the town from the fixed cameras into `out/town/`; `plans/townplay.json` runs the hider and the ground sampler. Three frames are in `docs/town/`.

## 11. The light reaches everywhere, the alert, and the catch without the face (2026-10-21)

From a playtest: "there are many places where I can just stand and he can never put a light on it", "when half seen or seen he should adjust the light to see us better", "the ending of seeing his face takes me out of the mystery". Three changes in `game.js` (constants at the top), one in `nights.js`:

- **The lamp goes all the way round.** Its swing round the mark was limited to about 77 degrees either side of the direction to the giant, so the far side of every wall was dark for the whole search. It now turns a full circle in `spin` seconds (night 1: 26, night 3: 18, floor 14) with a wobble, on top of the low-to-overhead drift. Measured with the mark pinned for 40 s: the lamp covers all 12 bearing sectors and lights three quarters of the open cells within 20 m at some point (the rest are under roofs or inside footprints).
- **No spot is safe forever.** When the mark sits within `DWELL_R` 7 m of you for `DWELL` 5 s, it peers in: deep shadow counts as half seen until you move out from under it. Measured: Hidden at 4 s, Half seen at 5 s, the eye filling from then; 10 m away it is deep again.
- **The alert.** Half seen: the mark drifts toward where you are now and the beam tightens by a tenth. Seen: the lamp pulls in from the side to `ALERT_OFF` 8 m, nearly overhead, so the cover under you shrinks, the beam tightens and brightens by `ALERT_NARROW` 30% (only once the mark is within 8-20 m, so it never narrows itself past you), the head turns to you, the drone and the chain quicken. The alert falls only after it has lost you for `ALERT_LOST` 2 s, slowly, so the release is visible. Measured: standing lit, alert 0.85 and the lamp from 52 m to 15 m within 1.5 s; after breaking line of sight, back out past 40 m in 5 s.
- **The catch, from the street.** No cut to the face. The play camera pushes in from 29 m to 12 m over 2.6 s, the beam narrows on you to a point, "it sees you" shows for a moment, at 2.4 s you flare (a glow and a white-hot figure) and come apart through the dither over 1.2 s while the ash in the beam rises, a stain and scorch ring stay where you stood, the horn swells to a hard cut to black at 4.4 s with the hit, and the card follows at 5 s. `tiltEye` and `faceEye` remain only for the dev cameras. Looking up on L during play stays the player's choice.
