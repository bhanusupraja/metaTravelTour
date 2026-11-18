/**
 * Travel Agent Tour v2.0 - grab-and-go souvenirs for the photo moment.
 *
 * After she and Chitti step out of the car at a destination, small
 * souvenirs wait on a side table beside her: a camera, a mini Statue of
 * Liberty, a New York coffee cup, a mini Liberty torch, a vintage brass
 * pocket-watch, a polaroid photo, a glowing miniature skyscraper, a
 * miniature Brooklyn Bridge, a miniature One World Trade Center, and a
 * flower bouquet from the Garden Park. She picks one up with her hand (pinch to grab)
 * and the photo is taken while she is holding it - "grab-and-go".
 *
 * The table and the souvenirs are separate scene nodes (world-fixed,
 * beside where she stands after getting out), so each object can carry
 * its own OneHandGrabbable component. The system hides them until the
 * get-out finishes and hides them again when the next drive starts.
 * Each factory returns a Group named after its scene-node id.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

/** Small round side table the souvenirs wait on. */
export function createSouvenirTable(): Group {
  const table = new Group();
  table.name = 'souvenir-table';
  const wood = new MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  const top = new Mesh(new CylinderGeometry(0.38, 0.38, 0.05, 20), wood);
  top.position.y = 0.76;
  table.add(top);
  const leg = new Mesh(new CylinderGeometry(0.04, 0.04, 0.74, 10), wood);
  leg.position.y = 0.38;
  table.add(leg);
  const base = new Mesh(new CylinderGeometry(0.2, 0.24, 0.04, 16), wood);
  base.position.y = 0.02;
  table.add(base);
  return table;
}

/** A small camera to hold in the photo. */
export function createSouvenirCamera(): Group {
  const cam = new Group();
  cam.name = 'souvenir-camera';
  const body = new Mesh(
    new BoxGeometry(0.17, 0.11, 0.07),
    new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.5 }),
  );
  cam.add(body);
  const lens = new Mesh(
    new CylinderGeometry(0.035, 0.04, 0.05, 14),
    new MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.15,
      metalness: 0.6,
      emissive: 0x0369a1,
      emissiveIntensity: 0.5,
    }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.01, -0.055);
  cam.add(lens);
  const flash = new Mesh(
    new BoxGeometry(0.04, 0.02, 0.02),
    new MeshBasicMaterial({ color: 0xfff7cc }),
  );
  flash.position.set(0.05, 0.065, -0.02);
  cam.add(flash);
  return cam;
}

/** A mini Statue of Liberty souvenir. */
export function createSouvenirStatue(): Group {
  const statue = new Group();
  statue.name = 'souvenir-statue';
  const green = new MeshStandardMaterial({
    color: 0x5da9a0,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x2f6f68,
    emissiveIntensity: 0.3,
  });
  // robe: a cone, head: a small sphere, crown spikes: three tiny boxes
  const robe = new Mesh(new ConeGeometry(0.07, 0.2, 12), green);
  robe.position.y = 0.1;
  statue.add(robe);
  const head = new Mesh(new SphereGeometry(0.04, 12, 10), green);
  head.position.y = 0.23;
  statue.add(head);
  [-0.04, 0, 0.04].forEach((x) => {
    const spike = new Mesh(new BoxGeometry(0.012, 0.05, 0.012), green);
    spike.position.set(x, 0.28, 0);
    statue.add(spike);
  });
  // torch: a thin cylinder held up, with a little flame
  const torch = new Mesh(
    new CylinderGeometry(0.008, 0.008, 0.12, 6),
    new MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 }),
  );
  torch.position.set(0.09, 0.2, 0);
  torch.rotation.z = -0.3;
  statue.add(torch);
  const flame = new Mesh(
    new SphereGeometry(0.02, 8, 8),
    new MeshBasicMaterial({ color: 0xfbbf24 }),
  );
  flame.position.set(0.11, 0.27, 0);
  statue.add(flame);
  // a little round base so it stands on the table
  const base = new Mesh(new CylinderGeometry(0.07, 0.08, 0.02, 14), green);
  base.position.y = 0.01;
  statue.add(base);
  return statue;
}

