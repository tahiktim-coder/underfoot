// UNDERFOOT — the three nights. What each night asks of you, the words on the cards between them, and the
// best run kept in the browser. The hiding test never reads a look; it reads this table.
export const LAST_NIGHT = 3;

// search: seconds the lantern hunts. k: the shallow-shadow divisor (the eye fills at the lit rate / k).
// offLo, offHi: the range the lantern's side offset drifts over (nearly overhead to low). lit: houses whose
// windows stay lit at the plant. check: seconds before the lantern goes to a lit window anyway. lag: trail
// samples (0.25 s each) it aims behind you. people: townspeople out in the search.
export const NIGHTS = [
  null,
  { search: 30, k: 2, offLo: 30, offHi: 60, lit: 3, check: 10, lag: 25, people: 1 },
  { search: 35, k: 1.75, offLo: 25, offHi: 60, lit: 4, check: 8, lag: 20, people: 2 },
  { search: 40, k: 1.5, offLo: 20, offHi: 60, lit: 6, check: 6, lag: 14, people: 3 },
];
export const night = (n) => NIGHTS[Math.max(1, Math.min(LAST_NIGHT, n))];

export const RULE = 'It takes what its light finds.';

// the words on the cards: each is a list of lines, the first drawn large
export function nightCard(n, saved, taken) {
  return [`Night ${n}.`, taken === 0 && saved === 0 ? 'It passed.' : `Saved ${saved}, taken ${taken}.`];
}
export function overCard(n, best) {
  const survived = n - 1;
  return [`Night ${n}.`, 'It found you.', `Nights survived: ${survived}. Best: ${Math.max(best, survived)}.`];
}
export function endCard(saved, taken) {
  return ['Three nights.', 'The light moved on.', `Saved ${saved}, taken ${taken}.`];
}

// the best run, kept in the browser when it allows it
const KEY = 'underfoot.best';
export const best = {
  get() { try { return Math.max(0, parseInt(localStorage.getItem(KEY) || '0', 10) || 0); } catch (e) { return 0; } },
  set(n) { try { if (n > best.get()) localStorage.setItem(KEY, String(n)); } catch (e) { /* private window */ } },
};
