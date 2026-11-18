export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourTest === 'object' && window.__tourTest !== null);
      if (!has) continue;
      const out = await f.evaluate(() => {
        const t = window.__tourTest;
        const names = Object.keys(t);
        const mine = ['tapGrabWorks','tapGrabReleaseWorks','thankYouShown','thankYouBackAnswered','photoFirstGuardOnce','journalBookPageOne','journalBookPageTwo','journalPhotoOpensBig','journalPhotoClosesBack','journalBookCloses','noCrowdNearHer','goodbyeShown','goodbyeJournalShown','journalViewOpens','journalGalleryShown'];
        const res = {};
        mine.forEach(n => { res[n] = t[n]; });
        return { total: names.length, mine: res };
      });
      return out;
    } catch (e) { /* next frame */ }
  }
  return { error: 'no app frame with __tourTest' };
}
