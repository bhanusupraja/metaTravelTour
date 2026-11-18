// Fix-3c probe: entry (no welcome) -> Times Square ready -> drive with a
// sideways look (white-blur periphery check) -> arrived -> grab camera ->
// Journal open (geometry + Where next?) -> next (big arrow buttons).
// Saves 90-entry-no-welcome.png and 92-journal-right.png into the screens dir.
export default async function run({ page }) {
  const SCREENS = '/home/hatch/workspace/your_files/travel-tour-v2-screens';
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
  // fresh load, plain URL (no autotest flag): entry must be the game ask
  await f.evaluate(() => {
    window.location.href = window.location.pathname;
  });
  await new Promise((r) => setTimeout(r, 9000));
  f = null;
  for (let i = 0; i < 40 && !f; i++) {
    f = await findApp();
    if (!f) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!f) return { error: 'no app frame after reload' };
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      place: window.__tour.place,
      buttons: window.__tour.shownButtons,
      heldObject: window.__tour.heldObject,
      journal: window.__tour.journal,
      journalOpen: window.__tour.journalOpen,
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
  for (let i = 0; i < 40 && s.phase !== 'choose'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  if (s.phase !== 'choose') return { ok: false, error: 'entry is not the game ask', s };
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${SCREENS}/90-entry-no-welcome.png` });
  const entryState = await state();

  await f.evaluate(() => window.__tourHandle('times square'));
  s = await waitPhase('ready', 20000);
  if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s };
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: '/tmp/probe-ready.png' });
  const readyState = await state();

  if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride', s };
  s = await waitPhase('driving', 20000);
  if (s.phase !== 'driving') return { ok: false, error: 'driving not reached', s };
  // mid-drive: look sideways (mouse drag on the canvas) for the
  // Quest-only white-blur periphery check, then look back
  await new Promise((r) => setTimeout(r, 2000));
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let x = 400; x <= 700; x += 30) {
    await page.mouse.move(x, 300);
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: '/tmp/probe-drive-left.png' });
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let x = 400; x >= 100; x -= 30) {
    await page.mouse.move(x, 300);
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));

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
  if (!(await click('btn-journal'))) return { ok: false, error: 'no journal button', s };
  s = await waitFor((st) => st.journalOpen, 5000);
  if (!s.journalOpen) return { ok: false, error: 'journal did not open', s };
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${SCREENS}/92-journal-right.png` });
  const journalState = await state();

  if (!(await click('btn-journal-close'))) return { ok: false, error: 'no journal close', s };
  s = await waitFor((st) => !st.journalOpen, 5000);
  if (!(await click('btn-where'))) return { ok: false, error: 'no where-next', s };
  s = await waitPhase('next', 20000);
  if (s.phase !== 'next') return { ok: false, error: 'next not reached', s };
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: '/tmp/probe-next.png' });
  const nextState = await state();
  return { ok: true, entryState, readyState, journalState, nextState };
}
