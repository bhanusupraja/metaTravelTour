export default async function run({ page }) {
  for (const f of page.frames()) {
    try {
      const t = await f.evaluate(() => window.__tourTest || null);
      if (!t) continue;
      const names = Object.keys(t);
      const hold = names.filter((n) => n.toLowerCase().includes('hold'));
      return { total: names.length, holdChecks: hold.map((n) => [n, t[n]]) };
    } catch (e) { /* next */ }
  }
  return { error: 'no app frame' };
}
