// Capture Milo scaled down at Start game + the single MILO SAYS
// screen (fix round 3). Drives: Start game -> 73: choose phase, Milo
// standing back at 2.2 m, whole head + body framed -> Times Square
// -> arrived -> 74: the bubble says "Here is the destination -
// Times Square!" while the panel shows only the place name "Times
// Square" (ONE Milo-talking screen, no second copy of his words).
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
      bubble: window.__tour.bubbleText,
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
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: '../travel-tour-v2-screens/73-milo-scaled-down.png' });
  const chooseShot = await state();
  await f.evaluate(() => window.__tourHandle('times square'));
  s = await waitPhase('ready', 20000);
  if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s, chooseShot };
  if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride', s, chooseShot };
  // the arrival line lives in the bubble only while stepping out
  // (getout) - by 'arrived' the bubble may already carry the next
  // line, so catch it here: bubble "Here is the destination - Times
  // Square!" + panel "Times Square" = ONE Milo-talking screen
  s = await waitPhase('getout', 60000);
  if (s.phase !== 'getout') return { ok: false, error: 'getout not reached', s, chooseShot };
  await new Promise((r) => setTimeout(r, 400));
  s = await state();
  if (!s.bubble.includes('Here is the destination') || s.line !== 'Times Square') {
    return { ok: false, error: 'single-says state not held', s, chooseShot };
  }
  await page.screenshot({ path: '../travel-tour-v2-screens/74-single-milo-says.png' });
  return { ok: true, chooseShot, arrived: s, files: ['73-milo-scaled-down.png', '74-single-milo-says.png'] };
}
