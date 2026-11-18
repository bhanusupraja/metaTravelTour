// Capture the seat adjust buttons + the Central Park panel in front
// of the trees (fix round 3). Drives: Start game -> Times Square ->
// arrived -> 77: panel with "Seat up" / "Seat down" visible at the
// higher 1.42 m eye height -> Central Park -> arrived -> 79: the tour
// panel fully visible in front of the tree canopy, head-locked.
export default async function run({ page }) {
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
  // reset to a fresh Welcome screen: reload the frame if it is still
  // on ?autotest=1 or left mid-game by a previous shot script
  const needsReset = await f.evaluate(
    () =>
      new URLSearchParams(location.search).get('autotest') === '1' ||
      window.__tour.phase !== 'enter',
  );
  if (needsReset) {
    await f.evaluate(() => {
      window.location.href = window.location.pathname;
    });
    await new Promise((r) => setTimeout(r, 8000));
    f = null;
    for (let i = 0; i < 40 && !f; i++) {
      f = await findApp();
      if (!f) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!f) return { error: 'no app frame after reload' };
  }
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      place: window.__tour.place,
      buttons: window.__tour.shownButtons,
      line: window.__tour.line,
    }));
  const waitPhase = async (want, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (s.phase === want) return s;
      await new Promise((r) => setTimeout(r, 200));
    }
    return await state();
  };
  const waitFor = async (fn, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (fn(s)) return s;
      await new Promise((r) => setTimeout(r, 200));
    }
    return await state();
  };
  const click = (id) => f.evaluate((btnId) => window.__tourClick(btnId), id);
  let s = await state();
  for (let i = 0; i < 40 && s.phase !== 'enter'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  if (s.phase !== 'enter') return { ok: false, error: 'not at welcome', s };
  if (!(await click('btn-start-game'))) return { ok: false, error: 'no start-game', s };
  s = await waitPhase('choose', 15000);
  if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
  await f.evaluate(() => window.__tourHandle('times square'));
  s = await waitPhase('ready', 20000);
  if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s };
  if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride', s };
  s = await waitPhase('arrived', 60000);
  if (s.phase !== 'arrived') return { ok: false, error: 'arrived not reached', s };
  if (!s.buttons.includes('btn-seat-up') || !s.buttons.includes('btn-seat-down')) {
    return { ok: false, error: 'seat buttons not shown at destination', s };
  }
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: '../travel-tour-v2-screens/77-seat-adjust.png' });
  const seatShot = await state();
  await f.evaluate(() => window.__tourHandle('central park'));
  s = await waitPhase('ready', 20000);
  if (s.phase !== 'ready') return { ok: false, error: 'park ready not reached', s, seatShot };
  if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride to park', s, seatShot };
  s = await waitPhase('arrived', 60000);
  if (s.phase !== 'arrived' || s.place !== 'central-park') {
    return { ok: false, error: 'park arrival not reached', s, seatShot };
  }
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: '../travel-tour-v2-screens/79-park-panel-in-front.png' });
  s = await state();
  return { ok: true, seatShot, park: s, files: ['77-seat-adjust.png', '79-park-panel-in-front.png'] };
}
