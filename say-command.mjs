// Say a voice command to the tour via the voice-command path, for
// picture capture. Env: SAY (command, e.g. "i'm done", "selfie").
// Waits for the phase to change, then reports state.
export default async function run({ page }) {
  const cmd = process.env.SAY || "i'm done";
  let appFrame = null;
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (has) { appFrame = f; break; }
    } catch (e) { /* next frame */ }
  }
  if (!appFrame) return { error: 'no app frame with __tour' };
  const state = () => appFrame.evaluate(() => {
    const t = window.__tour;
    return { phase: t.phase, place: t.place, driving: t.driving, journalOpen: t.journalOpen, photoMode: t.photoMode, buttons: t.shownButtons, line: t.line };
  });
  const before = await state();
  await appFrame.evaluate((c) => window.__tourHandle(c), cmd);
  let after = await state();
  for (let i = 0; i < 40 && after.phase === before.phase && after.journalOpen === before.journalOpen; i++) {
    await new Promise((r) => setTimeout(r, 500));
    after = await state();
  }
  return { ok: true, said: cmd, before, after };
}
