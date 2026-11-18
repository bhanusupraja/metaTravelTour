export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      if (!has) continue;
      const info = await f.evaluate(() => {
        const els = [...document.querySelectorAll('[data-uikit-id]')].map((e) => e.getAttribute('data-uikit-id'));
        const btns = [...document.querySelectorAll('button, [role="button"]')].map((e) => (e.textContent || '').trim().slice(0, 40));
        const text = (document.body.innerText || '').slice(0, 400);
        return { uikitIds: els.slice(0, 30), btns: btns.slice(0, 20), text };
      });
      return { ok: true, info };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { error: 'no app frame' };
}
