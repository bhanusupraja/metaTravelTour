// Capture the thank-you button ("Thank you, Milo!") at the thankyou phase.
// Drives: Start game -> say Times Square -> Start ride -> arrived ->
// "where next" -> thankyou, then screenshots the app frame immediately
// (the thank-you phase only lasts ~2.5 s before the next step).
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
        }));
      const click = (id) =>
        f.evaluate((btnId) => {
          const el = document.querySelector(`[data-uikit-id="${btnId}"]`);
          if (!el) return false;
          el.dispatchEvent(new Event('click', { bubbles: true }));
          return true;
        }, id);
      const waitPhase = async (want, timeoutMs) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
          const s = await state();
          if (s.phase === want) return s;
          await new Promise((r) => setTimeout(r, 200));
        }
        return await state();
      };
      let s = await state();
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
      await f.evaluate(() => window.__tourHandle('where next'));
      // poll fast: thankyou lasts ~2.5 s
      const t0 = Date.now();
      let shot = null;
      while (Date.now() - t0 < 15000) {
        s = await state();
        if (s.phase === 'thankyou') {
          shot = s;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!shot) return { ok: false, error: 'thankyou not reached', s };
      await f.screenshot({
        path: 'travel-tour-v2-screens/61-thankyou-milo.png',
      });
      const after = await state();
      return { ok: true, shot, after, file: '61-thankyou-milo.png' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
