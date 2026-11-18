// Capture the cover first page (fix round 3b): the thumbnail alone,
// full screen, for exactly 2 s - no title, no Milo, no buttons.
// Reloads the app frame plain. The trap from the first attempt: right
// after navigation the OLD frame still answers with phase 'enter' -
// reading it breaks the poll at once. So first wait until NO frame
// has __tour (old document detached), then poll for the new frame:
// __tour appears only once init has run, and the cover starts at the
// end of init, so the first sighting still has most of the 2 s left.
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
  for (let attempt = 0; attempt < 3; attempt++) {
    let f = await findApp();
    if (!f) return { error: 'no app frame' };
    await f.evaluate(() => {
      window.location.href = window.location.pathname;
    });
    // wait for the old document to detach
    for (let i = 0; i < 30; i++) {
      if (!(await findApp())) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // now poll for the new frame; screenshot the moment cover shows
    for (let i = 0; i < 60; i++) {
      f = await findApp();
      if (f) {
        const phase = await f
          .evaluate(() => window.__tour.phase)
          .catch(() => null);
        if (phase === 'cover') {
          await new Promise((r) => setTimeout(r, 300));
          await page.screenshot({
            path: '../travel-tour-v2-screens/81-cover-thumbnail.png',
          });
          const s = await f
            .evaluate(() => ({ phase: window.__tour.phase }))
            .catch(() => ({}));
          return { ok: true, s, file: '81-cover-thumbnail.png' };
        }
        if (phase === 'enter') break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return { ok: false, error: 'cover phase not observed in 3 attempts' };
}
