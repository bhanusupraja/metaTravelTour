// Probe the live app state: is the autotest progressing or stuck?
export default async function run({ page }) {
  for (const f of page.frames()) {
    let has = false;
    try {
      has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
    } catch {}
    if (!has) continue;
    const s = await f.evaluate(() => {
      const t = window.__tour;
      return {
        url: location.search,
        phase: t.phase,
        enterButtonsShown: t.enterButtonsShown,
        shownButtons: t.shownButtons,
        bubbleText: t.bubbleText,
        line: t.line,
        testKeys: Object.keys(window.__tourTest || {}).length,
        test: window.__tourTest || null,
      };
    }).catch((e) => ({ error: String(e) }));
    return { ok: true, s };
  }
  return { error: 'no app frame' };
}
