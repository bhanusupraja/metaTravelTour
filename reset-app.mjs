// Reset the app frame to the plain URL (no ?autotest=1) and wait for __tour.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (!has) continue;
      await f.evaluate(() => {
        if (window.location.search) window.location.search = '';
      });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const ok = await f
          .evaluate(() => typeof window.__tour === 'object' && window.__tour !== null)
          .catch(() => false);
        if (ok) {
          const s = await f.evaluate(() => ({
            phase: window.__tour.phase,
            line: window.__tour.line,
          }));
          return { ok: true, reset: true, state: s };
        }
      }
      return { ok: false, error: 'tour did not come back after reset' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