/** A "New York" coffee cup to hold - white cup, light-blue sleeve, dark lid. */
export function createSouvenirCup(): Group {
  const cup = new Group();
  cup.name = 'souvenir-cup';
  const white = new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const body = new Mesh(new CylinderGeometry(0.05, 0.04, 0.14, 14), white);
  body.position.y = 0.07;
  cup.add(body);
  const sleeve = new Mesh(
    new CylinderGeometry(0.052, 0.047, 0.06, 14),
    new MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.6,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
    }),
  );
  sleeve.position.y = 0.07;
  cup.add(sleeve);
  const lid = new Mesh(
    new CylinderGeometry(0.052, 0.052, 0.02, 14),
    new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }),
  );
  lid.position.y = 0.15;
  cup.add(lid);
  return cup;
}

/** A miniature glowing Liberty torch - green handle, golden flame. */
export function createSouvenirTorch(): Group {
  const torch = new Group();
  torch.name = 'souvenir-torch';
  const green = new MeshStandardMaterial({
    color: 0x5da9a0,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x2f6f68,
    emissiveIntensity: 0.3,
  });
  const handle = new Mesh(new CylinderGeometry(0.02, 0.03, 0.18, 10), green);
  handle.position.y = 0.09;
  torch.add(handle);
  const cupTop = new Mesh(new CylinderGeometry(0.045, 0.03, 0.05, 10), green);
  cupTop.position.y = 0.2;
  torch.add(cupTop);
  // the flame glows gold, so the torch reads as the Statue's torch
  const flame = new Mesh(
    new ConeGeometry(0.035, 0.1, 10),
    new MeshBasicMaterial({ color: 0xfbbf24 }),
  );
  flame.position.y = 0.27;
  torch.add(flame);
  const glow = new Mesh(
    new SphereGeometry(0.05, 10, 8),
    new MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.35 }),
  );
  glow.position.y = 0.27;
  torch.add(glow);
  return torch;
}

/** A vintage brass pocket-watch - the Grand Central keepsake. */
export function createSouvenirWatch(): Group {
  const watch = new Group();
  watch.name = 'souvenir-watch';
  const brass = new MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x78350f,
    emissiveIntensity: 0.3,
  });
  // the case: a flat brass disc, face up
  const case_ = new Mesh(new CylinderGeometry(0.07, 0.07, 0.02, 20), brass);
  case_.position.y = 0.01;
  watch.add(case_);
  // the face: a cream disc on top
  const face = new Mesh(
    new CylinderGeometry(0.06, 0.06, 0.005, 20),
    new MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 }),
  );
  face.position.y = 0.022;
  watch.add(face);
  // the hands: two thin dark boxes
  const hour = new Mesh(new BoxGeometry(0.006, 0.002, 0.035), new MeshBasicMaterial({ color: 0x1f2937 }));
  hour.position.set(0, 0.026, -0.012);
  hour.rotation.y = 0.6;
  watch.add(hour);
  const minute = new Mesh(new BoxGeometry(0.004, 0.002, 0.05), new MeshBasicMaterial({ color: 0x1f2937 }));
  minute.position.set(0.012, 0.026, 0.008);
  minute.rotation.y = -0.9;
  watch.add(minute);
  // the crown (winder) and the bow loop on top
  const crown = new Mesh(new CylinderGeometry(0.012, 0.012, 0.015, 8), brass);
  crown.position.set(0, 0.01, 0.08);
  crown.rotation.x = Math.PI / 2;
  watch.add(crown);
  const bow = new Mesh(new TorusGeometry(0.018, 0.005, 6, 14), brass);
  bow.position.set(0, 0.02, 0.095);
  watch.add(bow);
  return watch;
}

/** A polaroid photo of the bridge - the DUMBO keepsake. */
export function createSouvenirPolaroid(): Group {
  const polaroid = new Group();
  polaroid.name = 'souvenir-polaroid';
  const white = new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  // the white frame, standing up
  const frame = new Mesh(new BoxGeometry(0.14, 0.16, 0.008), white);
  frame.position.y = 0.08;
  polaroid.add(frame);
  // the photo: a sky-blue panel with a tiny bridge silhouette
  const photo = new Mesh(
    new BoxGeometry(0.12, 0.1, 0.004),
    new MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.4 }),
  );
  photo.position.set(0, 0.1, 0.006);
  polaroid.add(photo);
  const deck = new Mesh(
    new BoxGeometry(0.1, 0.008, 0.002),
    new MeshBasicMaterial({ color: 0x78350f }),
  );
  deck.position.set(0, 0.07, 0.009);
  polaroid.add(deck);
  [-0.035, 0.035].forEach((x) => {
    const tower = new Mesh(
      new BoxGeometry(0.008, 0.05, 0.002),
      new MeshBasicMaterial({ color: 0x78350f }),
    );
    tower.position.set(x, 0.09, 0.009);
    polaroid.add(tower);
  });
  return polaroid;
}

