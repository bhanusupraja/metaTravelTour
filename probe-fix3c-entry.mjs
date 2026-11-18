// Fix-3c staged probe, step 1: fresh load, stop at the game ask (entry).
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
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      buttons: window.__tour.shownButtons,
      bubble: window.__tour.bubbleText,
    }));
  let s = await state();
  for (let i = 0; i < 40 && s.phase !== 'choose'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  return { ok: s.phase === 'choose', s };
}
