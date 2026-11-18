export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourRaycast === 'function');
      if (!has) continue;
      const pts = [[-0.175, 0.0175], [-0.3, 0.02], [0.35, 0.02], [0, 0.1], [0, 0]];
      const out = {};
      for (const [x, y] of pts) {
        out[`${x},${y}`] = await f.evaluate(([a, b]) => JSON.parse(window.__tourRaycast(a, b)), [x, y]);
      }
      return { ok: true, out };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { error: 'no app frame' };
}
