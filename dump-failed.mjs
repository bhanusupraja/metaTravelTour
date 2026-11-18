// Dump the failed autotest checks plus live state, for diagnosis.
export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourTest === 'object' && window.__tourTest !== null);
      if (!has) continue;
      const r = await f.evaluate(() => {
        const t = window.__tourTest;
        const failed = Object.entries(t).filter(([, v]) => v === false).map(([k]) => k);
        const s = window.__tour || {};
        return {
          total: Object.keys(t).length,
          passed: Object.values(t).filter((v) => v === true).length,
          failed,
          phase: s.phase,
          place: s.place,
          journal: s.journal,
          musicPlaying: s.musicPlaying,
          musicNotesPlayed: s.musicNotesPlayed,
          line: s.line,
        };
      });
      return { ok: true, result: r };
    } catch (e) { /* next frame */ }
  }
  return { error: 'no app frame with __tourTest' };
}
