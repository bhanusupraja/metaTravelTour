// Wait for arrival, say "where next", then catch the thankyou phase the
// moment it appears and screenshot the app frame at once (the thank-you
// phase only lasts ~2.5 s before the next step).
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
      // wait for arrival (up to 60 s)
      let s = await state();
      const t0 = Date.now();
      while (s.phase !== 'arrived' && Date.now() - t0 < 60000) {
        await new Promise((r) => setTimeout(r, 300));
        s = await state();
      }
      if (s.phase !== 'arrived') return { ok: false, error: 'arrived not reached', s };
      await f.evaluate(() => window.__tourHandle('where next'));
      // poll fast for thankyou
      const t1 = Date.now();
      let shot = null;
      while (Date.now() - t1 < 15000) {
        s = await state();
        if (s.phase === 'thankyou') {
          shot = s;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!shot) return { ok: false, error: 'thankyou not reached', s };
      await page.screenshot({
        path: '/home/hatch/workspace/your_files/travel-tour-v2-screens/61-thankyou-milo.png',
      });
      const after = await state();
      return { ok: true, shot, after, file: '61-thankyou-milo.png' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
