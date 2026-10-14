// UNDERFOOT — the nights. Each night the lantern asks more of you; they go on until it finds you. The score
// is the seconds you lasted in its searches plus a hundred for each night passed. The hiding test never
// reads a look; it reads this table.

// search: seconds the lantern hunts. fill: how fast the eye fills in the light, as a share of the full rate
// (about 3 s to catch at 1). k: the shallow-shadow divisor (the eye fills at the lit rate / k). offLo,
// offHi: the range the lantern's side offset drifts over (nearly overhead to low). lit: houses whose windows
// stay lit at the plant. check: seconds before the lantern goes to a lit window anyway. lag: trail samples
// (0.25 s each) it aims behind you. people: townspeople out in the search. walk: how fast the light's mark
// moves along your trail or toward another light, hunt: once it has half seen you (you walk at 4.6).
export const NIGHTS = [
  null,
  { search: 30, fill: 0.55, k: 2, offLo: 30, offHi: 60, lit: 3, check: 10, lag: 25, people: 1, walk: 3.6, hunt: 4.2 },
  { search: 35, fill: 0.75, k: 1.75, offLo: 25, offHi: 60, lit: 4, check: 8, lag: 20, people: 2, walk: 4.2, hunt: 5.4 },
  { search: 40, fill: 1.0, k: 1.5, offLo: 20, offHi: 60, lit: 6, check: 5, lag: 10, people: 3, walk: 5.0, hunt: 6.5 },
];
// past the table the nights keep tightening, to a floor: a longer search, a thinner shallow shadow, a
// lantern nearer overhead, more windows left lit, a quicker check, a quicker light
export function night(n) {
  n = Math.max(1, n | 0);
  if (n < NIGHTS.length) return NIGHTS[n];
  const b = NIGHTS[NIGHTS.length - 1], k = n - (NIGHTS.length - 1);
  return {
    ...b,
    search: Math.min(60, b.search + 4 * k), k: Math.max(1.3, b.k - 0.05 * k), offLo: Math.max(15, b.offLo - k),
    lit: Math.min(8, b.lit + Math.ceil(k / 2)), check: Math.max(4, b.check - 0.5 * k), lag: Math.max(10, b.lag - k),
    walk: Math.min(5.4, b.walk + 0.1 * k), hunt: Math.min(7.5, b.hunt + 0.25 * k),
  };
}
export const NIGHT_BONUS = 100;

export const RULE = 'It takes what its light finds.';

// the words on the cards: each is a list of lines, the first drawn large
export function nightCard(n, score) {
  return [`Night ${n} passed.`, `Score ${score}.`];
}
export function overCard(n, score, bestScore) {
  return [`Night ${n}.`, 'It found you.', `Nights survived: ${n - 1}. Score ${score}.`, `Best: ${Math.max(bestScore, score)}.`];
}

// the best score, kept in the browser when it allows it
const KEY = 'underfoot.best';
export const best = {
  get() { try { return Math.max(0, parseInt(localStorage.getItem(KEY) || '0', 10) || 0); } catch (e) { return 0; } },
  set(n) { try { if (n > best.get()) localStorage.setItem(KEY, String(n)); } catch (e) { /* private window */ } },
};
