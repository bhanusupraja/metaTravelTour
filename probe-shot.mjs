export default async function run({ page }) {
  const out = { pageScreenshot: typeof page.screenshot };
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour === 'object' && window.__tour !== null);
      out.frames = out.frames || [];
      out.frames.push({ url: f.url(), hasTour: has, screenshot: typeof f.screenshot });
    } catch (e) { out.frames.push({ error: String(e) }); }
  }
  return out;
}
