// Fix-3c staged probe, step 3: start the ride, pause mid-drive, drag the
// view sideways (head-turn periphery check), stop there for a screenshot.
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
      paused: window.__tour.paused,
      buttons: window.__tour.shownButtons,
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
  const click = (id) => f.evaluate((btnId) => window.__tourClick(btnId), id);
  if (!(await click('btn-start-ride'))) return { ok: false, error: 'no start-ride' };
  let s = await waitPhase('driving', 20000);
  if (s.phase !== 'driving') return { ok: false, error: 'driving not reached', s };
  await new Promise((r) => setTimeout(r, 2000));
  if (!(await click('btn-pause'))) return { ok: false, error: 'no pause', s };
  await new Promise((r) => setTimeout(r, 500));
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let x = 400; x <= 700; x += 30) {
    await page.mouse.move(x, 300);
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1500));
  return { ok: true, s: await state() };
}
