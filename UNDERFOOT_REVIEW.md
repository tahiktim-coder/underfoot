# Underfoot 1.2: playtest and review

Written 2026-10-14 after playing the built game (dist/game.html) through several full cycles, reading the source, and running a five-lens review (design, bugs, itch.io readiness, performance, theme) whose factual findings were each checked by two independent refuters. 18 factual findings survived, 0 were refuted, 25 lower-severity ones were left unverified and are marked as such below.

## Verdict

Underfoot is a striking vignette and not yet a game. The picture, the giant walking in with delayed footfalls, the lantern lowering on its chain, the windows going out, the catch cinematic that climbs the chain to a face with embers in its eyes: that is more atmosphere than most itch games ever reach, and it is all hand built with no engine. What is missing is the frame around it. There is no start (the title skips itself and the town plays itself after 8 seconds), no end (caught and survived both just start the next cycle; the stats are counted but never shown), and no stakes. Three things actively fight the player, listed under "Why it is not a game yet". None of them are hard to fix. The expensive part (look, giant, renderer) is done and excellent. What remains is the cheap part: a shell with a start and an ending, readable feedback, and packaging. Your instinct to keep it basic and fun is the right one. It is worth pursuing.

## What I played and measured

The browser pane in this app does not run requestAnimationFrame, so I drove the game through its own test API (`window.__v16`, `game.update` and `game.render`) exactly as the headless screenshot tools do, captured 26 frames across every phase, and used real key events for input.

| What | Result |
| --- | --- |
| Stand still in the open once the light arrives | Caught in about 5 seconds (eye 0.03 to 1.00) |
| Run directly away from the lantern whenever lit | Caught in 5.5 seconds; running fills the eye 20% faster and the light outruns you once it has you |
| The game's own hiding brain (odd cycles) | Survived the full 26 second search; eye peaked at 0.49; lit for three short stretches as the shadows turned |
| Stand still in shadow for 8 seconds | Autopilot takes over; on even cycles it walks you into the light and you are caught |
| Release the right mouse button outside the picture | Look-up stays latched; also stays latched on blur |
| Page served without a charset header, or opened from disk | Quirks mode; "45°" renders as "45Â°", "386×218" as "386Ã—218" |
| Page at phone width (375 px) | Lays out at 980 px because there is no viewport meta; the picture is tiny |
| Render cost on this laptop (AMD Renoir integrated GPU, 1475x830 canvas) | 5 to 7 ms per frame in play, approach and leave cameras. Fine on laptops. Phones untested |

What reads well on screen: the zoomed-in catch push-in, the night look during the search (amber pool, blue dark), the look-up shot of the giant with the chain, the leave sequence with the boot overhead. What reads badly: the first seconds of the search, when the camera is still pulling back in from the wide plant shot and the whole town is a grey dithered field with an amber smear. The player figure is hard to find and the shadow edges are not where the hiding test says they are (see below).

## What is great and must stay

- The core image. A 2.9 km armoured giant stops beside a town and lowers a lantern to hunt one small figure. Nobody else on itch has this shot.
- The hiding loop itself. Put a house between you and the lantern, watch the shadows swing, move when the light comes round. That is a real stealth mechanic with no tutorial text.
- The 386x218 dithered picture with one warm light. Ownable style.
- The phase labels already tell the whole story in six words.
- The catch cinematic. This is the screenshot and the GIF people will post.
- The engineering: one 170 KB file, no runtime dependencies, deterministic runs, a force() API and Playwright tools that make tuning fast.
- The judgement theme is already half there without words: the town puts out its lights, the curious autopilot walks out, looks up and is taken, rust runs from the giant's eyes like tears.

## Why it is not a game yet

1. **No start, no end, no stakes.** `updateStory()` routes both caught and leave into `startCycle()` with identical settings. `S.stats` is incremented and never drawn. The title ends on a timer whether or not anyone pressed a key. A player on itch sees a self-playing demo.
2. **The idle autopilot hijacks a hiding player.** `update()` counts idle time in every phase and flips `S.auto` after 8 seconds. Standing still in shadow is the correct play during the search, so doing it right hands control to the autopilot. On even cycles that brain walks to the square and into the beam. Confirmed live.
3. **Running never helps.** The lit pool is roughly 30 m across and 80 m long; the aim trails you by only 3.5 seconds and loses 0.3 m/s to you, and the moment you are lit it snaps to your live position. So "it follows your trail" is invisible and breaking line of sight is the only mechanic. That is fine as the one mechanic, but the game never tells the player, and the first instinct (run) is death in 5 seconds.
4. **Being lit is unreadable.** `isLit()` lights you when one of three rays reaches the lantern, so a 2 to 3 m band at every shadow edge looks dark on screen but fills the eye. Nothing on the figure or in the sound changes when the light finds you. The only tell is a 30 px meter in the corner.
5. **Too much watching.** Roughly 70% of a cycle is non-interactive (calm, walk-in, plant, leave) around 26 seconds of play, and a death replays the whole walk-in before you can retry. There is also no give-up tell: the lantern looks identical at second 1 and second 25, so "hold on two more seconds or run" carries no information.

