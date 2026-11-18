// Is the welcome 2 s timer firing? Read state now, wait 6 s, read again.
export default async function run({ page }) {
  for (const f of page.frames()) {
    let has = false;
    try {
      has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
    } catch {}
    if (!has) continue;
    const read = () =>
      f.evaluate(() => ({
        nowMs: Math.round(performance.now()),
        url: location.search,
        phase: window.__tour.phase,
        enterButtonsShown: window.__tour.enterButtonsShown,
        shownButtons: window.__tour.shownButtons,
      }));
    const a = await read();
    await new Promise((r) => setTimeout(r, 6000));
    const b = await read();
    return { ok: true, a, b };
  }
  return { error: 'no app frame' };
}
