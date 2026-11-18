// Poll the built-in autotest: window.__tourTest is set (flat check map)
// only when the suite finishes. Until then, report the live phase so the
// caller can see progress. Checks every frame for the app frame (the one
// with window.__tour) instead of returning from the first frame.
export default async function run({ page }) {
  for (const f of page.frames()) {
    let has = false;
    try {
      has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
    } catch (e) {
      /* next frame */
    }
    if (!has) continue;
    const t = await f.evaluate(() => window.__tourTest || null).catch(() => null);
    if (t && Object.keys(t).length > 0) {
      const entries = Object.entries(t);
      const passed = entries.filter(([, v]) => v === true).length;
      const failed = entries
        .filter(([, v]) => v !== true)
        .map(([k, v]) => `${k}=${v}`);
      return { ok: true, done: true, total: entries.length, passed, failed };
    }
    const phase = await f.evaluate(() => window.__tour?.phase ?? null).catch(() => null);
    const n = await f.evaluate(() => Object.keys(window.__tourTest || {}).length).catch(() => 0);
    return { ok: true, done: false, phase, checksSoFar: n };
  }
  return { error: 'no app frame with __tour' };
}
