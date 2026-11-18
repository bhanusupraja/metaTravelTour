// Capture the tutorial lines advancing (Bhanu 2026-11-18: on her phone
// only the first line played). Drives: Start tutorial -> line 1 ->
// ~6 s in, line 2 (intro-2.mp3 sounding) -> ~11 s in, line 3.
// Screenshots 65 (line 1), 66 (line 2), 67 (line 3). Also records the
// music master gain (0.08 after the soften) in the returned state.
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
          line: window.__tour.line,
          introLineIdx: window.__tour.introLineIdx,
          lastClipPlayed: window.__tour.lastClipPlayed,
          lastClipPlayOk: window.__tour.lastClipPlayOk,
          lastClipError: window.__tour.lastClipError,
          musicGain: window.__tour.musicGain,
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
      if (s.phase === 'tutdone') {
        await f.evaluate(() => window.__tourClick('btn-skip'));
        s = await waitFor((st) => st.phase === 'enter', 10000);
      }
      if (s.phase !== 'enter') {
        return { ok: false, error: 'not at welcome', s };
      }
      if (!(await f.evaluate(() => window.__tourClick('btn-start-tutorial')))) {
        return { ok: false, error: 'no start-tutorial hook', s };
      }
      s = await waitFor((st) => st.phase === 'tutorial', 15000);
      if (s.phase !== 'tutorial') return { ok: false, error: 'tutorial did not start', s };
      await new Promise((r) => setTimeout(r, 1500));
      s = await state();
      await page.screenshot({ path: 'travel-tour-v2-screens/65-tutorial-line1.png' });
      const line1 = s;
      if (s.introLineIdx !== 0 || s.lastClipPlayed !== 'intro-1.mp3') {
        return { ok: false, error: 'line 1 not playing', s, line1 };
      }
      s = await waitFor((st) => st.introLineIdx >= 1, 10000);
      if (s.introLineIdx < 1) return { ok: false, error: 'line 2 never came', s, line1 };
      await new Promise((r) => setTimeout(r, 800));
      s = await state();
      await page.screenshot({ path: 'travel-tour-v2-screens/66-tutorial-line2.png' });
      const line2 = s;
      s = await waitFor((st) => st.introLineIdx >= 2, 10000);
      if (s.introLineIdx < 2) return { ok: false, error: 'line 3 never came', s, line1, line2 };
      await new Promise((r) => setTimeout(r, 800));
      s = await state();
      await page.screenshot({ path: 'travel-tour-v2-screens/67-tutorial-line3.png' });
      return { ok: true, line1, line2, line3: s };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
