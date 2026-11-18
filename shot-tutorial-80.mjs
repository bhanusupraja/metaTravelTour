// Capture the shortened tutorial (fix round 3): line 1 playing with
// Skip visible from line 1, whole tutorial ~12 s in one take.
// Drives: Start tutorial -> 80: line 1 + Skip button visible.
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
      line: window.__tour.line,
      sub: window.__tour.sub,
      introLineIdx: window.__tour.introLineIdx,
      buttons: window.__tour.shownButtons,
      lastClipPlayed: window.__tour.lastClipPlayed,
    }));
  const waitFor = async (fn, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (fn(s)) return s;
      await new Promise((r) => setTimeout(r, 200));
    }
    return await state();
  };
  let s = await state();
  for (let i = 0; i < 40 && s.phase !== 'enter'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  if (s.phase !== 'enter') return { ok: false, error: 'not at welcome', s };
  if (!(await f.evaluate(() => window.__tourClick('btn-start-tutorial')))) {
    return { ok: false, error: 'no start-tutorial', s };
  }
  s = await waitFor((st) => st.phase === 'tutorial', 15000);
  if (s.phase !== 'tutorial') return { ok: false, error: 'tutorial did not start', s };
  await new Promise((r) => setTimeout(r, 1500));
  s = await state();
  if (s.introLineIdx !== 0 || !s.buttons.includes('btn-skip')) {
    return { ok: false, error: 'line 1 or Skip not shown', s };
  }
  await page.screenshot({ path: '../travel-tour-v2-screens/80-tutorial-line1-skip.png' });
  return { ok: true, s, file: '80-tutorial-line1-skip.png' };
}
