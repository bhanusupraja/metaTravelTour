// Capture the Journal's empty state (Bhanu 2026-11-18: "grab and hold"
// text inside the Journal). Drives: Start game -> Times Square ->
// arrived -> open the Journal with nothing saved yet -> the panel shows
// the empty-state line ("Nothing saved yet - grab a souvenir and send
// it to your Journal!") with the eyebrow "MY TRAVEL JOURNAL".
// Screenshot 68.
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
          sub: window.__tour.sub,
          journal: window.__tour.journal,
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
      let s = await state();
      if (s.phase === 'tutdone') {
        await f.evaluate(() => window.__tourClick('btn-skip'));
        s = await waitPhase('enter', 10000);
      }
      if (s.phase === 'enter') {
        if (!(await f.evaluate(() => window.__tourClick('btn-start-game'))))
          return { ok: false, error: 'no start-game', s };
        s = await waitPhase('choose', 15000);
        if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
      }
      await f.evaluate(() => window.__tourHandle('times square'));
      s = await waitPhase('ready', 20000);
      if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s };
      if (!(await f.evaluate(() => window.__tourClick('btn-start-ride'))))
        return { ok: false, error: 'no start-ride', s };
      s = await waitPhase('arrived', 60000);
      if (s.phase !== 'arrived') return { ok: false, error: 'arrived not reached', s };
      // the journal is still empty: nothing saved yet
      if (s.journal && s.journal !== '') {
        return { ok: false, error: 'journal not empty', s };
      }
      if (!(await f.evaluate(() => window.__tourClick('btn-journal'))))
        return { ok: false, error: 'no journal btn', s };
      await new Promise((r) => setTimeout(r, 800));
      s = await state();
      await page.screenshot({ path: '../travel-tour-v2-screens/68-journal-empty.png' });
      return { ok: true, after: s };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
