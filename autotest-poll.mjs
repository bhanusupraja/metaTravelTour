// Poll the running autotest: returns done + results when finished,
// otherwise the current phase/place so the caller can keep waiting.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (!has) continue;
      const out = await f.evaluate(() => {
        const t = window.__tourTest || null;
        return {
          test: t,
          phase: window.__tour?.phase,
          place: window.__tour?.place,
        };
      });
      if (out.test && Object.keys(out.test).length > 0) {
        const entries = Object.entries(out.test);
        const passed = entries.filter(([, v]) => v === true).length;
        const failed = entries.filter(([, v]) => v !== true);
        return { ok: true, done: true, total: entries.length, passed, failed };
      }
      return { ok: true, done: false, phase: out.phase, place: out.place };
    } catch (e) {
      /* next frame */
    }
  }
  return { error: 'no app frame with __tour' };
}