/** A glowing miniature skyscraper (Empire State) - the Observation Deck keepsake. */
export function createSouvenirSkyscraper(): Group {
  const tower = new Group();
  tower.name = 'souvenir-skyscraper';
  const gold = new MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0xb45309,
    emissiveIntensity: 0.6,
  });
  const glow = new MeshBasicMaterial({ color: 0xfde68a });
  // stepped tower, tapering up like the Empire State Building
  const base = new Mesh(new BoxGeometry(0.12, 0.06, 0.12), gold);
  base.position.y = 0.03;
  tower.add(base);
  const mid = new Mesh(new BoxGeometry(0.09, 0.12, 0.09), gold);
  mid.position.y = 0.12;
  tower.add(mid);
  const top = new Mesh(new BoxGeometry(0.06, 0.1, 0.06), gold);
  top.position.y = 0.23;
  tower.add(top);
  const spire = new Mesh(new ConeGeometry(0.02, 0.08, 8), glow);
  spire.position.y = 0.32;
  tower.add(spire);
  const tipGlow = new Mesh(
    new SphereGeometry(0.04, 10, 8),
    new MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.35 }),
  );
  tipGlow.position.y = 0.32;
  tower.add(tipGlow);
  return tower;
}

/** A miniature One World Trade Center tower - blue glass, tapered,
 *  with a spire, like the tower in her DUMBO picture. */
export function createSouvenirWtc(): Group {
  const wtc = new Group();
  wtc.name = 'souvenir-wtc';
  const glass = new MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.15,
    metalness: 0.6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.5,
  });
  const base = new Mesh(new BoxGeometry(0.12, 0.04, 0.12), glass);
  base.position.y = 0.02;
  wtc.add(base);
  const shaft = new Mesh(new CylinderGeometry(0.045, 0.07, 0.26, 4), glass);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.y = 0.17;
  wtc.add(shaft);
  const spire = new Mesh(new CylinderGeometry(0.006, 0.015, 0.1, 6), new MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.8 }));
  spire.position.y = 0.35;
  wtc.add(spire);
  return wtc;
}

/** A miniature Brooklyn Bridge on a base - the Bridge walkway keepsake. */
export function createSouvenirBridge(): Group {
  const bridge = new Group();
  bridge.name = 'souvenir-bridge';
  const stone = new MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.7 });
  const wood = new MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  // the base
  const base = new Mesh(new BoxGeometry(0.22, 0.015, 0.08), wood);
  base.position.y = 0.008;
  bridge.add(base);
  // the deck
  const deck = new Mesh(new BoxGeometry(0.2, 0.008, 0.05), new MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 }));
  deck.position.y = 0.03;
  bridge.add(deck);
  // two stone towers with a top beam each
  [-0.07, 0.07].forEach((x) => {
    const tower = new Mesh(new BoxGeometry(0.02, 0.09, 0.04), stone);
    tower.position.set(x, 0.08, 0);
    bridge.add(tower);
    const beam = new Mesh(new BoxGeometry(0.03, 0.015, 0.04), stone);
    beam.position.set(x, 0.13, 0);
    bridge.add(beam);
  });
  // the cables: two thin golden lines, sloping from the towers to the deck ends
  [-1, 1].forEach((s) => {
    const cable = new Mesh(
      new CylinderGeometry(0.002, 0.002, 0.11, 4),
      new MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    cable.position.set(s * 0.1, 0.09, 0);
    cable.rotation.z = s * 0.5;
    bridge.add(cable);
  });
  return bridge;
}

