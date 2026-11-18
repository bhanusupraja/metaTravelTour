export default async function run({ page }) {
  await page.goto('https://localhost:8081/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 12000));
  const out = [];
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(() => {
        const ids = [...document.querySelectorAll('[data-uikit-id]')].map((el) => el.getAttribute('data-uikit-id'));
        return {
          url: location.href,
          hasTour: typeof window.__tour === 'object' && window.__tour !== null,
          phase: window.__tour ? window.__tour.phase : null,
          uikitCount: ids.length,
          hasStartGame: !!document.querySelector('[data-uikit-id="btn-start-game"]'),
        };
      });
      out.push(r);
    } catch (e) { out.push({ error: String(e) }); }
  }
  return out;
}
