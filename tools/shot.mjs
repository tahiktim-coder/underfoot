// Headless runs of a built page.  node tools/shot.mjs PAGE OUTDIR <plan.json | '<plan json>'>
// The page is served with ?hold so nothing moves until the plan says so (QUERY overrides, e.g. QUERY='?look=night&hold').
// Files next to PAGE (stills) are served too. Needs Playwright's Chromium: npx playwright install chromium
// Steps: {eval}, {wait: ms}, {shot: name, sel: css}, {full: name}, {frames: n, dt, piece}
// env VW, VH (viewport), MOBILE=1, DPR
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const [PAGE, OUT, planArg] = process.argv.slice(2);
const plan = JSON.parse(planArg && fs.existsSync(planArg) ? fs.readFileSync(planArg, 'utf8') : planArg || '[]');
fs.mkdirSync(OUT, { recursive: true });
const body = fs.readFileSync(PAGE, 'utf8');
const html = body.trimStart().startsWith('<!doctype') ? body : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>';
const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/fonts')) { r.writeHead(404); return r.end(); }
  // files next to the page (stills and the like) are served as themselves
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
  const f = rel && path.join(path.dirname(PAGE), rel);
  if (f && !rel.includes('..') && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return r.end(fs.readFileSync(f)); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 900) }, deviceScaleFactor: +(process.env.DPR || 1), isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); else if (process.env.LOG) console.log('log:', m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${srv.address().port}/${process.env.QUERY ?? '?hold'}`);
await page.waitForFunction(() => window.__v16 && window.__v16.ready, null, { timeout: 120000 });
console.log('boot ms', Date.now() - t0);
for (const s of plan) {
  if (s.eval) { const r = await page.evaluate((src) => (0, eval)(`(() => { ${src} })()`), s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r).slice(0, 3000)); }
  if (s.frames) await page.evaluate(({ n, dt, piece }) => { const v = window.__v16; v.hold = true; for (let i = 0; i < n; i++) v.step(piece, dt); }, { n: s.frames, dt: s.dt || 1 / 30, piece: s.piece || null });
  if (s.wait) { await page.evaluate(() => { window.__v16.hold = false; }); await page.waitForTimeout(s.wait); }
  if (s.shot) await page.locator(s.sel || 'canvas').first().screenshot({ path: path.join(OUT, s.shot + '.png') });
  if (s.full) await page.screenshot({ path: path.join(OUT, s.full + '.png'), fullPage: !!s.fullPage });
}
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no console errors');
await browser.close(); srv.close();
