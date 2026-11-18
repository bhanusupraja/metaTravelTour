/**
 * Travel Agent Tour v2.0 - the luxury convertible + Chitti the robot driver.
 *
 * Forward is -Z (Three.js convention). The robot sits IN the driver's
 * seat with both hands on the steering wheel - never standing in the road.
 * The car sits forward of the rider (CAR_HOME in the tour system), so
 * from the passenger seat she looks forward over the front seats and
 * sees Chitti driving ahead-left, hands on the wheel, road ahead -
 * the Screen_3 framing (Bhanu 2026-11-17: "carல లేదు", Chitti was not
 * visible in the car in the ready picture).
 *
 * Named parts (the TourSystem finds them by name - never by index):
 *   steerWheel, robotHead, chitti, wheelFL, wheelFR, wheelRL, wheelRR.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SpotLight,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

export function createTourCar(): Group {
  const car = new Group();
  car.name = 'tour-car';

  // black luxury car (Bhanu, 2026-11-15: "the car is BLACK")
  const paint = new MeshStandardMaterial({
    color: 0x050505,
    metalness: 0.9,
    roughness: 0.25,
  });
  const chrome = new MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 1,
    roughness: 0.15,
  });
  const leather = new MeshStandardMaterial({ color: 0x141416, roughness: 0.75 });

  const body = new Mesh(new BoxGeometry(2.0, 0.55, 4.6), paint);
  body.name = 'carBody';
  body.position.y = 0.62;
  car.add(body);

  // open-top convertible: low windshield, seats, dashboard, wheel.
  const shield = new Mesh(
    new BoxGeometry(1.8, 0.5, 0.06),
    new MeshStandardMaterial({
      color: 0x7dd3fc,
      metalness: 0.4,
      roughness: 0.1,
      transparent: true,
      opacity: 0.35,
    }),
  );
  shield.position.set(0, 1.15, -0.95);
  shield.rotation.x = 0.25;
  car.add(shield);
  // Dashboard: BLACK, like the rest of the car (Bhanu 2026-11-17:
  // "black car" - the old light-grey dash read as a big white box in
  // the forward view). The thin chrome strip along its top edge
  // catches the light, so the dashboard edge still reads clearly
  // against the black hood. Named so the autotest can find it.
  const dash = new Mesh(
    new BoxGeometry(1.8, 0.22, 0.35),
    new MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.55 }),
  );
  dash.name = 'carDash';
  dash.position.set(0, 1.0, -0.75);
  car.add(dash);
  // thin chrome strip along the top of the dash: catches the light, so
  // the dashboard edge reads clearly against the black hood
  const dashTrim = new Mesh(new BoxGeometry(1.8, 0.03, 0.05), chrome);
  dashTrim.position.set(0, 1.12, -0.75);
  car.add(dashTrim);

  // front seats (driver left, passenger right)
  [-0.45, 0.45].forEach((x) => {
    const seat = new Mesh(new BoxGeometry(0.55, 0.55, 0.18), leather);
    seat.position.set(x, 1.0, 0.35);
    seat.rotation.x = 0.15;
    car.add(seat);
    const base = new Mesh(new BoxGeometry(0.55, 0.18, 0.55), leather);
    base.position.set(x, 0.82, 0.55);
    car.add(base);
  });
  // back bench - the rider's seat
  const benchBack = new Mesh(new BoxGeometry(1.1, 0.5, 0.18), leather);
  benchBack.position.set(0, 1.0, 1.35);
  benchBack.rotation.x = 0.15;
  car.add(benchBack);
  const benchBase = new Mesh(new BoxGeometry(1.1, 0.18, 0.6), leather);
  benchBase.position.set(0, 0.82, 1.15);
  car.add(benchBase);

  // steering wheel (driver side) - chrome rim, so it catches the light
  // and reads in the forward view; close enough for Chitti's hands to
  // rest on the rim; turns with the car
  const steerWheel = new Mesh(
    new TorusGeometry(0.26, 0.045, 8, 20),
    chrome,
  );
  steerWheel.name = 'steerWheel';
  steerWheel.position.set(-0.45, 1.18, -0.1);
  steerWheel.rotation.x = 0.9;
  car.add(steerWheel);
  // steering column: dashboard -> wheel hub
  const column = new Mesh(
    new CylinderGeometry(0.04, 0.04, 0.66, 8),
    new MeshStandardMaterial({ color: 0x374151, roughness: 0.6 }),
  );
  column.position.set(-0.45, 1.08, -0.42);
  column.rotation.x = Math.PI / 2 - 0.21;
  car.add(column);

  // Chitti, the robot driver - rebuilt to the reference photo Bhanu sent
  // (2026-11-16, CHITTI_REFERENCE_NEW.png: "robo chitti should be like
  // this one"). Bhanu 2026-11-17 04:38: "the robotics is not good at
  // all. Can you change the robot design? To the one I have shared you."
  // The old build was too tall and humanoid, eyes too small. The
  // reference is a TRUE CHIBI: a VERY big round white head (diameter
  // 0.60 m, ~48% of his 1.25 m height, ~2.3x as wide as his torso),
  // HUGE round bright-blue eyes (the blue iris nearly fills the whole
  // eye, dark pupil, white glint - each eye ~32% of the face width,
  // inner edges nearly touching at the centre), a small subtle smile,
  // light-blue ear discs with silver centres, a compact white capsule
  // torso (much smaller than the head) with a small vertical light-blue
  // chest panel (three segments, like the photo), short stubby arms and
  // legs, blue hands and blue-tipped feet. Every part is a sphere,
  // capsule or rounded disc - friendly and realistic-cute, NOT blocky.
  // Seated in the driver's seat, facing forward (-Z) like a real
  // driver, hands on the wheel at 10 and 2. The car sits forward of
  // the rider, so from the passenger seat you see him ahead-left -
  // head, shoulders and hands on the wheel - with the road ahead.
  // Bright materials plus a warm cabin light keep him clearly visible,
  // never a dark block. Feet bottom out at local y ~0.30, so STAND_Y =
  // -0.30 in the tour system puts his feet on the ground when he
  // stands (head ~1.25 m). His arms are two-segment pivots (shoulder
  // + elbow, named armL/armR/elbowL/elbowR): the tour system poses
  // them - forward to the wheel while he drives, hanging with elbows
  // bent while he stands, like the photo.
  const robot = new Group();
  robot.name = 'chitti';
  // white shell (the reference body/head) + light-blue accents
  const white = new MeshStandardMaterial({
    color: 0xf5f7fa,
    metalness: 0.25,
    roughness: 0.3,
    emissive: 0x475569,
    emissiveIntensity: 0.18,
  });
  const lightBlue = new MeshStandardMaterial({
    color: 0x7dd3fc,
    metalness: 0.3,
    roughness: 0.35,
    emissive: 0x0369a1,
    emissiveIntensity: 0.3,
  });
  const brightBlue = new MeshBasicMaterial({ color: 0x38bdf8 });
  const darkNavy = new MeshBasicMaterial({ color: 0x0f172a });
  const darkGrey = new MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.5,
    roughness: 0.5,
  });
  // compact capsule torso, white - much smaller than the head
  // (0.26 wide vs the 0.60 head, like the photo)
  const torso = new Mesh(new CapsuleGeometry(0.13, 0.06, 6, 12), white);
  torso.position.y = 0.72;
  robot.add(torso);
  // chest panel - the reference's small vertical light-blue chest
  // detail: three short segments stacked, like the photo
  [0.745, 0.78, 0.815].forEach((y) => {
    const seg = new Mesh(
      new BoxGeometry(0.04, 0.018, 0.015),
      new MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.2,
        roughness: 0.3,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
      }),
    );
    seg.position.set(0, y, -0.128);
    robot.add(seg);
  });
  // dark neck ring between body and head
  const neck = new Mesh(new CylinderGeometry(0.045, 0.05, 0.05, 12), darkGrey);
  neck.position.y = 0.9;
  robot.add(neck);
  // VERY big round white head with a cute face - the chibi signature:
  // head diameter 0.60 m, ~48% of his 1.25 m height, ~2.3x torso width
  const head = new Group();
  head.name = 'robotHead';
  const skull = new Mesh(new SphereGeometry(0.3, 28, 20), white);
  head.add(skull);
  // light-blue ear discs on the sides of the head (a signature of the
  // reference), each with a small silver centre
  [-1, 1].forEach((s) => {
    const ear = new Mesh(new CylinderGeometry(0.07, 0.07, 0.035, 16), lightBlue);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.285, 0, 0);
    head.add(ear);
    const earDot = new Mesh(new CylinderGeometry(0.03, 0.03, 0.042, 12), chrome);
    earDot.rotation.z = Math.PI / 2;
    earDot.position.set(s * 0.285, 0, 0);
    head.add(earDot);
  });
  // HUGE round glowing BLUE eyes on the face (-Z side): each eye is
  // ~32% of the face width, inner edges nearly touching at the centre,
  // and the bright-blue iris nearly fills the whole eye - a white
  // eyeball, a bright-blue iris, a dark pupil, a white highlight.
  // Each layer's front sits just ahead of the last, so the blue reads
  // through the white. Bhanu 2026-11-17 07:44: the eyes sat too high
  // and the smile too far below them, so the face had no expression -
  // the eyes sit lower now (y 0.01, right above the smile) and each
  // iris carries a dark outline ring, like her reference photo.
  [-0.105, 0.105].forEach((x) => {
    const eyeball = new Mesh(new SphereGeometry(0.095, 20, 14), white);
    eyeball.position.set(x, 0.01, -0.235);
    head.add(eyeball);
    const iris = new Mesh(new SphereGeometry(0.082, 20, 14), brightBlue);
    iris.name = x < 0 ? 'chitti-iris-l' : 'chitti-iris-r';
    iris.scale.set(1, 1, 0.55);
    iris.position.set(x, 0.01, -0.291);
    head.add(iris);
    // dark outline ring around the iris - the reference photo's eyes
    // are ringed, which is what makes them read as big and cute
    const ring = new Mesh(
      new TorusGeometry(0.084, 0.006, 8, 24),
      darkNavy,
    );
    ring.position.set(x, 0.01, -0.298);
    head.add(ring);
    const pupil = new Mesh(new SphereGeometry(0.032, 14, 10), darkNavy);
    pupil.scale.set(1, 1, 0.55);
    pupil.position.set(x, 0.01, -0.321);
    head.add(pupil);
    const glint = new Mesh(
      new SphereGeometry(0.014, 8, 8),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    // glint on the upper-outer side of each pupil (symmetric) - the old
    // one sat left of both pupils, so his eyes looked sideways and
    // googly, part of the "funny" face she did not like
    glint.position.set(x + Math.sign(x) * 0.015, 0.036, -0.35);
    head.add(glint);
  });
  // small GENTLE smile - a thin, narrow, shallow arc RIGHT below the
  // eyes, like the reference photo's small smile just under the big
  // eyes. Bhanu 2026-11-17 07:44: the old smile sat too far down
  // (y -0.10) and was too small to see, so the face had no expression.
  // This one is bigger (radius 0.052), a touch thicker, and sits close
  // under the eyes (y -0.06) so eyes + smile read as one cute face.
  const smile = new Mesh(
    new TorusGeometry(0.052, 0.008, 8, 16, Math.PI),
    new MeshBasicMaterial({ color: 0x475569 }),
  );
  smile.name = 'chitti-smile';
  smile.position.set(0, -0.06, -0.283);
  smile.rotation.z = Math.PI;
  head.add(smile);
  head.position.set(0, 1.25, 0);
  robot.add(head);
  // Short stubby arms, two segments each (shoulder pivot + elbow
  // pivot, named so the tour system can pose them): while he drives
  // they reach forward to the wheel rim (10 and 2 o'clock); while he
  // stands they hang with the elbows bent, hands forward at hip level,
  // like the photo. White arms, light-blue palms (blue hands).
  [
    { side: 'L', sx: -0.16 },
    { side: 'R', sx: 0.16 },
  ].forEach(({ side, sx }) => {
    const shoulder = new Group();
    shoulder.name = `arm${side}`;
    shoulder.position.set(sx, 0.9, -0.02);
    const upper = new Mesh(new CylinderGeometry(0.042, 0.042, 0.26, 8), white);
    upper.position.set(0, -0.13, 0);
    shoulder.add(upper);
    const elbow = new Group();
    elbow.name = `elbow${side}`;
    elbow.position.set(0, -0.26, 0);
    const fore = new Mesh(new CylinderGeometry(0.038, 0.038, 0.24, 8), white);
    fore.position.set(0, -0.12, 0);
    elbow.add(fore);
    const palm = new Mesh(new SphereGeometry(0.05, 10, 8), lightBlue);
    palm.position.set(0, -0.24, 0);
    elbow.add(palm);
    shoulder.add(elbow);
    robot.add(shoulder);
  });
  // short stubby legs, seated: thighs forward, shins down, light-blue
  // feet. They sit inside the car body when driving and read as legs
  // when he steps out and stands. Feet bottom out at local y ~0.30.
  [-0.085, 0.085].forEach((x) => {
    const thigh = new Mesh(new CapsuleGeometry(0.05, 0.04, 4, 10), white);
    thigh.rotation.x = Math.PI / 2;
    thigh.position.set(x, 0.52, 0.0);
    robot.add(thigh);
    const shin = new Mesh(new CapsuleGeometry(0.045, 0.08, 4, 10), white);
    shin.position.set(x, 0.44, -0.06);
    robot.add(shin);
    const foot = new Mesh(new SphereGeometry(0.055, 10, 8), lightBlue);
    foot.scale.set(1, 0.6, 1.5);
    foot.position.set(x, 0.333, -0.1);
    robot.add(foot);
  });
  robot.position.set(-0.45, 0, 0.35);
  car.add(robot);

  // warm cabin light so Chitti reads clearly from the passenger seat
  const cabin = new PointLight(0xffe9b8, 2.0, 4.0);
  cabin.position.set(0, 1.9, 0.1);
  car.add(cabin);

  // hood, grille, headlights (front = -Z), taillights (rear = +Z)
  const hood = new Mesh(new BoxGeometry(1.9, 0.18, 1.1), paint);
  hood.position.set(0, 0.95, -1.75);
  car.add(hood);
  const grille = new Mesh(new BoxGeometry(1.5, 0.28, 0.08), chrome);
  grille.position.set(0, 0.6, -2.32);
  car.add(grille);
  [-0.65, 0.65].forEach((x) => {
    const h = new Mesh(
      new SphereGeometry(0.14, 10, 8),
      new MeshBasicMaterial({ color: 0xfff7cc }),
    );
    h.position.set(x, 0.68, -2.32);
    car.add(h);
    const t = new Mesh(
      new BoxGeometry(0.3, 0.12, 0.06),
      new MeshBasicMaterial({ color: 0xef4444 }),
    );
    t.position.set(x, 0.68, 2.32);
    car.add(t);
  });
  const beam = new SpotLight(0xfff2b0, 1.2, 40, 0.5, 0.5);
  beam.position.set(0, 0.8, -2.2);
  beam.target.position.set(0, 0, -20);
  car.add(beam);
  car.add(beam.target);

  // wheels - each in a named group so it can spin while driving
  const wheelGeo = new CylinderGeometry(0.38, 0.38, 0.3, 14);
  const wheelMat = new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheelSpots: Array<[string, number, number]> = [
    ['wheelFL', -0.95, -1.5],
    ['wheelFR', 0.95, -1.5],
    ['wheelRL', -0.95, 1.5],
    ['wheelRR', 0.95, 1.5],
  ];
  wheelSpots.forEach(([name, x, z]) => {
    const wg = new Group();
    wg.name = name;
    wg.position.set(x, 0.38, z);
    const w = new Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    wg.add(w);
    const hub = new Mesh(new CylinderGeometry(0.18, 0.18, 0.32, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);
    car.add(wg);
  });

  return car;
}
