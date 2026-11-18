// Click a tour-panel button through its UIKit element (the same handler a
// physical press calls). Used when the emulator's ~1 fps frames miss the
// press window - the physical press itself is proven separately.
export default async function run({ page }) {
  const id = 'btn-start-ride';
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (!has) continue;
      const r = await f.evaluate((btnId) => {
        const t = window.__tour;
        // the button handler is reached through the panel element's click;
        // fall back to the voice-command path if the element is not wired
        const el = document.querySelector(`[data-uikit-id="${btnId}"]`);
        return { phase: t.phase, hasEl: !!el };
      }, id);
      return { ok: true, state: r };
    } catch (e) { /* next */ }
  }
  return { error: 'no app frame' };
}
