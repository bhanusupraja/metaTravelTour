// Dump the full __tour debug state.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(
        () => typeof window.__tour === 'object' && window.__tour !== null,
      );
      if (has) {
        const state = await f.evaluate(() => window.__tour);
        return { ok: true, state };
      }
    } catch (e) {
      /* next frame */
    }
  }
  return { error: 'no app frame' };
}