/** A small flower bouquet from the Garden Park - the garden keepsake. */
export function createSouvenirBouquet(): Group {
  const bouquet = new Group();
  bouquet.name = 'souvenir-bouquet';
  const green = new MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
  const ribbon = new MeshStandardMaterial({ color: 0xec4899, roughness: 0.5 });
  // green stems, tied together
  for (let i = 0; i < 5; i++) {
    const stem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.22, 6), green);
    const a = (i / 5) * Math.PI * 2;
    stem.position.set(Math.cos(a) * 0.02, 0.11, Math.sin(a) * 0.02);
    stem.rotation.z = Math.cos(a) * 0.12;
    stem.rotation.x = -Math.sin(a) * 0.12;
    bouquet.add(stem);
  }
  // the ribbon wrap at the stems
  const wrap = new Mesh(new CylinderGeometry(0.045, 0.03, 0.06, 10), ribbon);
  wrap.position.y = 0.05;
  bouquet.add(wrap);
  // the blooms: red, pink and yellow, in a little bunch on top
  const bloomCols = [0xef4444, 0xec4899, 0xfacc15, 0xf97316, 0xef4444];
  bloomCols.forEach((c, i) => {
    const a = (i / 5) * Math.PI * 2;
    const bloom = new Mesh(
      new SphereGeometry(0.045, 10, 8),
      new MeshBasicMaterial({ color: c }),
    );
    bloom.position.set(Math.cos(a) * 0.05, 0.24, Math.sin(a) * 0.05);
    bouquet.add(bloom);
  });
  const centre = new Mesh(
    new SphereGeometry(0.05, 10, 8),
    new MeshBasicMaterial({ color: 0xfacc15 }),
  );
  centre.position.y = 0.28;
  bouquet.add(centre);
  return bouquet;
}

/** A miniature Times Square ball - the glowing New Year's Eve ball on
 *  its little pole, gold and bright like the one dropped at midnight. */
export function createSouvenirBall(): Group {
  const ball = new Group();
  ball.name = 'souvenir-ball';
  const gold = new MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.5,
    emissive: 0xb45309,
    emissiveIntensity: 0.7,
  });
  const pole = new Mesh(
    new CylinderGeometry(0.008, 0.008, 0.16, 6),
    new MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 }),
  );
  pole.position.y = 0.08;
  ball.add(pole);
  const base = new Mesh(
    new CylinderGeometry(0.04, 0.05, 0.02, 12),
    new MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 }),
  );
  base.position.y = 0.01;
  ball.add(base);
  const globe = new Mesh(new SphereGeometry(0.06, 14, 12), gold);
  globe.position.y = 0.22;
  ball.add(globe);
  const glow = new Mesh(
    new SphereGeometry(0.08, 12, 10),
    new MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.3 }),
  );
  glow.position.y = 0.22;
  ball.add(glow);
  return ball;
}

/** A little park tree - a brown trunk with two green cones, Central Park. */
export function createSouvenirTree(): Group {
  const tree = new Group();
  tree.name = 'souvenir-tree';
  const trunk = new Mesh(
    new CylinderGeometry(0.018, 0.025, 0.12, 8),
    new MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }),
  );
  trunk.position.y = 0.06;
  tree.add(trunk);
  const green = new MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
  const lower = new Mesh(new ConeGeometry(0.09, 0.14, 10), green);
  lower.position.y = 0.18;
  tree.add(lower);
  const upper = new Mesh(new ConeGeometry(0.065, 0.12, 10), green);
  upper.position.y = 0.28;
  tree.add(upper);
  return tree;
}

/** A miniature subway train - silver car with a blue stripe and windows. */
export function createSouvenirTrain(): Group {
  const train = new Group();
  train.name = 'souvenir-train';
  const silver = new MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.3,
    metalness: 0.7,
  });
  const body = new Mesh(new BoxGeometry(0.22, 0.08, 0.07), silver);
  body.position.y = 0.07;
  train.add(body);
  const stripe = new Mesh(
    new BoxGeometry(0.22, 0.02, 0.072),
    new MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }),
  );
  stripe.position.y = 0.05;
  train.add(stripe);
  const windowMat = new MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0x0369a1,
    emissiveIntensity: 0.4,
  });
  [-0.07, 0, 0.07].forEach((x) => {
    const win = new Mesh(new BoxGeometry(0.045, 0.035, 0.004), windowMat);
    win.position.set(x, 0.085, 0.037);
    train.add(win);
  });
  const wheelMat = new MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  [-0.08, 0.08].forEach((x) => {
    [-0.03, 0.03].forEach((z) => {
      const wheel = new Mesh(new CylinderGeometry(0.018, 0.018, 0.01, 10), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.018, z);
      train.add(wheel);
    });
  });
  return train;
}

