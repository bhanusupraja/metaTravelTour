// Reload the app page (used after a config change so the new config applies).
export default async function run({ page }) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4000));
  return { ok: true, url: page.url() };
}
