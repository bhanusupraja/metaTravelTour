// Fix-3c staged probe, step 4: resume the drive, arrive, grab the camera,
// send it to the Journal, open the Journal, stop there for a screenshot.
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
  const f = await findApp();
  if (!f) return { error: 'no app frame' };
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
  if (!(await click('btn-resume'))) return { ok: false, error: 'no resume' };
  let s = await waitPhase('arrived', 60000);
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
  return { ok: true, s: await state() };
}
