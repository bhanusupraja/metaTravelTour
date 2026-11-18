export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourRaycast === 'function');
      if (!has) continue;
      const pts = [[0,-0.5],[0.2,-0.5],[-0.2,-0.5],[0,-0.3],[0.3,-0.6],[-0.3,-0.6]];
      const out = {};
      for (const [nx,ny] of pts) {
        const hits = JSON.parse(await f.evaluate(([a,b]) => window.__tourRaycast(a,b), [nx, ny]));
        out[`${nx},${ny}`] = hits.slice(0,3).map(h => ({ name: h.name, dist: h.dist, pt: h.point.map(v=>+v.toFixed(2)) }));
      }
      return out;
    } catch (e) { return { error: String(e).slice(0,120) }; }
  }
  return { error: 'no frame' };
}