## Bugs (confirmed)

- Autopilot takeover after 8 s idle in every phase (game.js, `update()`, the idle counter). Gate it on "has the player ever pressed anything", or remove it from play once there is a click-to-start title.
- Right-click look-up latches on (game.js pointerdown returns before capturing button 2; only a button-2 pointerup clears it; blur clears keys but not `S.lookHeld`). Track `e.buttons & 2`, capture button 2, clear on blur, pointerleave and lostpointercapture. The page's hold button has the same latch via `S.lookButton`.
- No `<!doctype html>`, `<meta charset>`, `<meta viewport>` in page/game.html, so the shipped file runs in quirks mode, shows mojibake when served without a charset header, and lays out at 980 px on phones. The screenshot tool wraps a doctype around the page, which is why the tests never saw it.
- `touch-action: pan-y` on `.screen` lets the browser take vertical drags as scrolling and cancel the pointer, so the touch stick likely cannot walk up or down. Very likely from the code; verify on a phone.
- Keys only work after clicking the picture (listeners on the canvas, nothing focused at boot, look bar and Sound button steal focus). Bind on window, match `e.code` so non-QWERTY layouts work, focus the canvas at boot.
- The catch fades back in on the giant's face for half a second, then hard-cuts to the street with all windows popping on. Start the new cycle while the fade is still black.
- Wind, roar and drone keep playing in a hidden or scrolled-away tab. Suspend the AudioContext on visibilitychange.
- A WebGL context loss or any frame exception leaves a black frozen canvas with sound running and no message.
- Space is bound to look-up, which freezes the player mid-search. Space and Enter are needed for begin, skip and restart.
- Jump buttons from search or caught leave the giant's arm stretched toward the town and can stack a second horn (`pose.search` is never reset in `force()`). Low priority once the buttons are dev-only.

## itch.io blockers

- **The built page is a style-library exhibit, not a game page.** A 92 px title, a six-line lede, a seven-button look bar and notes sit above the picture. In itch's non-scrolling iframe the player sees the title and a quarter of the game. Make a new template, page/itch.html, with doctype, charset and viewport, a full-bleed 16:9 canvas, `touch-action: none`, no Google Fonts (the game draws its own pixel font), no look bar, no jump buttons, and a new entry src/itch.js that creates the game with the shipped look.
- **`npm run build` writes the looks contact sheet to dist/index.html.** itch launches index.html, so a zip of dist/ uploads the contact sheet as the game. Add a `build:itch` script that writes itch/index.html and zip that alone.
- **No click-to-start gate.** Inside itch's cross-origin iframe the parent's "Run game" click is not an audio gesture, keys do nothing until the picture is clicked, and the title skips itself. Hold the title until the first key or click; that one gesture starts audio, focuses the canvas and disables the autopilot for good.
- **Never run on a real GPU or phone.** On my integrated AMD it is 5 to 7 ms per frame, so laptops are fine. Phones are unknown. The giant's sun shadow map re-draws about 200k static terrain triangles every frame and the frame loop is uncapped (144 Hz laptops do 2.4x the work). Cheap wins in order: cap the loop at 60 Hz, halve the shadow map sizes if it stutters, cache the terrain-only shadow map.
- **Store page.** Lead with the rule and the hook, not the renderer. Cover: the lantern lowering over the town. GIF: about 16 seconds of a search at 4x so the shadows visibly turn. Tags: stealth, horror, pixel-art, short, browser.

## Recommended direction: survive three nights

Keep exactly the core you have, light versus shadow and one giant lantern, and wrap it in the smallest possible shell.

