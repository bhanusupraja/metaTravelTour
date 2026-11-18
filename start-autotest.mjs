// Start the built-in autotest: navigate the app frame to ?autotest=1 and
// return at once. The suite then runs IN THE PAGE (up to ~14 min on the
// slow rig); poll it separately with poll-test.mjs, because a single
// browser-run lease caps at 110 s.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (has) {
        await f.evaluate(() => {
          window.location.search = 'autotest=1';
        });
        return { ok: true, navigated: true };
      }
    } catch (e) {
      /* next frame */
    }
  }
  return { error: 'no app frame with __tour' };
}
