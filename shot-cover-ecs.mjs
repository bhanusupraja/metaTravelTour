// Capture the cover first page (fix round 3b) while ECS is paused:
// the caller has already paused updates, jumped TourState.phase to
// 'cover' and stepped a few frames, so the thumbnail sits alone, full
// screen - no title, no Milo, no buttons - and the 2 s clock cannot
// advance while paused. Just verify the phase and screenshot.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (!has) continue;
      const s = await f.evaluate(() => ({ phase: window.__tour.phase }));
      if (s.phase !== 'cover') return { ok: false, error: 'not cover', s };
      await page.screenshot({
        path: '../travel-tour-v2-screens/81-cover-thumbnail.png',
      });
      return { ok: true, s, file: '81-cover-thumbnail.png' };
    } catch {}
  }
  return { error: 'no app frame' };
}
