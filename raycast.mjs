// Raycast from camera through NDC coords (env NX, NY) and return hits.
export default async ({ page, log }) => {
  const nx = parseFloat(process.env.NX || '0.225');
  const ny = parseFloat(process.env.NY || '0.1125');
  const frames = page.frames();
  for (const f of frames) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (has) {
        const hits = await f.evaluate(([nx, ny]) => window.__tourRaycast(nx, ny), [nx, ny]);
        return { nx, ny, hits: JSON.parse(hits) };
      }
    } catch (e) { log('frame err: ' + e.message); }
  }
  return { error: 'no frame with __tour' };
};
