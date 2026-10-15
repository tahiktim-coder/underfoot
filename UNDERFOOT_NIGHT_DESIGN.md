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

Frames (384 x 216, `plans/docnight.json`): `docs/night/01_title.png` (the title with the rule), `02_approach_lights_out.png`, `03_curious_taken.png`, `04_stain.png`, `05_shallow_ring.png`, `07_taken_house.png`, `08_card.png` (the night card with the score). The itch page itself: `plans` has no entry; `node tools/shot.mjs itch/index.html out/itch '<plan>'` with `QUERY='?hold'` renders it (the title shows the credit, the overlay buttons sit top right).

### The numbers

| | Night 1 | Night 2 | Night 3 | Night 4 | Night 5 | Night 8 and on |
| --- | --- | --- | --- | --- | --- | --- |
| Search length | 30 s | 35 s | 40 s | 44 s | 48 s | 60 s |
| Eye fill in the light (1 catches in about 3 s) | 0.55 | 0.75 | 1.0 | 1.0 | 1.0 | 1.0 |
| Shallow divisor k | 2 | 1.75 | 1.5 | 1.45 | 1.4 | 1.3 |
| Lantern offset low end (high end 60 m) | 30 m | 25 m | 20 m | 19 m | 18 m | 15 m |
| Lit houses at the plant | 3 | 4 | 6 | 7 | 7 | 8 |
| Lantern visits a lit window after (and at least 6 s lost) | 10 s | 8 s | 5 s | 4.5 s | 4 s | 4 s |
| Trail lag (0.25 s samples) | 25 | 20 | 10 | 10 | 10 | 10 |
| Townspeople | 1, the curious one | 2 | 3 | 3 | 3 | 3 |
| The light's mark walks / hunts at (you: 4.6 m/s) | 3.6 / 4.2 | 4.2 / 5.4 | 5.0 / 6.5 | 5.1 / 6.75 | 5.2 / 7.0 | 5.4 / 7.5 |

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
