// Debug probe: reload the app frame and sample window.__tour.phase
// every 200 ms for ~10 s, returning the timeline.
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
  let f = await findApp();
  if (!f) return { error: 'no app frame at start' };
  const before = await f.evaluate(() => window.__tour.phase).catch(() => null);
  await f.evaluate(() => {
    window.location.href = window.location.pathname;
  });
  const timeline = [];
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    f = await findApp();
    const phase = f
      ? await f.evaluate(() => window.__tour.phase).catch(() => null)
      : null;
    timeline.push([Date.now() - t0, phase]);
    await new Promise((r) => setTimeout(r, 200));
  }
  return { ok: true, before, timeline };
}
