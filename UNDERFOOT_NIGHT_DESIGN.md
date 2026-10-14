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
