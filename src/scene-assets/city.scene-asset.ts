/**
 * Travel Agent Tour v2.0 - stylised New York City (procedural, offline).
 *
 * Port of the v1.5 Three.js city, rebuilt as an IWSDK scene asset.
 * Deterministic: a seeded RNG replaces Math.random() so the runtime and
 * the editor build the same city.
 *
 * ROAD LAYOUT (the drive graph lives on these roads - the car never leaves
 * them; see src/tour-system.ts):
 *   Avenue (N-S): x -8..8, z 44..-220. Start (0,8) -> Times Sq (0,-60).
 *   Park St (E-W): z -43..-37, x -19..8. -> Central Park stop (-16,-40).
 *   Plaza St (E-W): z -63..-57, x -19..19. Cross street at Times Square.
 *   West St (N-S): x -19..-13, z -60..-40. Park St <-> Plaza St (west loop).
 *   East St (N-S): x 13..19, z -60..-40. Plaza St <-> Park St (east loop).
 * Buildings are carved out wherever a road runs; the park lawn sits north
 * of Park St (x -55..-19, z -70..-42) and the Statue viewpoint is south
 * on the Battery promenade (z 26..44, statue island at z=96).
 */
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';

// Seeded RNG (mulberry32) - deterministic across realms.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- canvas textures ----------
function canvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

function towerTex(
  rng: () => number,
  base: string,
  glass: string,
  litRatio: number,
): CanvasTexture {
  return canvasTex(512, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, base);
    g.addColorStop(0.55, glass);
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,190,140,.10)';
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 0);
    ctx.lineTo(w * 0.45, 0);
    ctx.lineTo(w * 0.25, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(160,200,255,.08)';
    ctx.beginPath();
    ctx.moveTo(w * 0.6, 0);
    ctx.lineTo(w * 0.75, 0);
    ctx.lineTo(w * 0.6, h);
    ctx.lineTo(w * 0.45, h);
    ctx.closePath();
    ctx.fill();
    const cols = 12;
    const rows = 28;
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const rowDark = rng() < 0.08;
      for (let c = 0; c < cols; c++) {
        const x = c * cw + 3;
        const y = r * rh + 4;
        const ww = cw - 6;
        const hh = rh - 8;
        if (rowDark) {
          ctx.fillStyle = '#10152a';
        } else {
          const roll = rng();
          if (roll < litRatio * 0.75) ctx.fillStyle = '#ffd166';
          else if (roll < litRatio) ctx.fillStyle = '#bfe9ff';
          else ctx.fillStyle = rng() < 0.5 ? '#141a2e' : '#1a2138';
        }
        ctx.fillRect(x, y, ww, hh);
        if (ctx.fillStyle === '#ffd166' || ctx.fillStyle === '#bfe9ff') {
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.fillRect(x, y, ww, 2);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(0, r * rh + rh - 3, w, 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let mc = 1; mc < cols; mc++) ctx.fillRect(mc * cw - 1, 0, 2, h);
  });
}

// One realistic person, drawn on canvas (128x256, transparent).
// cfg: skin, hair, hairStyle, jacket, legs, bags, phone.
function personTex(
  cfg: {
    skin: string;
    hair: string;
    hairStyle: string;
    jacket: string;
    legs: string;
    bags: string | null;
    phone: boolean;
  },
): CanvasTexture {
  return canvasTex(128, 256, (ctx, w, h) => {
    const cx = 64;
    const limb = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      col: string,
      lw: number,
    ) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    limb(cx - 12, 150, cx - 18, 232, cfg.legs, 15);
    limb(cx + 12, 150, cx + 20, 232, cfg.legs, 15);
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(cx - 19, 240, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 21, 240, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cfg.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 30, 82);
    ctx.quadraticCurveTo(cx, 70, cx + 30, 82);
    ctx.lineTo(cx + 27, 152);
    ctx.lineTo(cx - 27, 152);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(cx - 27, 146, 54, 6);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(cx - 1, 80, 2, 70);
    if (cfg.phone) {
      limb(cx - 28, 88, cx - 34, 150, cfg.jacket, 13);
      limb(cx + 28, 88, cx + 40, 52, cfg.jacket, 13);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx + 34, 34, 12, 20);
      ctx.fillStyle = '#9be7ff';
      ctx.fillRect(cx + 36, 37, 8, 14);
    } else {
      limb(cx - 28, 88, cx - 34, 152, cfg.jacket, 13);
      limb(cx + 28, 88, cx + 34, 152, cfg.jacket, 13);
    }
    if (cfg.bags) {
      ctx.fillStyle = cfg.bags;
      ctx.fillRect(cx - 44, 152, 20, 26);
      ctx.fillRect(cx + 24, 152, 20, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SHOP', cx - 34, 168);
      ctx.fillText('SHOP', cx + 34, 168);
    }
    ctx.fillStyle = cfg.skin;
    ctx.fillRect(cx - 7, 62, 14, 16);
    ctx.beginPath();
    ctx.arc(cx, 46, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cfg.hair;
    if (cfg.hairStyle === 'long') {
      ctx.beginPath();
      ctx.arc(cx, 42, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 18, 40, 8, 44);
      ctx.fillRect(cx + 10, 40, 8, 44);
    } else if (cfg.hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(cx, 42, 18, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, 22, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.hairStyle === 'cap') {
      ctx.beginPath();
      ctx.arc(cx, 44, 17, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 17, 40, 34, 5);
      ctx.fillRect(cx + 2, 40, 22, 5);
    } else if (cfg.hairStyle === 'hood') {
      ctx.fillStyle = cfg.jacket;
      ctx.beginPath();
      ctx.arc(cx, 44, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.skin;
      ctx.beginPath();
      ctx.arc(cx, 47, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, 42, 18, Math.PI, 0);
      ctx.fill();
    }
    // face - realistic, not anime: eyes, brows, nose, mouth, ears.
    ctx.fillStyle = cfg.skin;
    ctx.beginPath();
    ctx.arc(cx - 17, 46, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 17, 46, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - 6, 44, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, 44, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx - 6, 44, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 6, 44, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cfg.hair;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 10, 38);
    ctx.lineTo(cx - 3, 37.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 3, 37.5);
    ctx.lineTo(cx + 10, 38);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, 46);
    ctx.lineTo(cx - 1, 52);
    ctx.lineTo(cx + 1, 53);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,40,40,.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 4, 57);
    ctx.quadraticCurveTo(cx, 59, cx + 4, 57);
    ctx.stroke();
  });
}

function billboardTex(
  rng: () => number,
  bg: string,
  fg: string,
  lines: string[],
): CanvasTexture {
  return canvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // crisp frame + a soft top glow, so the board reads like a lit sign
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(0, 0, w, 60);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 120px Arial';
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, 180 + i * 140);
    });
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 80; i++) {
      ctx.fillRect(rng() * w, rng() * h, 5, 5);
    }
  });
}

/** Sky dome texture, one per time of day - her pictures set the light:
 *  day = bright blue morning sky with sun and soft clouds (the drive,
 *  Brooklyn Bridge, Central Park, Statue of Liberty);
 *  dusk = the purple-orange evening from the original build (Times Square
 *  arrival); sunset = golden sun low over the river (DUMBO);
 *  twilight = deep blue-purple with an orange band at the horizon and
 *  city lights coming on (Observation Deck). */
type SkyMode = 'day' | 'dusk' | 'sunset' | 'twilight';
function skyTex(rng: () => number, mode: SkyMode = 'dusk'): CanvasTexture {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (mode === 'day') {
      g.addColorStop(0, '#1e6fd9');
      g.addColorStop(0.35, '#4a9be8');
      g.addColorStop(0.5, '#8ec9f5');
      g.addColorStop(0.62, '#cfeaff');
      g.addColorStop(1, '#e8f6ff');
    } else if (mode === 'sunset') {
      g.addColorStop(0, '#2c2150');
      g.addColorStop(0.3, '#6b2f63');
      g.addColorStop(0.45, '#c94b3a');
      g.addColorStop(0.55, '#ff8c3b');
      g.addColorStop(0.65, '#ffb347');
      g.addColorStop(1, '#ffd98a');
    } else if (mode === 'twilight') {
      g.addColorStop(0, '#070b24');
      g.addColorStop(0.3, '#141a45');
      g.addColorStop(0.45, '#2c2560');
      g.addColorStop(0.55, '#6b3a7a');
      g.addColorStop(0.62, '#e8763f');
      g.addColorStop(0.7, '#f7b267');
      g.addColorStop(1, '#2a1a4d');
    } else {
      g.addColorStop(0, '#181640');
      g.addColorStop(0.4, '#1d1a55');
      g.addColorStop(0.58, '#4a2a72');
      g.addColorStop(0.7, '#b34a4a');
      g.addColorStop(0.78, '#e8763f');
      g.addColorStop(0.84, '#f7b267');
      g.addColorStop(1, '#33204d');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (mode === 'day') {
      // bright sun high up + soft white clouds, no stars
      const sun = ctx.createRadialGradient(w * 0.7, h * 0.2, 4, w * 0.7, h * 0.2, 90);
      sun.addColorStop(0, 'rgba(255,250,220,1)');
      sun.addColorStop(0.25, 'rgba(255,244,190,.9)');
      sun.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(w * 0.7 - 100, h * 0.2 - 100, 200, 200);
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.2, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let c = 0; c < 12; c++) {
        const cx = rng() * w;
        const cy = h * (0.08 + rng() * 0.3);
        const cw = 50 + rng() * 90;
        const ch = 10 + rng() * 12;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mode === 'sunset') {
      // low golden sun over the river + pink-purple clouds
      const sun = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, 140);
      sun.addColorStop(0, 'rgba(255,220,140,1)');
      sun.addColorStop(0.3, 'rgba(255,170,80,.8)');
      sun.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(w * 0.5 - 150, h * 0.5 - 150, 300, 300);
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,150,180,.35)';
      for (let c = 0; c < 8; c++) {
        ctx.beginPath();
        ctx.ellipse(
          rng() * w,
          h * (0.3 + rng() * 0.25),
          80 + rng() * 100,
          10 + rng() * 12,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      // dusk + twilight: stars in the top half, warm horizon glow
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 260; i++) {
        ctx.globalAlpha = 0.25 + rng() * 0.75;
        ctx.fillRect(rng() * w, rng() * h * 0.45, 2, 2);
      }
      ctx.globalAlpha = 1;
      const g2 = ctx.createLinearGradient(0, h * 0.62, 0, h);
      g2.addColorStop(0, 'rgba(255,170,80,0)');
      g2.addColorStop(0.6, 'rgba(255,170,80,.35)');
      g2.addColorStop(1, 'rgba(255,190,110,.65)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, h * 0.62, w, h * 0.38);
      ctx.fillStyle = 'rgba(255,140,90,.14)';
      for (let c = 0; c < 7; c++) {
        ctx.beginPath();
        ctx.ellipse(
          rng() * w,
          h * (0.55 + rng() * 0.2),
          90 + rng() * 90,
          10 + rng() * 10,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  });
}

function roadTex(rng: () => number): CanvasTexture {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1d1f27';
    ctx.fillRect(0, 0, w, h);
    for (let s = 0; s < 26; s++) {
      ctx.fillStyle = 'rgba(255,190,120,' + (0.02 + rng() * 0.05) + ')';
      const sx = rng() * w;
      const sw = 3 + rng() * 10;
      ctx.fillRect(sx, 0, sw, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 0; y < h; y += 128) ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = '#facc15';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 4, y + 8, 8, 34);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(8, 0, 4, h);
    ctx.fillRect(w - 12, 0, 4, h);
  });
}

