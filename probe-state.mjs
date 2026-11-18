export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (has) {
        const s = await f.evaluate(() => {
          const t = window.__tour;
          return { phase: t.phase, place: t.place, driving: t.driving, heldObject: t.heldObject, journal: t.journal, journalOpen: t.journalOpen, buttons: t.shownButtons, line: t.line };
        });
        return { ok: true, state: s };
      }
    } catch (e) { /* next */ }
  }
  return { error: 'no app frame' };
}
