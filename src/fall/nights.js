// UNDERFOOT — the nights. Each night the lantern asks more of you; they go on until it finds you. The score
// is the seconds you lasted in its searches, banked ten at a time and kept on a catch, plus fifty for each
// night passed. The hiding test never reads a look; it reads this table.

// search: seconds the lantern hunts. fill: how fast the eye fills in the light, as a share of the full rate
// (about 3 s to catch at 1). k: the shallow-shadow divisor (the eye fills at the lit rate / k). offLo,
// offHi: the range the lantern's side offset drifts over (nearly overhead to low). lag: trail samples
// (0.25 s each) it aims behind you. people: townspeople out in the search. walk: how fast the light's mark
// moves along your trail, hunt: once it has seen you. Both stay under your 4.6, on every night: a light that
// outruns you makes hiding pointless, so the nights ask more by the search's length, the trail's lag, the
// fill and the thinner shallow shadow instead.
export const NIGHTS = [
  null,
  { search: 30, fill: 0.55, k: 1.6, offLo: 30, offHi: 60, lag: 25, people: 1, walk: 3.6, hunt: 4.2, spin: 26 },
  { search: 35, fill: 0.75, k: 1.9, offLo: 25, offHi: 60, lag: 16, people: 2, walk: 3.9, hunt: 4.3, spin: 22 },
  { search: 40, fill: 0.8, k: 2.2, offLo: 25, offHi: 60, lag: 16, people: 2, walk: 4.0, hunt: 4.4, spin: 22 },
];
// (night 3 measured: with night 2's row and a 40 s search a careful player passes about half the time; a
// 2 s lag, full fill or the lamp at 20 m each alone made it a cliff nobody passed)
// past the table the nights keep tightening, to a floor: a longer search, a faster fill, a thinner shallow
// shadow, a lantern nearer overhead, a shorter lag, a quicker turn, a third townsperson. The light's speed
// stays where night 3 left it. (Night 4 measured no harder than 3 at a fill step of 0.05; it is 0.1.)
export function night(n) {
  n = Math.max(1, n | 0);
  if (n < NIGHTS.length) return NIGHTS[n];
  const b = NIGHTS[NIGHTS.length - 1], k = n - (NIGHTS.length - 1);
  return {
    ...b,
    search: Math.min(60, b.search + 4 * k), fill: Math.min(1, b.fill + 0.1 * k), k: Math.max(1.6, b.k - 0.15 * k),
    offLo: Math.max(20, b.offLo - k), lag: Math.max(12, b.lag - k), spin: Math.max(14, b.spin - k), people: Math.min(3, b.people + (k >= 2 ? 1 : 0)),
  };
}
export const NIGHT_BONUS = 50;   // for a night passed, on top of its seconds (a round hundred dwarfed them)
export const DAWN_NIGHT = 7;     // the run has somewhere to arrive: after this night's search, dawn, and it goes
export const DAWN_BONUS = 100;   // for reaching it
export const BANK = 10;          // the seconds are banked ten at a time as they tick, and a catch keeps what is banked

export const RULE = 'It takes what its light finds.';

// the knight's record, a line a night (a Verdant Knight keeps one; the game's text, a proposal in the
// Verdant Reach bible, 19-underfoot.md, never canon on its own)
export const RECORD = [
  null,
  'It came down the valley, lantern first.',
  'The old maps mark this valley an Elder Frontier.',
  'No order remembers who armoured it.',
  'It does not take the ones who stay dark.',
  'By morning it is always gone back up the valley.',
  'One more night.',
];
// the words on the cards: each is a list of lines, the first drawn large
export function nightCard(n, score, secs = 0) {
  const lines = [`Night ${n} passed.`, `${secs} s + ${NIGHT_BONUS}. Score ${score}.`];
  if (RECORD[n]) lines.push(RECORD[n]);
  return lines;
}
export function dawnCard(score, bestScore) {
  return ['Dawn.', 'Seven nights. It went back up the valley, toward the Cavern of Giants.', score > bestScore ? `New best ${score}.` : `Score ${score}. Best ${bestScore}.`];
}
// the over card: how long you lasted tonight against your best on this night, why it got you, and the score
export function overCard(n, secs, bestSecs, cause, score, bestScore) {
  const lasted = `Night ${n}. You lasted ${secs} s` + (bestSecs > secs ? `, your best ${bestSecs} s.` : bestSecs > 0 && secs > bestSecs ? ', your best yet.' : '.');
  return ['It found you.', lasted, cause, score > bestScore ? `New best ${score}.` : `Score ${score}. Best ${bestScore}.`];
}

// the bests, kept in the browser when it allows it: the score, and the seconds lasted on each night
const KEY = 'underfoot.best';
const readInt = (k) => { try { return Math.max(0, parseInt(localStorage.getItem(k) || '0', 10) || 0); } catch (e) { return 0; } };
const writeMax = (k, n) => { try { if (n > readInt(k)) localStorage.setItem(k, String(n)); } catch (e) { /* private window */ } };
export const best = {
  get() { return readInt(KEY); },
  set(n) { writeMax(KEY, n); },
  secs(n) { return readInt(`${KEY}.secs.${n | 0}`); },
  setSecs(n, s) { writeMax(`${KEY}.secs.${n | 0}`, s); },
};
