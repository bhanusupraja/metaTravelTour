// Fresh arrival screenshots for the Devpost gallery (83-88).
// Run in slices of 2 stops per 110 s browser-run lease, via env:
//   SHOT_STOPS="times square|83-arrival-times-square-milo.png,central park|84-arrival-central-park-milo.png"
// Drives the real game flow with the __tour hooks (no code changes):
// Start game -> choose place -> ride -> arrived -> screenshot with
// Milo in front of the place. Retakes any shot that comes out blank
// (headless blank-frame issue: blank frames are ~6 KB, good ones 70+ KB).
// Resumable: if the app is already mid-game (arrived/choose/ready),
// it drives the next stop directly without reloading.
import fs from 'node:fs';

const STOPS = (process.env.SHOT_STOPS || '')
  .split(',')
  .filter(Boolean)
  .map((pair) => {
    const [name, file] = pair.split('|');
    return { name: name.trim(), file: file.trim() };
  });

export default async function run({ page }) {
  if (!STOPS.length) return { error: 'SHOT_STOPS env empty' };
  const findApp = async () => {
    for (const f of page.frames()) {
      try {
        const has = await f.evaluate(
          () => typeof window.__tour === 'object' && window.__tour !== null,
        );
        if (has) return f;
      } catch {}
    }
    return null;
  };
  let f = await findApp();
  if (!f) return { error: 'no app frame' };
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      place: window.__tour.place,
      buttons: window.__tour.shownButtons,
      line: window.__tour.line,
      bubble: window.__tour.bubbleText,
    }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitPhase = async (want, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (s.phase === want) return s;
      await sleep(300);
    }
    return await state();
  };
  const click = (id) => f.evaluate((btnId) => window.__tourClick(btnId), id);

  const shoot = async (file) => {
    const path = `../travel-tour-v2-screens/${file}`;
    let bytes = 0;
    let tries = 0;
    for (let i = 0; i < 3; i++) {
      tries = i + 1;
      await page.screenshot({ path });
      try {
        bytes = fs.statSync(path).size;
      } catch {
        bytes = 0;
      }
      if (bytes > 20000) break;
      await sleep(2000);
    }
    return { file, bytes, tries };
  };

  let s = await state();
  if (s.phase === 'enter') {
    if (!(await click('btn-start-game'))) return { ok: false, error: 'no start-game', s };
    s = await waitPhase('choose', 20000);
    if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
  } else if (!['arrived', 'choose', 'ready'].includes(s.phase)) {
    // Unexpected phase (e.g. autotest or cover): reload plain and start over.
    await f.evaluate(() => {
      window.location.href = window.location.pathname;
    });
    await sleep(8000);
    f = null;
    for (let i = 0; i < 40 && !f; i++) {
      f = await findApp();
      if (!f) await sleep(1000);
    }
    if (!f) return { error: 'no app frame after reload' };
    s = await state();
    for (let i = 0; i < 40 && s.phase !== 'enter'; i++) {
      await sleep(500);
      s = await state();
    }
    if (s.phase !== 'enter') return { ok: false, error: 'not at welcome after reload', s };
    if (!(await click('btn-start-game'))) return { ok: false, error: 'no start-game', s };
    s = await waitPhase('choose', 20000);
    if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
  }

  const results = [];
  for (const stop of STOPS) {
    await f.evaluate((n) => window.__tourHandle(n), stop.name);
    s = await waitPhase('ready', 30000);
    if (s.phase !== 'ready') {
      results.push({ ...stop, ok: false, error: 'ready not reached', s });
      continue;
    }
    if (!(await click('btn-start-ride'))) {
      results.push({ ...stop, ok: false, error: 'no start-ride', s });
      continue;
    }
    s = await waitPhase('arrived', 90000);
    if (s.phase !== 'arrived') {
      results.push({ ...stop, ok: false, error: 'arrived not reached', s });
      continue;
    }
    await sleep(3000);
    const shot = await shoot(stop.file);
    s = await state();
    results.push({ ...stop, ok: shot.bytes > 20000, shot, arrived: s });
  }
  return { ok: true, results };
}
