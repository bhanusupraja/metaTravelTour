export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const t = await f.evaluate(() => window.__tourTest || null);
      if (!t) continue;
      const names = ['holdRingShown','holdConfirmShown','holdConfirmNoKeepsIt','holdConfirmShownAgain','holdConfirmYesSends','musicSofter','tutorialLineTwoPlays','tutorialLineThreePlays','journalEmptyState','selfieModeHidesToggle','cheeseTakesSelfie','selfieModeResetAfterPhoto'];
      const res = {};
      names.forEach((n) => { res[n] = t[n]; });
      return { total: Object.keys(t).length, newChecks: res };
    } catch (e) { /* next */ }
  }
  return { error: 'no app frame' };
}
