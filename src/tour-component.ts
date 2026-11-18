/**
 * Travel Agent Tour v2.0 - ECS components (system-free module).
 *
 * TourState mirrors the whole tour state machine as ECS fields, so the
 * tour can be inspected and driven from the CLI (`ecs query`,
 * `ecs set-component`) without playing through it or scripting the page:
 * set `phase`/`place` to jump, set `autotest` to run the self-test.
 */
import { createComponent, Types } from '@iwsdk/core';

export const Phases = {
  cover: 'cover',
  enter: 'enter',
  tutorial: 'tutorial',
  tutdone: 'tutdone',
  choose: 'choose',
  ready: 'ready',
  driving: 'driving',
  getout: 'getout',
  arrived: 'arrived',
  photopick: 'photopick',
  story: 'story',
  thankyou: 'thankyou',
  next: 'next',
  goodbye: 'goodbye',
} as const;

export const Places = {
  start: 'start',
  'times-square': 'times-square',
  'central-park': 'central-park',
  'statue-liberty': 'statue-liberty',
  broadway: 'broadway',
  'grand-central': 'grand-central',
  dumbo: 'dumbo',
  'observation-deck': 'observation-deck',
  'brooklyn-bridge': 'brooklyn-bridge',
  'world-trade-center': 'world-trade-center',
  'garden-park': 'garden-park',
} as const;

export const TourState = createComponent('TourState', {
  phase: { type: Types.Enum, default: Phases.enter, enum: Phases },
  place: { type: Types.Enum, default: Places.start, enum: Places },
  paused: { type: Types.Boolean, default: false },
  driving: { type: Types.Boolean, default: false },
  historyTold: { type: Types.Int32, default: 0 },
  photos: { type: Types.Int32, default: 0 },
  autotest: { type: Types.Boolean, default: false },
  testResult: { type: Types.String, default: '' },
  // self-drive (Bhanu 2026-11-16 22:01): she in the driver seat, Milo
  // on her right in the passenger seat
  selfDriving: { type: Types.Boolean, default: false },
  // tour Journal (Bhanu 2026-11-16 22:06): saved souvenirs + photos,
  // as a short summary ("2: mini Statue of Liberty @ Statue of Liberty")
  journal: { type: Types.String, default: '' },
  // live position (city coords) + heading + city lift, for the CLI and
  // for picture capture: the world aim of a city feature is computed
  // from these (Bhanu 2026-11-17). Mirrored on arrival / when still.
  posX: { type: Types.Float32, default: 0 },
  posZ: { type: Types.Float32, default: 0 },
  headingDeg: { type: Types.Float32, default: 0 },
  cityLiftY: { type: Types.Float32, default: 0 },
  // grab trigger (Bhanu 2026-11-17): set to a souvenir id
  // ('souvenir-cup', 'souvenir-statue', ...) to grab it, the same as a
  // hand pinch - the glowing arc to the Journal ring appears while it
  // is held. For the CLI / picture capture; the app itself never sets it.
  grabSouvenir: { type: Types.String, default: '' },
});

export const TourCar = createComponent('TourCar', {
  speed: { type: Types.Float32, default: 0 },
});
