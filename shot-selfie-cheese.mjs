// Capture the selfie fixes (Bhanu 2026-11-18): "cheese" is only the
// shutter, and exactly one Photo button in selfie mode. Drives: Start
// game -> Times Square -> arrived -> toggle Selfie -> 69: arrived in
// selfie mode (one Photo button, toggle hidden) -> tap Photo ->
// photopick -> 70: "Take the photo" only, no second "Photo" -> say
// "cheese" -> 71: the selfie is taken (photos 1, journal photo saved).
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
          photoMode: window.__tour.photoMode,
          buttons: window.__tour.shownButtons,
          photos: window.__tour.photos,
          journal: window.__tour.journal,
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
      if (s.phase === 'tutdone') {
        await click('btn-skip');
        s = await waitPhase('enter', 10000);
      }
      if (s.phase === 'enter') {
        if (!(await click('btn-start-game'))) return { ok: false, error: 'no start-game', s };
        s = await waitPhase('choose', 15000);
        if (s.phase !== 'choose') return { ok: false, error: 'choose not reached', s };
      }
      await f.evaluate(() => window.__tourHandle('times square'));
      s = await waitPhase('ready', 20000);
      if (s.phase !== 'ready') return { ok: false, error: 'ready not reached', s };
      if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride', s };
      s = await waitPhase('arrived', 60000);
      if (s.phase !== 'arrived') return { ok: false, error: 'arrived not reached', s };
      // toggle to selfie mode: the toggle must hide (it would read
      // "Photo"), leaving exactly one Photo button
      if (!(await click('btn-selfie'))) return { ok: false, error: 'no selfie toggle', s };
      s = await waitFor((st) => st.photoMode === 'selfie', 5000);
      if (s.photoMode !== 'selfie') return { ok: false, error: 'selfie mode not set', s };
      if (s.buttons.includes('btn-selfie') || !s.buttons.includes('btn-photo')) {
        return { ok: false, error: 'duplicate Photo button still there', s };
      }
      await page.screenshot({ path: '../travel-tour-v2-screens/69-selfie-one-photo.png' });
      const onePhoto = s;
      // tap Photo: the photo moment starts in selfie mode (Milo beside
      // her); the panel must show "Take the photo" only
      if (!(await click('btn-photo'))) return { ok: false, error: 'no photo btn', s };
      s = await waitPhase('photopick', 15000);
      if (s.phase !== 'photopick') return { ok: false, error: 'photopick not reached', s, onePhoto };
      if (s.buttons.includes('btn-selfie')) {
        return { ok: false, error: 'duplicate Photo button in photopick', s, onePhoto };
      }
      await page.screenshot({ path: '../travel-tour-v2-screens/70-selfie-photopick.png' });
      const photopick = s;
      // say "cheese": only the shutter - the selfie is taken. Snap at
      // once: the thank-you follows 2 s after the photo, and the slow
      // headless capture would otherwise show that instead
      await f.evaluate(() => window.__tourHandle('cheese'));
      s = await waitFor((st) => st.photos >= 1, 15000);
      if (s.photos < 1) return { ok: false, error: 'cheese did not take the selfie', s, onePhoto, photopick };
      await page.screenshot({ path: '../travel-tour-v2-screens/71-selfie-cheese-taken.png' });
      s = await state();
      return { ok: true, onePhoto, photopick, taken: s };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
