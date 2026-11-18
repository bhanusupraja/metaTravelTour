// Capture the tutorial intro bubble ("MILO SAYS" + "Hi, my name is Milo...").
// Clicks Start tutorial via the UIKit DOM element, waits for the intro line,
// then screenshots just the app frame.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (!has) continue;
      const state = () =>
        f.evaluate(() => ({
          phase: window.__tour.phase,
          line: window.__tour.line,
          bubble: window.__tour.bubbleText,
        }));
      const before = await state();
      if (before.phase !== 'enter') {
        return { ok: false, error: 'not at welcome', before };
      }
      const clicked = await f.evaluate(() => {
        const el = document.querySelector('[data-uikit-id="btn-start-tutorial"]');
        if (!el) return { clicked: false, reason: 'no element' };
        el.dispatchEvent(new Event('click', { bubbles: true }));
        return { clicked: true };
      });
      let after = await state();
      for (let i = 0; i < 20 && after.phase !== 'tutorial'; i++) {
        await new Promise((r) => setTimeout(r, 500));
        after = await state();
      }
      if (after.phase !== 'tutorial') {
        return { ok: false, error: 'tutorial did not start', before, clicked, after };
      }
      // line 0 plays first; give the bubble a moment to show it
      await new Promise((r) => setTimeout(r, 2500));
      const shot = await state();
      await f.screenshot({
        path: 'travel-tour-v2-screens/60-tutorial-milo-says.png',
      });
      return { ok: true, before, clicked, after: shot, file: '60-tutorial-milo-says.png' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { error: 'no app frame' };
}
