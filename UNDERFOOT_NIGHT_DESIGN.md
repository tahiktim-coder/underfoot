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