/** A little ferry boat - brown hull, white sail, for the DUMBO waterfront. */
export function createSouvenirBoat(): Group {
  const boat = new Group();
  boat.name = 'souvenir-boat';
  const hull = new Mesh(
    new BoxGeometry(0.2, 0.05, 0.07),
    new MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }),
  );
  hull.position.y = 0.025;
  boat.add(hull);
  const bow = new Mesh(
    new ConeGeometry(0.035, 0.07, 4),
    new MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }),
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0.13, 0.025, 0);
  boat.add(bow);
  const mast = new Mesh(
    new CylinderGeometry(0.006, 0.006, 0.16, 6),
    new MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 }),
  );
  mast.position.y = 0.13;
  boat.add(mast);
  const sail = new Mesh(
    new BoxGeometry(0.004, 0.11, 0.09),
    new MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }),
  );
  sail.position.set(0.03, 0.15, 0);
  sail.rotation.z = -0.15;
  boat.add(sail);
  return boat;
}

/** A miniature telescope on a tripod - the Observation Deck keepsake. */
export function createSouvenirTelescope(): Group {
  const scope = new Group();
  scope.name = 'souvenir-telescope';
  const dark = new MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.35,
    metalness: 0.6,
  });
  const tube = new Mesh(new CylinderGeometry(0.025, 0.03, 0.2, 12), dark);
  tube.rotation.z = Math.PI / 2 - 0.6;
  tube.position.set(0, 0.2, 0);
  scope.add(tube);
  const lens = new Mesh(
    new CylinderGeometry(0.032, 0.032, 0.02, 12),
    new MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.15,
      metalness: 0.6,
      emissive: 0x0369a1,
      emissiveIntensity: 0.5,
    }),
  );
  lens.rotation.z = Math.PI / 2 - 0.6;
  lens.position.set(0.085, 0.25, 0);
  scope.add(lens);
  const legMat = new MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new Mesh(new CylinderGeometry(0.006, 0.006, 0.16, 6), legMat);
    leg.position.set(Math.cos(a) * 0.035, 0.08, Math.sin(a) * 0.035);
    leg.rotation.z = Math.cos(a) * 0.4;
    leg.rotation.x = -Math.sin(a) * 0.4;
    scope.add(leg);
  }
  return scope;
}

/** A miniature reflecting pool - flat blue water with a lighter centre,
 *  like the memorial pools at the World Trade Center. */
export function createSouvenirPool(): Group {
  const pool = new Group();
  pool.name = 'souvenir-pool';
  const rim = new Mesh(
    new BoxGeometry(0.2, 0.015, 0.14),
    new MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }),
  );
  rim.position.y = 0.008;
  pool.add(rim);
  const water = new Mesh(
    new BoxGeometry(0.17, 0.01, 0.11),
    new MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.1,
      metalness: 0.4,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5,
    }),
  );
  water.position.y = 0.016;
  pool.add(water);
  return pool;
}

/** A potted flower - terracotta pot with green stems and bright blooms,
 *  for the Garden Park. */
export function createSouvenirPlant(): Group {
  const plant = new Group();
  plant.name = 'souvenir-plant';
  const pot = new Mesh(
    new CylinderGeometry(0.05, 0.035, 0.08, 12),
    new MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 }),
  );
  pot.position.y = 0.04;
  plant.add(pot);
  const green = new MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
  [-0.015, 0.015].forEach((x) => {
    const stem = new Mesh(new CylinderGeometry(0.005, 0.005, 0.1, 6), green);
    stem.position.set(x, 0.12, 0);
    plant.add(stem);
  });
  const bloomCols = [0xec4899, 0xfacc15, 0xef4444];
  bloomCols.forEach((c, i) => {
    const bloom = new Mesh(
      new SphereGeometry(0.025, 8, 8),
      new MeshBasicMaterial({ color: c }),
    );
    bloom.position.set(-0.03 + i * 0.03, 0.18, i % 2 === 0 ? 0.01 : -0.01);
    plant.add(bloom);
  });
  return plant;
}

/** A thin glowing ring marker, used by the system to highlight the table. */
export function createSouvenirRing(): Group {
  const ring = new Group();
  ring.name = 'souvenir-ring';
  const torus = new Mesh(
    new TorusGeometry(0.42, 0.012, 8, 32),
    new MeshBasicMaterial({ color: 0x67e8f9 }),
  );
  torus.rotation.x = Math.PI / 2;
  torus.position.y = 0.02;
  ring.add(torus);
  return ring;
}
