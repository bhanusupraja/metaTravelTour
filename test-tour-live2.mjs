export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (!has) continue;
      const s = await f.evaluate(() => ({
        phase: window.__tour.phase,
        line: window.__tour.line,
        idx: window.__tour.introLineIdx,
        clip: window.__tour.lastClipPlayed,
        clipOk: window.__tour.lastClipPlayOk,
        clipErr: window.__tour.lastClipError,
        musicGain: window.__tour.musicGain,
        speaking: window.__tour.speaking,
      }));
      return s;
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { error: 'no app frame' };
}
