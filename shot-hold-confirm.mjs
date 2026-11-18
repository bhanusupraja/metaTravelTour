// Capture the hold-to-confirm Journal send (Bhanu 2026-11-18 07:25).
// Drives: Start game -> say Times Square -> Start ride -> arrived ->
// grab the camera -> 1 s in (ring half full) -> hold elapsed (Yes/No
// panel) -> Yes -> the camera is in the Journal (book page 1).
// Uses the window debug hooks __tourGrab / __tourHoldElapsed.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (!has) continue;
      const state = () =>
        f.evaluate(() => ({
          phase: window.__tour.phase,
          place: window.__tour.place,
          line: window.__tour.line,
          buttons: window.__tour.shownButtons,
          heldObject: window.__tour.heldObject,
          holdConfirmShown: window.__tour.holdConfirmShown,
          holdRingVisible: window.__tour.holdRingVisible,
          journal: window.__tour.journal,
        }));
      // UIKit panels are 3D scene objects, not DOM: click through the
      // __tourClick debug hook (same route as the autotest's clickBtn)
      const click = (id) => f.evaluate((btnId) => window.__tourClick(btnId), id);
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
      let s = await state();
      if (s.phase === 'tutdone') {
        await click('btn-skip');
        s = await waitPhase('enter', 10000);
      }
      if (s.phase === 'enter') {
        if (!(await click('btn-start-game'))) return { ok: false, error: 'no start-game btn', s };
        s = await waitPhase('choose', 15000);
        if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
      }
      await f.evaluate(() => window.__tourHandle('times square'));
      s = await waitPhase('ready', 20000);
      if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s };
      if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride btn', s };
      s = await waitPhase('arrived', 60000);
      if (s.phase !== 'arrived') return { ok: false, error: 'arrived not reached', s };
      // snap the ring mid-hold: screenshot IMMEDIATELY after the grab -
      // a state read first costs ~1 s in this slow emulator, and the
      // headless capture always shows a fresh frame, so any wait puts
      // the 2 s hold (and the panel) ahead of the shutter
      await f.evaluate(() => window.__tourGrab('souvenir-camera'));
      await page.screenshot({ path: '../travel-tour-v2-screens/62-hold-ring.png' });
      s = await waitFor((st) => st.heldObject === 'souvenir-camera', 5000);
      if (s.heldObject !== 'souvenir-camera') return { ok: false, error: 'grab failed', s };
      const ringShot = s;
      // the 2-second hold runs out: the Yes/No panel appears
      await f.evaluate(() => window.__tourHoldElapsed());
      s = await waitFor((st) => st.holdConfirmShown === true, 5000);
      if (!s.holdConfirmShown) return { ok: false, error: 'confirm panel not shown', s, ringShot };
      await page.screenshot({ path: '../travel-tour-v2-screens/63-hold-confirm.png' });
      const confirmShot = s;
      // Yes: the camera flies to the Journal along the arc
      if (!(await click('btn-journal-yes'))) return { ok: false, error: 'no yes btn', s };
      s = await waitFor(
        (st) => st.heldObject === null && (st.journal || '').includes('camera'),
        5000,
      );
      if (s.heldObject !== null || !(s.journal || '').includes('camera')) {
        return { ok: false, error: 'yes did not send', s, ringShot, confirmShot };
      }
      // open the Journal: the camera is page 1 of the book
      if (!(await click('btn-journal'))) return { ok: false, error: 'no journal btn', s };
      await new Promise((r) => setTimeout(r, 500));
      s = await state();
      await page.screenshot({ path: '../travel-tour-v2-screens/64-hold-yes-journal.png' });
      return { ok: true, ringShot, confirmShot, after: s };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
