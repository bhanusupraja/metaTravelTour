// Capture the Journal as a pasted flat picture (fix round 3).
// Drives: Start game -> Times Square -> arrived -> grab the camera
// -> hold 2 s -> Yes -> saved to Journal -> open Journal -> 75:
// the page shows the camera as a FLAT PICTURE/card pasted on the
// page, not the 3D model in the book.
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
      heldObject: window.__tour.heldObject,
      journal: window.__tour.journal,
      journalOpen: window.__tour.journalOpen,
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
  await f.evaluate(() => window.__tourGrab('souvenir-camera'));
  s = await waitFor((st) => st.heldObject === 'souvenir-camera', 5000);
  if (s.heldObject !== 'souvenir-camera') return { ok: false, error: 'camera not grabbed', s };
  await f.evaluate(() => window.__tourHoldElapsed());
  s = await waitFor((st) => st.buttons.includes('btn-journal-yes'), 5000);
  if (!s.buttons.includes('btn-journal-yes')) return { ok: false, error: 'hold confirm not shown', s };
  if (!(await click('btn-journal-yes'))) return { ok: false, error: 'no yes button', s };
  s = await waitFor((st) => st.journal.includes('camera') || st.journal.includes('Camera'), 8000);
  if (!(s.journal.includes('camera') || s.journal.includes('Camera'))) {
    return { ok: false, error: 'camera not saved to journal', s };
  }
  if (!(await click('btn-journal'))) return { ok: false, error: 'no journal button', s };
  s = await waitFor((st) => st.journalOpen, 5000);
  if (!s.journalOpen) return { ok: false, error: 'journal did not open', s };
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: '../travel-tour-v2-screens/75-journal-flat-picture.png' });
  s = await state();
  return { ok: true, s, file: '75-journal-flat-picture.png' };
}
