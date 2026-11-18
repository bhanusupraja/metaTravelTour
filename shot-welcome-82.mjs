// Capture the Milo welcome screen after the cover (fix round 3b):
// thumbnail backdrop at normal size, 'Welcome to Travel Tour' with
// Milo, both boxes centred. Reloads the app frame plain if it is
// still on ?autotest=1 or left mid-game, then screenshots the enter
// screen once the two boxes have appeared (2 s after the cover ends).
export default async function run({ page }) {
  const findApp = async () => {
    for (const f of page.frames()) {
      try {
        const has = await f.evaluate(
          () => typeof window.__tour === 'object' && window.__tour !== null,
        );
        if (has) return f;
      } catch {}
    }
    return null;
  };
  let f = await findApp();
  if (!f) return { error: 'no app frame' };
  const needsReset = await f.evaluate(
    () =>
      new URLSearchParams(location.search).get('autotest') === '1' ||
      window.__tour.phase !== 'enter',
  );
  if (needsReset) {
    await f.evaluate(() => {
      window.location.href = window.location.pathname;
    });
    await new Promise((r) => setTimeout(r, 8000));
    f = null;
    for (let i = 0; i < 40 && !f; i++) {
      f = await findApp();
      if (!f) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!f) return { error: 'no app frame after reload' };
  }
  const state = () =>
    f.evaluate(() => ({
      phase: window.__tour.phase,
      buttons: window.__tour.shownButtons,
      enterButtons: window.__tour.enterButtonsShown,
    }));
  let s = await state();
  for (let i = 0; i < 40 && s.phase !== 'enter'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  if (s.phase !== 'enter') return { ok: false, error: 'not at welcome', s };
  for (let i = 0; i < 20 && !s.enterButtons; i++) {
    await new Promise((r) => setTimeout(r, 500));
    s = await state();
  }
  await new Promise((r) => setTimeout(r, 6000));
  await page.screenshot({ path: '../travel-tour-v2-screens/82-welcome-after-cover.png' });
  s = await state();
  return { ok: true, s, file: '82-welcome-after-cover.png' };
}
