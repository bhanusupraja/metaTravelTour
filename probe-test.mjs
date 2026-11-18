export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tourTest === 'object' && window.__tourTest !== null);
      if (has) {
        const s = await f.evaluate(() => {
          const t = window.__tourTest;
          const keys = Object.keys(t.results || {});
          const failed = keys.filter((k) => t.results[k] === false);
          return { done: t.done, total: keys.length, passed: keys.filter((k) => t.results[k] === true).length, failed, url: window.location.search };
        });
        return { ok: true, test: s };
      }
    } catch (e) { /* next */ }
  }
  return { error: 'no __tourTest frame' };
}
