// Run the built-in autotest (?autotest=1) in the managed browser and
// return its results. Navigates the app frame to ?autotest=1, then polls
// window.__tourTest until the suite finishes (up to ~14 minutes on the
// slow SwiftShader rig).
export default async function run({ page }) {
  const findAppFrame = async () => {
    for (const f of page.frames()) {
      try {
        const has = await f.evaluate(
          () => typeof window.__tour === 'object' && window.__tour !== null,
        );
        if (has) return f;
      } catch (e) {
        /* next frame */
      }
    }
    return null;
  };

  let appFrame = await findAppFrame();
  if (!appFrame) return { error: 'no app frame with __tour' };

  // reload the app frame with the autotest flag
  await appFrame.evaluate(() => {
    window.location.search = 'autotest=1';
  });
  await new Promise((r) => setTimeout(r, 5000));

  appFrame = null;
  for (let i = 0; i < 30 && !appFrame; i++) {
    appFrame = await findAppFrame();
    if (!appFrame) await new Promise((r) => setTimeout(r, 2000));
  }
  if (!appFrame) return { error: 'app frame did not come back after reload' };

  // poll for the finished results (set once at the end of runAutotest)
  for (let i = 0; i < 168; i++) {
    const t = await appFrame
      .evaluate(() => window.__tourTest || null)
      .catch(() => null);
    if (t && Object.keys(t).length > 0) {
      const entries = Object.entries(t);
      const passed = entries.filter(([, v]) => v === true).length;
      const failed = entries.filter(([, v]) => v !== true);
      return { ok: true, total: entries.length, passed, failed };
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  const state = await appFrame
    .evaluate(() => ({
      phase: window.__tour?.phase,
      place: window.__tour?.place,
    }))
    .catch(() => null);
  return { error: 'autotest did not finish in 14 min', state };
}
