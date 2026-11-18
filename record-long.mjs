// CDP screencast recorder for the long Travel Agent Tour play-through.
// Adapted from the 90s record.mjs used for travel-tour-v2-playthrough.mp4.
// Records screencast frames to <workspaceRoot>/frames-long/frame-NNNNNN.jpg
// plus a timestamps log, until <workspaceRoot>/stop-recording-long appears
// or maxSeconds elapse.
import fs from 'node:fs/promises';
import path from 'node:path';

export default async function run({ context, page, workspaceRoot }) {
  const seg = process.env.SEG || '1';
  const framesDir = path.join(workspaceRoot, `frames-long-${seg}`);
  const stopFile = path.join(workspaceRoot, `stop-recording-long-${seg}`);
  const maxSeconds = Number(process.env.MAXSEC || '100');
  await fs.mkdir(framesDir, { recursive: true });
  await fs.rm(stopFile, { force: true });

  const session = await context.newCDPSession(page);
  const stamps = [];
  let count = 0;
  let lastAck = Promise.resolve();

  session.on('Page.screencastFrame', (event) => {
    const n = ++count;
    const t = Date.now();
    const p = path.join(framesDir, `frame-${String(n).padStart(6, '0')}.jpg`);
    lastAck = lastAck
      .then(() => fs.writeFile(p, Buffer.from(event.data, 'base64')))
      .then(() => stamps.push(`${n},${t}`))
      .then(() => session.send('Page.screencastFrameAck', { sessionId: event.sessionId }))
      .catch((e) => console.error('frame save error', e));
  });

  await session.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 65,
    everyNthFrame: 1,
  });

  const started = Date.now();
  let stoppedBy = 'timeout';
  while (Date.now() - started < maxSeconds * 1000) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await fs.access(stopFile);
      stoppedBy = 'stop-file';
      break;
    } catch {
      // keep recording
    }
  }

  await session.send('Page.stopScreencast').catch(() => {});
  await lastAck;
  await fs.writeFile(path.join(framesDir, 'timestamps.csv'), `frame,ms\n${stamps.join('\n')}\n`);
  return {
    ok: true,
    stoppedBy,
    frames: count,
    elapsedMs: Date.now() - started,
    framesDir,
  };
}
