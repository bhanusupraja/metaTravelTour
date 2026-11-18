// Drive the tour to a place's arrival via the voice-command path, for
// picture capture. Env: SAY (place phrase, e.g. 'times square').
// Finds the app frame (the one with window.__tour), fires the command,
// waits for phase 'ready', then reports state. The Start ride button
// itself is pressed separately (xr run-sequence / flat tap).
export default async function run({ page }) {
  const place = process.env.SAY || 'times square';
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
    return { phase: t.phase, place: t.place, driving: t.driving, pendingPlace: t.pendingPlace, buttons: t.shownButtons, line: t.line };
  });
  const before = await state();
  await appFrame.evaluate((c) => window.__tourHandle(c), place);
  // wait up to 15 s for the ready phase
  let after = await state();
  for (let i = 0; i < 30 && after.phase !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    after = await state();
  }
  return { ok: true, said: place, before, after };
}