function marbleTex(rng: () => number): CanvasTexture {
  // Grand Central concourse floor: warm cream marble, large tiles with
  // soft grey veining and a darker grout grid.
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e8ddc4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,110,90,.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = rng() * w;
      let y = rng() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (rng() - 0.5) * 220;
        y += (rng() - 0.5) * 220;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,80,60,.5)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function cobbleTex(rng: () => number): CanvasTexture {
  // DUMBO promenade: grey cobblestones in staggered rows.
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6b655c';
    ctx.fillRect(0, 0, w, h);
    const rows = 10;
    const cols = 8;
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = 100 + Math.floor(rng() * 60);
        ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
        const x = c * cw + 3 + (r % 2 ? cw / 2 : 0);
        const y = r * rh + 3;
        ctx.beginPath();
        ctx.roundRect(x % w, y, cw - 6, rh - 6, 8);
        ctx.fill();
      }
    }
  });
}

function plankTex(rng: () => number): CanvasTexture {
  // Brooklyn Bridge walkway: warm wooden planks with gaps and grain.
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(0, 0, w, h);
    const rows = 6;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const shade = 130 + Math.floor(rng() * 40);
      ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.55)},${Math.floor(shade * 0.28)})`;
      ctx.fillRect(0, r * rh + 2, w, rh - 4);
      ctx.strokeStyle = 'rgba(60,30,10,.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = r * rh + 6 + rng() * (rh - 12);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + (rng() - 0.5) * 6, w * 0.7, y + (rng() - 0.5) * 6, w, y);
        ctx.stroke();
      }
    }
  });
}

function storefrontTex(sign: string, bg: string, fg: string): CanvasTexture {
  return canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    for (let x = 14; x < w - 20; x += 62) ctx.fillRect(x, 46, 48, 68);
    ctx.fillStyle = 'rgba(255,220,130,.85)';
    for (let x = 14; x < w - 20; x += 62) {
      ctx.fillRect(x + 4, 50, 40, 60);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px Arial';
    ctx.fillText(sign, w / 2, 34);
  });
}

function marqueeTex(text: string, bg: string, fg: string): CanvasTexture {
  return canvasTex(512, 192, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd166';
    for (let x = 8; x < w; x += 22) {
      ctx.beginPath();
      ctx.arc(x, 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, h - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let y = 10; y < h; y += 22) {
      ctx.beginPath();
      ctx.arc(10, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w - 10, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px Arial';
    ctx.fillText(text, w / 2, h / 2 + 18);
  });
}


// ---------- the city ----------
// Parentless prototype. The TourSystem moves this whole group (the
// "treadmill"): the car stays at the origin with the rider, and the city
// slides/turns around it, so the rider never moves - seated, comfortable.
export function createCity(): Group {
  const rng = mulberry32(20261114);
  const city = new Group();
  city.name = 'nyc-city';

  const add = (o: Object3D): Object3D => {
    city.add(o);
    return o;
  };

  // lights - named so the tour system can set them per sky (daylight
  // drive, dusk Times Square, sunset DUMBO, twilight Observation Deck).
  // Day is the default: bright blue sky, high warm sun.
  const amb = new AmbientLight(0xdfeaf5, 1.15);
  amb.name = 'cityAmbient';
  add(amb);
  const moon = new DirectionalLight(0xcfd8ff, 0.15);
  moon.name = 'cityMoon';
  moon.position.set(-30, 60, 20);
  add(moon);
  const dusk = new DirectionalLight(0xfff2d9, 1.35);
  dusk.name = 'citySun';
  dusk.position.set(30, 60, -40);
  add(dusk);

  // sky domes (radius 150 - MUST stay inside the camera far plane of
  // 200 in iwsdk.config.json; the old radius 400 sat beyond it, so the
  // dome was clipped entirely and the sky rendered black in every
  // scene, daylight included). One visible at a time; the tour system
  // switches by sky mode.
  const skyGeo = new SphereGeometry(150, 24, 16);
  const skyModes: SkyMode[] = ['day', 'dusk', 'sunset', 'twilight'];
  for (const mode of skyModes) {
    const dome = new Mesh(
      skyGeo,
      new MeshBasicMaterial({ map: skyTex(rng, mode), side: BackSide, fog: false }),
    );
    dome.name = mode === 'day' ? 'skyDay' : mode === 'dusk' ? 'skyDusk' : mode === 'sunset' ? 'skySunset' : 'skyTwilight';
    dome.visible = mode === 'day';
    add(dome);
  }

  // ---- roads (the drive graph, visible) ----
  const roadMat = new MeshStandardMaterial({
    map: roadTex(rng),
    roughness: 0.35,
    metalness: 0.25,
  });
  const crossMat = new MeshStandardMaterial({
    map: roadTex(rng),
    roughness: 0.35,
    metalness: 0.25,
  });
  // Avenue: x -8..8, z 40..-220
  const avenue = new Mesh(new PlaneGeometry(16, 260), roadMat);
  avenue.rotation.x = -Math.PI / 2;
  avenue.position.set(0, 0, -90);
  add(avenue);
  // Park St (E-W): x -19..8, z -43..-37
  const parkSt = new Mesh(new PlaneGeometry(27, 6), crossMat);
  parkSt.rotation.x = -Math.PI / 2;
  parkSt.rotation.z = Math.PI / 2;
  parkSt.position.set(-5.5, 0.01, -40);
  add(parkSt);
  // Plaza St (E-W): x -19..19, z -63..-57
  const plazaSt = new Mesh(new PlaneGeometry(38, 6), crossMat);
  plazaSt.rotation.x = -Math.PI / 2;
  plazaSt.rotation.z = Math.PI / 2;
  plazaSt.position.set(0, 0.01, -60);
  add(plazaSt);
  // West St (N-S): x -19..-13, z -60..-40
  const westSt = new Mesh(new PlaneGeometry(6, 20), roadMat);
  westSt.rotation.x = -Math.PI / 2;
  westSt.position.set(-16, 0.01, -50);
  add(westSt);
  // East St (N-S): x 13..19, z -60..-40
  const eastSt = new Mesh(new PlaneGeometry(6, 20), roadMat);
  eastSt.rotation.x = -Math.PI / 2;
  eastSt.position.set(16, 0.01, -50);
  add(eastSt);

  // sidewalks along the avenue
  const walkMat = new MeshStandardMaterial({ color: 0x4b4f5e, roughness: 1 });
  [-12, 12].forEach((x) => {
    const w = new Mesh(new PlaneGeometry(8, 260), walkMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(x, 0.02, -90);
    add(w);
  });
  // crosswalks at the Times Square plaza + start street
  const stripeMat = new MeshBasicMaterial({ color: 0xd7dae2 });
  [-58, -18, 8].forEach((cz) => {
    for (let sx = -7; sx <= 7; sx += 2.4) {
      const stripe = new Mesh(new PlaneGeometry(1.3, 3.2), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(sx, 0.04, cz);
      add(stripe);
    }
  });

  // ---- buildings (carved out wherever a road runs) ----
  const towers = [
    towerTex(rng, '#232c44', '#31405e', 0.6),
    towerTex(rng, '#33283e', '#4a3560', 0.55),
    towerTex(rng, '#1c2836', '#2b3d55', 0.65),
    towerTex(rng, '#3d2f24', '#54402e', 0.55),
    towerTex(rng, '#2b2b3e', '#3d3d5e', 0.6),
    towerTex(rng, '#22333a', '#2f4850', 0.6),
    towerTex(rng, '#452a2e', '#5e3a3e', 0.5),
    towerTex(rng, '#1f2f28', '#2e4a3a', 0.55),
  ];
  const peopleTex = [
    personTex({ skin: '#e0ac69', hair: '#1f2937', hairStyle: 'short', jacket: '#1f2937', legs: '#1e3a8a', bags: null, phone: false }),
    personTex({ skin: '#f1c27d', hair: '#6b4423', hairStyle: 'long', jacket: '#7f1d1d', legs: '#111827', bags: '#dc2626', phone: false }),
    personTex({ skin: '#c68642', hair: '#111827', hairStyle: 'cap', jacket: '#1e3a8a', legs: '#374151', bags: null, phone: true }),
    personTex({ skin: '#8d5524', hair: '#111827', hairStyle: 'bun', jacket: '#14532d', legs: '#1f2937', bags: '#f59e0b', phone: false }),
    personTex({ skin: '#f1c27d', hair: '#b45309', hairStyle: 'long', jacket: '#581c87', legs: '#0f172a', bags: null, phone: true }),
    personTex({ skin: '#e0ac69', hair: '#374151', hairStyle: 'short', jacket: '#0e7490', legs: '#1e3a8a', bags: null, phone: false }),
    personTex({ skin: '#c68642', hair: '#111827', hairStyle: 'hood', jacket: '#44403c', legs: '#292524', bags: '#2563eb', phone: false }),
    personTex({ skin: '#f1c27d', hair: '#111827', hairStyle: 'short', jacket: '#be123c', legs: '#111827', bags: null, phone: false }),
  ];
  const ads = [
    billboardTex(rng, '#e11d48', '#ffffff', ['TIMES', 'SQUARE']),
    billboardTex(rng, '#0ea5e9', '#ffffff', ['BROADWAY', 'MUSICAL']),
    billboardTex(rng, '#f59e0b', '#1a1005', ['NEW YORK', 'CITY']),
    billboardTex(rng, '#7c3aed', '#ffffff', ['TKTS', 'SHOWS']),
    billboardTex(rng, '#059669', '#ffffff', ['HOT DOGS', 'PIZZA']),
    billboardTex(rng, '#db2777', '#ffffff', ['BALL DROP', 'DEC 31']),
    billboardTex(rng, '#dc2626', '#ffffff', ["M&M'S", 'WORLD']),
    billboardTex(rng, '#2563eb', '#ffffff', ['COCA-COLA', 'TASTE IT']),
    billboardTex(rng, '#0891b2', '#ffffff', ['SAMSUNG', 'GALAXY']),
    billboardTex(rng, '#b45309', '#ffffff', ["HERSHEY'S", 'CHOCOLATE']),
    billboardTex(rng, '#be123c', '#ffffff', ['DISNEY', 'STORE']),
    billboardTex(rng, '#4d7c0f', '#ffffff', ['THE LION', 'KING']),
  ];
  const shops = [
    storefrontTex("M&M'S WORLD", '#7f1d1d', '#fde68a'),
    storefrontTex('HERSHEY’S', '#451a03', '#fef3c7'),
    storefrontTex('DISNEY STORE', '#1e3a8a', '#ffffff'),
    storefrontTex('SEPHORA', '#111827', '#ffffff'),
    storefrontTex('STARBUCKS', '#064e3b', '#ffffff'),
    storefrontTex('PIZZA • PRETZELS', '#7c2d12', '#fde68a'),
  ];
  const marquees = [
    marqueeTex('WICKED', '#065f46', '#fef9c3'),
    marqueeTex('LION KING', '#7f1d1d', '#fde68a'),
    marqueeTex('HAMILTON', '#1e293b', '#fde68a'),
  ];
  let ai = 0;
  let mi = 0;
  let si = 0;
  const billboards: Mesh[] = [];
  // All Times Square billboards live in ONE named group, so the tour
  // can hide them per place: at Central Park the park must feel like a
  // park, not a square with adverts over it (Bhanu 2026-11-17 18:17).
  // The boards themselves are untouched - they still show at Times
  // Square, Broadway and everywhere else.
  const billboardGroup = new Group();
  billboardGroup.name = 'timesSquareBillboards';
  for (let z = 20; z > -200; z -= 18) {
    [-24, 24].forEach((x) => {
      // Road carve-outs - no building may stand on a road:
      // west side: the park frontage + West St + Park/Plaza St (z -70..-30)
      if (x === -24 && z >= -70 && z <= -30) return;
      // WTC plaza frontage (z 20): the tall frontage tower at (-24,20)
      // stands right beside the WTC footpath and crowds the One World
      // Trade Center tower out of the arrival view - Bhanu 2026-11-17:
      // the arrival must SHOW the tower, so the plaza stays open.
      if (x === -24 && z === 20) return;
      // east side: Park St + Plaza St mouths (buildings at z=-34,-52 span them)
      if (x === 24 && (z === -34 || z === -52)) return;
      const nearPlaza = z === -52;
      const tallTower = Math.abs(z) % 90 === 20;
      const hgt = nearPlaza
        ? 82 + rng() * 18
        : tallTower
          ? 70 + rng() * 35
          : 26 + rng() * 38;
      const wid = nearPlaza ? 16 + rng() * 3 : 13 + rng() * 6;
      const b = new Mesh(
        new BoxGeometry(wid, hgt, 16),
        new MeshStandardMaterial({
          map: towers[ai++ % towers.length],
          roughness: 0.55,
          metalness: 0.3,
        }),
      );
      b.position.set(x, hgt / 2, z);
      add(b);
      if (rng() < 0.6) {
        const th = 10 + rng() * 18;
        const tw = wid * (0.55 + rng() * 0.2);
        const tower = new Mesh(
          new BoxGeometry(tw, th, 10),
          new MeshStandardMaterial({
            map: towers[ai++ % towers.length],
            roughness: 0.55,
            metalness: 0.3,
          }),
        );
        tower.position.set(x, hgt + th / 2, z);
        add(tower);
        if (nearPlaza) {
          const crown = new Mesh(
            new BoxGeometry(tw * 0.6, 7, 7),
            new MeshStandardMaterial({
              map: towers[ai++ % towers.length],
              roughness: 0.55,
              metalness: 0.3,
            }),
          );
          crown.position.set(x, hgt + th + 3.5, z);
          add(crown);
        }
      }
      const rr = rng();
      const roofMat = new MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });
      if (rr < 0.22) {
        const wt = new Mesh(new CylinderGeometry(1.1, 1.1, 2.4, 10), roofMat);
        wt.position.set(x + (rng() * 4 - 2), hgt + 1.2, z + (rng() * 4 - 2));
        add(wt);
        const wtRoof = new Mesh(new ConeGeometry(1.3, 1.2, 10), roofMat);
        wtRoof.position.set(wt.position.x, hgt + 3, wt.position.z);
        add(wtRoof);
      } else if (rr < 0.38) {
        const ant = new Mesh(new CylinderGeometry(0.08, 0.12, 9 + rng() * 6, 6), roofMat);
        ant.position.set(x, hgt + 5, z);
        add(ant);
      } else if (rr < 0.58) {
        for (let ab = 0; ab < 2; ab++) {
          const ac = new Mesh(new BoxGeometry(1.6, 0.9, 1.6), roofMat);
          ac.position.set(x + (ab ? 3 : -3), hgt + 0.45, z + (ab ? -2 : 2));
          add(ac);
        }
      }
      // glowing shopfront at street level
      const shop = new Mesh(
        new PlaneGeometry(11, 2.8),
        new MeshBasicMaterial({ map: shops[si++ % shops.length] }),
      );
      shop.position.set(x > 0 ? x - wid / 2 - 0.1 : x + wid / 2 + 0.1, 1.6, z);
      shop.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      add(shop);
      // billboards in ONE neat aligned band (y 12)
      if (!nearPlaza && rng() < 0.85) {
        const ad = new Mesh(
          new PlaneGeometry(11, 5.5),
          new MeshBasicMaterial({ map: ads[(ai + (x > 0 ? 1 : 0)) % ads.length] }),
        );
        ad.position.set(x > 0 ? x - wid / 2 - 0.1 : x + wid / 2 + 0.1, 12, z);
        ad.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        billboardGroup.add(ad);
        billboards.push(ad);
      }
      // second billboard band above it (y 20) - the square reads bright
      // and dense from the car, like the reference Times Squares
      if (rng() < 0.7) {
        const ad2 = new Mesh(
          new PlaneGeometry(11, 5.5),
          new MeshBasicMaterial({ map: ads[(ai + (x > 0 ? 3 : 1)) % ads.length] }),
        );
        ad2.position.set(x > 0 ? x - wid / 2 - 0.1 : x + wid / 2 + 0.1, 20, z);
        ad2.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        billboardGroup.add(ad2);
        billboards.push(ad2);
      }
    });
  }
  // theatre marquees on the Broadway (east) frontage, facing the avenue
  [-44, -52, -60].forEach((z) => {
    const mq = new Mesh(
      new PlaneGeometry(9, 3.4),
      new MeshBasicMaterial({ map: marquees[mi++ % marquees.length] }),
    );
    mq.position.set(20, 5.2, z);
    mq.rotation.y = -Math.PI / 2;
    billboardGroup.add(mq);
    billboards.push(mq);
  });
  // big Times Square billboard wall at the plaza (z = -78)
  const big = new Mesh(
    new PlaneGeometry(40, 18),
    new MeshBasicMaterial({ map: billboardTex(rng, '#e11d48', '#ffffff', ['TIMES SQUARE', 'NEW YORK']) }),
  );
  big.position.set(0, 15, -78);
  billboardGroup.add(big);
  billboards.push(big);
  const bigTop = new Mesh(
    new PlaneGeometry(30, 8),
    new MeshBasicMaterial({ map: billboardTex(rng, '#0ea5e9', '#ffffff', ['COCA-COLA']) }),
  );
  bigTop.position.set(0, 28, -78);
  billboardGroup.add(bigTop);
  billboards.push(bigTop);
  const big2 = new Mesh(
    new PlaneGeometry(20, 9),
    new MeshBasicMaterial({ map: billboardTex(rng, '#0ea5e9', '#ffffff', ['BROADWAY']) }),
  );
  big2.position.set(-26, 12, -70);
  big2.rotation.y = Math.PI / 4;
  billboardGroup.add(big2);
  const big3 = new Mesh(
    new PlaneGeometry(18, 8),
    new MeshBasicMaterial({ map: billboardTex(rng, '#7c3aed', '#ffffff', ['TKTS SHOWS']) }),
  );
  big3.position.set(26, 12, -70);
  big3.rotation.y = -Math.PI / 4;
  billboardGroup.add(big3);
  billboards.push(big3);
  // third tier on the big wall + angled side wings, so the square glows
  const bigMid = new Mesh(
    new PlaneGeometry(24, 7),
    new MeshBasicMaterial({ map: billboardTex(rng, '#7c3aed', '#ffffff', ['WICKED', 'MUSICAL']) }),
  );
  bigMid.position.set(0, 38, -78);
  billboardGroup.add(bigMid);
  billboards.push(bigMid);
  const wingL = new Mesh(
    new PlaneGeometry(16, 8),
    new MeshBasicMaterial({ map: billboardTex(rng, '#0891b2', '#ffffff', ['SAMSUNG']) }),
  );
  wingL.position.set(-30, 22, -74);
  wingL.rotation.y = Math.PI / 4;
  billboardGroup.add(wingL);
  billboards.push(wingL);
  const wingR = new Mesh(
    new PlaneGeometry(16, 8),
    new MeshBasicMaterial({ map: billboardTex(rng, '#be123c', '#ffffff', ['DISNEY']) }),
  );
  wingR.position.set(30, 22, -74);
  wingR.rotation.y = -Math.PI / 4;
  billboardGroup.add(wingR);
  billboards.push(wingR);
  add(billboardGroup);
  // diagonal Broadway crossing stripes on the plaza (flat paint on the
  // road - the car rolls over them; the road layout does not change)
  for (let d = -3; d <= 3; d++) {
    const dstripe = new Mesh(new PlaneGeometry(1.3, 6), stripeMat);
    dstripe.rotation.x = -Math.PI / 2;
    dstripe.rotation.z = Math.PI / 4;
    dstripe.position.set(d * 2.2, 0.045, -60);
    add(dstripe);
  }
  // hot dog stand on the east sidewalk by the TKTS steps
  const hotDog = new Group();
  hotDog.name = 'hotDogStand';
  const cartBody = new Mesh(
    new BoxGeometry(1.3, 1.0, 0.9),
    new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
  );
  cartBody.position.y = 0.7;
  hotDog.add(cartBody);
  const cartStripe = new Mesh(
    new BoxGeometry(1.32, 0.25, 0.92),
    new MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 }),
  );
  cartStripe.position.y = 0.95;
  hotDog.add(cartStripe);
  const poleMat = new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]].forEach(([px, pz]) => {
    const pole = new Mesh(new CylinderGeometry(0.03, 0.03, 0.7, 6), poleMat);
    pole.position.set(px, 1.55, pz);
    hotDog.add(pole);
  });
  const canopy = new Mesh(
    new BoxGeometry(1.5, 0.08, 1.1),
    new MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }),
  );
  canopy.position.y = 1.9;
  hotDog.add(canopy);
  const hdSign = new Mesh(
    new PlaneGeometry(1.2, 0.4),
    new MeshBasicMaterial({ map: billboardTex(rng, '#f59e0b', '#1a1005', ['HOT DOGS']) }),
  );
  hdSign.position.set(-0.66, 1.35, 0);
  hdSign.rotation.y = -Math.PI / 2;
  hotDog.add(hdSign);
  hotDog.position.set(11, 0, -54);
  add(hotDog);
  // TKTS red steps (Broadway), east of East St
  const stepMat = new MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
  [0, 1, 2].forEach((s) => {
    const step = new Mesh(new BoxGeometry(6 - s * 1.2, 0.5, 3 - s * 0.6), stepMat);
    step.position.set(23, 0.25 + s * 0.5, -52);
    add(step);
  });
  // distant Midtown skyline
  const silTex = towerTex(rng, '#2e2456', '#4a3580', 0.55);
  const silMat = new MeshStandardMaterial({ map: silTex, roughness: 0.9 });
  for (let dz = -215; dz > -280; dz -= 18) {
    [-70, -40, -12, 18, 48, 78].forEach((dx) => {
      const sh = 30 + rng() * 45;
      const sil = new Mesh(new BoxGeometry(16 + rng() * 10, sh, 14), silMat);
      sil.position.set(dx, sh / 2, dz + rng() * 8);
      add(sil);
    });
  }
  // Empire-State-like spire + blinking beacon
  const spireBase = new Mesh(new BoxGeometry(9, 12, 9), silMat);
  spireBase.position.set(-52, 66, -240);
  add(spireBase);
  const spire = new Mesh(new CylinderGeometry(0.6, 2.2, 26, 8), silMat);
  spire.position.set(-52, 85, -240);
  add(spire);
  const spireTip = new Mesh(
    new SphereGeometry(0.9, 10, 8),
    new MeshBasicMaterial({ color: 0xff4444 }),
  );
  spireTip.name = 'spireTip';
  spireTip.position.set(-52, 99, -240);
  add(spireTip);

  // ---- Central Park (north of Park St) ----
  const addTree = (x: number, z: number, s: number) => {
    const trunk = new Mesh(
      new CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s, 6),
      new MeshStandardMaterial({ color: 0x5b3a29, roughness: 1 }),
    );
    trunk.position.set(x, 0.8 * s, z);
    add(trunk);
    const top = new Mesh(
      new SphereGeometry(1.4 * s, 10, 8),
      new MeshStandardMaterial({ color: 0x2d6a4f, roughness: 1 }),
    );
    top.position.set(x, 2.4 * s, z);
    add(top);
  };
  const lawn = new Mesh(
    new PlaneGeometry(36, 28),
    new MeshStandardMaterial({ color: 0x2f7a3d, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(-37, 0.03, -56);
  add(lawn);
  const pond = new Mesh(
    new CircleGeometry(5, 20),
    new MeshStandardMaterial({ color: 0x3b82c4, roughness: 0.2, metalness: 0.3 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-40, 0.05, -58);
  add(pond);
  [
    [-50, -48], [-44, -60], [-38, -48], [-30, -62], [-48, -66],
    [-26, -50], [-34, -66], [-52, -56], [-42, -44], [-28, -56],
  ].forEach((p) => addTree(p[0], p[1], 0.9 + rng() * 0.5));

  // ---- Statue of Liberty viewpoint (Battery promenade, south) ----
  const prom = new Mesh(
    new PlaneGeometry(90, 18),
    new MeshStandardMaterial({ color: 0x5b5f6e, roughness: 1 }),
  );
  prom.rotation.x = -Math.PI / 2;
  prom.position.set(0, 0.03, 35);
  add(prom);
  const water = new Mesh(
    new PlaneGeometry(320, 150),
    new MeshStandardMaterial({ color: 0x1d4e6b, roughness: 0.15, metalness: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.04, 120);
  add(water);
  [[-16, 28], [-30, 32], [16, 28], [30, 32], [-38, 40], [38, 40]].forEach((p) => {
    addTree(p[0], p[1], 1.1);
  });
  [[-10, 42], [12, 42]].forEach((p) => {
    const bench = new Mesh(
      new BoxGeometry(2.4, 0.5, 0.8),
      new MeshStandardMaterial({ color: 0x7c4a21, roughness: 1 }),
    );
    bench.position.set(p[0], 0.35, p[1]);
    add(bench);
  });
  const island = new Mesh(
    new CylinderGeometry(17, 19, 2.5, 24),
    new MeshStandardMaterial({ color: 0x8a7f6a, roughness: 1 }),
  );
  island.position.set(0, 1.25, 96);
  add(island);
  const islandTop = new Mesh(
    new CylinderGeometry(15, 15, 0.4, 24),
    new MeshStandardMaterial({ color: 0x4d7c5f, roughness: 1 }),
  );
  islandTop.position.set(0, 2.7, 96);
  add(islandTop);
  // the statue - stylised silhouette on its island (scaled 1.5x)
  const statueGroup = new Group();
  statueGroup.name = 'statueLiberty';
  const patina = new MeshStandardMaterial({ color: 0x6fae9e, roughness: 0.6, metalness: 0.35 });
  const stone = new MeshStandardMaterial({ color: 0xb8a888, roughness: 0.9 });
  const pedestal = new Mesh(new BoxGeometry(8, 10, 8), stone);
  pedestal.position.set(0, 5, 0);
  statueGroup.add(pedestal);
  const robe = new Mesh(new CylinderGeometry(1.6, 2.6, 8, 12), patina);
  robe.position.set(0, 14, 0);
  statueGroup.add(robe);
  const shoulders = new Mesh(new CylinderGeometry(1.5, 1.7, 2.2, 12), patina);
  shoulders.position.set(0, 18.6, 0);
  statueGroup.add(shoulders);
  const head = new Mesh(new SphereGeometry(1.15, 12, 10), patina);
  head.position.set(0, 20.5, 0);
  statueGroup.add(head);
  for (let ci = 0; ci < 7; ci++) {
    const spike = new Mesh(new ConeGeometry(0.22, 1.4, 6), patina);
    const ang = (ci / 7) * Math.PI * 2;
    spike.position.set(Math.cos(ang) * 1.15, 21.7, Math.sin(ang) * 1.15);
    spike.rotation.z = -Math.cos(ang) * 0.7;
    spike.rotation.x = Math.sin(ang) * 0.7;
    statueGroup.add(spike);
  }
  const arm = new Mesh(new CylinderGeometry(0.35, 0.45, 5.5, 8), patina);
  arm.position.set(2.4, 21.6, 0);
  arm.rotation.z = -0.6;
  statueGroup.add(arm);
  const torchCup = new Mesh(
    new CylinderGeometry(0.5, 0.35, 1.2, 8),
    new MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }),
  );
  torchCup.position.set(4.1, 24.3, 0);
  statueGroup.add(torchCup);
  const flame = new Mesh(
    new SphereGeometry(0.9, 10, 8),
    new MeshBasicMaterial({ color: 0xffd166 }),
  );
  flame.name = 'statueFlame';
  flame.position.set(4.1, 25.5, 0);
  statueGroup.add(flame);
  const torchLight = new PointLight(0xffd166, 0.8, 40);
  torchLight.position.set(4.1, 25.5, 0);
  statueGroup.add(torchLight);
  const armL = new Mesh(new CylinderGeometry(0.32, 0.42, 3.5, 8), patina);
  armL.position.set(-2.2, 18.6, 0);
  armL.rotation.z = 0.5;
  statueGroup.add(armL);
  const tablet = new Mesh(new BoxGeometry(1.4, 2, 0.25), stone);
  tablet.position.set(-3.4, 17.3, 0);
  tablet.rotation.z = 0.2;
  statueGroup.add(tablet);
  statueGroup.position.set(0, 2.9, 96);
  statueGroup.scale.setScalar(1.5);
  add(statueGroup);
  // skyline across the water
  const acrossTex = towerTex(rng, '#1a1436', '#2a2050', 0.3);
  const acrossMat = new MeshStandardMaterial({ map: acrossTex, roughness: 0.9 });
  [-60, -35, -12, 14, 38, 62].forEach((dx) => {
    const ah = 18 + rng() * 30;
    const at = new Mesh(new BoxGeometry(14 + rng() * 8, ah, 12), acrossMat);
    at.position.set(dx, ah / 2, 150 + rng() * 10);
    add(at);
  });
  // harbour ferry
  const ferry = new Group();
  ferry.name = 'ferry';
  const fbody = new Mesh(
    new BoxGeometry(3, 1.6, 9),
    new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
  );
  fbody.position.y = 1;
  ferry.add(fbody);
  const fcab = new Mesh(
    new BoxGeometry(2.4, 1.2, 5),
    new MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }),
  );
  fcab.position.y = 2.4;
  ferry.add(fcab);
  ferry.position.set(-80, 0.1, 68);
  add(ferry);

  // ---- traffic: taxis + bus on the avenue (named, animated by the system) ----
  // 14 taxis now, not 10 (Bhanu 2026-11-17 18:17): a little more life on
  // the roads at Times Square and Central Park. They still hide while
  // she is on foot - the earlier fix for a taxi crossing Chitti's face.
  const yellow = new MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.4 });
  for (let i = 0; i < 14; i++) {
    const t = new Group();
    t.name = `taxi${i}`;
    const body = new Mesh(new BoxGeometry(1.8, 0.6, 3.6), yellow);
    body.position.y = 0.6;
    t.add(body);
    const top = new Mesh(
      new BoxGeometry(1.6, 0.5, 1.8),
      new MeshStandardMaterial({ color: 0x111827 }),
    );
    top.position.set(0, 1.1, -0.2);
    t.add(top);
    const sign = new Mesh(
      new BoxGeometry(0.5, 0.18, 0.3),
      new MeshBasicMaterial({ color: 0xfff7cc }),
    );
    sign.position.set(0, 1.45, -0.2);
    t.add(sign);
    const dir = i % 2 === 0 ? 1 : -1;
    t.userData.dir = dir;
    t.userData.speed = 9 + (i % 6) * 1.5;
    t.position.set(dir > 0 ? 4.5 : -4.5, 0, -20 - ((i * 32) % 170));
    if (dir < 0) t.rotation.y = Math.PI;
    add(t);
  }
  // two parked cars at the curb by the square (static, off the drive line)
  const parkedCols = [0x111827, 0xdc2626];
  [[6.5, -45, 0], [-6.5, -75, 1]].forEach(([px, pz, ci], k) => {
    const pc = new Group();
    pc.name = `parked${k}`;
    const pbody = new Mesh(
      new BoxGeometry(1.8, 0.6, 3.6),
      new MeshStandardMaterial({ color: parkedCols[ci], metalness: 0.4, roughness: 0.4 }),
    );
    pbody.position.y = 0.6;
    pc.add(pbody);
    const ptop = new Mesh(
      new BoxGeometry(1.6, 0.5, 1.8),
      new MeshStandardMaterial({ color: 0x111827 }),
    );
    ptop.position.set(0, 1.1, -0.2);
    pc.add(ptop);
    pc.position.set(px, 0, pz);
    add(pc);
  });
  const bus = new Group();
  bus.name = 'bus';
  const bbody = new Mesh(
    new BoxGeometry(2.6, 2.6, 10),
    new MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.3, roughness: 0.5 }),
  );
  bbody.position.y = 1.6;
  bus.add(bbody);
  const bwin = new Mesh(
    new BoxGeometry(2.7, 0.8, 9),
    new MeshStandardMaterial({ color: 0x0e7490, metalness: 0.6, roughness: 0.2 }),
  );
  bwin.position.y = 2.1;
  bus.add(bwin);
  bus.userData.dir = 1;
  bus.userData.speed = 7;
  bus.position.set(-4.5, 0, -120);
  add(bus);

  // ---- traffic lights ----
  const trafficLights: { lamps: Mesh[]; phase: number }[] = [];
  [-18, -58, -98].forEach((tz) => {
    [-8.6, 8.6].forEach((tx) => {
      const pole = new Mesh(
        new CylinderGeometry(0.1, 0.1, 5.4, 8),
        new MeshStandardMaterial({ color: 0x1f2937 }),
      );
      pole.position.set(tx, 2.7, tz);
      add(pole);
      const box = new Mesh(
        new BoxGeometry(0.7, 1.9, 0.5),
        new MeshStandardMaterial({ color: 0x111111 }),
      );
      box.position.set(tx, 5.2, tz);
      add(box);
      const lampCols = [0xef4444, 0xf59e0b, 0x22c55e];
      const lamps = lampCols.map((c, li) => {
        const l = new Mesh(
          new SphereGeometry(0.2, 8, 8),
          new MeshBasicMaterial({ color: c }),
        );
        l.name = 'trafficLamp';
        l.position.set(tx, 5.75 - li * 0.55, tz + (tx > 0 ? -0.28 : 0.28));
        add(l);
        return l;
      });
      trafficLights.push({ lamps, phase: rng() * 6 });
    });
  });
  // NOTE: only plain numbers go in userData - object refs (meshes) do not
  // survive the asset clone, so the system finds lamps by name instead.
  city.userData.trafficLightPhases = trafficLights.map((t) => t.phase);
  city.userData.billboards = billboards;

  // ---- street lights ----
  for (let lz = 16; lz > -180; lz -= 28) {
    [-9, 9].forEach((x) => {
      const pole = new Mesh(
        new CylinderGeometry(0.12, 0.12, 7, 8),
        new MeshStandardMaterial({ color: 0x222222 }),
      );
      pole.position.set(x, 3.5, lz);
      add(pole);
      const lamp = new Mesh(
        new SphereGeometry(0.45, 10, 8),
        new MeshBasicMaterial({ color: 0xffe9a8 }),
      );
      lamp.position.set(x, 7.1, lz);
      add(lamp);
      // soft halo so the lamp reads as glowing at dusk
      const halo = new Mesh(
        new SphereGeometry(0.8, 10, 8),
        new MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.12 }),
      );
      halo.position.set(x, 7.1, lz);
      add(halo);
    });
  }

  // ---- people ----
  const crowd: Mesh[] = [];
  const addPerson = (
    texIdx: number,
    x: number,
    z: number,
    dir: number,
    speed: number,
    still: boolean,
    faceYaw: number | null,
    y?: number,
  ) => {
    const p = new Mesh(
      new PlaneGeometry(0.78, 2.0),
      new MeshBasicMaterial({
        map: peopleTex[texIdx % peopleTex.length],
        transparent: true,
        alphaTest: 0.12,
        side: DoubleSide,
      }),
    );
    const scale = 0.85 + rng() * 0.2;
    p.scale.set(scale, scale, scale);
    // y defaults to ground level; the observation-deck people pass
    // y=26 so they stand on the raised platform, not 25 m below it
    const baseY = y ?? 1.0 * scale;
    p.position.set(x, baseY, z);
    p.userData = {
      phase: rng() * 6,
      dir,
      speed,
      still,
      faceYaw,
      baseY,
    };
    p.name = `crowd-${crowd.length}`;
    add(p);
    crowd.push(p);
    return p;
  };
  for (let pi = 0; pi < 6; pi++) {
    const pside = pi % 2 ? -1 : 1;
    const pz = 8 - pi * 20 - rng() * 6;
    const pdir = pi % 2 ? 1 : -1;
    const pspeed = 0.5 + rng() * 0.4;
    addPerson(pi * 2, pside * (10.8 + rng()), pz, pdir, pspeed, false, null);
    addPerson(pi * 2 + 1, pside * (11.7 + rng()), pz + 0.4, pdir, pspeed, false, null);
  }
  for (let wi = 0; wi < 32; wi++) {
    const side = wi % 2 ? -1 : 1;
    addPerson(
      wi,
      side * (10.5 + rng() * 3.2),
      10 - rng() * 135,
      side > 0 ? -1 : 1,
      0.5 + rng() * 0.8,
      false,
      null,
    );
  }
  // photographers at the plaza, phones up at the big screens
  addPerson(2, -7, -52, 0, 0, true, Math.PI);
  addPerson(4, 8, -56, 0, 0, true, Math.PI);
  addPerson(2, 11, -66, 0, 0, true, Math.PI * 0.85);
  addPerson(4, -11, -64, 0, 0, true, Math.PI * 1.15);
  // a little more life at the square (Bhanu 2026-11-17 18:17): two more
  // walkers on the plaza sidewalks and two more people watching the big
  // screens - the square should feel busy, not empty
  addPerson(6, -11.5, -58, -1, 0.6, false, null);
  addPerson(7, 11.5, -62, 1, 0.55, false, null);
  addPerson(0, -9, -70, 0, 0, true, Math.PI * 0.9);
  addPerson(3, 9, -72, 0, 0, true, Math.PI);
  // people at the statue viewpoint, looking at the statue - ON the
  // Battery promenade (z 26..44), never in the water: the harbour water
  // starts at z=45, so the old spots (z 46-50) stood ON the water.
  // Bhanu 2026-11-17 18:17. They stand along the promenade's south
  // edge, clear of Chitti's spot (-12,40) and of the bridge walkway
  // (x 8..20, z 40..44) - the old z 30-38 spots sat 2 m from the
  // walkway footpath and a static figure blocked the bridge picture.
  addPerson(1, -7, 41, 0, 0, true, 0);
  addPerson(5, 2, 42, 0, 0, true, 0);
  addPerson(3, 7, 41, 0, 0, true, 0);
  // a little life in the park (Bhanu 2026-11-17 18:17): people enjoying
  // the lawn - by the pond, on the grass, under the trees. They stand
  // (still) so they stay on the lawn; two more walkers pass on the
  // park-frontage sidewalk like the avenue walkers above.
  addPerson(1, -40, -54, 0, 0, true, 0);
  addPerson(4, -30, -50, 0, 0, true, Math.PI * 0.5);
  addPerson(6, -46, -62, 0, 0, true, -Math.PI * 0.5);
  addPerson(2, -34, -64, 0, 0, true, 0);
  addPerson(5, -50, -50, 0, 0, true, Math.PI * 0.25);
  addPerson(0, -11.5, -50, 1, 0.5, false, null);
  addPerson(3, -12.5, -58, -1, 0.55, false, null);
  city.userData.crowd = crowd;

  // plaza lights
  const plazaLight = new PointLight(0xff9a5c, 0.9, 60);
  plazaLight.position.set(0, 12, -60);
  add(plazaLight);
  const plazaLight2 = new PointLight(0x38bdf8, 0.7, 50);
  plazaLight2.position.set(0, 10, -78);
  add(plazaLight2);

  // ---- Times Square pedestrian island: a raised pad between the
  // avenue lanes (x -4..4, z -71..-63) where Chitti stands in front of
  // her after arriving - off the road, with a kerb, bollards and
  // planters so it reads as a plaza, not asphalt
  const islandPad = new Mesh(
    new PlaneGeometry(8, 8),
    new MeshStandardMaterial({ color: 0x4b4f5e, roughness: 0.9 }),
  );
  islandPad.rotation.x = -Math.PI / 2;
  islandPad.position.set(0, 0.025, -67);
  add(islandPad);
  const kerbMat = new MeshStandardMaterial({ color: 0x9aa0ae, roughness: 0.8 });
  [
    { w: 8, d: 0.3, x: 0, z: -71 },
    { w: 8, d: 0.3, x: 0, z: -63 },
    { w: 0.3, d: 8, x: -4, z: -67 },
    { w: 0.3, d: 8, x: 4, z: -67 },
  ].forEach(({ w, d, x, z }) => {
    const kerb = new Mesh(new BoxGeometry(w, 0.12, d), kerbMat);
    kerb.position.set(x, 0.06, z);
    add(kerb);
  });
  // bollards with glowing tops at the pad's north corners
  [-3.2, 3.2].forEach((x) => {
    const b = new Mesh(
      new CylinderGeometry(0.12, 0.14, 0.9, 10),
      new MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.4 }),
    );
    b.position.set(x, 0.45, -70.2);
    add(b);
    const cap = new Mesh(
      new SphereGeometry(0.13, 10, 8),
      new MeshBasicMaterial({ color: 0xffd166 }),
    );
    cap.position.set(x, 0.95, -70.2);
    add(cap);
  });
  // planters with green topiary at the pad's south corners
  [-3.2, 3.2].forEach((x) => {
    const box = new Mesh(
      new BoxGeometry(0.9, 0.5, 0.9),
      new MeshStandardMaterial({ color: 0x3f3a35, roughness: 0.9 }),
    );
    box.position.set(x, 0.25, -63.8);
    add(box);
    const top = new Mesh(
      new SphereGeometry(0.45, 10, 8),
      new MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.9 }),
    );
    top.position.set(x, 0.85, -63.8);
    add(top);
  });
  // benches facing the island, on the sidewalks clear of the side streets
  [-11.5, 11.5].forEach((x) => {
    const benchMat = new MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.85 });
    const seat = new Mesh(new BoxGeometry(2.2, 0.12, 0.6), benchMat);
    seat.position.set(x, 0.45, -58);
    add(seat);
    const back = new Mesh(new BoxGeometry(2.2, 0.7, 0.1), benchMat);
    back.position.set(x, 0.85, -57.7);
    add(back);
  });
  // planters flanking the Battery promenade benches
  [-6, 6].forEach((x) => {
    const box = new Mesh(
      new BoxGeometry(0.9, 0.5, 0.9),
      new MeshStandardMaterial({ color: 0x3f3a35, roughness: 0.9 }),
    );
    box.position.set(x, 0.25, 42);
    add(box);
    const top = new Mesh(
      new SphereGeometry(0.45, 10, 8),
      new MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.9 }),
    );
    top.position.set(x, 0.85, 42);
    add(top);
  });

  // ---- denser skyline: a second ring of taller towers behind the avenue
  // frontage (x +/-44), so the city reads deep from the car. Never on a
  // road: the west ring skips the park frontage (z -70..-30), and the ring
  // stays north of the promenade (z < 0).
  for (let z = -10; z > -200; z -= 24) {
    [-44, 44].forEach((x) => {
      if (x === -44 && z >= -70 && z <= -30) return;
      const nearSquare = z >= -84 && z <= -36;
      const h = nearSquare ? 70 + rng() * 30 : 55 + rng() * 55;
      const w = 13 + rng() * 5;
      const b = new Mesh(
        new BoxGeometry(w, h, 14),
        new MeshStandardMaterial({
          map: towers[ai++ % towers.length],
          roughness: 0.55,
          metalness: 0.3,
        }),
      );
      b.position.set(x, h / 2, z);
      add(b);
      if (h > 100) {
        const crown = new Mesh(
          new BoxGeometry(w * 0.5, 5, 7),
          new MeshStandardMaterial({
            color: 0xf59e0b,
            roughness: 0.6,
            emissive: 0x92400e,
            emissiveIntensity: 0.4,
          }),
        );
        crown.position.set(x, h + 2.5, z);
        add(crown);
      }
    });
  }

  // ---- Empire State Building (named landmark) ----
  const empire = new Group();
  empire.name = 'empireState';
  const limestone = new MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.75, metalness: 0.1 });
  const limeTex = new MeshStandardMaterial({
    map: towerTex(rng, '#cfc4a8', '#e8dfc8', 0.5),
    roughness: 0.75,
  });
  const esShaft = new Mesh(new BoxGeometry(20, 55, 20), limeTex);
  esShaft.position.y = 27.5;
  empire.add(esShaft);
  const esSet1 = new Mesh(new BoxGeometry(15, 20, 15), limestone);
  esSet1.position.y = 65;
  empire.add(esSet1);
  const esSet2 = new Mesh(new BoxGeometry(11, 15, 11), limestone);
  esSet2.position.y = 82.5;
  empire.add(esSet2);
  const esCrown = new Mesh(new BoxGeometry(7, 8, 7), limestone);
  esCrown.position.y = 94;
  empire.add(esCrown);
  const esSpire = new Mesh(new CylinderGeometry(0.5, 1.5, 18, 8), silMat);
  esSpire.position.y = 107;
  empire.add(esSpire);
  const esBeacon = new Mesh(
    new SphereGeometry(0.8, 8, 8),
    new MeshBasicMaterial({ color: 0xff4444 }),
  );
  esBeacon.position.y = 116;
  empire.add(esBeacon);
  empire.position.set(-56, 0, -150);
  empire.scale.setScalar(1.25);
  add(empire);

  // ---- Chrysler Building (named landmark): art-deco crown + spire ----
  const chrysler = new Group();
  chrysler.name = 'chrysler';
  const steel = new MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.25 });
  const chrysTex = new MeshStandardMaterial({
    map: towerTex(rng, '#2a3446', '#3d4c66', 0.55),
    roughness: 0.6,
    metalness: 0.3,
  });
  const cShaft = new Mesh(new BoxGeometry(16, 60, 16), chrysTex);
  cShaft.position.y = 30;
  chrysler.add(cShaft);
  const crownSteps: Array<[number, number, number]> = [
    [7, 9, 64],
    [5.5, 8, 72],
    [4, 7, 79],
  ];
  crownSteps.forEach(([rTop, h, y]) => {
    const step = new Mesh(new CylinderGeometry(rTop, rTop + 1.5, h, 8), steel);
    step.position.y = y;
    chrysler.add(step);
  });
  const cSpire = new Mesh(new CylinderGeometry(0.3, 1.2, 14, 8), steel);
  cSpire.position.y = 90;
  chrysler.add(cSpire);
  chrysler.position.set(56, 0, -110);
  chrysler.scale.setScalar(1.25);
  add(chrysler);

  // ---- Brooklyn Bridge (named landmark) over the harbour water ----
  const bridge = new Group();
  bridge.name = 'brooklynBridge';
  const deckMat = new MeshStandardMaterial({ color: 0x374151, roughness: 0.8 });
  const bridgeStone = new MeshStandardMaterial({ color: 0x9c8e7a, roughness: 0.9 });
  const cableMat = new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  const bDeck = new Mesh(new BoxGeometry(170, 1.4, 9), deckMat);
  bDeck.position.set(0, 8, 0);
  bridge.add(bDeck);
  // two stone towers with pointed (Gothic) caps
  [-32, 32].forEach((tx) => {
    [-2.2, 2.2].forEach((dz) => {
      const col = new Mesh(new BoxGeometry(3, 30, 3), bridgeStone);
      col.position.set(tx, 15, dz);
      bridge.add(col);
    });
    const cap = new Mesh(new BoxGeometry(9, 2, 8), bridgeStone);
    cap.position.set(tx, 31, 0);
    bridge.add(cap);
    const peak = new Mesh(new ConeGeometry(4.5, 7, 4), bridgeStone);
    peak.position.set(tx, 35.5, 0);
    peak.rotation.y = Math.PI / 4;
    bridge.add(peak);
  });
  // main cables: tower top down to the midspan low point and back up
  const cableBetween = (
    a: [number, number, number],
    b: [number, number, number],
    r: number,
  ) => {
    const va = new Vector3(a[0], a[1], a[2]);
    const vb = new Vector3(b[0], b[1], b[2]);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const m = new Mesh(new CylinderGeometry(r, r, len, 6), cableMat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    bridge.add(m);
  };
  [-4.4, 4.4].forEach((dz) => {
    cableBetween([-32, 32, dz], [0, 12, dz], 0.18);
    cableBetween([0, 12, dz], [32, 32, dz], 0.18);
    // vertical suspenders from the cable down to the deck
    [-16, 16].forEach((sx) => {
      const sus = new Mesh(new CylinderGeometry(0.08, 0.08, 14, 4), cableMat);
      sus.position.set(sx, 15, dz);
      bridge.add(sus);
    });
  });
  // Bhanu 2026-11-17 18:17: the span sat at z=130, and from the Liberty
  // arrival footpath its deck cut straight across the statue's pedestal.
  // It now stands at z=170, behind the island and the far skyline - the
  // statue has a clear view, and the bridge still reads from DUMBO and
  // the bridge walkway as the big span across the harbour.
  bridge.position.set(0, 0, 170);
  add(bridge);

  // ---- One World Trade Center (her DUMBO picture's skyline) ----
  // The tall blue-glass tower in the background of her DUMBO picture:
  // a tapered square glass tower with a spire, the tallest in America.
  // Bhanu 2026-11-17: the arrival must SHOW the tower. It stands at
  // the south-west end of the Battery promenade (x -25, z 45), 28 m
  // from her footpath spot (-12,20) and ~28° right of the southbound
  // drive in, so it is ahead-right of her on arrival, in view - the
  // drive is routed in from the north (see beginDriveTo) for exactly
  // this. Two memorial pools sit at its feet, north and south.
  const wtc = new Group();
  wtc.name = 'oneWorldTrade';
  const wtcGlass = new MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.15,
    metalness: 0.65,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.25,
  });
  const wtcBase = new MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.6, metalness: 0.3 });
  const podium = new Mesh(new BoxGeometry(14, 8, 14), wtcBase);
  podium.position.y = 4;
  wtc.add(podium);
  // tapered square tower: 4-sided cylinder, narrower at the top,
  // turned 45° so its flat faces meet the streets
  const tower = new Mesh(
    new CylinderGeometry(6.5, 10, 118, 4, 1),
    wtcGlass,
  );
  tower.rotation.y = Math.PI / 4;
  tower.position.y = 8 + 59;
  wtc.add(tower);
  // glass fins up the corners, catching the light like the real tower
  for (let c = 0; c < 4; c++) {
    const fin = new Mesh(
      new BoxGeometry(0.5, 118, 0.5),
      new MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.1,
        metalness: 0.8,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.3,
      }),
    );
    const ang = (c / 4) * Math.PI * 2 + Math.PI / 4;
    fin.position.set(Math.cos(ang) * 8.2, 67, Math.sin(ang) * 8.2);
    wtc.add(fin);
  }
  // the spire on top
  const wtcSpire = new Mesh(
    new CylinderGeometry(0.4, 1.2, 26, 8),
    new MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.8 }),
  );
  wtcSpire.position.y = 8 + 118 + 13;
  wtc.add(wtcSpire);
  const wtcSpireTip = new Mesh(
    new SphereGeometry(0.6, 8, 8),
    new MeshBasicMaterial({ color: 0xef4444 }),
  );
  wtcSpireTip.position.y = 8 + 118 + 26;
  wtc.add(wtcSpireTip);
  // the two memorial pools at its feet (north and south of the podium),
  // dark still water with a pale stone rim - the quiet place to remember
  [-9, 9].forEach((dz) => {
    const rim = new Mesh(
      new BoxGeometry(5.6, 0.12, 5.6),
      new MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 }),
    );
    rim.position.set(0, 0.06, dz);
    wtc.add(rim);
    const pool = new Mesh(
      new BoxGeometry(5, 0.3, 5),
      new MeshStandardMaterial({
        color: 0x0c2d4d,
        roughness: 0.05,
        metalness: 0.6,
      }),
    );
    pool.position.set(0, 0.15, dz);
    wtc.add(pool);
  });
  wtc.position.set(-25, 0, 45);
  add(wtc);

  // ---- Grand Central Terminal concourse INTERIOR (her picture) ----
  // A grand hall at the grand node (16,-50): cream marble floor, cream
  // walls, a flat teal ceiling with gold constellations, the famous
  // four-faced brass clock on a pedestal in the centre, ticket windows
  // and departure boards on the east wall, a staircase, chandeliers and
  // people. The car drives in through the south arch on East St, stops
  // at the node, and leaves through the north arch; she steps out onto
  // the marble floor at the west side (12,-50) and faces the clock.
  const grand = new Group();
  grand.name = 'grandCentral';
  const gcStone = new MeshStandardMaterial({ color: 0xd6c9a8, roughness: 0.8 });
  const gcDark = new MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.3 });
  const gcTeal = new MeshStandardMaterial({ color: 0x0f766e, roughness: 0.7 });
  const gcGold = new MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
  const gcBrass = new MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 0.8 });
  // marble floor (a thin plane so the car rolls over it without clipping)
  const gcFloor = new Mesh(
    new PlaneGeometry(20, 20),
    new MeshStandardMaterial({ map: marbleTex(rng), roughness: 0.35, metalness: 0.1 }),
  );
  gcFloor.rotation.x = -Math.PI / 2;
  gcFloor.position.set(0, 0.005, 0);
  grand.add(gcFloor);
  // flat teal ceiling with gold constellation dots and lines
  const gcCeil = new Mesh(new PlaneGeometry(20, 20), gcTeal);
  gcCeil.rotation.x = Math.PI / 2;
  gcCeil.position.set(0, 13, 0);
  grand.add(gcCeil);
  const gcGoldDot = new MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xaa8800,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.6,
  });
  const starPts: Array<[number, number]> = [];
  for (let i = 0; i < 46; i++) starPts.push([(rng() - 0.5) * 18, (rng() - 0.5) * 18]);
  starPts.forEach(([sx, sz]) => {
    const dot = new Mesh(new SphereGeometry(0.09, 6, 6), gcGoldDot);
    dot.position.set(sx, 12.9, sz);
    grand.add(dot);
  });
  for (let i = 0; i < 7; i++) {
    const a = starPts[i * 5];
    const b = starPts[i * 5 + 2];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const line = new Mesh(new CylinderGeometry(0.02, 0.02, len, 4), gcGoldDot);
    line.rotation.z = Math.PI / 2;
    line.rotation.y = -Math.atan2(dz, dx);
    line.position.set((a[0] + b[0]) / 2, 12.92, (a[1] + b[1]) / 2);
    grand.add(line);
  }
  // chandeliers: gold rings with warm glowing bulbs, hanging from the ceiling
  [-5, 0, 5].forEach((cx) => {
    const rod = new Mesh(new CylinderGeometry(0.03, 0.03, 1.6, 6), gcGold);
    rod.position.set(cx, 12.2, 0);
    grand.add(rod);
    const ring = new Mesh(new TorusGeometry(0.55, 0.05, 8, 20), gcGold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 11.4, 0);
    grand.add(ring);
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const bulb = new Mesh(
        new SphereGeometry(0.09, 8, 8),
        new MeshBasicMaterial({ color: 0xffe9a8 }),
      );
      bulb.position.set(cx + Math.cos(ang) * 0.55, 11.4, Math.sin(ang) * 0.55);
      grand.add(bulb);
    }
  });
  // warm interior lights (the hall is enclosed; the sky domes are hidden by it)
  const gcLight1 = new PointLight(0xffd9a0, 0.9, 30);
  gcLight1.position.set(0, 11, 0);
  grand.add(gcLight1);
  const gcLight2 = new PointLight(0xffd9a0, 0.6, 25);
  gcLight2.position.set(-6, 10, 0);
  grand.add(gcLight2);
  // walls: west (with a big arched entrance to the avenue), north and
  // south (each with an arched opening for East St, the road through).
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new Mesh(new BoxGeometry(w, h, d), gcStone);
    m.position.set(x, y, z);
    grand.add(m);
    return m;
  };
  // west wall: segments either side of a 6-wide, 8-tall entrance arch
  wall(0.5, 13, 7, -10, 6.5, -6.5);
  wall(0.5, 13, 7, -10, 6.5, 6.5);
  wall(0.5, 5, 6, -10, 10.5, 0);
  // north + south walls: segments either side of a 7-wide, 5-tall road arch
  [-10, 10].forEach((wz) => {
    wall(6.5, 13, 0.5, -6.75, 6.5, wz);
    wall(6.5, 13, 0.5, 6.75, 6.5, wz);
    wall(7, 8, 0.5, 0, 9, wz);
  });
  // east wall: the grand facade (beige, 3 arched dusk windows, the clock
  // high on the wall) + corner segments filling the gaps beside it
  const facade = new Group();
  const gcFacade = new Mesh(new BoxGeometry(2, 14, 16), gcStone);
  gcFacade.position.set(0, 7, 0);
  facade.add(gcFacade);
  [-5, 0, 5].forEach((dz) => {
    const win = new Mesh(new BoxGeometry(0.2, 8, 2.5), gcDark);
    win.position.set(-1.05, 7, dz);
    facade.add(win);
  });
  const gcDoor = new Mesh(new BoxGeometry(0.3, 5, 4), new MeshStandardMaterial({ color: 0x3f2d20, roughness: 0.7 }));
  gcDoor.position.set(-1.05, 2.5, 0);
  facade.add(gcDoor);
  const gcClock = new Group();
  const clockBody = new Mesh(
    new CylinderGeometry(1.4, 1.4, 0.4, 20),
    new MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 0.8 }),
  );
  clockBody.rotation.z = Math.PI / 2;
  gcClock.add(clockBody);
  const clockFace = new Mesh(
    new CircleGeometry(1.2, 20),
    new MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 }),
  );
  clockFace.position.set(-0.22, 0, 0);
  clockFace.rotation.y = -Math.PI / 2;
  gcClock.add(clockFace);
  const clockHand = new Mesh(new BoxGeometry(0.02, 0.8, 0.06), new MeshBasicMaterial({ color: 0x1f2937 }));
  clockHand.position.set(-0.25, 0.3, 0);
  clockHand.rotation.x = 0.5;
  gcClock.add(clockHand);
  const clockHand2 = new Mesh(new BoxGeometry(0.02, 0.5, 0.06), new MeshBasicMaterial({ color: 0x1f2937 }));
  clockHand2.position.set(-0.25, 0, 0.2);
  clockHand2.rotation.z = -0.8;
  gcClock.add(clockHand2);
  gcClock.position.set(-1.2, 11, 0);
  facade.add(gcClock);
  facade.position.set(9, 0, 0);
  grand.add(facade);
  wall(0.5, 13, 2, 10, 6.5, -9);
  wall(0.5, 13, 2, 10, 6.5, 9);
  // the famous four-faced clock on a brass pedestal, centre of the hall
  const infoClock = new Group();
  const clockPedestal = new Mesh(new CylinderGeometry(0.45, 0.6, 1.4, 12), gcBrass);
  clockPedestal.position.y = 0.7;
  infoClock.add(clockPedestal);
  const clockBox = new Mesh(new BoxGeometry(1.1, 0.9, 1.1), gcBrass);
  clockBox.position.y = 1.85;
  infoClock.add(clockBox);
  for (let f = 0; f < 4; f++) {
    const face = new Mesh(
      new CircleGeometry(0.34, 16),
      new MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 }),
    );
    const ang = (f / 4) * Math.PI * 2;
    face.position.set(Math.sin(ang) * 0.56, 1.85, Math.cos(ang) * 0.56);
    face.rotation.y = ang;
    infoClock.add(face);
    const hand = new Mesh(new BoxGeometry(0.02, 0.2, 0.02), new MeshBasicMaterial({ color: 0x1f2937 }));
    hand.position.set(Math.sin(ang) * 0.58, 1.9, Math.cos(ang) * 0.58);
    hand.rotation.y = ang;
    hand.rotation.x = 0.4;
    infoClock.add(hand);
  }
  const clockTop = new Mesh(new SphereGeometry(0.18, 10, 10), gcGold);
  clockTop.position.y = 2.45;
  infoClock.add(clockTop);
  infoClock.position.set(4, 0, 0);
  grand.add(infoClock);
  // ticket windows + departure boards along the east wall
  const boardTex = canvasTex(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#facc15';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 18; c++) {
        if (rng() < 0.75) ctx.fillRect(8 + c * 13, 10 + r * 16, 9, 5);
      }
    }
  });
  [-6, -2, 2, 6].forEach((tz) => {
    const win = new Mesh(new BoxGeometry(0.15, 1.6, 1.4), gcDark);
    win.position.set(7.9, 1.6, tz);
    grand.add(win);
    const frame = new Mesh(new BoxGeometry(0.1, 1.8, 1.6), gcGold);
    frame.position.set(7.95, 1.6, tz);
    grand.add(frame);
  });
  [-4, 4].forEach((tz) => {
    const board = new Mesh(
      new PlaneGeometry(3.4, 1.3),
      new MeshBasicMaterial({ map: boardTex }),
    );
    board.rotation.y = -Math.PI / 2;
    board.position.set(7.9, 3.8, tz);
    grand.add(board);
  });
  // grand staircase on the west side, gold railings
  for (let s = 0; s < 4; s++) {
    const step = new Mesh(
      new BoxGeometry(0.7, 0.3, 3.2),
      new MeshStandardMaterial({ color: 0xe8ddc4, roughness: 0.5 }),
    );
    step.position.set(-8.2 + s * 0.7, 0.15 + s * 0.3, 0);
    grand.add(step);
  }
  [-1.7, 1.7].forEach((rz) => {
    // Bhanu 2026-11-17: the old rails (y 1.5, 3.4 m long, tilted 0.4)
    // crossed the frame as a thick gold bar at eye level in the Grand
    // Central picture. These sit low (y 1.1, 2.6 m, gentle tilt) so
    // they read as stair rails, never as a bar across Chitti's face.
    const rail = new Mesh(new CylinderGeometry(0.04, 0.04, 2.6, 6), gcGold);
    rail.rotation.z = Math.PI / 2 - 0.25;
    rail.position.set(-6.8, 1.1, rz);
    grand.add(rail);
  });
  // people in the hall, looking at the clock and the boards
  // (addPerson takes world coords - the hall sits at world 16,-50)
  addPerson(0, 10, -54, 0, 0, true, Math.PI / 2);
  addPerson(3, 13, -46, 0, 0, true, -Math.PI / 2);
  addPerson(5, 18, -56, 0, 0, true, Math.PI / 2);
  addPerson(1, 22, -47, 0, 0, true, -Math.PI / 2);
  addPerson(6, 11, -44, 0, 0, true, Math.PI / 2);
  addPerson(2, 23, -53, 0, 0, true, -Math.PI / 2);
  grand.position.set(16, 0, -50);
  add(grand);

  // ---- Observation Deck (Bhanu 2026-11-16 22:39) ----
  // A HIGH circular viewing platform on the east sidewalk at the deck
  // node (0,-80), with a glass railing and a telescope. Bhanu
  // 2026-11-17: the old ground-level deck read as a Times Square
  // street - the platform now stands on a 25 m tower (the tour system
  // lowers the whole city 25 m when she arrives, so she steps onto it
  // at ground level), with a ring of shorter Midtown towers around it
  // whose tops stay BELOW her eye level - the skyline below, twilight
  // sky above. The telescope points south at the skyline.
  const deck = new Group();
  deck.name = 'observationDeck';
  // the tower the platform stands on (local y -25..0, so the platform
  // top is at city y 25 and the column's foot is on the street)
  const deckColumn = new Mesh(
    new CylinderGeometry(3.5, 4.2, 25, 20),
    new MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 }),
  );
  deckColumn.position.y = -12.5;
  deck.add(deckColumn);
  const deckFloor = new Mesh(
    new CylinderGeometry(4, 4, 0.05, 24),
    new MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.6 }),
  );
  deckFloor.position.y = 0.025;
  deck.add(deckFloor);
  const deckRail = new Mesh(
    new CylinderGeometry(4, 4, 1.1, 24, 1, true),
    new MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
    }),
  );
  deckRail.position.y = 0.6;
  deck.add(deckRail);
  // a coin telescope on a stand, pointing south at the skyline
  const scopeStand = new Mesh(new CylinderGeometry(0.08, 0.12, 1.0, 8), new MeshStandardMaterial({ color: 0x475569, roughness: 0.5 }));
  scopeStand.position.set(1.5, 0.5, -1);
  deck.add(scopeStand);
  const scope = new Mesh(
    new CylinderGeometry(0.09, 0.12, 0.8, 10),
    new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 }),
  );
  scope.rotation.x = Math.PI / 2 - 0.2;
  scope.position.set(1.5, 1.15, -0.8);
  deck.add(scope);
  deck.position.set(12, 25, -80);
  add(deck);
  // the Midtown skyline BELOW the deck: a ring of shorter towers
  // (tops 12-18 m, all below the 25 m platform) so that from the deck
  // the city spreads out underneath her, like a real observation deck
  const deckSkyTex = towerTex(rng, '#232946', '#3b4371', 0.35);
  const deckSkyMat = new MeshStandardMaterial({ map: deckSkyTex, roughness: 0.9 });
  [
    [-30, -80, 14, 10],
    [55, -80, 18, 10],
    [14, -125, 16, 8],
    [14, -30, 12, 8],
    [-30, -115, 18, 10],
    [50, -115, 14, 10],
    [-30, -45, 12, 10],
    [50, -45, 16, 10],
  ].forEach(([tx, tz, th, tw]) => {
    const t = new Mesh(new BoxGeometry(tw, th, tw), deckSkyMat);
    t.position.set(tx, th / 2, tz);
    add(t);
  });
  // people on the deck, at the railing rim looking out (never in the
  // middle where she and Chitti stand - the old ones blocked a quarter
  // of the frame). They stand on the platform (y 26), facing outward.
  addPerson(3, 15.2, -80, 0, 0, true, Math.PI / 2, 26);
  addPerson(5, 8.8, -80, 0, 0, true, -Math.PI / 2, 26);
  addPerson(1, 12, -76.8, 0, 0, true, 0, 26);

  // ---- Garden Park (Bhanu 2026-11-17 07:41) ----
  // A separate green garden destination of its own, west of West St
  // (x -32..-19, z -60..-40), reached by the garden node (-16,-50) on
  // West St: a green lawn, a stone path from the east gate to a
  // fountain, flower beds in red, pink and yellow, old trees, wooden
  // benches, and a low stone border (open at the east gate). She steps
  // out onto the path by the fountain. NOT part of the World Trade
  // Center - a standalone destination, like Times Square or the Park.
  const garden = new Group();
  garden.name = 'gardenPark';
  const gardenLawn = new Mesh(
    new PlaneGeometry(13, 20),
    new MeshStandardMaterial({ color: 0x4d8a4f, roughness: 1 }),
  );
  gardenLawn.rotation.x = -Math.PI / 2;
  gardenLawn.position.set(-25.75, 0.03, -50);
  garden.add(gardenLawn);
  // stone path from the east gate to the fountain, with a cross path
  const gardenPathMat = new MeshStandardMaterial({ color: 0xd6d3d1, roughness: 1 });
  const gardenPath = new Mesh(new PlaneGeometry(2, 12.5), gardenPathMat);
  gardenPath.rotation.x = -Math.PI / 2;
  gardenPath.position.set(-25.75, 0.04, -50);
  garden.add(gardenPath);
  const gardenCross = new Mesh(new PlaneGeometry(12.5, 2), gardenPathMat);
  gardenCross.rotation.x = -Math.PI / 2;
  gardenCross.position.set(-25.75, 0.04, -50);
  garden.add(gardenCross);
  // the fountain at the centre: stone basin, blue water, a spout
  const basin = new Mesh(
    new CylinderGeometry(1.5, 1.6, 0.5, 16),
    new MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 }),
  );
  basin.position.set(-25.75, 0.25, -50);
  garden.add(basin);
  const fountainWater = new Mesh(
    new CircleGeometry(1.3, 16),
    new MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.3 }),
  );
  fountainWater.rotation.x = -Math.PI / 2;
  fountainWater.position.set(-25.75, 0.48, -50);
  garden.add(fountainWater);
  const spout = new Mesh(
    new CylinderGeometry(0.12, 0.18, 0.9, 8),
    new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6 }),
  );
  spout.position.set(-25.75, 0.9, -50);
  garden.add(spout);
  const spoutTop = new Mesh(
    new SphereGeometry(0.18, 8, 8),
    new MeshBasicMaterial({ color: 0x7dd3fc }),
  );
  spoutTop.position.set(-25.75, 1.4, -50);
  garden.add(spoutTop);
  // flower beds: dark soil with red, pink and yellow blooms
  const flowerCols = [0xef4444, 0xec4899, 0xfacc15, 0xf97316];
  [
    [-22.5, -55],
    [-29, -55],
    [-22.5, -45],
    [-29, -45],
  ].forEach(([bx, bz], bi) => {
    const soil = new Mesh(
      new BoxGeometry(3, 0.25, 1.6),
      new MeshStandardMaterial({ color: 0x3f2d20, roughness: 1 }),
    );
    soil.position.set(bx, 0.12, bz);
    garden.add(soil);
    for (let fi = 0; fi < 8; fi++) {
      const bloom = new Mesh(
        new SphereGeometry(0.14, 8, 6),
        new MeshBasicMaterial({ color: flowerCols[(bi + fi) % flowerCols.length] }),
      );
      bloom.position.set(bx - 1.2 + (fi % 4) * 0.8, 0.38, bz - 0.4 + Math.floor(fi / 4) * 0.8);
      garden.add(bloom);
    }
  });
  // low stone border on the north, south and west sides (east stays
  // open - the gate from West St)
  const borderMat = new MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
  [
    [-25.75, -60, 13, 0.6],
    [-25.75, -40, 13, 0.6],
    [-32, -50, 0.6, 20],
  ].forEach(([bx, bz, w, d]) => {
    const wall = new Mesh(new BoxGeometry(w, 0.5, d), borderMat);
    wall.position.set(bx, 0.25, bz);
    garden.add(wall);
  });
  garden.position.set(0, 0, 0);
  add(garden);
  // old trees at the garden corners + benches facing the fountain
  addTree(-31, -57, 1.3);
  addTree(-31, -43, 1.3);
  addTree(-20.5, -57, 1.0);
  addTree(-20.5, -43, 1.0);
  [
    [-24, -55, Math.PI],
    [-27.5, -45, 0],
  ].forEach(([bx, bz, ry]) => {
    const bench = new Mesh(
      new BoxGeometry(2.4, 0.5, 0.8),
      new MeshStandardMaterial({ color: 0x7c4a21, roughness: 1 }),
    );
    bench.position.set(bx, 0.35, bz);
    bench.rotation.y = ry;
    add(bench);
  });

  // ---- Brooklyn Bridge walkway + DUMBO promenade (her pictures) ----
  // A wooden-plank pedestrian walkway along the promenade's south strip
  // (z 40..44, pedestrian ground, never a road), with railings, two
  // stone gothic towers with suspension cables, and - just north of it -
  // a cobblestone promenade strip and a red-brick warehouse for DUMBO.
  // She stands on it at the bridge and DUMBO arrivals; the big bridge
  // spans the harbour to the south and the river is on both sides.
  const walk = new Group();
  walk.name = 'bridgeWalkway';
  const walkDeck = new Mesh(
    new BoxGeometry(12, 0.05, 4),
    new MeshStandardMaterial({ map: plankTex(rng), roughness: 0.8 }),
  );
  walkDeck.position.y = 0.025;
  walk.add(walkDeck);
  // railings along both long edges
  [-1.9, 1.9].forEach((dz) => {
    const rail = new Mesh(new BoxGeometry(12, 0.08, 0.08), new MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }));
    rail.position.set(0, 1.05, dz);
    walk.add(rail);
    for (let x = -5.5; x <= 5.5; x += 1.1) {
      const post = new Mesh(new BoxGeometry(0.08, 1.0, 0.08), new MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }));
      post.position.set(x, 0.55, dz);
      walk.add(post);
    }
  });
  // two stone gothic towers, one at each end of the walkway: twin
  // columns, a pointed arch between them, and suspension cables
  const walkStone = new MeshStandardMaterial({ color: 0x9c8e7a, roughness: 0.9 });
  const walkCable = new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  [-5.5, 5.5].forEach((tx) => {
    [-1.4, 1.4].forEach((dz) => {
      const col = new Mesh(new BoxGeometry(0.7, 6, 0.7), walkStone);
      col.position.set(tx, 3, dz);
      walk.add(col);
    });
    const beam = new Mesh(new BoxGeometry(0.7, 0.8, 3.5), walkStone);
    beam.position.set(tx, 6.2, 0);
    walk.add(beam);
    const peak = new Mesh(new ConeGeometry(1.6, 1.8, 4), walkStone);
    peak.position.set(tx, 7.4, 0);
    peak.rotation.y = Math.PI / 4;
    walk.add(peak);
    // suspension cables from this tower down to the deck midspan
    [-1.9, 1.9].forEach((dz) => {
      const dir = new Vector3(-Math.sign(tx) * 5.5, -6, dz * 0.4);
      const len = dir.length();
      const cable = new Mesh(new CylinderGeometry(0.05, 0.05, len, 4), walkCable);
      cable.position.set(tx - Math.sign(tx) * 2.75, 3.4, dz * 0.7);
      cable.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
      walk.add(cable);
    });
  });
  walk.position.set(14, 0, 42);
  add(walk);
  // DUMBO: cobblestone promenade strip just north of the walkway
  const cobble = new Mesh(
    new PlaneGeometry(12, 4),
    new MeshStandardMaterial({ map: cobbleTex(rng), roughness: 0.95 }),
  );
  cobble.rotation.x = -Math.PI / 2;
  cobble.position.set(14, 0.005, 38);
  add(cobble);
  // DUMBO: red-brick warehouse on the east side of the promenade
  const warehouse = new Group();
  warehouse.name = 'dumboWarehouse';
  const brick = new MeshStandardMaterial({ color: 0x7f2d1d, roughness: 0.9 });
  const whBody = new Mesh(new BoxGeometry(8, 7, 6), brick);
  whBody.position.y = 3.5;
  warehouse.add(whBody);
  const whRoof = new Mesh(new BoxGeometry(8.4, 0.4, 6.4), new MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 }));
  whRoof.position.y = 7.2;
  warehouse.add(whRoof);
  [-2, 0, 2].forEach((dz) => {
    const win = new Mesh(
      new BoxGeometry(0.2, 2.2, 1.2),
      new MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.3 }),
    );
    win.position.set(-4.05, 4.5, dz);
    warehouse.add(win);
    const win2 = new Mesh(
      new BoxGeometry(0.2, 1.6, 1.0),
      new MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.3 }),
    );
    win2.position.set(-4.05, 1.4, dz);
    warehouse.add(win2);
  });
  warehouse.position.set(26, 0, 38);
  add(warehouse);
  // people on the promenade at DUMBO, looking at the bridge and the river
  addPerson(2, 10, 38, 0, 0, true, 0);
  addPerson(4, 18, 39, 0, 0, true, Math.PI);
  addPerson(1, 22, 37, 0, 0, true, -Math.PI / 2);

  return city;
}
