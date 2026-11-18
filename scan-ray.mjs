export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourRaycast === 'function');
      if (!has) continue;
      const out = [];
      for (let nx = -0.8; nx <= 0.8; nx += 0.2) {
        for (let ny = -0.9; ny <= 0.5; ny += 0.2) {
          const hits = JSON.parse(await f.evaluate(([a,b]) => window.__tourRaycast(a,b), [nx, ny]));
          for (const h of hits) {
            const dx = h.point[0]-0.5, dy = h.point[1]-0.84, dz = h.point[2]+0.34;
            const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
            if (d < 0.25) out.push({ nx: +nx.toFixed(1), ny: +ny.toFixed(1), name: h.name, dist: h.dist, pt: h.point.map(v=>+v.toFixed(2)), d: +d.toFixed(2) });
          }
        }
      }
      return { nearSouvenir: out };
    } catch (e) { return { error: String(e).slice(0,120) }; }
  }
  return { error: 'no frame' };
}
