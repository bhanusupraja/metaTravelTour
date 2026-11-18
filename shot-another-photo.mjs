// Capture the multi-photo flow (fix round 3). Drives: Start game ->
// Times Square -> arrived -> Photo -> photopick -> say "cheese" ->
// photo taken -> 78: still at the destination in photo mode, bubble
// "Nice one! Want another photo?" and the button reads "Another
// photo" (no left/right question yet).
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
      photos: window.__tour.photos,
      journal: window.__tour.journal,
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
  if (!(await click('btn-photo'))) return { ok: false, error: 'no photo btn', s };
  s = await waitPhase('photopick', 15000);
  if (s.phase !== 'photopick') return { ok: false, error: 'photopick not reached', s };
  await f.evaluate(() => window.__tourHandle('cheese'));
  s = await waitFor((st) => st.photos >= 1 && st.phase === 'arrived', 20000);
  if (s.photos < 1 || s.phase !== 'arrived') {
    return { ok: false, error: 'photo did not leave her at the place', s };
  }
  if (!s.bubble.toLowerCase().includes('another photo')) {
    return { ok: false, error: 'no another-photo line in the bubble', s };
  }
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: '../travel-tour-v2-screens/78-another-photo.png' });
  s = await state();
  return { ok: true, s, file: '78-another-photo.png' };
}
