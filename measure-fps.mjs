// Measure the app frame rate over ~6 s (requestAnimationFrame count)
// to see whether the emulator is rendering slowly enough to starve the
// per-frame sampling the autotest relies on (trail, gestures, boost).
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (!has) continue;
      const r = await f.evaluate(() => new Promise((resolve) => {
        let n = 0;
        const start = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - start < 6000) requestAnimationFrame(tick);
          else resolve({ frames: n, seconds: (performance.now() - start) / 1000 });
        };
        requestAnimationFrame(tick);
      }));
      return { ok: true, result: r };
    } catch (e) { /* next frame */ }
  }
  return { error: 'no app frame' };
}