- A title that waits for a click. "Night N" in the corner. A verdict card after each night ("Night 2. It passed."). A game-over card with nights survived and best (the localStorage helper in main.js already exists). An ending on the relit town after night 3.
- State the judgement as a rule, not a morality, in one line on the title and the first card: **"It takes what its light finds."** That line is the lore, the tutorial and the win/lose vocabulary at once. "Sinners" is a rule the game cannot explain when you die; "what its light finds" is one the player can act on.
- Escalate through the light, not the map: each night the pool is wider, the trail lag shorter, the search longer, the start closer, the swing bigger. Today's values become the last night. Night 1 should use a narrower cone (about 0.24 instead of 0.36) and a longer lag (about 25 samples instead of 14) so "break line of sight, keep moving, the light arrives where you were" is learnable.
- Make lit mean at least two of the three rays, so the picture and the rule agree. Brighten the cloak and draw the eye dot over the figure's head when lit. Add a one second "notice" sting in sound.js and tighten the beam as the eye passes 0.3.
- A failed night retries at the plant ("It is still here"), not the walk-in. The first death and the ending keep the full tilt-to-face cinematic; every other death is a two second burn to ash and a card.
- A give-up tell: over the last five seconds of the search the lantern visibly lifts and the pool widens and dims.
- Ship **Night lantern** as the only look. A lantern only means something at night, and the windows going out is only a story beat when the town was lit. Switch to Ash and blood under a fade for night 3: red sun, ash falling, bone-white lantern is the "burn" without a fire system. Do not ship the look picker; keep page/game.html with `?look=` as the dev page.
- Optional, a few dozen lines: on night 1 a single townsperson running the existing curious brain walks out into the square, stands in the pool, looks up, and is gone. Wordless tutorial and the judgement in one beat.

Target 5 to 6 minutes for a full run with about 2.5 minutes of actual hiding.

## Roadmap

### 1. Make it a game with an ending (one weekend)
- Extract the zip into Project_giants and build from there (`npm install`, `npm run build`).
- game.js: click-or-key-to-start title; delete the idle autopilot from play; keep `autopilot()` for the title attract loop.
- game.js: `S.night` and a NIGHTS table (search length, cone, trail lag, swing, start distance) read in `setPhase('search')` and `updateGiant()`.
- game.js `drawUI()`: "Night N", verdict card, game-over card with best, ending card.
- game.js `isLit()`: lit means at least 2 of 3 rays; brighter cloak and eye dot on the figure when lit.
- Failed-night retry re-enters at plant like `force('search')` does; leave cut to about 12 s from night 2; drop Space from the look binding.
- `?night=N` and `?debug` on top of `force()` so each night can be reached in 30 seconds.

### 2. Make it feel like judgement (one weekend)
- sound.js: notice sting and a seen-driven tone; pass `P.seen` and `P.lit` into `snd.update`.
- `lanLight()`: tighten the beam as the eye passes 0.3.
- Short burn fail after the first death; fix the fade-back-in at the end of the catch.
- Give-up tell over the last 5 s of the search; "Hold on" label.
- Copy: subtitle, three night cards, ending line, first-search hint tied to search time.
- Night 3 under Ash and blood, switched under a fade.
- Optional townsperson.

### 3. Fix the player-facing bugs and the page (a Saturday)
- page/itch.html and src/itch.js; `build:itch`; a small zip script.
- Key listeners on window, `e.code` matching, canvas focused at boot.
- Right-click and hold-button latch, second finger as look-up on touch, `touch-action: none`.
- AudioContext suspend on hidden tab; webglcontextlost handler; a visible error message; a "Building the valley..." line during startup; 60 Hz cap.
- tools/shot.mjs: stop auto-wrapping the doctype so screenshots test the shipped file.

### 4. Ship on itch.io (a Saturday)
- Run itch/index.html on a laptop iGPU and one phone; halve shadow maps first if it stutters.
- Playtest with two or three people who have never seen it; watch for "why did I die" moments.
- itch project: Kind HTML, zip with index.html at root, embed in page, viewport 1152x648 (3x the native picture), fullscreen on, auto-start off.
- Store page: cover, GIF, four night stills, the pitch, dev note last.
- README section 13: the itch build steps. Tag v1.3.

## Not verified

- Sound by ear (the README says levels were only measured offline). Nobody has heard it yet.
- Touch input on a real phone.
- Performance on a phone or on a 144 Hz laptop.
- The 25 lower-severity findings below the "verified" line in the review (HUD redraw cost, chain rebuilt every frame, 500+ draw calls per frame, synchronous shader compile at boot, and others). Plausible from the code, not checked against a running build.
