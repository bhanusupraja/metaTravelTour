// Reload the app frame plain, then watch the welcome 2 s timer.
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
  if (!f) return { error: 'no app frame' };
  await f.evaluate(() => {
    window.location.href = window.location.pathname;
  });
  await new Promise((r) => setTimeout(r, 9000));
  f = null;
  for (let i = 0; i < 40 && !f; i++) {
    f = await findApp();
    if (!f) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!f) return { error: 'no app frame after reload' };
  const read = () =>
    f.evaluate(() => ({
      nowMs: Math.round(performance.now()),
      phase: window.__tour.phase,
      enterButtonsShown: window.__tour.enterButtonsShown,
    }));
  const a = await read();
  await new Promise((r) => setTimeout(r, 3000));
  const b = await read();
  return { ok: true, a, b };
}
