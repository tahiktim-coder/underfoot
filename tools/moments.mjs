// node tools/moments.mjs [look ...]
// Renders the four comparison moments (in the valley, the search, looking up, its face) for each look into
// out/shots/<look>/, from the same seeded run, so the looks compare like for like. No looks given = all seven.
import { spawnSync } from 'child_process';
import { LOOKS, LOOK_ORDER } from '../src/fall/looks.js';

const looks = process.argv.slice(2).length ? process.argv.slice(2) : LOOK_ORDER;
for (const L of looks) if (!LOOKS[L]) { console.error(`unknown look "${L}"; one of: ${LOOK_ORDER.join(', ')}`); process.exit(1); }
const run = (args, env = {}) => { const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } }); if (r.status) process.exit(r.status); };
run(['tools/build.mjs', 'out/test.html', '--dev', '--tpl=page/test.html']);
for (const L of looks) run(['tools/shot.mjs', 'out/test.html', `out/shots/${L}`, 'plans/moments.json'], { QUERY: `?look=${L}&hold`, VW: '1152', VH: '648' });
console.log('shots in out/shots/<look>/: 1_valley, 2_search, 3_look, 4_face');
