// Probe full debugState from the app frame.
export default async ({ page, log }) => {
  const frames = page.frames();
  let appFrame = null;
  for (const f of frames) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (has) { appFrame = f; break; }
    } catch (e) {}
  }
  if (!appFrame) return { error: 'no app frame with __tour' };
  const state = await appFrame.evaluate(() => {
    const t = window.__tour;
    return {
      phase: t.phase, place: t.place, driving: t.driving,
      pendingPlace: t.pendingPlace, destPlace: t.destPlace,
      currentNode: t.currentNode, posX: t.posX, posZ: t.posZ,
      paused: t.paused, line: t.line,
    };
  });
  return { state };
};
