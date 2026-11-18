// Dump the managed page URL and all child frame URLs, plus __tour presence.
export default async function run({ page }) {
  const frames = page.frames().map((f) => ({
    url: f.url(),
    hasTour: undefined,
  }));
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => typeof window.__tour !== 'undefined');
      const entry = frames.find((x) => x.url === f.url());
      if (entry) entry.hasTour = has;
    } catch (e) {
      const entry = frames.find((x) => x.url === f.url());
      if (entry) entry.hasTour = 'err:' + String(e).slice(0, 80);
    }
  }
  return { ok: true, pageUrl: page.url(), frames };
}
