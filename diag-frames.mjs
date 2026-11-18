export default async function run({ page }) {
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
          sample: ids.slice(0, 8),
          hasStartGame: !!document.querySelector('[data-uikit-id="btn-start-game"]'),
        };
      });
      out.push(r);
    } catch (e) { out.push({ error: String(e) }); }
  }
  return out;
}
