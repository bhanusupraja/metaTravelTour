export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (!has) continue;
      const before = await f.evaluate(() => ({ phase: window.__tour.phase, line: window.__tour.line }));
      const clicked = await f.evaluate(() => (typeof window.__tourClick === 'function' ? window.__tourClick('btn-start-tutorial') : 'no-hook'));
      await new Promise((r) => setTimeout(r, 3000));
      const after = await f.evaluate(() => ({ phase: window.__tour.phase, line: window.__tour.line, idx: window.__tour.introLineIdx, clip: window.__tour.lastClipPlayed }));
      return { before, clicked, after };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { error: 'no app frame' };
}
