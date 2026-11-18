// Probe the tour's live state: phase, place, shown buttons, journal.
// Also fires a voice command when SAY_CMD is set in the environment.
export default async function run({ page, frame }) {
  const probe = async (ctx) => {
    try {
      return await ctx.evaluate(() => ({
        hasTour: typeof window.__tour !== 'undefined',
        hasHandle: typeof window.__tourHandle,
        phase: window.__tour?.phase,
        place: window.__tour?.place,
        driving: window.__tour?.driving,
        line: window.__tour?.currentLine,
        buttons: window.__tour?.shownButtons,
        journalOpen: window.__tour?.journalOpen,
        journal: window.__tour?.journal,
        held: window.__tour?.heldObject,
      }));
    } catch (e) {
      return { error: String(e).slice(0, 150) };
    }
  };
  const onPage = await probe(page);
  const onFrame = frame ? await probe(frame) : null;
  const ctx = onFrame?.hasHandle === 'function' ? frame : page;
  let fired = null;
  const cmd = process.env.SAY_CMD;
  if (cmd && typeof onFrame?.hasHandle !== 'undefined' || onFrame?.hasHandle === 'function') {
    try {
      await ctx.evaluate((c) => window.__tourHandle(c), cmd);
      fired = cmd;
    } catch (e) {
      fired = 'error: ' + String(e).slice(0, 120);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  const after = cmd ? await probe(ctx) : null;
  return { ok: true, onPage, onFrame, fired, after };
}
