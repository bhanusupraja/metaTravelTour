// Start the built-in autotest: navigate the app frame to ?autotest=1.
// Returns immediately; poll with autotest-poll.mjs.
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
        return { ok: true, started: true };
      }
    } catch (e) {
      /* next frame */
    }
  }
  return { error: 'no app frame with __tour' };
}
