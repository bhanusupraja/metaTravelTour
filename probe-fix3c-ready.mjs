// Fix-3c staged probe, step 2: name Times Square, stop at ready.
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
  const f = await findApp();
  if (!f) return { error: 'no app frame' };
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      buttons: window.__tour.shownButtons,
      line: window.__tour.line,
      bubble: window.__tour.bubbleText,
    }));
  const waitPhase = async (want, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = await state();
      if (s.phase === want) return s;
      await new Promise((r) => setTimeout(r, 200));
    }
    return await state();
  };
  await f.evaluate(() => window.__tourHandle('times square'));
  const s = await waitPhase('ready', 20000);
  await new Promise((r) => setTimeout(r, 1200));
  return { ok: s.phase === 'ready', s: await state() };
}
