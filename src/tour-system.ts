/**
 * Travel Agent Tour v2.0 - the tour system.
 *
 * How it works (plain words):
 * - The rider sits in the passenger seat of the BLACK luxury car, which
 *   never moves. The whole city slides and turns around the car (a
 *   "treadmill"), so the rider stays seated and comfortable, and the
 *   ride feels like driving. The car always faces forward down the road,
 *   and Times Square is ahead of the car. The car is centred on her
 *   head (CAR_HOME), so she sits IN the passenger seat (right) and
 *   Chitti drives on her left, his face in side view beside her -
 *   the Screen_3 framing (Bhanu 2026-11-17: the ready picture showed
 *   only the back of his head, because the car sat 1.5 m ahead of her).
 * - First screen: only the title "Welcome to Travel Tour". After 2
 *   seconds two boxes appear on the same screen - "Start tutorial"
 *   or "Start the game". Tapping a box itself starts the XR session
 *   (there is no Enter XR step). The city and the car appear only
 *   when she starts the game.
 * - The tutorial is Chitti introducing himself and the rules (10-20
 *   seconds): name any place and he shows her all of New York; the
 *   controls are the buttons; the mic on/off lets her talk with him.
 *   Then "Skip tutorial" (back to the main screen) / "Restart tutorial".
 * - The ride starts with the "Start ride" button: she names a place,
 *   Chitti gets in beside her, and she taps Start ride. (The two-hand
 *   circle gesture was removed at her ask, 2026-11-16.)
 * - The car follows a real road graph (avenue + cross streets). It never
 *   cuts across blocks or through buildings - every metre of a drive is
 *   on a road, and every trip takes about 5 seconds. Halfway there,
 *   Chitti tells her what places are nearby. While travelling she can
 *   say "turn left / turn right" and the car turns at the next junction.
 * - When the car arrives, Chitti says "Here is the destination!" and
 *   then she and Chitti step OUT of the car together, within 2 seconds.
 *   She walks from the car to the FOOTPATH beside the road (never on the
 *   road) and Chitti stands in front of her there; the whole car drives
 *   away behind them and is gone. At the destination there is a small
 *   table with the souvenirs from her pictures - a camera, a mini Statue
 *   of Liberty, a New York coffee cup, a mini Liberty torch. She grabs
 *   one with her hand (pinch) and places it anywhere she likes; in the
 *   photo moment the grab holds it for the photo.
 *   After the photo, Chitti says thank you - that closes the visit.
 * - Only AFTER the visit ends (photos + thank-you) does the left/right
 *   choice appear: Chitti suggests a nearby place first ("let's go left
 *   / let's go right") with a small hint showing which hand movement
 *   means left and which means right. Saying or pointing left/right
 *   turns the car that way, on the road.
 * - History is told ONLY when she asks. Chitti the robot stays in the
 *   driver's seat with his hands on the wheel while driving, and stands
 *   beside her at the destination.
 * - One panel shows one thing at a time: the enter screen alone, then
 *   the intro, then "where to go?", then the drive, then one short
 *   story card at a time. Never a big block of information.
 * - Pause freezes the car mid-drive; Resume continues exactly where it
 *   stopped; Stop ends the drive and asks where next.
 * - The agent speaks verified scripted lines only. No open-ended chat,
 *   no personal data, no bookings, no third-party services, fully offline.
 *
 * TourState (ECS) mirrors the state machine so the CLI can inspect and
 * drive it: `ecs query` to read, `ecs set-component` to jump (set phase
 * + place to drive somewhere, set autotest=true to run the self-test).
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  GrabSystem,
  Grabbed,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Quaternion,
  Raycaster,
  TorusGeometry,
  UIKitMLAsset,
  Vector2,
  Vector3,
  createSystem,
  type Entity,
} from '@iwsdk/core';
import { TourCar, TourState } from './tour-component.js';
import type { Model as VoskModel, KaldiRecognizer as VoskRecognizer } from 'vosk-browser';

// ---------- scripted lines (verified facts only, unchanged from v1.5) ----------
// The tutorial intro: Chitti introduces himself and explains the rules,
// 10-20 seconds total. One short line per intro screen; the panel rotates
// through them (5 s each) and each line is spoken as it appears, so the
// speech bubble beside him is the live transcript of what he is saying.
const INTRO_MS = 19000; // the intro runs ~19 seconds, then Skip / Restart appear
const INTRO_LINES = [
  "Hi, my name is Chitti, I'll tell you how to play this game.",
  'Tell me any place, and I\'ll show you all of New York.',
  "These are the controls - press a button for what you want, and I'll do it.",
  'If you want to talk to me, turn the mic on and keep talking with me.',
];
// The greeting when she enters the game - short, one line.
const GREETING = 'Hi, where shall I take you today?';
// After she names a place: no more hand-circle gesture (removed at
// Bhanu's ask, 2026-11-16) - the ride starts with the Start ride button.
const READY_LINE = 'Lovely! Tap Start ride when you are ready.';
// Answering "are there any next places?" - the full list, fixed text so
// it has a voice clip (the per-place list varies, so it cannot).
const NEXT_PLACES_LINE =
  'We can visit Times Square, Central Park, and the Statue of Liberty - and Broadway, Grand Central Terminal, DUMBO, the Observation Deck, the Brooklyn Bridge, the World Trade Center, and the Garden Park too. Which one shall we go to?';
// Grab-and-send to the Journal at a destination (fixed text, so each has
// a voice clip). The mockup line: grab it, hold it, or send it to her
// tour Journal (the glowing ring).
const GRAB_NICE_LINE = 'Nice grab! Hold it or send it to your journal!';
const PLACED_LINE = 'Nice - you put it there! Grab it again any time.';
// Self-drive (Bhanu 2026-11-16 22:01): she sits LEFT in the driver seat
// and Chitti sits on her RIGHT in the passenger seat, chatting and
// guiding. She steers with Turn left / Turn right (buttons or voice);
// "Let Chitti drive" hands the wheel back to him.
const SELFDRIVE_START_LINE = "You're driving! Which way should we go?";
const CHITTI_DRIVE_LINE = "I'll take the wheel - sit back and enjoy the ride!";
// "I'll drive" at a destination (not in a ride yet): pick the next place
// first, then she can drive.
const DRIVE_NEXT_LINE = "Let's pick where to go next first - then you can drive!";
// Mid-drive voice turn (Bhanu 2026-11-16 22:01): Chitti confirms the
// turn out loud and a glowing arrow shows on the road ahead.
const TURN_LEFT_LINE = 'Turning left!';
const TURN_RIGHT_LINE = 'Turning right!';
// Journal (Bhanu 2026-11-16 22:06): her personal travel scrapbook -
// saved souvenirs and photos she can open and look through any time.
const JOURNAL_SAVED_LINE = 'Saved to your Journal! You can look at it any time.';
const JOURNAL_OPEN_LINE = 'Here is your Journal - everything you saved on this tour!';
// The thank-you that closes a visit, after the photos are done.
const THANK_YOU = 'Thank you so much for taking me!';
const THANKYOU_MS = 2500; // thank-you shows ~2.5 s, then the left/right choice
// Getting out: Chitti says "here is the destination" (~2 s), then they
// step out of the car together within 2 seconds.
const GETOUT_WAIT_MS = 2000;
const STEP_OUT_MS = 2000;
const BOARD_MS = 1500; // Chitti gets back in before the next drive
// Where Chitti stands after getting out - city coordinates (the city
// frame: x east, z south, same frame as the road graph), one spot per
// destination, each OFF the road and right before that place:
//   Times Square: west sidewalk, just south of Plaza St
//   Central Park: on the park lawn, at the park entrance
//   Statue of Liberty: Battery promenade, before the statue viewpoint
//   Broadway: east sidewalk, just south of Plaza St
//   World Trade Center: WEST sidewalk, facing the tower (mirrors
//     footpathSpotForHer, so the fallback agrees with the arrival spot)
//   Garden Park: stone path east of the fountain, by the gate (same)
// The old fixed spot (-0.55, -0.75, car frame) sat on the road beside
// the car, so Chitti stood in traffic after every arrival. The spot is
// converted to the car frame with city.localToWorld() at step-out time,
// because the city turns under the car (treadmill) and a fixed car-frame
// point lands on a different piece of ground at each destination.
const STAND_SPOTS: Record<string, { x: number; z: number }> = {
  'times-square': { x: -12, z: -66 },
  'central-park': { x: -22, z: -44 },
  'statue-liberty': { x: -12, z: 40 },
  broadway: { x: 12, z: -66 },
  'grand-central': { x: 12, z: -50 },
  dumbo: { x: 16, z: 42 },
  'observation-deck': { x: 12, z: -80 },
  'brooklyn-bridge': { x: 12, z: 36 },
  'world-trade-center': { x: -12, z: 20 },
  'garden-park': { x: -22, z: -50 },
};
const STAND_SPOT_DEFAULT = STAND_SPOTS['times-square'];
// NEW FLOW (Bhanu 2026-11-16 20:04): on arrival the whole car drives
// away behind them and is GONE - far enough that it is out of sight,
// not parked behind them. It comes back when he asks "shall we go?"
const CAR_AWAY_Z = -25;
const CAR_RETURN_MS = 1500; // the car drives back in after the photos
// Bhanu 2026-11-17 07:41: the ready picture showed only the BACK of
// Chitti's head - the car sat 1.5 m ahead of her (CAR_HOME_Z -1.5), so
// she looked at him from behind, 90° off her forward gaze. The car now
// sits CENTRED on her head (CAR_HOME 0,0): the passenger seat (car-local
// x +0.45, z 0.35) lands exactly under her head (0.45, 1.5, 0.35), so
// she sits IN the passenger seat and Chitti drives 0.9 m to her left at
// the SAME depth - his face in side view, the road ahead over the hood,
// the Screen_3 framing. The treadmill puts the road node at the world
// origin and the car is at the origin. Every place that re-homes the car
// (boarding, step-out, return, seat swap, autotest) uses these two
// constants - never a literal 0 again.
// Self-drive: the car shifts right so the DRIVER seat comes under her
// head - the old shift (+0.45) left the seat 0.45 m left of her head;
// +0.7 puts it 0.2 m left, close enough to read as her driving.
const CAR_HOME_X = 0;
const CAR_HOME_Z = 0;
const SELF_DRIVE_SHIFT = 0.7;
// Chitti's feet sit 0.30 m below his group origin (his foot spheres
// bottom out at local y 0.30), so a standing spot puts his origin 0.30 m
// below the ground or he floats above the pavement.
const STAND_Y = -0.3;
// Left/right point gesture: hold the point for this long to choose.
const POINT_HOLD_MS = 500;
// The souvenirs on the side table at each destination (grab-and-go) -
// exactly the keepsakes from her pictures: the camera, the mini Statue
// of Liberty, the New York coffee cup, the mini Liberty torch, the
// vintage pocket-watch, the polaroid photo, the glowing miniature
// skyscraper, and the miniature Brooklyn Bridge - plus the place
// souvenirs added later (Times Square ball, park tree, train, ferry
// boat, telescope, reflecting pool, potted flower) and the four extra
// mini Liberty statues for the Statue of Liberty table.
const SOUVENIR_IDS = [
  'souvenir-camera',
  'souvenir-statue',
  'souvenir-statue-2',
  'souvenir-statue-3',
  'souvenir-statue-4',
  'souvenir-statue-5',
  'souvenir-cup',
  'souvenir-torch',
  'souvenir-watch',
  'souvenir-polaroid',
  'souvenir-skyscraper',
  'souvenir-bridge',
  'souvenir-wtc',
  'souvenir-bouquet',
  'souvenir-ball',
  'souvenir-tree',
  'souvenir-train',
  'souvenir-boat',
  'souvenir-telescope',
  'souvenir-pool',
  'souvenir-plant',
];
const SOUVENIR_NAMES: Record<string, string> = {
  'souvenir-camera': 'camera',
  'souvenir-statue': 'mini Statue of Liberty',
  'souvenir-statue-2': 'mini Statue of Liberty',
  'souvenir-statue-3': 'mini Statue of Liberty',
  'souvenir-statue-4': 'mini Statue of Liberty',
  'souvenir-statue-5': 'mini Statue of Liberty',
  'souvenir-cup': 'New York coffee cup',
  'souvenir-torch': 'mini Liberty torch',
  'souvenir-watch': 'vintage brass pocket-watch',
  'souvenir-polaroid': 'polaroid photo',
  'souvenir-skyscraper': 'glowing miniature skyscraper',
  'souvenir-bridge': 'miniature Brooklyn Bridge',
  'souvenir-wtc': 'miniature One World Trade Center',
  'souvenir-bouquet': 'flower bouquet',
  'souvenir-ball': 'Times Square ball',
  'souvenir-tree': 'little park tree',
  'souvenir-train': 'miniature train',
  'souvenir-boat': 'little ferry boat',
  'souvenir-telescope': 'miniature telescope',
  'souvenir-pool': 'miniature reflecting pool',
  'souvenir-plant': 'potted flower',
};
// Place-specific souvenir tables (Bhanu 2026-11-17 17:38): the table at
// each destination shows ONLY souvenirs related to THAT place - 2-3 per
// place, except the Statue of Liberty, whose table holds FIVE mini
// Liberty statues (she grabs one for her Journal, the rest stay). The
// New York coffee cup belongs to Central Park. Every place in PLACES
// must have an entry here, or its table would be empty.
const PLACE_SOUVENIRS: Record<string, string[]> = {
  'times-square': ['souvenir-camera', 'souvenir-skyscraper', 'souvenir-ball'],
  'central-park': ['souvenir-cup', 'souvenir-bouquet', 'souvenir-tree'],
  broadway: ['souvenir-camera', 'souvenir-skyscraper'],
  'statue-liberty': [
    'souvenir-statue',
    'souvenir-statue-2',
    'souvenir-statue-3',
    'souvenir-statue-4',
    'souvenir-statue-5',
  ],
  'grand-central': ['souvenir-watch', 'souvenir-train'],
  dumbo: ['souvenir-polaroid', 'souvenir-boat'],
  'observation-deck': ['souvenir-skyscraper', 'souvenir-telescope'],
  'brooklyn-bridge': ['souvenir-bridge', 'souvenir-camera'],
  'world-trade-center': ['souvenir-wtc', 'souvenir-pool'],
  'garden-park': ['souvenir-bouquet', 'souvenir-plant'],
};

type SkyMode = 'day' | 'dusk' | 'sunset' | 'twilight';
const PLACES: Record<
  string,
  { name: string; node: string; short: string; nearby: string[]; sky: SkyMode }
> = {
  'times-square': {
    name: 'Times Square',
    node: 'times',
    short: 'Times Square - the Crossroads of the World.',
    nearby: ['TKTS Steps', 'Broadway Theatres', "New Year's Ball Drop"],
    sky: 'dusk',
  },
  'central-park': {
    name: 'Central Park',
    node: 'park',
    short: 'Central Park - 843 acres of green.',
    nearby: ['Bethesda Terrace', 'The Lake', 'Strawberry Fields'],
    sky: 'day',
  },
  broadway: {
    name: 'Broadway',
    node: 'east40',
    short: 'Broadway - the home of musicals.',
    nearby: ['TKTS Steps', 'Times Square', 'The Lion King Theatre'],
    sky: 'dusk',
  },
  'statue-liberty': {
    name: 'Statue of Liberty',
    node: 'battery',
    short: 'The Statue of Liberty - a gift from France.',
    nearby: ['Battery Park', 'Ellis Island', 'Harbour Ferry'],
    sky: 'day',
  },
  'grand-central': {
    name: 'Grand Central Terminal',
    node: 'grand',
    short: 'Grand Central Terminal - the great hall of New York.',
    nearby: ['The Clock', 'The Whispering Gallery', 'The Celestial Ceiling'],
    sky: 'dusk',
  },
  dumbo: {
    name: 'DUMBO',
    node: 'dumbo',
    short: 'DUMBO - the waterfront under the Brooklyn Bridge.',
    nearby: ['Brooklyn Bridge', 'The East River', 'Washington Street View'],
    sky: 'sunset',
  },
  'observation-deck': {
    name: 'Observation Deck',
    node: 'deck',
    short: 'Observation Deck - high above Midtown.',
    nearby: ['Empire State Building', 'Chrysler Building', 'The Skyline'],
    sky: 'twilight',
  },
  'brooklyn-bridge': {
    name: 'Brooklyn Bridge',
    node: 'bridge',
    short: 'Brooklyn Bridge - the great East River crossing.',
    nearby: ['The Stone Towers', 'The Walkway', 'The East River'],
    sky: 'day',
  },
  'world-trade-center': {
    name: 'World Trade Center',
    node: 'wtc',
    short: 'World Trade Center - the tallest tower in America.',
    nearby: ['One World Trade Center', 'The 9/11 Memorial Pools', 'The Oculus'],
    sky: 'day',
  },
  // Garden Park (Bhanu 2026-11-17 07:41): a SEPARATE green garden
  // destination of its own - trees, flowers, benches, paths - reached
  // by the garden node on West St. NOT part of the World Trade Center.
  'garden-park': {
    name: 'Garden Park',
    node: 'garden',
    short: 'Garden Park - a quiet green garden in the city.',
    nearby: ['The Rose Beds', 'The Fountain', 'The Old Trees'],
    sky: 'day',
  },
};

const HISTORY_PART1 =
  "Let me tell you a story. Long ago, this place was called Longacre Square, named after London's carriage-making district - horse stables and harness shops lined these streets. Then, in 1904, the New York Times newspaper moved its headquarters here, into the Times Tower, and the city renamed the square Times Square, on April 8, 1904. That same year, the very first New Year's Eve party was held here, with fireworks lighting up the sky. Ask me to tell you more, and I will tell you about the famous ball drop.";
const HISTORY_PART2 =
  'By 1907, the city banned the fireworks - too dangerous, with so many people crowded here. So the newspaper\'s electrician had a new idea: a big ball of iron and wood, five feet wide, seven hundred pounds, covered with one hundred light bulbs, lowered from the tower at midnight. The first ball drop was December 31, 1907, and it has happened almost every year since - only paused in 1942 and 1943, during the war. And the theatres of Broadway, with their glowing neon signs, made this the Crossroads of the World.';
const PARK_STORY =
  'Frederick Law Olmsted and Calvert Vaux won a design competition to create this park - a place for everyone in the city, with lakes, meadows and woodlands to walk in. That is why it still feels like the countryside, right in the middle of Manhattan.';
const STATUE_STORY =
  'Her full name is Liberty Enlightening the World. She was built in Paris first, then shipped across the ocean in pieces and put together here, on her island. That is why she still stands here today, holding her torch up over the harbour.';
const BROADWAY_STORY =
  'The theatres here have been putting on musicals for more than a hundred years - The Lion King, Wicked, Hamilton and so many more. People travel from all over the world just to sit in these seats for one evening.';
const GRAND_CENTRAL_STORY =
  'Want to hear the story of Grand Central? Grand Central Terminal opened in 1913, and its main concourse is one of the most beautiful rooms in America. Look up - the ceiling is painted like the night sky, with the constellations of the zodiac. And in the middle of the hall, on the information booth, sits the famous four-faced clock - people have met under that clock for more than a hundred years.';
const DUMBO_STORY =
  'DUMBO stands for Down Under the Manhattan Bridge Overpass. This cobblestone waterfront looks across the East River at the Manhattan skyline - the Empire State Building, the Chrysler Building, and the Brooklyn Bridge right beside us. It is one of the most photographed views in all of New York.';
const DECK_STORY =
  'From this observation deck you can see the whole of Midtown - the Empire State Building and the Chrysler Building standing tall, and the city spreading out in every direction. On a clear evening the lights come on one by one, and the city glows.';
const BRIDGE_STORY =
  'The Brooklyn Bridge opened in 1883, and it was the longest suspension bridge in the world. Its two great stone towers hold up the cables, and the walkway above the traffic has carried walkers, dreamers and lovers across the East River for more than a hundred and forty years.';
const WTC_STORY =
  'This is One World Trade Center - the tallest building in America, 1,776 feet high, opened in 2014. It stands where the Twin Towers once stood, and at its feet are the two memorial pools, where the towers stood - a quiet place to remember. Look up: the blue glass catches the whole sky.';
const GARDEN_STORY =
  'This is the Garden Park - a quiet green garden in the middle of the city. The rose beds are in bloom, the fountain plays in the centre, and the old trees have stood here for decades. People come here to sit on the benches, smell the flowers, and forget the traffic for a while.';

// Pre-recorded Chitti voice clips (public/audio/voice/*.mp3). The Quest
// Browser has no speech engine, so speechSynthesis is silent there - these
// clips are how Chitti actually talks on the headset. Exact spoken text ->
// clip file; anything not listed falls back to speechSynthesis (desktop).
const VOICE_BY_TEXT: Record<string, string> = {
  [GREETING]: 'greeting.mp3',
  [INTRO_LINES[0]]: 'intro-1.mp3',
  [INTRO_LINES[1]]: 'intro-2.mp3',
  [INTRO_LINES[2]]: 'intro-3.mp3',
  [INTRO_LINES[3]]: 'intro-4.mp3',
  [READY_LINE]: 'ready.mp3',
  [NEXT_PLACES_LINE]: 'next-places.mp3',
  [GRAB_NICE_LINE]: 'grab-nice.mp3',
  [PLACED_LINE]: 'placed.mp3',
  [SELFDRIVE_START_LINE]: 'selfdrive-start.mp3',
  [CHITTI_DRIVE_LINE]: 'chitti-drive.mp3',
  [DRIVE_NEXT_LINE]: 'drive-next.mp3',
  [TURN_LEFT_LINE]: 'turn-left.mp3',
  [TURN_RIGHT_LINE]: 'turn-right.mp3',
  [JOURNAL_SAVED_LINE]: 'journal-saved.mp3',
  [JOURNAL_OPEN_LINE]: 'journal-open.mp3',
  [THANK_YOU]: 'thankyou.mp3',
  'Welcome to New York! Where do you want to go?': 'welcome.mp3',
  'I am listening - say a place, like Times Square.': 'listening.mp3',
  'I did not hear that clearly - tap a button, that works too.': 'notheard.mp3',
  'Best photo spot! Get ready - 3, 2, 1!': 'photo-ready.mp3',
  'Going left - smoothly, careful.': 'going-left.mp3',
  'Going right - smoothly, careful.': 'going-right.mp3',
  'No left turn here - the road goes straight. Shall we go somewhere?': 'no-left.mp3',
  'No right turn here - the road goes straight. Shall we go somewhere?': 'no-right.mp3',
  "We'll choose left or right after we arrive - first, let's enjoy the ride!":
    'enjoy-ride.mp3',
  [HISTORY_PART1]: 'story-times-1.mp3',
  [HISTORY_PART2]: 'story-times-2.mp3',
  [PARK_STORY]: 'story-park.mp3',
  [STATUE_STORY]: 'story-statue.mp3',
  [BROADWAY_STORY]: 'story-broadway.mp3',
  [GRAND_CENTRAL_STORY]: 'story-grand-central.mp3',
  [DUMBO_STORY]: 'story-dumbo.mp3',
  [DECK_STORY]: 'story-deck.mp3',
  [BRIDGE_STORY]: 'story-bridge.mp3',
  [WTC_STORY]: 'story-world-trade-center.mp3',
  [GARDEN_STORY]: 'story-garden-park.mp3',
  // every other line Chitti can speak has a clip too: on the Quest the
  // browser speech engine is silent, so a line with no clip is a line
  // she never hears. The one exception is the dynamic "I heard ..." line
  // (its text varies with what was heard) - it stays on the speech
  // fallback, and the bubble + panel still show its words.
  'Shall we go somewhere next, or stay here a little longer?': 'where-next.mp3',
  'Where shall we go now? Times Square, Central Park, or the Statue of Liberty?':
    'where-now.mp3',
  'No turn here - let us pick a place to go next!': 'no-turn.mp3',
  'And we are moving again!': 'moving-again.mp3',
  'Paused. Take your time - tap Resume, or say go, when you are ready.': 'paused.mp3',
  'Stopped. Where shall we go next?': 'stopped.mp3',
  'We are already stopped - take a photo, or tap Where next when you are ready.':
    'already-stopped.mp3',
  'Mic off - tap the mic any time to talk to me.': 'mic-off.mp3',
  'Voice is not available - tap a button instead.': 'voice-unavailable.mp3',
  'Paris is coming in version 2 - tonight we enjoy New York. Shall we go to Times Square?':
    'paris-v2.mp3',
  // no clip for the two "start the game first" guard lines: the old
  // clips said "Enter the game", so they are deleted - the lines still
  // show in the speech bubble, and the desktop speech fallback speaks
  // them; on the Quest they are silent (bubble only).
  'Take a photo when we arrive at a place - first, pick where to go!':
    'photo-first-pick.mp3',
  'Grab something to hold in your photo - the camera, the mini Statue of Liberty, the coffee cup, or the torch!':
    'grab-something.mp3',
  'Photo did not save this time - try again.': 'photo-failed.mp3',
  'Hey Bhanu, not that way - let us go this way, smoothly, careful. There is a chair on your left.':
    'warn-left.mp3',
  'Hey Bhanu, not that way - let us go this way, smoothly, careful. There is a bed on your right.':
    'warn-right.mp3',
};
// per-place lines, built from PLACES so the text always matches the code
for (const [id, p] of Object.entries(PLACES)) {
  VOICE_BY_TEXT[`Here is the destination - ${p.name}!`] = `arrival-${id}.mp3`;
  VOICE_BY_TEXT[`Before we get there - nearby you'll find ${p.nearby.join(', ')}.`] =
    `nearby-${id}.mp3`;
  for (const dir of ['left', 'right'] as const) {
    VOICE_BY_TEXT[`Let's go ${dir} first - ${p.name} is that way!`] =
      `suggestion-${dir}-${id}.mp3`;
  }
  VOICE_BY_TEXT[`Great choice! Driving you to ${p.name} now - about 5 seconds. Enjoy the ride!`] =
    `drive-${id}.mp3`;
  VOICE_BY_TEXT[
    `Famous places near here: ${p.nearby.join(', ')}. Which one shall we visit? Say its name, or tap Times Square, Central Park, or the Statue of Liberty.`
  ] = `nearby-ask-${id}.mp3`;
  VOICE_BY_TEXT[
    `Photo taken! It is saved in your Downloads. That is your souvenir from ${p.name}.`
  ] = `photo-souvenir-${id}.mp3`;
}
// per-souvenir lines (SOUVENIR_NAMES is the single source of the names).
// Only the ten original souvenirs have pre-recorded clips: a mapping to
// a missing clip would set lastClipError when Chitti speaks the line,
// and the extra Liberty copies would clobber the 'holding-statue.mp3'
// mapping with a missing 'holding-statue-2.mp3' (their spoken line is
// the same text). New souvenirs get no mapping, so their lines fall
// through to the desktop speech fallback instead - the bubble still
// shows the line, like the guard lines.
const SOUVENIR_VOICE_IDS = [
  'souvenir-camera',
  'souvenir-statue',
  'souvenir-cup',
  'souvenir-torch',
  'souvenir-watch',
  'souvenir-polaroid',
  'souvenir-skyscraper',
  'souvenir-bridge',
  'souvenir-wtc',
  'souvenir-bouquet',
];
for (const sid of SOUVENIR_VOICE_IDS) {
  const sname = SOUVENIR_NAMES[sid];
  const short = sid.replace('souvenir-', '');
  VOICE_BY_TEXT[`You're holding the ${sname}! Say cheese!`] = `holding-${short}.mp3`;
  VOICE_BY_TEXT[`Photo taken - you're holding the ${sname}! It is saved in your Downloads.`] =
    `photo-held-${short}.mp3`;
}

// Vosk grammar: the only words the offline recogniser listens for (the
// tour's own places + commands). A small grammar hears "Times Square"
// far better than a full-English model.
const VOSK_GRAMMAR = JSON.stringify([
  'times square',
  'central park',
  'statue of liberty',
  'broadway',
  'grand central',
  'dumbo',
  'observation deck',
  'brooklyn bridge',
  'world trade center',
  'wtc',
  'garden park',
  'garden',
  'left',
  'right',
  'stop',
  'pause',
  'go',
  'resume',
  'continue',
  'history',
  'tell me more',
  'tell me the story',
  'nearby',
  'famous',
  'photo',
  'picture',
  'next place',
  'where next',
  'paris',
  'eiffel',
  'tkts',
]);

// Story cards: one short line per panel screen (fix d - no big blocks).
const STORY_CARDS: Record<string, string[][]> = {
  'times-square': [
    [
      'Long ago, this was Longacre Square - horse stables and carriage shops.',
      'In 1904 the New York Times moved here - the square was renamed Times Square.',
      "That same year, the first New Year's Eve party lit up the sky.",
    ],
    [
      'By 1907 fireworks were banned - too dangerous with so many people.',
      'So a giant ball was built - iron and wood, 5 feet wide, 700 pounds, 100 bulbs.',
      'The first ball drop was December 31, 1907 - almost every year since.',
    ],
  ],
  'central-park': [
    [
      'Olmsted and Vaux won a contest to design this park - a place for everyone.',
      'Lakes, meadows and woodlands - the countryside, in the middle of Manhattan.',
    ],
  ],
  'statue-liberty': [
    [
      'Her full name is Liberty Enlightening the World.',
      'She was built in Paris, shipped over in pieces, and put together here.',
    ],
  ],
  broadway: [
    [
      'Theatres here have staged musicals for over a hundred years.',
      'The Lion King, Wicked, Hamilton - people travel the world to sit here.',
    ],
  ],
  'grand-central': [
    [
      'Grand Central opened in 1913 - one of the most beautiful rooms in America.',
      'The ceiling is the night sky, painted with the constellations of the zodiac.',
      'People have met under the famous four-faced clock for more than a hundred years.',
    ],
  ],
  dumbo: [
    [
      'DUMBO means Down Under the Manhattan Bridge Overpass.',
      'This cobblestone waterfront faces the Manhattan skyline and the Brooklyn Bridge.',
    ],
  ],
  'observation-deck': [
    [
      'From here you can see the whole of Midtown - Empire State and Chrysler standing tall.',
      'On a clear evening the lights come on one by one, and the city glows.',
    ],
  ],
  'brooklyn-bridge': [
    [
      'The Brooklyn Bridge opened in 1883 - then the longest suspension bridge in the world.',
      'Its two stone towers hold the cables, and the walkway has carried dreamers across the river for over 140 years.',
    ],
  ],
  'world-trade-center': [
    [
      'One World Trade Center is the tallest building in America - 1,776 feet high.',
      'It opened in 2014, where the Twin Towers once stood, and its blue glass catches the whole sky.',
      'At its feet are the two memorial pools - a quiet place to remember.',
    ],
  ],
  'garden-park': [
    [
      'The Garden Park is a quiet green garden in the middle of the city.',
      'The rose beds are in bloom, the fountain plays in the centre, and the old trees have stood here for decades.',
      'People come to sit on the benches, smell the flowers, and forget the traffic for a while.',
    ],
  ],
};

// ---------- road graph (city space; the car only ever travels on edges) ----------
type NodeId =
  | 'start'
  | 'ave40'
  | 'park'
  | 'times'
  | 'battery'
  | 'timesW'
  | 'timesE'
  | 'east40'
  | 'grand'
  | 'dumbo'
  | 'deck'
  | 'bridge'
  | 'garden'
  | 'wtc';

const NODES: Record<NodeId, { x: number; z: number }> = {
  start: { x: 0, z: 8 },
  ave40: { x: 0, z: -40 },
  park: { x: -16, z: -40 },
  times: { x: 0, z: -60 },
  battery: { x: 0, z: 38 },
  timesW: { x: -16, z: -60 },
  timesE: { x: 16, z: -60 },
  east40: { x: 16, z: -40 },
  grand: { x: 16, z: -50 },
  dumbo: { x: 16, z: 30 },
  deck: { x: 0, z: -80 },
  bridge: { x: 0, z: 30 },
  garden: { x: -16, z: -50 },
  wtc: { x: 0, z: 20 },
};

const EDGES: Record<NodeId, NodeId[]> = {
  start: ['battery', 'ave40', 'bridge', 'wtc'],
  battery: ['start', 'bridge'],
  ave40: ['start', 'times', 'park', 'east40'],
  park: ['ave40', 'timesW', 'garden'],
  timesW: ['park', 'times', 'garden'],
  times: ['ave40', 'timesW', 'timesE', 'deck'],
  timesE: ['times', 'east40', 'grand'],
  east40: ['timesE', 'ave40', 'grand'],
  grand: ['east40', 'timesE'],
  dumbo: ['bridge'],
  deck: ['times'],
  bridge: ['start', 'battery', 'dumbo', 'wtc'],
  garden: ['timesW', 'park'],
  wtc: ['start', 'bridge'],
};

// Which place a node belongs to (for the arrival line + story).
const NODE_PLACE: Record<NodeId, string> = {
  start: 'start',
  ave40: 'times-square',
  park: 'central-park',
  times: 'times-square',
  battery: 'statue-liberty',
  timesW: 'times-square',
  timesE: 'broadway',
  east40: 'broadway',
  grand: 'grand-central',
  dumbo: 'dumbo',
  deck: 'observation-deck',
  bridge: 'brooklyn-bridge',
  garden: 'garden-park',
  wtc: 'world-trade-center',
};

function bfs(from: NodeId, to: NodeId): NodeId[] {
  if (from === to) return [from];
  const prev = new Map<NodeId, NodeId | null>();
  const queue: NodeId[] = [from];
  prev.set(from, null);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of EDGES[cur]) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        if (nb === to) {
          const path: NodeId[] = [to];
          let p: NodeId | null = cur;
          while (p !== null) {
            path.unshift(p);
            p = prev.get(p) ?? null;
          }
          return path;
        }
        queue.push(nb);
      }
    }
  }
  return [from, to];
}

function nearestNode(x: number, z: number): NodeId {
  let best: NodeId = 'start';
  let bestD = Infinity;
  (Object.keys(NODES) as NodeId[]).forEach((id) => {
    const n = NODES[id];
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  });
  return best;
}

// Signed turn angle from direction dIn to dOut about +Y (radians).
// Positive = left, negative = right, ~0 = straight.
function turnAngle(
  dIn: { x: number; z: number },
  dOut: { x: number; z: number },
): number {
  const cross = dIn.z * dOut.x - dIn.x * dOut.z;
  const dot = dIn.x * dOut.x + dIn.z * dOut.z;
  return Math.atan2(cross, dot);
}

function moveTowardAngle(cur: number, target: number, maxStep: number): number {
  let diff = target - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return cur + Math.sign(diff) * maxStep;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type UiEl = {
  setProperties: (props: Record<string, string>) => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

interface Drive {
  waypoints: Array<{ x: number; z: number }>;
  segLens: number[];
  totalLen: number;
  start: number;
  pausedTotal: number;
  pausedAt: number | null;
  destNode: NodeId;
  destPlace: string;
}

const log = (...args: unknown[]): void => {
  console.log('[tour]', ...args);
};

export class TourSystem extends createSystem({
  state: { required: [TourState] },
  car: { required: [TourCar] },
  // entities currently held in a hand (Grabbed is a transient tag managed
  // by GrabSystem - read it, never add or remove it)
  held: { required: [Grabbed] },
}) {
  // --- cached scene refs (init only, never allocated in update) ---
  private city!: Object3D;
  private carObj!: Object3D;
  private steerWheel!: Object3D;
  private robotHead!: Object3D;
  // Chitti's arm pivots (shoulder + elbow per side, from the car asset):
  // posed by poseChittiArms - forward to the wheel while he drives,
  // hanging with bent elbows while he stands (the photo's pose)
  private armL: Object3D | null = null;
  private armR: Object3D | null = null;
  private elbowL: Object3D | null = null;
  private elbowR: Object3D | null = null;
  private armDriveQL = new Quaternion();
  private armDriveQR = new Quaternion();
  private armHangQL = new Quaternion();
  private armHangQR = new Quaternion();
  private wheels: Object3D[] = [];
  private taxis: Object3D[] = [];
  private bus: Object3D | null = null;
  private ferry: Object3D | null = null;
  private statueFlame: Object3D | null = null;
  private spireTip: Object3D | null = null;
  // sky + lights (her pictures set the light per scene: daylight drive,
  // dusk Times Square, sunset DUMBO, twilight Observation Deck)
  private skyDomes: Partial<Record<SkyMode, Object3D>> = {};
  private cityAmbient: AmbientLight | null = null;
  private citySun: DirectionalLight | null = null;
  private cityMoon: DirectionalLight | null = null;
  private skyMode: SkyMode = 'day';
  // Times Square billboards, as one named group in the city asset -
  // hidden per place (Central Park) by applyPlaceCityVisibility()
  private billboardGroup: Object3D | null = null;
  private crowd: Object3D[] = [];
  private titlePanel: UIKitMLAsset | null = null;
  private tourPanel: UIKitMLAsset | null = null;
  private speechBubble: UIKitMLAsset | null = null;
  private buttonHandlers: Record<string, () => void> = {};

  private els: Record<string, UiEl | null> = {};

  // --- tour state (internal authority; mirrored to TourState) ---
  private phase = 'enter';
  // Welcome screen: the two boxes appear 2 s after the title (wall
  // clock, so slow frames can't stall it)
  private enterShownAtMs = 0;
  private enterButtonsShown = false;
  private place = 'start';
  private paused = false;
  private driving = false;
  private historyTold = 0;
  private photos = 0;
  private storyCards: string[] = [];
  private storyIdx = 0;
  private storyPart = 0;
  private visited = new Set<string>();

  // --- drive engine (treadmill: car fixed at origin, city moves) ---
  private pos = { x: 0, z: 8 };
  private heading = -Math.PI / 2; // direction angle; starts facing north
  private facing = { x: 0, z: -1 };
  private drive: Drive | null = null;
  private nodePath: NodeId[] = [];
  private segIndex = 0;
  private segFrom: NodeId = 'start';
  private currentNode: NodeId = 'start';
  private destPlace = 'start'; // where the current drive is going
  private driveStartMs = 0;
  private lastDriveMs = 0;
  private turnRate = 0;
  private glanceUntil = 0;
  private elapsed = 0;
  private bobPhase = 0;

  // --- nearby places, told while driving (before arriving) ---
  private nearbyToldFor: string | null = null;
  private nearbyToldAtMs = 0;
  private nearbyTimer: ReturnType<typeof setTimeout> | null = null;

  // --- tutorial intro (10-20 s, timed) ---
  private introStartMs = 0;
  private introEndMs = 0;
  private introLineIdx = 0;

  // --- ride start (no gesture any more) + passenger seat ---
  // She names a place, Chitti gets in beside her, and she taps the
  // "Start ride" button. The two-hand circle / portal was removed at
  // Bhanu's ask (2026-11-16): the button is the only way a ride starts.
  private pendingPlace: string | null = null;
  // Test hooks for the left/right POINT gesture (kept): the autotest
  // pretends her palms are out to one side. (The circle gesture that
  // used these is gone; the point gesture is a separate feature.)
  private gestureDebug = false;
  private debugPalms: { l: Vector3; r: Vector3 } | null = null;
  // preallocated temps (no per-frame allocation)
  private tmpL = new Vector3();
  private tmpR = new Vector3();
  private tmpMid = new Vector3();
  private tmpHead = new Vector3();
  private tmpPos = new Vector3();
  private tmpFwd = new Vector3();
  private tmpRight = new Vector3();
  // scratch for the direction-of-travel fallback in the step-out spot search
  private tmpFacingWorld = new Vector3();
  // spot-search scratch: the candidate stand point and its city coords
  private tmpCand = new Vector3();
  private tmpCity = new Vector3();
  // true once panels have been aimed at her head for the current XR session
  private xrActive = false;

  // --- getting out + getting back in (Chitti + rider, together) ---
  private chittiObj!: Object3D;
  // a small warm light that rides with Chitti and switches on ONLY while
  // he stands out of the car, so his face is lit for her in the dark
  // tutorial void and on the plaza at dusk (in the car the cabin light
  // does this job, so his light stays off there)
  private chittiLight: PointLight | null = null;
  private chittiOut = false;
  // NEW FLOW (Bhanu 2026-11-16 20:04): the city + car stay hidden until
  // she names the first place - before that it is just a conversation
  // with Chitti in front of her, no New York at all.
  private cityRevealed = false;
  // the car driving back in after the photos ("shall we go?")
  private carReturnActive = false;
  private carReturnStartMs = 0;
  private getOutPending = false;
  private getOutAt = 0;
  private stepOutActive = false;
  private stepOutStartMs = 0;
  private boardActive = false;
  private boardStartMs = 0;
  // Observation Deck lift (Bhanu 2026-11-17): the deck platform stands
  // 25 m up on its tower. The city is lowered 25 m (cityLiftY) as
  // Chitti steps out, so the platform comes up to her feet - she steps
  // onto a HIGH deck with the skyline below. It rises back when he
  // boards the car for the next ride. Animated over 2 s, smoothstep.
  private cityLiftY = 0;
  private cityLiftTarget = 0;
  private cityLiftFromY = 0;
  private cityLiftStartMs = 0;
  // how long this climb-in takes (BOARD_MS, or longer when the footpath
  // glide walks her back to the car - the two finish together)
  private boardMs = BOARD_MS;
  private pendingAfterBoard: (() => void) | null = null;
  // animation from/to (preallocated; no per-frame allocation)
  private animFromPos = new Vector3();
  private animToPos = new Vector3();
  private animFromYaw = 0;
  private animToYaw = 0;
  private animCarFromZ = 0;
  private animCarToZ = 0;
  // the car's x at the start of a step-out (self-drive leaves it at
  // +0.45); it lerps back to 0 as the car drives away, so the next ride
  // starts with the car centred
  private animCarFromX = 0;
  // Chitti's step-out spot in the car frame (set by beginStepOut from the
  // per-destination city spot); boardCar + the autotest read it back.
  private standSpot = new Vector3(-0.55, 0, -0.75);
  // --- footpath glide (Bhanu 2026-11-16 20:35) ---
  // After arrival she walks from the car (on the road) to the FOOTPATH
  // beside the road; the city glides under her while Chitti steps out,
  // so it looks like the two friends walk into the place together. The
  // same glide walks her back to the car (road) when he boards again -
  // the next drive must start on a road, never from the footpath.
  // The glide moves `pos` (the car's city position); the drive engine
  // never runs while a glide is active.
  private footpathGlideActive = false;
  private footpathGlideFrom = { x: 0, z: 0 };
  private footpathGlideTo = { x: 0, z: 0 };
  private footpathGlideStartMs = 0;
  private footpathGlideMs = 2000;

  // --- photo with grab-and-go souvenirs ---
  private souvenirObjs: Array<{
    id: string;
    obj: Object3D;
    ent: Entity;
    homePos: Vector3;
    homeQuat: Quaternion;
    homeParent: Object3D | null;
  }> = [];
  private souvenirTable: Object3D | null = null;
  private souvenirRingObj: Object3D | null = null;
  private heldObject: string | null = null;
  private photoObject: string | null = null;
  // true from the moment a photo countdown starts until the thank-you
  // closes the visit: one grab (or one double-tap) takes exactly one photo
  private photoInProgress = false;

  // --- self-drive (Bhanu 2026-11-16 22:01) ---
  // She sits LEFT in the driver seat, Chitti on her RIGHT in the
  // passenger seat, facing her and chatting. The car shifts +0.45 in x
  // so the steering wheel sits in front of her; Chitti moves to the
  // passenger seat and turns to face her.
  private selfDriving = false;
  // --- glowing turn arrow (Bhanu 2026-11-16 22:01) ---
  // A cyan arrow on the road at the junction where the car turns, shown
  // while the turn runs. A child of the city, so it stays glued to the
  // road as the city glides under the car.
  private turnArrow: Group | null = null;
  private turnArrowHead: Mesh | null = null;
  private turnArrowHideAt = 0;
  // --- two-hand circle ring (Bhanu 2026-11-16 22:39) ---
  // The glowing circle ring from her new picture: two hands form the
  // ring at eye level, and the Start ride button sits beside it. The
  // ring itself is a visual only (the palm-tracking gesture stays
  // removed per her 20:34 ask) - a child of the car, 1.5 m ahead at eye
  // level, visible only in the ready phase, beside the Start ride button.
  private readyRing: Group | null = null;
  // --- tour Journal (Bhanu 2026-11-16 22:06) ---
  // Her personal travel scrapbook: souvenirs she sends to the glowing
  // ring, and photos she takes, saved so she can open the Journal and
  // look through them any time. Entries are {kind, name, place}.
  private journal: Array<{ kind: 'souvenir' | 'photo'; name: string; place: string }> = [];
  private journalOpen = false;
  // souvenir ids already saved to the Journal: they stay in the
  // Journal, not back on the table at the next destination
  private journalSavedIds = new Set<string>();
  // The glowing Journal ring (the toss target) + the glowing arc from a
  // held souvenir to the ring. The ring is a child of the souvenir
  // table, so it shows/hides with the souvenirs at each destination;
  // the arc is a line (child of the table too) whose points are
  // rewritten in place (never reallocated) while she holds something.
  private journalRing: Group | null = null;
  private journalArc: Line | null = null;
  private journalArcGeo: BufferGeometry | null = null;
  private journalArcCount = 20;
  // A souvenir flying to the Journal ring after a toss / a tap on
  // "Send to Journal": it arcs to the ring, then is saved and hidden.
  private journalFlyActive = false;
  private journalFlyId: string | null = null;
  private journalFlyStartMs = 0;
  private journalFlyMs = 700;
  private journalFlyFrom = new Vector3();
  private journalFlyTo = new Vector3();
  // temp vectors for the arc + the fly (preallocated; no per-frame alloc)
  private tmpArcA = new Vector3();
  private tmpArcB = new Vector3();
  private tmpArcC = new Vector3();
  private tmpArcP = new Vector3();
  private tmpFly = new Vector3();

  // --- thank-you + left/right "where next" ---
  private thankYouShown = false;
  private thankYouTimer: ReturnType<typeof setTimeout> | null = null;
  // --- "I'm done": the end of the whole tour (Bhanu 2026-11-17) ---
  private goodbyeTimer: ReturnType<typeof setTimeout> | null = null;
  private nextLeft: { node: NodeId; destNode: NodeId; destPlace: string } | null = null;
  private nextRight: { node: NodeId; destNode: NodeId; destPlace: string } | null = null;
  private suggestion: 'left' | 'right' | null = null;
  private suggestionText = '';
  private pointHoldSince: number | null = null;
  private pointDir: 'left' | 'right' | null = null;
  // true after a point fires, until she lowers her hand (edge trigger)
  private pointFired = false;
  // the point gesture only arms after her hands are seen down/neutral:
  // after the photo her hand is still out from the grab, and that leftover
  // pose must not turn the car on its own (D8)
  private pointArmed = false;

  // --- mirrors / timers ---
  private lastSeen = '';
  private uiDirty = true;
  private shownButtons: string[] = [];
  private currentLine = '';
  private currentSub = '';
  private bubbleText = '';
  // Meet-style mic icon state (Bhanu 2026-11-17 07:43): 'on' = plain
  // mic icon on a dark button (listening), 'off' = crossed-out mic on
  // a red button (muted). The icon IS the button - no label text.
  private micIconState: 'on' | 'off' = 'off';
  private micButtonBg = '#dc2626';
  private testRunning = false;
  private testResults: Record<string, unknown> = {};
  // last souvenir id fired via the ECS grabSouvenir trigger (so one
  // set-component grabs once, not every frame)
  private lastGrabSouvenir = '';
  private recog: {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((ev: unknown) => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
  } | null = null;
  // pre-recorded Chitti voice: one HTMLAudio element per clip, so cutting
  // from one line to another never changes a shared element's src mid-load
  // (that abort is what logged ERR_ABORTED on fast mic toggling, D7)
  private clipAudios = new Map<string, HTMLAudioElement>();
  // voice-playback observability: the autotest (and the CLI debug dump)
  // read these to prove a clip actually started playing, not just that
  // play() was called. Audio itself cannot be heard in the emulator.
  private lastClipPlayed: string | null = null;
  private lastClipPlayOk = false;
  private lastClipError: string | null = null;
  private audioUnlocked = false;
  private audioCtx: AudioContext | null = null;
  // a clip whose play() was refused (no user gesture yet): retried on
  // the next tap, so a timer-spoken line is never lost to silence
  private pendingClip: string | null = null;
  private currentClipAudio: HTMLAudioElement | null = null;
  private speakTimer: ReturnType<typeof setTimeout> | null = null;
  // true while Chitti is speaking: the mic ignores his own voice, so it
  // never echoes back into the recogniser as if she said it
  private speaking = false;
  private clipToken = 0;
  // mic on/off (the tap-to-speak toggle): while ON, Chitti keeps listening
  private listening = false;
  // offline speech recognition (Vosk) - loaded only when she taps the mic
  private voskModel: VoskModel | null = null;
  private vosk: {
    recognizer: VoskRecognizer;
    listening: boolean;
    stream: MediaStream;
    audioCtx: AudioContext;
    node: ScriptProcessorNode;
  } | null = null;
  private voskLoading = false;

  // ================= init =================
  init(): void {
    // city + car (scene nodes)
    this.city = this.world.requireSceneObject<Object3D>('nyc-city');
    const carEntity = this.world.requireSceneEntity('tour-car');
    this.carObj = carEntity.object3D as Object3D;
    if (!this.carObj) throw new Error('tour-car has no object3D');
    // the car sits centred on her head (CAR_HOME) from the start, so
    // the first reveal already frames Chitti in the driver seat beside
    // her, his face in side view, Screen_3-style
    this.carObj.position.set(CAR_HOME_X, 0, CAR_HOME_Z);
    // the city and the car appear only when she enters the game
    this.city.visible = false;
    this.carObj.visible = false;

    // named car parts
    const findPart = (root: Object3D, name: string): Object3D => {
      let found: Object3D | null = null;
      root.traverse((o) => {
        if (o.name === name) found = o as Object3D;
      });
      if (!found) throw new Error(`car part not found: ${name}`);
      return found;
    };
    this.steerWheel = findPart(this.carObj, 'steerWheel');
    this.robotHead = findPart(this.carObj, 'robotHead');
    this.chittiObj = findPart(this.carObj, 'chitti');
    // Chitti's arm poses (shoulder pivots aim the upper arm, elbow
    // pivots bend the forearm). Driving: upper arms aim at the wheel
    // hand targets (robot-local shoulders (±0.16, 0.90, -0.02) to hands
    // (±0.22, 1.26, -0.35)), elbows nearly straight. Standing: arms
    // hang slightly out, elbows bent ~100° so his hands rest forward
    // at hip level, like the reference photo.
    this.armL = findPart(this.carObj, 'armL');
    this.armR = findPart(this.carObj, 'armR');
    this.elbowL = findPart(this.carObj, 'elbowL');
    this.elbowR = findPart(this.carObj, 'elbowR');
    const down = new Vector3(0, -1, 0);
    this.armDriveQL.setFromUnitVectors(
      down,
      new Vector3(-0.06, 0.36, -0.33).normalize(),
    );
    this.armDriveQR.setFromUnitVectors(
      down,
      new Vector3(0.06, 0.36, -0.33).normalize(),
    );
    this.armHangQL.setFromEuler(new Euler(0, 0, -0.1));
    this.armHangQR.setFromEuler(new Euler(0, 0, 0.1));
    this.poseChittiArms(false);
    // Chitti's own little light: off in the car (the cabin light covers
    // him there), switched on when he stands out of the car so his face
    // is lit for her - in the dark tutorial void and on the plaza at dusk
    this.chittiLight = new PointLight(0xfff2d9, 0, 5, 1.5);
    // at his face height, just in front of his face: it lights his face
    // for the camera without spilling onto the panels between them
    // (at 1.5 m high and 0.8 m out it washed the entry buttons white)
    this.chittiLight.position.set(0, 1.2, -0.4);
    this.chittiObj.add(this.chittiLight);
    ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].forEach((n) => {
      this.wheels.push(findPart(this.carObj, n));
    });

    // named city parts (animated by the system)
    const findCity = (name: string): Object3D | null => {
      let found: Object3D | null = null;
      this.city.traverse((o) => {
        if (o.name === name) found = o as Object3D;
      });
      return found;
    };
    for (let i = 0; i < 14; i++) {
      const t = findCity(`taxi${i}`);
      if (t) this.taxis.push(t);
    }
    this.bus = findCity('bus');
    this.ferry = findCity('ferry');
    this.statueFlame = findCity('statueFlame');
    this.spireTip = findCity('spireTip');
    this.billboardGroup = findCity('timesSquareBillboards');
    // sky domes + lights, by name (the city asset names them); the
    // tour switches them per scene - daylight for the drive, the
    // place's own sky on arrival
    (['day', 'dusk', 'sunset', 'twilight'] as SkyMode[]).forEach((m) => {
      const dome = findCity(m === 'day' ? 'skyDay' : m === 'dusk' ? 'skyDusk' : m === 'sunset' ? 'skySunset' : 'skyTwilight');
      if (dome) this.skyDomes[m] = dome;
    });
    this.cityAmbient = findCity('cityAmbient') as AmbientLight | null;
    this.citySun = findCity('citySun') as DirectionalLight | null;
    this.cityMoon = findCity('cityMoon') as DirectionalLight | null;
    // crowd people are named crowd-0, crowd-1, ... in the city asset;
    // collect them by name (userData object refs do not survive cloning)
    const crowdFound: Object3D[] = [];
    this.city.traverse((o) => {
      if (o.name.startsWith('crowd-')) crowdFound.push(o as Object3D);
    });
    crowdFound.sort(
      (a, b) =>
        Number(a.name.slice('crowd-'.length)) -
        Number(b.name.slice('crowd-'.length)),
    );
    this.crowd = crowdFound;

    // grab-and-go souvenirs on the side table (hidden until she steps
    // out of the car at a destination; home transforms are stored so the
    // autotest can put them back after a simulated grab)
    SOUVENIR_IDS.forEach((id) => {
      const ent = this.world.requireSceneEntity(id);
      const obj = ent.object3D as Object3D;
      if (!obj) throw new Error(`${id} has no object3D`);
      this.souvenirObjs.push({
        id,
        obj,
        ent,
        homePos: obj.position.clone(),
        homeQuat: obj.quaternion.clone(),
        homeParent: obj.parent,
      });
      obj.visible = false;
    });
    const tableEnt = this.world.requireSceneEntity('souvenir-table');
    this.souvenirTable = tableEnt.object3D as Object3D;
    if (!this.souvenirTable) throw new Error('souvenir-table has no object3D');
    this.souvenirTable.visible = false;
    const ringEnt = this.world.requireSceneEntity('souvenir-ring');
    this.souvenirRingObj = ringEnt.object3D as Object3D;
    if (!this.souvenirRingObj) throw new Error('souvenir-ring has no object3D');
    this.souvenirRingObj.visible = false;

    // glowing turn arrow (Bhanu 2026-11-16 22:01): a cyan arrow on the
    // road at the junction where the car turns. A child of the city, so
    // it stays glued to the road as the city glides under the car.
    // Hidden until a mid-drive turn shows it.
    const arrowMat = new MeshBasicMaterial({ color: 0x22d3ee });
    const arrow = new Group();
    arrow.name = 'turn-arrow';
    const shaft = new Mesh(new BoxGeometry(0.35, 0.02, 2.0), arrowMat);
    arrow.add(shaft);
    const arrowHead = new Mesh(new ConeGeometry(0.42, 0.75, 12), arrowMat);
    arrowHead.name = 'turn-arrow-head';
    // the cone's axis is +Y; rotation.z lays it flat pointing left or
    // right (set at show time), and the thin x-scale keeps it flat on
    // the road like a painted turn marking
    arrowHead.scale.set(0.2, 1, 1);
    arrowHead.rotation.z = Math.PI / 2;
    arrowHead.position.set(-0.35, 0, 1.15);
    arrow.add(arrowHead);
    arrow.position.set(0, 0.04, 0);
    arrow.visible = false;
    this.city.add(arrow);
    this.turnArrow = arrow;
    this.turnArrowHead = arrowHead;

    // two-hand circle ring (Bhanu 2026-11-16 22:39): the glowing cyan
    // ring from her picture, at eye level in front of the car, beside
    // the Start ride button. A child of the car so it sits ahead of her
    // while she waits; shown only in the ready phase.
    const readyRing = new Group();
    readyRing.name = 'ready-ring';
    const readyRingMesh = new Mesh(new TorusGeometry(0.35, 0.03, 10, 32), arrowMat);
    readyRing.add(readyRingMesh);
    const readyRingHalo = new Mesh(
      new TorusGeometry(0.43, 0.015, 8, 32),
      new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45 }),
    );
    readyRing.add(readyRingHalo);
    readyRing.position.set(0, 1.5, -1.5);
    readyRing.visible = false;
    this.carObj.add(readyRing);
    this.readyRing = readyRing;

    // glowing Journal ring (Bhanu 2026-11-16 22:01/22:06): the toss
    // target - a cyan ring floating in front of her at each destination.
    // A child of the souvenir table, so it shows/hides with the
    // souvenirs; world (1.2, 1.7, -2.2) = table-local (0.05, 1.7, -2.35).
    // It sits a couple of metres ahead (not in her face) so it reads as
    // a target without blocking Chitti or the panel.
    const ringGroup = new Group();
    ringGroup.name = 'journal-ring';
    const ring = new Mesh(new TorusGeometry(0.32, 0.03, 10, 32), arrowMat);
    ringGroup.add(ring);
    const halo = new Mesh(
      new TorusGeometry(0.4, 0.015, 8, 32),
      new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45 }),
    );
    ringGroup.add(halo);
    ringGroup.position.set(0.05, 1.7, -2.35);
    this.souvenirTable.add(ringGroup);
    this.journalRing = ringGroup;

    // glowing arc (Bhanu 2026-11-16 22:01): a cyan line from a held
    // souvenir to the Journal ring, showing the toss path. A child of
    // the souvenir table (world-fixed); its points are rewritten in
    // table-local coordinates while she holds something, never
    // reallocated. Hidden when she is not holding a souvenir.
    // frustumCulled off: the line's bounds come from its initial
    // (all-zero) points and would cull it once the points move.
    const arcGeo = new BufferGeometry();
    arcGeo.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(this.journalArcCount * 3), 3),
    );
    const arc = new Line(
      arcGeo,
      new LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }),
    );
    arc.visible = false;
    arc.frustumCulled = false;
    this.souvenirTable.add(arc);
    this.journalArc = arc;
    this.journalArcGeo = arcGeo;

    // UI panels
    this.titlePanel =
      this.world.getSceneObject<UIKitMLAsset>('title-panel') ?? null;
    this.tourPanel =
      this.world.getSceneObject<UIKitMLAsset>('tour-panel') ?? null;
    this.speechBubble =
      this.world.getSceneObject<UIKitMLAsset>('speech-bubble') ?? null;
    // the bubble only appears once she enters the game (Chitti is there)
    if (this.speechBubble) this.speechBubble.visible = false;
    this.wirePanel(this.speechBubble, {});
    this.wirePanel(this.titlePanel, {
      'btn-start-tutorial': () => this.startTutorial(),
      'btn-start-game': () => this.startGame(),
    });
    this.wirePanel(this.tourPanel, {
      'btn-next': () => this.onNext(),
      'btn-skip': () => this.skipTutorial(),
      'btn-restart': () => this.restartTutorial(),
      'btn-back': () => this.backToChoice(),
      'btn-place-times': () => this.driveTo('times-square'),
      'btn-place-park': () => this.driveTo('central-park'),
      'btn-place-statue': () => this.driveTo('statue-liberty'),
      'btn-start-ride': () => this.tapStartRide(),
      'btn-left': () => this.requestTurn('left'),
      'btn-right': () => this.requestTurn('right'),
      'btn-turn-left': () => this.requestTurn('left'),
      'btn-turn-right': () => this.requestTurn('right'),
      'btn-selfdrive': () => this.startSelfDrive(),
      'btn-chittidrive': () => this.handBackToChitti(),
      'btn-journal': () => this.openJournal(),
      'btn-send-journal': () => this.sendHeldToJournal(),
      'btn-journal-close': () => this.closeJournal(),
      'btn-pause': () => this.pauseDrive(),
      'btn-resume': () => this.pauseDrive(),
      'btn-stop': () => this.stopDrive(),
      'btn-history': () => this.onHistoryButton(),
      'btn-photo': () => this.takePhoto(),
      'btn-mic': () => this.toggleListening(),
      'btn-where': () => this.finishVisit(),
      'btn-im-done': () => this.endTour(),
    });
    // (No Enter XR step: tapping either Welcome box starts the XR
    // session itself - see ensureXR().)

    // any press on the page (mouse / touch, even one that misses a
    // button) unlocks audio, so Chitti's voice can play afterwards
    const unlockOnPress = (): void => this.unlockAudio();
    window.addEventListener('pointerdown', unlockOnPress);
    this.cleanupFuncs.push(() =>
      window.removeEventListener('pointerdown', unlockOnPress),
    );

    // a souvenir being picked up (pinch-grab) counts as "grabbed for the
    // photo" - the Grabbed tag is managed by GrabSystem, we only read it
    this.queries.held.subscribe('qualify', (entity) => {
      this.onGrabbedEntity(entity);
    });
    // and a souvenir being put down (the hand let go) is the place step
    // of grab-and-place: it stays where she dropped it
    this.queries.held.subscribe('disqualify', (entity) => {
      this.onReleasedEntity(entity);
    });

    // debug + test hooks (same shape as v1.5): window.__tour is the live
    // state; window.__tourHandle drives the voice-command path.
    const w = window as unknown as Record<string, unknown>;
    w.__tour = this.debugState();
    (window as unknown as { __tourHandle: (h: string) => void }).__tourHandle = (
      h: string,
    ) => this.handleCommand(h);
    // Raycast probe for naming a stray object in the frame (Bhanu
    // 2026-11-17: a gold bar crossed Chitti's face in two pictures).
    // Call window.__tourRaycast(nx, ny) with normalised screen coords
    // (-1..1, y up) - it returns a JSON string of the first 5 hits
    // (object name, distance, point, material colour), so the bar's
    // owner is named instead of guessed.
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    w.__tourRaycast = (nx: number, ny: number): string => {
      const cam = this.world.camera;
      if (!cam) return '[]';
      ndc.set(nx, ny);
      raycaster.setFromCamera(ndc, cam);
      const hits = raycaster.intersectObjects(this.world.scene.children, true);
      return JSON.stringify(
        hits.slice(0, 5).map((h) => {
          const m = (h.object as Mesh).material as
            | { color?: { getHexString?: () => string } }
            | undefined;
          return {
            name: h.object.name || h.object.type,
            dist: +h.distance.toFixed(2),
            point: h.point.toArray().map((v) => +v.toFixed(2)),
            color: m?.color?.getHexString?.() ?? null,
          };
        }),
      );
    };

    this.setPhase('enter');
    this.syncComponent(true);
    log('tour v2.0 ready');

    // autotest via URL (?autotest=1), like v1.5
    if (new URLSearchParams(window.location.search).get('autotest') === '1') {
      setTimeout(() => this.runAutotest(), 800);
    }
  }

  // ================= UI =================
  private wirePanel(
    panel: UIKitMLAsset | null,
    handlers: Record<string, () => void>,
  ): void {
    if (!panel) {
      log('panel missing, UI buttons will not work');
      return;
    }
    Object.keys(handlers).forEach((id) => {
      const el = panel.getElementById(id) as unknown as UiEl | null;
      this.els[id] = el;
      if (!el) {
        log('UI element missing:', id);
        return;
      }
      const fn = handlers[id];
      // keep the wiring itself so the autotest can prove a button routes
      // to its handler (the physical tap is proven separately, by hand)
      // every tap first unlocks audio (see unlockAudio): a tap is the
      // user gesture that lets Chitti's voice play
      const wrapped = (): void => {
        this.unlockAudio();
        fn();
      };
      this.buttonHandlers[id] = wrapped;
      el.addEventListener('click', wrapped);
      this.cleanupFuncs.push(() => el.removeEventListener('click', wrapped));
    });
    // text elements (no click handler) + the two mic icons (toggled by
    // updateMicButton - the Meet-style mic button has no label any more)
    // + the Welcome boxes row (hidden for the first 2 s of the screen)
    ['tour-line', 'tour-sub', 'title-root', 'tour-root', 'enter-buttons', 'btn-next-label', 'btn-photo-label', 'btn-mic-icon-on', 'btn-mic-icon-off', 'bubble-text'].forEach((id) => {
      const el = panel.getElementById(id) as unknown as UiEl | null;
      if (el) this.els[id] = el;
    });
  }

  private setEl(id: string, props: Record<string, string>): void {
    const el = this.els[id];
    if (el) {
      try {
        el.setProperties(props);
      } catch (e) {
        log('setProperties failed for', id, e);
      }
    }
  }

  private showEl(id: string, show: boolean): void {
    this.setEl(id, { display: show ? 'flex' : 'none' });
  }

  private setLine(text: string, sub?: string): void {
    this.currentLine = text;
    if (sub !== undefined) this.currentSub = sub;
    this.setEl('tour-line', { text });
    if (sub !== undefined) this.setEl('tour-sub', { text: sub });
  }

  /** Switch the sky + city lights to one of her pictures' light:
   *  day = bright blue morning (the drive, Brooklyn Bridge, Central
   *  Park, Statue of Liberty); dusk = purple-orange evening (Times
   *  Square arrival, Broadway, Grand Central interior); sunset = golden
   *  sun low over the river (DUMBO); twilight = deep blue-purple with
   *  an orange band at the horizon (Observation Deck). */
  private setSky(mode: SkyMode): void {
    this.skyMode = mode;
    (Object.keys(this.skyDomes) as SkyMode[]).forEach((m) => {
      const dome = this.skyDomes[m];
      if (dome) dome.visible = m === mode;
    });
    const light: Record<SkyMode, { amb: number; ambI: number; sun: number; sunI: number; moonI: number }> = {
      day: { amb: 0xdfeaf5, ambI: 1.15, sun: 0xfff2d9, sunI: 1.35, moonI: 0.15 },
      dusk: { amb: 0x8a8fc0, ambI: 0.85, sun: 0xff9a5c, sunI: 0.65, moonI: 0.5 },
      sunset: { amb: 0xe8a87c, ambI: 0.9, sun: 0xffb347, sunI: 1.0, moonI: 0.2 },
      twilight: { amb: 0x6b7bb8, ambI: 0.8, sun: 0xff9a5c, sunI: 0.45, moonI: 0.5 },
    };
    const L = light[mode];
    if (this.cityAmbient) {
      this.cityAmbient.color.setHex(L.amb);
      this.cityAmbient.intensity = L.ambI;
    }
    if (this.citySun) {
      this.citySun.color.setHex(L.sun);
      this.citySun.intensity = L.sunI;
    }
    if (this.cityMoon) this.cityMoon.intensity = L.moonI;
  }

  private setPhase(phase: string): void {
    // leaving a destination closes the Journal (and its 3D gallery)
    if (phase !== 'arrived' && this.journalOpen) {
      this.journalOpen = false;
      this.hideJournalGallery();
    }
    // The souvenir table appears ONLY at a destination - arrived,
    // photopick, story, thankyou, next - and nowhere else (Bhanu
    // 2026-11-17 17:39): never on the ride, never in the conversation /
    // choice phase, never in the tutorial, never on the Welcome screen,
    // and never following her between places. It is shown once, at the
    // end of the step-out (showSouvenirs), and this gate hides it again
    // on every phase change out of the destination.
    if (!['arrived', 'photopick', 'story', 'thankyou', 'next'].includes(phase)) {
      this.hideSouvenirs();
    }
    this.phase = phase;
    this.uiDirty = true;
    this.refreshUI();
    this.syncComponent();
    // re-aim the panels at her real head on EVERY phase change, not just
    // at Enter: she may turn in her seat, and a panel fixed in world
    // space drifts off to one side (and off the right edge) as she does
    this.placePanelsInFront();
    if (phase === 'enter') {
      // Enter shows only the Welcome title at first - no city, no car,
      // no souvenirs, and no speech bubble (it only appears once she
      // is in the game). But Chitti himself stands centre in front of
      // her, like the Screen 1 mockup, with the two glowing buttons
      // either side of him once they appear, 2 s later (see update()).
      // The boxes start hidden on every return to this screen, so the
      // title alone is always what she sees first.
      if (this.city) this.city.visible = false;
      if (this.carObj) this.carObj.visible = false;
      if (this.speechBubble) this.speechBubble.visible = false;
      // BUG (found 2026-11-17 18:17 while verifying the park fix): the
      // city is hidden here but cityRevealed stayed true, so the next
      // driveTo skipped its reveal and the whole second tour played in
      // a black world. Returning to Welcome is a clean slate - the next
      // place named reveals the city again, like a fresh load.
      this.cityRevealed = false;
      this.hideSouvenirs();
      this.standChittiInFront();
      // the Welcome title shows alone first: hide the two boxes and
      // restart the 2 s clock on every return to this screen
      this.enterShownAtMs = performance.now();
      this.enterButtonsShown = false;
      this.showEl('enter-buttons', false);
    }
  }

  /**
   * The direction she is looking (head -Z), into `out`.
   * Object3D.getWorldDirection returns the head's +Z axis, but a person
   * looks along -Z - using the raw value put every panel BEHIND her.
   */
  private headLookDir(out: Vector3): Vector3 {
    try {
      this.player?.head?.getWorldDirection(out);
      out.negate();
    } catch {
      out.set(0, 0, -1);
    }
    out.y = 0;
    if (out.lengthSq() < 0.01) out.set(0, 0, -1);
    out.normalize();
    return out;
  }

  /**
   * Put both panels in front of her, within arm's reach, facing her.
   * The authored spots are 1.4-1.75 m away - too far to poke on a real
   * Quest - and they sit in fixed world space, so if she enters XR facing
   * another way they end up behind her. This re-aims them at her real head.
   */
  private placePanelsInFront(): void {
    const head = this.headPos();
    const fwd = this.headLookDir(this.tmpFwd);
    // her right (fwd x up): for fwd (0,0,-1) this is (1,0,0)
    const right = this.tmpRight;
    right.set(-fwd.z, 0, fwd.x);
    // yaw so the panel's +Z points back at her head
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    // title: 0.9 m ahead, just above eye level, big enough to tap easily
    // (at 0.75 m the 2.1 m panel filled the whole view and the words ran
    // off both edges - readable first, then reachable). It sits a touch
    // below eye level so the two glowing buttons flank Chitti's head
    // (Screen 1 mockup) instead of floating well above him; still
    // within the eye-level band the autotest allows.
    if (this.titlePanel) {
      this.titlePanel.position.set(
        head.x + fwd.x * 0.9,
        head.y - 0.1,
        head.z + fwd.z * 0.9,
      );
      this.titlePanel.rotation.set(-0.07, yaw, 0);
      this.titlePanel.scale.setScalar(0.3);
    }
    // tour: 0.85 m ahead, at EYE LEVEL and a touch to her right, so she
    // can see it and tap it from the passenger seat without looking down.
    // (At 0.3 m right the 1.2 m panel ran off the right edge of the view;
    // 0.1 m keeps every button inside it.)
    // OUT OF THE CAR Chitti stands directly in front of her, so the
    // panel steps to her right - otherwise the 1.2 m panel hides his
    // face. In the car he is on her left and the panel stays centred.
    // (chittiOut covers it: he is out in the tutorial, at every
    // destination, and at the first place choice, where he stands in
    // front of her talking; the phase list is the backstop.)
    // The step is sized to her Screen_4 picture: the panel sits right
    // of Chitti with his whole face clear. At 0.9 m ahead and 0.52 m
    // right, scaled to 0.14 (0.56 m wide), its left edge is at ~15° off
    // her forward - clear of his head's right edge (~11°) - and its
    // right edge at ~42° is comfortably inside the view (at 0.8/0.55
    // the right edge sat at ~47°, and any head turn clipped it off the
    // emulator's edge). The old 0.3 m step left the panel over his face.
    const outOfCar =
      this.chittiOut ||
      [
        'tutorial',
        'tutdone',
        'arrived',
        'photopick',
        'story',
        'thankyou',
        'next',
        'goodbye',
      ].includes(this.phase);
    const tourFwd = outOfCar ? 0.9 : 0.85;
    const tourRight = outOfCar ? 0.52 : 0.2;
    // in-car the panel is 0.22 (0.88 m wide) and stepped right, so it
    // does not cover Chitti driving on her left or the road ahead -
    // at 0.3 it filled the frame during the drive and hid him entirely
    const tourScale = outOfCar ? 0.14 : 0.22;
    if (this.tourPanel) {
      this.tourPanel.position.set(
        head.x + fwd.x * tourFwd + right.x * tourRight,
        head.y,
        head.z + fwd.z * tourFwd + right.z * tourRight,
      );
      this.tourPanel.rotation.set(-0.07, yaw, 0);
      this.tourPanel.scale.setScalar(tourScale);
    }
  }

  /**
   * The speech bubble floats in front of her, centred in her view and
   * above the tour panel, so its text is never cut off at an edge.
   * (It used to sit beside Chitti's head - 1.3 m to her left, almost
   * outside her view, so the words ran off the left edge. It is also
   * shrunk a little: at its old scale it was about a metre wide.)
   */
  private positionBubble(): void {
    if (!this.speechBubble || !this.speechBubble.visible) return;
    const head = this.headPos();
    // along her real forward (not world -Z): she may turn her head, and
    // the bubble must stay in front of her, above Chitti, not off to one
    // side
    const fwd = this.headLookDir(this.tmpFwd);
    const bx = head.x + fwd.x * 0.9;
    const by = head.y + 0.45;
    const bz = head.z + fwd.z * 0.9;
    const yaw = Math.atan2(head.x - bx, head.z - bz);
    this.speechBubble.position.set(bx, by, bz);
    this.speechBubble.rotation.set(0, yaw, 0);
    this.speechBubble.scale.setScalar(0.22);
  }

  /** One panel, one thing: show exactly the line + buttons for this phase. */
  private refreshUI(): void {
    if (!this.tourPanel || !this.titlePanel) return;
    const p = this.phase;
    // the enter screen is the only thing on screen at the enter phase
    this.setEl('title-root', { display: p === 'enter' ? 'flex' : 'none' });
    this.setEl('tour-root', { display: p === 'enter' ? 'none' : 'flex' });
    // no tour buttons show at Enter - clear the list here, before the
    // early return, or it stays stale from the previous phase (a re-run
    // of the autotest then reads the old buttons at the Enter screen)
    this.shownButtons = [];
    if (p === 'enter') return;
    // the two-hand circle ring shows only while the ride waits (ready)
    if (this.readyRing) this.readyRing.visible = p === 'ready';

    const all = [
      'btn-next', 'btn-skip', 'btn-restart', 'btn-back', 'btn-place-times', 'btn-place-park',
      'btn-place-statue', 'btn-left', 'btn-right', 'btn-pause', 'btn-resume',
      'btn-stop', 'btn-history', 'btn-photo', 'btn-mic',
      'btn-where', 'btn-start-ride',
      'btn-turn-left', 'btn-turn-right', 'btn-selfdrive', 'btn-chittidrive',
      'btn-journal', 'btn-send-journal', 'btn-journal-close', 'btn-im-done',
    ];
    all.forEach((id) => this.showEl(id, false));
    const show = (id: string): void => {
      this.showEl(id, true);
      this.shownButtons.push(id);
    };

    if (p === 'tutorial') {
      this.setLine(INTRO_LINES[this.introLineIdx], 'CHITTI IS TALKING');
    } else if (p === 'tutdone') {
      this.setLine(
        "That's all - short and sweet! Hear it again, or shall we go?",
        'TUTORIAL DONE',
      );
      show('btn-skip');
      show('btn-restart');
    } else if (p === 'choose') {
      // NEW FLOW: voice-first conversation - she SPEAKS where she wants
      // to go. The mic comes FIRST; the three place buttons are only the
      // tap fallback if voice fails. One board, minimal options.
      this.setLine(
        'Tap the mic and tell me where you want to go - Times Square, Central Park, or the Statue of Liberty?',
        this.chittiOut
          ? 'SPEAK TO CHITTI - HE IS RIGHT IN FRONT OF YOU'
          : 'CHITTI IS DRIVING BESIDE YOU - LOOK LEFT!',
      );
      show('btn-mic');
      show('btn-place-times');
      show('btn-place-park');
      show('btn-place-statue');
    } else if (p === 'ready') {
      // she named a place and Chitti is in the car beside her: the ride
      // starts with the Start ride button (no circle gesture any more).
      const dest = PLACES[this.pendingPlace ?? ''];
      this.setLine(
        READY_LINE,
        dest ? `READY TO GO TO ${dest.name.toUpperCase()}` : 'READY TO GO',
      );
      show('btn-start-ride');
      // always a way back: she can pick a different place instead of
      // sitting in the car with nowhere to go
      show('btn-back');
      show('btn-mic');
      // the separate option to drive herself, as a tap as well as a
      // voice ask - she takes the driver seat, Chitti the passenger seat
      show('btn-selfdrive');
    } else if (p === 'driving') {
      const dest = PLACES[this.destPlace];
      if (this.selfDriving) {
        this.setLine(
          this.paused
            ? 'Paused. Take your time.'
            : `You're driving to ${dest ? dest.name : 'your place'}!`,
          'TURN LEFT OR RIGHT - OR LET CHITTI DRIVE',
        );
      } else {
        this.setLine(
          this.paused
            ? 'Paused. Take your time.'
            : `Driving to ${dest ? dest.name : 'your place'}...`,
          '',
        );
      }
      if (this.paused) show('btn-resume');
      else show('btn-pause');
      show('btn-stop');
      show('btn-mic');
      // turn left / turn right DURING the drive, as tap buttons as well
      // as voice; when she drives herself, the wheel goes back to Chitti
      show('btn-turn-left');
      show('btn-turn-right');
      if (this.selfDriving) show('btn-chittidrive');
      else show('btn-selfdrive');
      // no left/right here: the choice comes only after the visit ends
    } else if (p === 'getout') {
      const pl = PLACES[this.place];
      this.setLine(
        `Here is the destination - ${pl ? pl.name : 'New York'}!`,
        '',
      );
    } else if (p === 'arrived') {
      // Screen 4 mockup: the panel is titled with the place name
      // ("Times Square"), History / Photo / mic beside it. The bubble
      // already carries the "Here is the destination" line.
      const pl = PLACES[this.place];
      if (this.journalOpen) {
        // the Journal view: her saved souvenirs + photos, a collection
        // she can open and look through any time
        this.setLine(
          this.journalText(),
          `MY TRAVEL JOURNAL - ${this.journal.length} KEEPSAKE${this.journal.length === 1 ? '' : 'S'}`,
        );
        show('btn-journal-close');
        show('btn-mic');
      } else {
        this.setLine(pl ? pl.name : 'You are here!', '');
        this.setEl('btn-photo-label', { text: 'Photo' });
        show('btn-history');
        show('btn-photo');
        show('btn-where');
        show('btn-mic');
        show('btn-journal');
        // "I'm done" ends the whole tour from here - she has visited
        // enough places and wants to finish (Bhanu 2026-11-17)
        show('btn-im-done');
        // holding a souvenir: she can send it to the Journal (the
        // glowing ring) with one tap, as well as by tossing it
        if (this.heldObject) show('btn-send-journal');
      }
    } else if (p === 'photopick') {
      this.setLine(
        'Grab something to hold in your photo!',
        'PICK IT UP WITH YOUR HAND',
      );
      this.setEl('btn-photo-label', { text: 'Take the photo' });
      show('btn-photo');
      show('btn-im-done');
    } else if (p === 'story') {
      const card = this.storyCards[this.storyIdx] ?? '';
      this.setLine(card, `STORY ${this.storyIdx + 1} OF ${this.storyCards.length}`);
      show('btn-next');
      this.setEl('btn-next-label', {
        text: this.storyIdx === this.storyCards.length - 1 ? 'Done' : 'Next',
      });
      show('btn-im-done');
    } else if (p === 'thankyou') {
      this.setLine(THANK_YOU, 'VISIT COMPLETE');
    } else if (p === 'next') {
      this.setLine(
        this.suggestionText,
        'POINT LEFT with your left hand  |  POINT RIGHT with your right hand',
      );
      if (this.nextLeft) show('btn-left');
      if (this.nextRight) show('btn-right');
      show('btn-mic');
      show('btn-im-done');
    } else if (p === 'goodbye') {
      // the end of the whole tour: first Chitti's thank-you, then her
      // Journal (the scrapbook) opens on this same screen - closing it
      // takes her back to the Welcome screen (see closeJournal)
      if (this.journalOpen) {
        this.setLine(
          this.journalText(),
          `MY TRAVEL JOURNAL - ${this.journal.length} KEEPSAKE${this.journal.length === 1 ? '' : 'S'}`,
        );
        show('btn-journal-close');
        show('btn-mic');
      } else {
        this.setLine(THANK_YOU, 'THANK YOU');
      }
    }
    this.uiDirty = false;
  }

  // ================= flow =================
  /** Start tutorial: Chitti's short intro (10-20 s), then Skip / Restart. */
  private startTutorial(): void {
    // the tap that chose this also starts the XR session
    this.ensureXR();
    this.introStartMs = performance.now();
    this.introEndMs = 0;
    this.introLineIdx = 0;
    this.setPhase('tutorial');
    // the tutorial is before the game: no city, no car, no bubble (they
    // appear only when she enters the game) - Chitti stands in front of
    // her in the void instead. (Without this, a tutorial reached after
    // entering the game would leave the start street visible behind him,
    // and his stand spot would read as on the avenue.)
    if (this.city) this.city.visible = false;
    if (this.carObj) this.carObj.visible = false;
    if (this.speechBubble) this.speechBubble.visible = false;
    this.hideSouvenirs();
    // he stands in front of her, facing her, while he talks - never
    // hidden in the car during the intro
    this.standChittiInFront();
    // the first rule, spoken as it appears on the panel; the other lines
    // are spoken as the panel rotates to them (see the update loop), so
    // the bubble beside him is the live transcript of what he is saying
    this.speak(INTRO_LINES[0]);
  }

  /** Restart the intro from the beginning (from the tutdone screen). */
  private restartTutorial(): void {
    if (this.phase !== 'tutdone') return;
    this.startTutorial();
  }

  /** Skip the tutorial: straight back to the main screen (Start tutorial
   * / Start the game) - not into the game. */
  private skipTutorial(): void {
    if (this.phase !== 'tutdone') return;
    this.setPhase('enter');
  }

  /**
   * Back to the place choice from the car (ready to ride): she picked a
   * place but changed her mind. The ride only ever starts after a place
   * is chosen, so leaving the ready screen must never strand her in the
   * car with nowhere to go.
   */
  private backToChoice(): void {
    // NEW FLOW: changing her mind while Chitti is still climbing in
    // (boarding runs after she names a place) - stop the climb, seat
    // him, and stay on the place choice.
    if (this.boardActive) {
      this.boardActive = false;
      this.pendingAfterBoard = null;
      this.resetChittiToSeat();
      this.pendingPlace = null;
      this.showChoice();
      return;
    }
    if (this.phase !== 'ready') return;
    this.pendingPlace = null;
    this.showChoice();
  }

  /** The intro finished: show Skip tutorial / Restart tutorial, nothing else. */
  private showTutDone(): void {
    this.introEndMs = performance.now();
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      /* speech unavailable */
    }
    this.setPhase('tutdone');
  }

  /** Test hook (autotest only): jump the intro to its end. */
  private fastForwardIntro(): void {
    this.introStartMs = performance.now() - INTRO_MS;
  }

  /** Start the game: a conversation with Chitti, not the city yet. */
  private startGame(): void {
    // the tap that chose this also starts the XR session
    this.ensureXR();
    // NEW FLOW (Bhanu 2026-11-16 20:04): the game starts as a
    // conversation - NO New York city, NO car, until she names a place.
    // Just the screen and Chitti, standing right in front of her,
    // facing her, talking, like two friends going out together. (He may
    // already be standing in front from the tutorial void; standing him
    // in front again just re-places him 1.5 m dead ahead.)
    this.city.visible = false;
    this.carObj.visible = false;
    this.standChittiInFront();
    this.setPhase('choose');
    // a long glance at her while he greets her
    this.speak(GREETING, { glanceMs: 5000 });
  }

  private onNext(): void {
    if (this.phase === 'story') {
      if (this.storyIdx < this.storyCards.length - 1) {
        this.storyIdx++;
        this.refreshUI();
        return;
      }
      // story finished - back to the place
      this.setPhase('arrived');
      this.say('Shall we go somewhere next, or stay here a little longer?');
    }
  }

  private showChoice(): void {
    if (this.phase === 'enter' || this.phase === 'tutorial' || this.phase === 'tutdone') return;
    this.setPhase('choose');
    this.say('Where shall we go now? Times Square, Central Park, or the Statue of Liberty?');
  }

  /** The visit is done (photos done, or "Where next?" tapped): thank-you, then left/right. */
  private finishVisit(): void {
    if (this.phase !== 'arrived' && this.phase !== 'photopick' && this.phase !== 'story') return;
    this.sayThankYou();
  }

  /** "Thank you so much for taking me!" - the last step of a visit. */
  private sayThankYou(): void {
    if (this.phase === 'thankyou') return;
    // the visit's photo is done: the next destination may take its own
    this.photoInProgress = false;
    if (this.thankYouTimer) clearTimeout(this.thankYouTimer);
    this.thankYouShown = true;
    this.setPhase('thankyou');
    this.speak(THANK_YOU);
    this.thankYouTimer = setTimeout(() => {
      this.thankYouTimer = null;
      this.showNext();
    }, THANKYOU_MS);
  }

  /**
   * "I'm done" (Bhanu 2026-11-17): the end of the WHOLE tour, not just
   * one visit - she has visited enough places and feels done. Chitti
   * says thank-you (the same line + clip as the visit thank-you, so
   * his voice still works on the Quest), then her Journal opens on
   * this screen; closing the Journal takes her back to the Welcome
   * screen (see closeJournal). Only from a destination or the
   * left/right choice - never mid-drive or mid-ride.
   */
  private endTour(): void {
    if (
      this.phase !== 'arrived' &&
      this.phase !== 'photopick' &&
      this.phase !== 'story' &&
      this.phase !== 'next'
    )
      return;
    this.photoInProgress = false;
    if (this.goodbyeTimer) clearTimeout(this.goodbyeTimer);
    this.setPhase('goodbye');
    this.speak(THANK_YOU);
    this.goodbyeTimer = setTimeout(() => {
      this.goodbyeTimer = null;
      // the Journal opens here, on the goodbye screen - no setPhase
      // call, or setPhase would close the Journal again (it closes on
      // leaving 'arrived')
      this.journalOpen = true;
      this.showJournalGallery();
      this.say(JOURNAL_OPEN_LINE);
      this.refreshUI();
    }, THANKYOU_MS);
  }

  /** Where can the car turn from here (a real ~90-degree turn, no U-turns)? */
  private turnDrive(dir: 'left' | 'right'): {
    node: NodeId;
    destNode: NodeId;
    destPlace: string;
  } | null {
    const info = this.turnInfo(this.currentNode, this.facing, dir);
    if (!info) return null;
    const cont = this.continuation(info.node, this.currentNode);
    const destNode = cont ?? info.node;
    return { node: info.node, destNode, destPlace: NODE_PLACE[destNode] };
  }

  /** The left/right choice, only after the visit ends: Chitti suggests a nearby place first. */
  private showNext(): void {
    // NEW FLOW: when he asks "shall we go?", the SAME car comes back -
    // it drives back in behind them, ready for the next ride.
    this.returnCar();
    this.nextLeft = this.turnDrive('left');
    this.nextRight = this.turnDrive('right');
    // Times Square, her picture: "Turn left to Central Park or right
    // to Brooklyn Bridge?" - the graph's right turn from Times Square
    // leads to Grand Central, not the bridge, so the right option is
    // set to the bridge here (the drive routes down the avenue and
    // across). Only while the bridge is unvisited, like her picture.
    if (this.place === 'times-square' && !this.visited.has('brooklyn-bridge')) {
      this.nextRight = { node: 'timesE', destNode: 'bridge', destPlace: 'brooklyn-bridge' };
    }
    if (!this.nextLeft && !this.nextRight) {
      this.say('No turn here - let us pick a place to go next!');
      this.setPhase('choose');
      return;
    }
    const leftPlace = this.nextLeft ? this.nextLeft.destPlace : null;
    const rightPlace = this.nextRight ? this.nextRight.destPlace : null;
    const leftVisited = leftPlace ? this.visited.has(leftPlace) : true;
    const rightVisited = rightPlace ? this.visited.has(rightPlace) : true;
    let dir: 'left' | 'right';
    let placeName: string;
    if (this.nextLeft && !leftVisited && rightVisited) {
      dir = 'left';
      placeName = PLACES[leftPlace as string].name;
    } else if (this.nextRight && !rightVisited && leftVisited) {
      dir = 'right';
      placeName = PLACES[rightPlace as string].name;
    } else if (this.nextLeft) {
      dir = 'left';
      placeName = PLACES[leftPlace as string].name;
    } else {
      dir = 'right';
      placeName = PLACES[rightPlace as string].name;
    }
    this.suggestion = dir;
    this.suggestionText = `Let's go ${dir} first - ${placeName} is that way!`;
    this.setPhase('next');
    this.speak(this.suggestionText);
  }

  // ================= drive engine (road graph + treadmill) =================
  private driveTo(placeKey: string): void {
    const p = PLACES[placeKey];
    if (!p || this.driving) return;
    // Re-naming a place while the ride waits just switches the
    // destination (the Start ride button stays up).
    if (this.phase === 'ready') {
      this.pendingPlace = placeKey;
      this.refreshUI();
      this.speak(READY_LINE);
      return;
    }
    this.pendingPlace = placeKey;
    // NEW FLOW: naming a place is what brings the world in - the city
    // and the car appear NOW, and Chitti gets in beside her (until
    // now he stood in front of her, talking). First place only: after
    // that the city is already there.
    if (!this.cityRevealed) {
      this.city.visible = true;
      this.carObj.visible = true;
      this.cityRevealed = true;
    }
    // he gets in the car before the ride - the Start ride button waits
    // in the passenger seat, with him driving on her left
    if (this.chittiOut) {
      this.boardCar(() => this.openReady(placeKey));
      return;
    }
    this.openReady(placeKey);
  }

  /** She named a place: the Start ride button waits for her tap. */
  private openReady(placeKey: string): void {
    const p = PLACES[placeKey];
    if (!p) return;
    // the city appears in daylight here (Screen_3) - the dark void was
    // only for the entry / mic-first screens; the ready view is the
    // bright city with Chitti driving
    this.setSky('day');
    this.setPhase('ready');
    this.speak(READY_LINE);
  }

  /** The actual drive: route on the road graph, then start the ~5s ride. */
  private beginDriveTo(placeKey: string): void {
    const p = PLACES[placeKey];
    if (!p) return;
    // the drive is daylight in her pictures (Screen_3) - whatever sky
    // the last place had, the ride back out is morning sun again
    this.setSky('day');
    const target = p.node as NodeId;
    // World Trade Center: the tower stands south-west of the node, so
    // the drive must come in from the north (heading south) for the
    // tower to be ahead-right of her on arrival, in view. Route via
    // 'start' (the node just north of the WTC) - from the south the car
    // drives past the tower site and turns around there, then comes in
    // facing south. (Bhanu 2026-11-17: the arrival must show the tower.)
    let nodes = bfs(this.currentNode, target);
    if (placeKey === 'world-trade-center' && this.currentNode !== 'wtc') {
      nodes = [...bfs(this.currentNode, 'start'), 'wtc'];
    }
    this.startDrive(nodes, placeKey);
    this.say(`Great choice! Driving you to ${p.name} now - about 5 seconds. Enjoy the ride!`);
  }

  /** Tap fallback: start the ride without the gesture (hands not tracked). */
  /** The Start ride button: the ride starts, from the button alone. */
  private tapStartRide(): void {
    if (this.phase !== 'ready' || !this.pendingPlace) return;
    const dest = this.pendingPlace;
    this.pendingPlace = null;
    this.beginDriveTo(dest);
  }

  // ================= self-drive (Bhanu 2026-11-16 22:01) =================
  /** She takes the driver seat (LEFT); Chitti moves to the passenger
   * seat (RIGHT) and guides her. From 'ready' the ride starts at once;
   * from 'driving' the seats swap mid-ride. She steers with Turn left /
   * Turn right (buttons or voice); "Let Chitti drive" hands it back. */
  private startSelfDrive(): void {
    if (this.phase === 'choose') {
      this.say('Pick a place first, then tap Drive yourself!');
      return;
    }
    if (this.phase !== 'ready' && this.phase !== 'driving') {
      // at a destination (or elsewhere): pick the next place first,
      // then she can drive
      this.say(DRIVE_NEXT_LINE);
      return;
    }
    if (this.selfDriving) return;
    this.selfDriving = true;
    this.swapSeats(true);
    this.say(SELFDRIVE_START_LINE);
    this.syncComponent();
    if (this.phase === 'ready' && this.pendingPlace) {
      const dest = this.pendingPlace;
      this.pendingPlace = null;
      this.beginDriveTo(dest);
    }
    this.refreshUI();
  }

  /** Hand the wheel back to Chitti: seats swap back, he drives on. */
  private handBackToChitti(): void {
    if (!this.selfDriving) return;
    this.selfDriving = false;
    this.swapSeats(false);
    this.say(CHITTI_DRIVE_LINE);
    this.syncComponent();
    this.refreshUI();
  }

  /** End self-drive silently (arrival / reset): seats back, no line. */
  private endSelfDriveSilent(): void {
    if (!this.selfDriving) return;
    this.selfDriving = false;
    this.swapSeats(false);
    this.syncComponent();
  }

  /** Swap the seats: self-drive (she left, Chitti right, facing her) or
   * normal (Chitti left driving, she right as passenger). The car shifts
   * +0.45 in x so the steering wheel sits in front of her; Chitti moves
   * to the passenger seat and turns to face her, chatting and guiding. */
  private swapSeats(self: boolean): void {
    if (!this.carObj || !this.chittiObj) return;
    if (self) {
      // the car shifts right so the driver seat comes under her head
      // (SELF_DRIVE_SHIFT, not the old +0.45 - that left the wheel
      // 0.45 m left of her; +0.7 puts it beside her, like her picture)
      this.carObj.position.x = CAR_HOME_X + SELF_DRIVE_SHIFT;
      this.chittiObj.position.set(0.45, 0, 0.35);
      this.chittiObj.rotation.set(0, Math.PI / 2, 0);
      // passenger now: arms hang, he is not driving
      this.poseChittiArms(false);
    } else {
      this.carObj.position.x = CAR_HOME_X;
      this.chittiObj.position.set(-0.45, 0, 0.35);
      this.chittiObj.rotation.set(0, 0, 0);
      // driver again: hands back on the wheel
      this.poseChittiArms(true);
    }
  }

  // ================= glowing turn arrow (Bhanu 2026-11-16 22:01) =================
  /** Show the glowing cyan arrow on the road at the junction ahead,
   * pointing the way the car will turn. `dIn` is the direction of travel
   * (city coords); the arrow group is rotated to face along it. */
  private showTurnArrow(dir: 'left' | 'right', node: NodeId, dIn: { x: number; z: number }): void {
    if (!this.turnArrow || !this.turnArrowHead) return;
    const n = NODES[node];
    if (!n) return;
    this.turnArrow.position.set(n.x, 0.04, n.z);
    this.turnArrow.rotation.y = Math.atan2(dIn.x, dIn.z);
    this.turnArrowHead.rotation.z = dir === 'left' ? Math.PI / 2 : -Math.PI / 2;
    this.turnArrowHead.position.set(dir === 'left' ? -0.35 : 0.35, 0, 1.15);
    this.turnArrow.visible = true;
    this.turnArrowHideAt = performance.now() + 4000;
  }

  private hideTurnArrow(): void {
    if (this.turnArrow) this.turnArrow.visible = false;
    this.turnArrowHideAt = 0;
  }

  // ================= tour Journal (Bhanu 2026-11-16 22:06) =================
  /** The Journal as text for the panel: one keepsake per line. */
  private journalText(): string {
    if (this.journal.length === 0) {
      return 'Nothing saved yet - grab a souvenir and send it to your Journal!';
    }
    return this.journal
      .map((e, i) => `${i + 1}. ${e.name} - ${e.place}`)
      .join('\n');
  }

  /** A short summary of the Journal for the ECS component + debug hook. */
  private journalSummary(): string {
    if (this.journal.length === 0) return '';
    return this.journal.map((e) => `${e.name} @ ${e.place}`).join('; ');
  }

  /** Open the Journal view (the panel shows the saved collection). */
  private openJournal(): void {
    if (this.phase !== 'arrived') return;
    this.journalOpen = true;
    this.showJournalGallery();
    this.say(JOURNAL_OPEN_LINE);
    this.refreshUI();
  }

  /** Close the Journal view, back to the destination panel - or, at
   * the end of the tour, back to the Welcome screen. */
  private closeJournal(): void {
    this.journalOpen = false;
    this.hideJournalGallery();
    if (this.phase === 'goodbye') {
      // the tour is over: closing the Journal takes her home, to the
      // Welcome screen (title first, two boxes 2 s later)
      this.setPhase('enter');
      return;
    }
    this.refreshUI();
  }

  /** Journal gallery (Bhanu 2026-11-16 22:39, scene 7): the open
   * scrapbook from her picture - when the Journal opens, the saved
   * souvenir 3D objects appear in a row in front of her at eye level,
   * like the items laid out on the journal pages, with Chitti beside
   * them. Hidden again on close. */
  private showJournalGallery(): void {
    const ids = [...this.journalSavedIds];
    if (ids.length === 0) return;
    const head = this.headPos();
    const fwd = this.headLookDir(this.tmpFwd);
    const right = this.tmpRight.set(-fwd.z, 0, fwd.x).normalize();
    const n = ids.length;
    ids.forEach((id, i) => {
      const s = this.souvenirObjs.find((o) => o.id === id);
      if (!s) return;
      const off = (i - (n - 1) / 2) * 0.35;
      const px = head.x + fwd.x * 1.2 + right.x * off;
      const pz = head.z + fwd.z * 1.2 + right.z * off;
      if (s.homeParent) s.homeParent.add(s.obj);
      s.obj.position.set(px, 1.15, pz);
      s.obj.visible = true;
    });
  }

  /** Put the gallery objects back home (hidden) when the Journal closes. */
  private hideJournalGallery(): void {
    this.journalSavedIds.forEach((id) => {
      const s = this.souvenirObjs.find((o) => o.id === id);
      if (!s) return;
      if (s.homeParent) s.homeParent.add(s.obj);
      s.obj.position.copy(s.homePos);
      s.obj.quaternion.copy(s.homeQuat);
      s.obj.visible = false;
    });
  }

  /** Send the held souvenir to the Journal (tap path): it flies along
   * the glowing arc to the ring, then is saved and hidden. */
  private sendHeldToJournal(): void {
    if (!this.heldObject || this.phase !== 'arrived') return;
    this.startJournalFly(this.heldObject);
  }

  /** Start a souvenir flying to the Journal ring along the arc. */
  private startJournalFly(id: string): void {
    const s = this.souvenirObjs.find((o) => o.id === id);
    if (!s || !this.journalRing) return;
    // if the grab system still holds it, let go first or the fly fights
    // the hand; forceRelease drops the Grabbed tag on its next frame
    try {
      this.world.getSystem(GrabSystem)?.forceRelease(s.ent);
    } catch {
      /* not held by the grab system */
    }
    // the object flies in world space, so put it back on the scene root
    // at its current world spot first (the hand had reparented it)
    s.obj.getWorldPosition(this.journalFlyFrom);
    if (s.homeParent) s.homeParent.add(s.obj);
    s.obj.position.copy(this.journalFlyFrom);
    this.journalRing.getWorldPosition(this.journalFlyTo);
    this.journalFlyId = id;
    this.journalFlyStartMs = performance.now();
    this.journalFlyActive = true;
    // the held flags clear now: the object is on its way to the Journal,
    // not in her hand any more, and the photo flow must not see it
    this.heldObject = null;
    this.photoObject = null;
    this.refreshUI();
  }

  /** The glowing arc from a held souvenir to the Journal ring, rewritten
   * in place each frame while she holds something at a destination. */
  private updateJournalArc(): void {
    const arc = this.journalArc;
    const geo = this.journalArcGeo;
    const table = this.souvenirTable;
    if (!arc || !geo || !table) return;
    const show =
      this.phase === 'arrived' && !!this.heldObject && !this.journalFlyActive;
    arc.visible = show;
    if (!show) return;
    const s = this.souvenirObjs.find((o) => o.id === this.heldObject);
    if (!s || !this.journalRing) return;
    // quadratic bezier: held object -> up over the middle -> the ring,
    // in world space, then into table-local coordinates (the arc is a
    // child of the table, which sits at a fixed world spot)
    s.obj.getWorldPosition(this.tmpArcA);
    this.journalRing.getWorldPosition(this.tmpArcB);
    this.tmpArcC.addVectors(this.tmpArcA, this.tmpArcB).multiplyScalar(0.5);
    this.tmpArcC.y += 0.5;
    const tablePos = table.position;
    const attr = geo.getAttribute('position') as Float32BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.journalArcCount; i++) {
      const t = i / (this.journalArcCount - 1);
      const u = 1 - t;
      this.tmpArcP
        .copy(this.tmpArcA)
        .multiplyScalar(u * u)
        .addScaledVector(this.tmpArcC, 2 * u * t)
        .addScaledVector(this.tmpArcB, t * t);
      arr[i * 3] = this.tmpArcP.x - tablePos.x;
      arr[i * 3 + 1] = this.tmpArcP.y - tablePos.y;
      arr[i * 3 + 2] = this.tmpArcP.z - tablePos.z;
    }
    attr.needsUpdate = true;
  }

  /** Finish a Journal fly: save the keepsake, hide the object, say so. */
  private finishJournalFly(): void {
    const id = this.journalFlyId;
    this.journalFlyActive = false;
    this.journalFlyId = null;
    if (!id) return;
    const s = this.souvenirObjs.find((o) => o.id === id);
    if (s) s.obj.visible = false;
    const name = SOUVENIR_NAMES[id] ?? 'souvenir';
    const placeName = PLACES[this.place]?.name ?? 'New York';
    this.journal.push({ kind: 'souvenir', name, place: placeName });
    this.journalSavedIds.add(id);
    this.say(JOURNAL_SAVED_LINE);
    this.syncComponent();
    this.refreshUI();
    log('journal saved:', id, 'at', placeName);
  }

  /** Save a photo into the Journal (called when a photo is taken). */
  private savePhotoToJournal(): void {
    const placeName = PLACES[this.place]?.name ?? 'New York';
    this.journal.push({ kind: 'photo', name: 'Photo', place: placeName });
    this.syncComponent();
    log('journal photo saved at', placeName);
  }

  /** Head position (passenger-seat eye); falls back to the seat if untracked. */
  private headPos(): Vector3 {
    const v = this.tmpHead;
    try {
      this.player?.head?.getWorldPosition(v);
    } catch {
      /* fall back below */
    }
    if (v.lengthSq() < 0.01) v.set(0.45, 1.5, 0.35);
    return v;
  }

  /** Both palm positions (world), or null when hands are not tracked. */
  private readPalms(): { l: Vector3; r: Vector3; mid: Vector3 } | null {
    if (this.gestureDebug && this.debugPalms) {
      const { l, r } = this.debugPalms;
      this.tmpMid.addVectors(l, r).multiplyScalar(0.5);
      if (!this.palmsPlausible(l, r, this.tmpMid)) return null;
      return { l, r, mid: this.tmpMid };
    }
    try {
      const lg = this.player?.gripSpaces?.left;
      const rg = this.player?.gripSpaces?.right;
      if (!lg || !rg) return null;
      lg.getWorldPosition(this.tmpL);
      rg.getWorldPosition(this.tmpR);
      this.tmpMid.addVectors(this.tmpL, this.tmpR).multiplyScalar(0.5);
      if (!this.palmsPlausible(this.tmpL, this.tmpR, this.tmpMid)) return null;
      return { l: this.tmpL, r: this.tmpR, mid: this.tmpMid };
    } catch {
      return null;
    }
  }

  /**
   * Plausibility: untracked hands sit at the origin, so ignore those; the
   * circle is made on the desk in front of her, below eye level.
   */
  private palmsPlausible(l: Vector3, r: Vector3, mid: Vector3): boolean {
    if (l.lengthSq() < 0.0025 || r.lengthSq() < 0.0025) return false;
    const head = this.headPos();
    if (mid.y > head.y + 0.1) return false;
    if (mid.y < head.y - 0.9) return false;
    const dx = mid.x - head.x;
    const dz = mid.z - head.z;
    if (dx * dx + dz * dz > 0.64) return false; // within 0.8 m of her
    return true;
  }

  private startDrive(nodes: NodeId[], destPlace: string): void {
    // never drive nowhere: a ride only starts for a real place. Without
    // a destination she would sit in the car with Chitti and no way
    // forward, so send her back to the place choice instead.
    if (!destPlace || !PLACES[destPlace]) {
      log('startDrive with no destination - back to choice');
      this.driving = false;
      this.drive = null;
      this.showChoice();
      return;
    }
    // if Chitti is standing outside, he gets back in first, then we drive
    if (this.chittiOut) {
      this.boardCar(() => this.startDrive(nodes, destPlace));
      return;
    }
    // The ave40<->east40 edge crosses a stretch with no road: Park St
    // ends at the avenue (x 8) and East St starts 5 m further east
    // (x 13) - between them is only sidewalk. Drive around it on real
    // roads instead (down the avenue, across the plaza, up East St).
    // The graph edge stays, so turns and suggestions still work.
    const expanded: NodeId[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (expanded.length > 0) {
        const prev = expanded[expanded.length - 1];
        if (prev === 'ave40' && n === 'east40') expanded.push('times', 'timesE');
        else if (prev === 'east40' && n === 'ave40') expanded.push('timesE', 'times');
      }
      expanded.push(n);
    }
    nodes = expanded;
    // waypoints: current position, then each node in turn
    const waypoints = [{ x: this.pos.x, z: this.pos.z }];
    nodes.forEach((n) => waypoints.push({ x: NODES[n].x, z: NODES[n].z }));
    const segLens: number[] = [];
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].x - waypoints[i].x;
      const dz = waypoints[i + 1].z - waypoints[i].z;
      const len = Math.hypot(dx, dz);
      segLens.push(len);
      total += len;
    }
    this.driveStartMs = performance.now();
    if (total < 0.01) {
      this.arrive(nodes[nodes.length - 1], destPlace);
      return;
    }
    this.drive = {
      waypoints,
      segLens,
      totalLen: total,
      start: performance.now(),
      pausedTotal: 0,
      pausedAt: null,
      destNode: nodes[nodes.length - 1],
      destPlace,
    };
    this.nodePath = nodes;
    this.segIndex = 0;
    this.segFrom = this.currentNode;
    this.destPlace = destPlace;
    this.driving = true;
    this.paused = false;
    this.nearbyToldFor = null;
    this.nearbyToldAtMs = 0;
    this.setPhase('driving');
    // halfway there, Chitti tells her what places are nearby
    if (this.nearbyTimer) clearTimeout(this.nearbyTimer);
    this.nearbyTimer = setTimeout(() => {
      this.nearbyTimer = null;
      if (this.driving && this.phase === 'driving') this.sayNearbyWhileDriving(destPlace);
    }, 2000);
    this.syncComponent();
  }

  /** Halfway to a place, Chitti tells her what places are nearby. */
  private sayNearbyWhileDriving(destPlace: string): void {
    if (this.nearbyToldFor === destPlace) return;
    const p = PLACES[destPlace];
    if (!p) return;
    this.nearbyToldFor = destPlace;
    this.nearbyToldAtMs = performance.now();
    this.speak(`Before we get there - nearby you'll find ${p.nearby.join(', ')}.`);
    this.setEl('tour-sub', { text: `NEARBY: ${p.nearby.join(' | ').toUpperCase()}` });
    log('nearby told while driving:', p.nearby.join(', '));
  }

  /**
   * "Take me left/right" - a REAL turn, on the road. After the visit ends
   * (the 'next' phase) it turns from where she stands. WHILE travelling
   * she can also say it: the car turns at the next junction ahead.
   * Before that (choosing a place, or just arrived), Chitti gently says
   * to enjoy the ride first.
   */
  private requestTurn(dir: 'left' | 'right'): void {
    if (this.phase === 'enter' || this.phase === 'tutorial' || this.phase === 'tutdone') return;
    if (this.phase === 'driving') {
      this.turnWhileDriving(dir);
      return;
    }
    if (this.phase !== 'next') {
      this.say(
        "We'll choose left or right after we arrive - first, let's enjoy the ride!",
      );
      return;
    }
    // at the 'next' phase: turn from where we are, using the direction we face
    const from = this.currentNode;
    // the board promised a destination (showNext): honour the stored
    // choice - at Times Square the right button promises the Brooklyn
    // Bridge, which the raw turn graph would not reach (it leads to
    // Grand Central). In every other case the stored choice is exactly
    // the turn + continuation below, so this changes nothing there.
    const stored = dir === 'left' ? this.nextLeft : this.nextRight;
    if (stored) {
      // drive via the turn node the board promised, then the shortest
      // real-road route from there to the destination - a plain BFS
      // from here can shortcut past the turn (Times->Park via the
      // avenue) and arrive facing the wrong way, so the next board's
      // left/right is wrong. Bhanu 2026-11-17: Park arrived facing west.
      const via = bfs(stored.node, stored.destNode);
      this.startDrive([from, stored.node, ...via.slice(1)], stored.destPlace);
      return;
    }
    const chosen = this.pickTurn(from, this.facing, dir, null);
    if (!chosen) {
      this.say(
        dir === 'left'
          ? 'No left turn here - the road goes straight. Shall we go somewhere?'
          : 'No right turn here - the road goes straight. Shall we go somewhere?',
      );
      return;
    }
    const cont = this.continuation(chosen, from);
    const nodes: NodeId[] = cont ? [chosen, cont] : [chosen];
    this.startDrive([from, ...nodes], NODE_PLACE[nodes[nodes.length - 1]]);
    this.say(dir === 'left' ? TURN_LEFT_LINE : TURN_RIGHT_LINE);
  }

  /**
   * Turn WHILE travelling: at the next junction ahead, take the road that
   * turns `dir` and drive on from there. The car keeps going to the end
   * of that road (its place), so a mid-drive turn is a real re-route, not
   * a swerve. When the road ahead goes straight, Chitti says so and the
   * drive continues to the place she named.
   */
  private turnWhileDriving(dir: 'left' | 'right'): void {
    if (!this.drive || this.paused) return;
    // the next junction ahead is the node at the end of the current
    // segment; the direction into it is the segment's direction
    const seg = this.segIndex;
    const nextNode = this.nodePath[seg];
    const a = this.drive.waypoints[seg];
    const b = this.drive.waypoints[seg + 1];
    if (!nextNode || !a || !b) return;
    const dIn = { x: b.x - a.x, z: b.z - a.z };
    const len = Math.hypot(dIn.x, dIn.z) || 1;
    dIn.x /= len;
    dIn.z /= len;
    // never turn back the way she came (the node behind this segment)
    const behind = seg > 0 ? this.nodePath[seg - 1] : this.segFrom;
    const chosen = this.pickTurn(nextNode, dIn, dir, behind);
    if (!chosen) {
      this.say(
        dir === 'left'
          ? 'No left turn here - the road goes straight. Shall we go somewhere?'
          : 'No right turn here - the road goes straight. Shall we go somewhere?',
      );
      return;
    }
    const cont = this.continuation(chosen, nextNode);
    const nodes: NodeId[] = cont ? [chosen, cont] : [chosen];
    const destPlace = NODE_PLACE[nodes[nodes.length - 1]];
    if (!destPlace) return;
    // re-route from where the car is now: the drive restarts its 5 s
    // clock for the new leg, and the nearby timer restarts with it
    this.startDrive([nextNode, ...nodes], destPlace);
    // the glowing arrow shows on the road at the junction ahead, and
    // Chitti confirms the turn out loud (Bhanu 2026-11-16 22:01)
    this.showTurnArrow(dir, nextNode, dIn);
    this.say(dir === 'left' ? TURN_LEFT_LINE : TURN_RIGHT_LINE);
  }

  /** The neighbour of `node` that turns `dir` from `dIn`, with its angle. */
  private turnInfo(
    node: NodeId,
    dIn: { x: number; z: number },
    dir: 'left' | 'right',
    exclude: NodeId | null = null,
  ): { node: NodeId; angle: number } | null {
    let best: { node: NodeId; angle: number } | null = null;
    let bestScore = Infinity;
    for (const nb of EDGES[node]) {
      if (nb === exclude) continue;
      const dOut = {
        x: NODES[nb].x - NODES[node].x,
        z: NODES[nb].z - NODES[node].z,
      };
      const len = Math.hypot(dOut.x, dOut.z);
      if (len < 0.01) continue;
      dOut.x /= len;
      dOut.z /= len;
      const th = turnAngle(dIn, dOut);
      const isTurn = dir === 'left' ? th > 0.35 : th < -0.35;
      if (!isTurn) continue;
      // a U-turn is not a left/right turn - skip it
      if (Math.abs(th) > 2.4) continue;
      const score = Math.abs(Math.abs(th) - Math.PI / 2);
      if (score < bestScore) {
        bestScore = score;
        best = { node: nb, angle: th };
      }
    }
    return best;
  }

  /** Pick the neighbour of `node` that turns `dir` from `dIn`. */
  private pickTurn(
    node: NodeId,
    dIn: { x: number; z: number },
    dir: 'left' | 'right',
    exclude: NodeId | null,
  ): NodeId | null {
    const info = this.turnInfo(node, dIn, dir, exclude);
    return info ? info.node : null;
  }

  /** After turning onto `node` from `from`, where does the street lead? */
  private continuation(node: NodeId, from: NodeId): NodeId | null {
    const outs = EDGES[node].filter((n) => n !== from);
    if (outs.length === 0) return null;
    if (outs.length === 1) return outs[0];
    // at an intersection, keep going straight
    const dIn = {
      x: NODES[node].x - NODES[from].x,
      z: NODES[node].z - NODES[from].z,
    };
    const len = Math.hypot(dIn.x, dIn.z) || 1;
    dIn.x /= len;
    dIn.z /= len;
    let best: NodeId | null = null;
    let bestScore = Infinity;
    for (const nb of outs) {
      const dOut = {
        x: NODES[nb].x - NODES[node].x,
        z: NODES[nb].z - NODES[node].z,
      };
      const l2 = Math.hypot(dOut.x, dOut.z) || 1;
      dOut.x /= l2;
      dOut.z /= l2;
      const score = Math.abs(turnAngle(dIn, dOut));
      if (score < bestScore) {
        bestScore = score;
        best = nb;
      }
    }
    return best;
  }

  /** Per-place city dressing (Bhanu 2026-11-17 18:17): at Central Park
   *  the Times Square billboards are hidden - the park must feel like a
   *  park, green and open, not a square with adverts looming over it.
   *  Everywhere else they stay exactly as they were. Called whenever
   *  the place changes (arrival, reset). */
  private applyPlaceCityVisibility(): void {
    if (this.billboardGroup) {
      this.billboardGroup.visible = this.place !== 'central-park';
    }
  }

  /**
   * Arrived: Chitti says "here is the destination" (~2 s), then she and
   * Chitti step out of the car together, within 2 seconds. History is NOT
   * played here - only when she asks.
   */
  private arrive(node: NodeId, destPlace: string): void {
    if (this.driveStartMs > 0) this.lastDriveMs = performance.now() - this.driveStartMs;
    this.drive = null;
    this.driving = false;
    this.paused = false;
    this.currentNode = node;
    this.place = destPlace;
    this.applyPlaceCityVisibility();
    this.visited.add(destPlace);
    if (this.nearbyTimer) {
      clearTimeout(this.nearbyTimer);
      this.nearbyTimer = null;
    }
    const p = PLACES[destPlace];
    // the place's own light from her picture (dusk Times Square,
    // sunset DUMBO, twilight Observation Deck, daylight the rest)
    if (p) this.setSky(p.sky);
    this.setPhase('getout');
    this.speak(`Here is the destination - ${p ? p.name : 'New York'}!`);
    this.getOutPending = true;
    this.getOutAt = performance.now() + GETOUT_WAIT_MS;
    this.syncComponent();
  }

  /**
   * Pedestrian ground in city coords (sidewalks, park lawn, Battery
   * promenade, and the Times Square island pad). Chitti may stand here;
   * the road rectangles below are the only places he may not.
   */
  private walkableAtCity(x: number, z: number): boolean {
    // sidewalks along the avenue
    if ((x >= -16 && x <= -8.5) || (x >= 8.5 && x <= 16)) {
      if (z >= -220 && z <= 44) return true;
    }
    // park lawn, north of Park St
    if (x >= -55 && x <= -19 && z >= -70 && z <= -42) return true;
    // Battery promenade (the avenue's asphalt ends at z=40; south of
    // that the promenade paving is pedestrian ground)
    if (x >= -45 && x <= 45 && z >= 26 && z <= 44) return true;
    // Garden Park lawn, west of West St (Bhanu 2026-11-17 07:41)
    if (x >= -32 && x <= -19.5 && z >= -60 && z <= -40) return true;
    // Times Square island pad, between the avenue lanes
    if (x >= -4 && x <= 4 && z >= -71 && z <= -63) return true;
    return false;
  }

  /**
   * Road in city coords: the five drive rectangles, minus the pedestrian
   * ground that overlaps them (the island pad sits on the avenue, and
   * the promenade's south strip sits past the avenue's end). One ground
   * truth for the spot search and the autotest's off-road check.
   */
  private roadAtCity(x: number, z: number): boolean {
    const onIsland = x >= -4 && x <= 4 && z >= -71 && z <= -63;
    const onPromenadeSouth = x >= -45 && x <= 45 && z >= 40 && z <= 44;
    if (onIsland || onPromenadeSouth) return false;
    const onAve = Math.abs(x) <= 8.5 && z <= 44 && z >= -100;
    const onParkSt = z >= -43.5 && z <= -36.5 && x >= -19.5 && x <= 8.5;
    const onPlazaSt = z >= -63.5 && z <= -56.5 && x >= -19.5 && x <= 19.5;
    const onWestSt = x >= -19.5 && x <= -12.5 && z >= -60.5 && z <= -39.5;
    const onEastSt = x >= 12.5 && x <= 19.5 && z >= -60.5 && z <= -39.5;
    // the waterfront road to DUMBO, east from the avenue at z=30
    const onWaterfrontRd = z >= 26.5 && z <= 33.5 && x >= 8.5 && x <= 19.5;
    return onAve || onParkSt || onPlazaSt || onWestSt || onEastSt || onWaterfrontRd;
  }

  /**
   * Chitti's stand spot, in front of her head, facing her: fan out from
   * her forward ray (dead ahead first, then ±20° and ±40°) at 1.5–6 m
   * and take the closest, most frontal spot on pedestrian ground, off
   * the road, clear of the parked car and the souvenir table. With road
   * rules off (the tutorial void) he just stands 1.5 m dead ahead.
   * Writes the spot into `out` (world coords) and returns true; false
   * only when no ground qualifies (the caller falls back to STAND_SPOTS).
   */
  /**
   * The tour's direction of travel (`facing`, city coords) as a world
   * direction. The city is rotated by psi = PI/2 + heading, so a city
   * direction (fx, fz) maps to world (fx*cos psi + fz*sin psi,
   * -fx*sin psi + fz*cos psi).
   */
  private facingWorldDir(out: Vector3): Vector3 {
    const psi = this.city.rotation.y;
    const fx = this.facing.x;
    const fz = this.facing.z;
    out.set(
      fx * Math.cos(psi) + fz * Math.sin(psi),
      0,
      -fx * Math.sin(psi) + fz * Math.cos(psi),
    );
    if (out.lengthSq() < 0.01) out.set(0, 0, -1);
    out.normalize();
    return out;
  }

  private chittiFrontSpot(
    out: Vector3,
    useRoadRules: boolean,
    fwdOverride?: Vector3,
  ): boolean {
    const head = this.headPos();
    const fwd = this.tmpFwd;
    if (fwdOverride) {
      // caller-supplied forward (world): the direction of travel, used
      // when her head was turned at the moment the car stopped
      fwd.copy(fwdOverride);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1);
      fwd.normalize();
    } else {
      this.headLookDir(fwd);
    }
    const right = this.tmpRight;
    right.set(-fwd.z, 0, fwd.x);
    if (!useRoadRules) {
      out.set(head.x + fwd.x * 1.5, STAND_Y, head.z + fwd.z * 1.5);
      return true;
    }
    // the parked car, in world coords (it slides to z -5 while he steps
    // out): keep him clear of its body so he never clips a corner
    const carMinX = -1.6;
    const carMaxX = 1.6;
    const carMinZ = -7.9;
    const carMaxZ = -2.2;
    // the souvenir table stands to her right; keep him off it too
    const tableX = 1.15;
    const tableZ = 0.15;
    let bestScore = -Infinity;
    let found = false;
    const angles = [0, -20, 20, -40, 40];
    for (const deg of angles) {
      const a = (deg * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let d = 1.5; d <= 6.01; d += 0.5) {
        // candidate = head + fwd * (d * cos a) + right * (d * sin a)
        this.tmpCand.set(
          head.x + fwd.x * d * ca + right.x * d * sa,
          STAND_Y,
          head.z + fwd.z * d * ca + right.z * d * sa,
        );
        // clear of the parked car?
        if (
          this.tmpCand.x >= carMinX &&
          this.tmpCand.x <= carMaxX &&
          this.tmpCand.z >= carMinZ &&
          this.tmpCand.z <= carMaxZ
        )
          continue;
        // clear of the souvenir table?
        const tdx = this.tmpCand.x - tableX;
        const tdz = this.tmpCand.z - tableZ;
        if (tdx * tdx + tdz * tdz < 0.9 * 0.9) continue;
        // on pedestrian ground, off the road?
        this.tmpCity.copy(this.tmpCand);
        this.city.worldToLocal(this.tmpCity);
        if (!this.walkableAtCity(this.tmpCity.x, this.tmpCity.z)) continue;
        if (this.roadAtCity(this.tmpCity.x, this.tmpCity.z)) continue;
        // cos a is the dot of the candidate direction with her forward
        const score = ca - 0.06 * d;
        if (score > bestScore) {
          bestScore = score;
          out.copy(this.tmpCand);
          found = true;
        }
      }
    }
    // Observation Deck: the platform is only 4 m across, but the fan
    // only knows the ground-plane walkable map (the sidewalk under the
    // platform) - it can pick a spot past the platform's edge, where
    // Chitti would float 25 m above the street once the city drops.
    // Clamp his spot to within 3.2 m of the platform centre (city
    // 12,-80), so he always lands on the platform beside her.
    if (found && this.place === 'observation-deck') {
      this.tmpCity.set(12, 25, -80);
      this.city.localToWorld(this.tmpCity);
      const pdx = out.x - this.tmpCity.x;
      const pdz = out.z - this.tmpCity.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd > 3.2) {
        out.x = this.tmpCity.x + (pdx / pd) * 3.2;
        out.z = this.tmpCity.z + (pdz / pd) * 3.2;
      }
    }
    return found;
  }

  /**
   * Chitti stands in front of her, facing her, talking - the out-of-car
   * pose for the tutorial/intro (the city is still hidden, so there is
   * no road to stay off; he just stands 1.5 m dead ahead in the void).
   * Bhanu's rule: he is on her left ONLY in the car; everywhere else he
   * stands directly in front of her.
   */
  /**
   * Pose Chitti's arms. Driving (true): upper arms reach forward to
   * the steering wheel, elbows nearly straight, hands on the rim at 10
   * and 2. Standing (false): arms hang slightly out with elbows bent
   * ~100°, hands forward at hip level - the reference photo's pose.
   * No allocation here (quaternions were built once in init).
   */
  private poseChittiArms(driving: boolean): void {
    if (!this.armL || !this.armR || !this.elbowL || !this.elbowR) return;
    if (driving) {
      this.armL.quaternion.copy(this.armDriveQL);
      this.armR.quaternion.copy(this.armDriveQR);
      this.elbowL.rotation.set(0.15, 0, 0);
      this.elbowR.rotation.set(0.15, 0, 0);
    } else {
      this.armL.quaternion.copy(this.armHangQL);
      this.armR.quaternion.copy(this.armHangQR);
      this.elbowL.rotation.set(1.75, 0, 0);
      this.elbowR.rotation.set(1.75, 0, 0);
    }
  }

  private standChittiInFront(): void {
    const parent = this.carObj.parent;
    if (parent) parent.attach(this.chittiObj);
    else this.chittiObj.removeFromParent();
    this.chittiFrontSpot(this.animToPos, false);
    this.standSpot.copy(this.animToPos);
    this.chittiObj.position.copy(this.animToPos);
    const head = this.headPos();
    this.chittiObj.rotation.set(
      0,
      Math.atan2(-(head.x - this.animToPos.x), -(head.z - this.animToPos.z)),
      0,
    );
    this.chittiOut = true;
    // he is standing now, so his arms hang like the photo
    this.poseChittiArms(false);
    if (this.chittiLight) this.chittiLight.intensity = 0.8;
  }

  /**
   * Her footpath spot after arrival (city coords): the nearest point to
   * the car's stop (the destination node, on the road) that is pedestrian
   * ground and off the road. Two places have a fixed spot, because the
   * nearest-point search picks the wrong one there: Times Square (the
   * island pad in the middle of the square - the arrival must show the
   * billboards and the crosswalk, not a beige wall on the sidewalk) and
   * Garden Park (the stone path by the fountain, east of it so she is
   * never inside the basin). Returns null when nothing qualifies
   * within 15 m (should not happen).
   */
  private footpathSpotForHer(): { x: number; z: number } | null {
    // Times Square: stand on the island pad (0,-67), in the middle of
    // the square - billboards and crosswalk all around. Bhanu
    // 2026-11-17: the sidewalk arrival faced a beige wall.
    if (this.place === 'times-square') {
      return { x: 0, z: -67 };
    }
    // Garden Park: on the stone path east of the fountain, by the gate.
    if (this.place === 'garden-park') {
      return { x: -22, z: -50 };
    }
    // Central Park: the park IS the lawn, north of Park St. The nearest
    // footpath to the park node is the sidewalk south of Park St, but
    // that leaves Chitti nowhere to stand in front of her - Park St is
    // a road to the north and the sidewalk is one step wide at its edge,
    // so his fan falls off it and he ends up on the lawn behind her.
    // She walks onto the lawn itself instead, where there is room for
    // him in front of her in every direction.
    if (this.place === 'central-park') {
      const x = Math.min(-20, Math.max(-54, this.pos.x));
      const z = Math.min(-43, Math.max(-69, this.pos.z));
      return { x, z };
    }
    // World Trade Center: the tower is west of the avenue, so she
    // stands on the WEST sidewalk facing it (the generic ring search
    // would pick the east sidewalk, with the tower behind her).
    if (this.place === 'world-trade-center') {
      return { x: -12, z: 20 };
    }
    const ox = this.pos.x;
    const oz = this.pos.z;
    for (let r = 0.5; r <= 15.01; r += 0.5) {
      // ring of candidates at distance r - nearest first
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const cx = ox + r * Math.cos(a);
        const cz = oz + r * Math.sin(a);
        const onIsland = cx >= -4 && cx <= 4 && cz >= -71 && cz <= -63;
        if (onIsland) continue;
        if (!this.walkableAtCity(cx, cz)) continue;
        if (this.roadAtCity(cx, cz)) continue;
        return { x: cx, z: cz };
      }
    }
    return null;
  }

  /** Start a footpath glide: the city slides so `to` comes under her. */
  private startFootpathGlide(to: { x: number; z: number }): void {
    const dist = Math.hypot(to.x - this.pos.x, to.z - this.pos.z);
    if (dist < 0.05) return;
    this.footpathGlideFrom = { x: this.pos.x, z: this.pos.z };
    this.footpathGlideTo = { x: to.x, z: to.z };
    // walking pace (~1.4 m/s), at least 1.5 s, at most 3 s
    this.footpathGlideMs = Math.min(3000, Math.max(1500, (dist / 1.4) * 1000));
    this.footpathGlideStartMs = performance.now();
    this.footpathGlideActive = true;
  }

  /** Start the step-out: Chitti detaches from the car and steps out with her. */
  private beginStepOut(): void {
    // self-drive ends here: the car recentres as it drives away (the x
    // lerps back to 0 in the step-out animation below), and Chitti steps
    // out from wherever he sat - no teleport back to the driver seat
    this.selfDriving = false;
    this.animCarFromX = this.carObj.position.x;
    // FOOTPATH RULE (Bhanu 2026-11-16 20:35): she must end up on the
    // footpath beside the road, never on the road. The car stopped on
    // the road (destination node); she walks to the nearest footpath
    // spot while Chitti steps out - the city glides under them both,
    // so it looks like the two friends walk into the place together.
    const footpath = this.footpathSpotForHer();
    if (footpath) this.startFootpathGlide(footpath);
    // detach Chitti from the car, keeping his world position
    const parent = this.carObj.parent;
    if (parent) parent.attach(this.chittiObj);
    else this.chittiObj.removeFromParent();
    this.chittiObj.getWorldPosition(this.animFromPos);
    // step out to the front spot: in front of her head, facing her, on
    // pedestrian ground off the road (never on her left any more). The
    // spot is picked in the FINAL frame (after the footpath glide):
    // preview the final city transform, search the spot there, then
    // restore the live transform - so his walk ends exactly on the
    // footpath, in front of her.
    if (footpath) this.applyCityTransformFor(footpath.x, footpath.z);
    if (!this.chittiFrontSpot(this.animToPos, true)) {
      // Her head was turned when the car stopped (she had just pressed
      // a button on the side panel), so "in front of her gaze" can fall
      // off a narrow sidewalk - at Central Park the west sidewalk is
      // only one step wide at its edge, and the fan then falls back to
      // the lawn spot behind her. Retry in the direction of travel,
      // which is where the destination lies and where she faces after
      // the ride, before falling back to the fixed per-destination spot.
      this.facingWorldDir(this.tmpFacingWorld);
      if (!this.chittiFrontSpot(this.animToPos, true, this.tmpFacingWorld)) {
        // no pedestrian ground in front of her (should not happen): fall
        // back to the per-destination spot from the last build
        const spot = STAND_SPOTS[this.place] ?? STAND_SPOT_DEFAULT;
        this.animToPos.set(spot.x, STAND_Y, spot.z);
        this.city.localToWorld(this.animToPos);
      }
    }
    if (footpath) this.applyCityTransformFor(this.pos.x, this.pos.z);
    this.standSpot.copy(this.animToPos);
    // face her head (she sits at the passenger seat, x +0.45)
    const head = this.headPos();
    this.animFromYaw = 0;
    this.animToYaw = Math.atan2(
      -(head.x - this.standSpot.x),
      -(head.z - this.standSpot.z),
    );
    this.animCarFromZ = this.carObj.position.z;
    this.animCarToZ = CAR_AWAY_Z;
    this.stepOutStartMs = performance.now();
    this.stepOutActive = true;
    // Observation Deck: as the car drives away, the city glides down
    // 25 m so the high platform comes up to her feet - she steps onto
    // a deck with the skyline below, not a street.
    if (this.place === 'observation-deck') {
      this.cityLiftFromY = this.cityLiftY;
      this.cityLiftTarget = 25;
      this.cityLiftStartMs = performance.now();
    }
    // he is standing now, so his arms hang like the photo
    this.poseChittiArms(false);
    // his light comes on as he steps out, so his face is lit on the plaza
    if (this.chittiLight) this.chittiLight.intensity = 0.8;
  }

  /** The same car comes back after the photos: it drives back in from
   * where it went after the arrival, ready for the next ride. A return
   * already in flight, or a boarding (which brings it back anyway),
   * is left alone. */
  private returnCar(): void {
    if (this.boardActive || this.carReturnActive) return;
    if (this.carObj.visible && this.carObj.position.z === CAR_HOME_Z) return;
    this.carObj.visible = true;
    this.animCarFromZ = this.carObj.position.z;
    this.animCarToZ = 0;
    this.carReturnStartMs = performance.now();
    this.carReturnActive = true;
  }

  /** Chitti gets back in the car before the next drive, then `then` runs. */
  private boardCar(then: () => void): void {
    // the car drove away after the last arrival - it comes back now and
    // slides in as he climbs aboard. A return animation in flight is
    // cancelled: the board takes the car the rest of the way.
    this.carReturnActive = false;
    this.carObj.visible = true;
    if (!this.chittiOut) {
      then();
      return;
    }
    // already boarding: do not restart the climb-in, just queue the
    // newest drive behind it (a second tap/point mid-boarding must not
    // reset the clock, or the car never leaves)
    if (this.boardActive) {
      this.pendingAfterBoard = then;
      return;
    }
    this.pendingAfterBoard = then;
    // FOOTPATH RULE, way back: she is standing on the footpath; she
    // walks back to the car (on the road) while he climbs in. The city
    // glides back to the road node, over the same time as his climb, so
    // the next drive starts on a road, never from the footpath.
    const node = NODES[this.currentNode];
    let boardMs = BOARD_MS;
    if (node) {
      const dist = Math.hypot(node.x - this.pos.x, node.z - this.pos.z);
      if (dist > 0.05) {
        this.footpathGlideFrom = { x: this.pos.x, z: this.pos.z };
        this.footpathGlideTo = { x: node.x, z: node.z };
        boardMs = Math.min(3000, Math.max(BOARD_MS, (dist / 1.4) * 1000));
        this.footpathGlideMs = boardMs;
        this.footpathGlideStartMs = performance.now();
        this.footpathGlideActive = true;
      }
    }
    this.boardMs = boardMs;
    this.chittiObj.getWorldPosition(this.animFromPos);
    // Observation Deck: the city rises back up as he climbs in, so the
    // next drive starts on the street again, not 25 m in the air.
    if (this.cityLiftTarget !== 0 || this.cityLiftY !== 0) {
      this.cityLiftFromY = this.cityLiftY;
      this.cityLiftTarget = 0;
      this.cityLiftStartMs = performance.now();
    }
    // the driver's seat in WORLD coords once the car is home
    this.animToPos.set(CAR_HOME_X - 0.45, 0, CAR_HOME_Z + 0.35);
    this.animFromYaw = Math.atan2(
      -(0.45 - this.standSpot.x),
      -(0.35 - this.standSpot.z),
    );
    this.animToYaw = 0;
    this.animCarFromZ = this.carObj.position.z;
    this.animCarToZ = CAR_HOME_Z;
    this.boardStartMs = performance.now();
    this.boardActive = true;
    // he reaches for the wheel as he climbs in
    this.poseChittiArms(true);
  }

  /** Put Chitti back in the driver's seat (autotest reset / boarding done). */
  private resetChittiToSeat(): void {
    this.stepOutActive = false;
    this.boardActive = false;
    this.carReturnActive = false;
    this.getOutPending = false;
    this.pendingAfterBoard = null;
    this.carObj.add(this.chittiObj);
    this.chittiObj.position.set(-0.45, 0, 0.35);
    this.chittiObj.rotation.set(0, 0, 0);
    this.carObj.position.z = CAR_HOME_Z;
    this.carObj.position.x = CAR_HOME_X;
    this.chittiOut = false;
    // back in the driver seat, hands on the wheel
    this.poseChittiArms(true);
    // his stand light goes off with him (the cabin light covers him here)
    if (this.chittiLight) this.chittiLight.intensity = 0;
  }

  private showSouvenirs(): void {
    // place-specific tables (Bhanu 2026-11-17 17:38): only this
    // destination's souvenirs appear - everything else stays hidden,
    // even though all of them live on the same small table.
    const want = PLACE_SOUVENIRS[this.place] ?? [];
    this.souvenirObjs.forEach((s) => {
      // a souvenir already saved to the Journal stays in the Journal,
      // not back on the table at the next destination; a placed one
      // stays where she dropped it
      if (s.id !== this.heldObject && !this.journalSavedIds.has(s.id) && want.includes(s.id)) {
        s.obj.visible = true;
      } else if (s.id !== this.heldObject) {
        s.obj.visible = false;
      }
    });
    if (this.souvenirTable) this.souvenirTable.visible = true;
    if (this.souvenirRingObj) this.souvenirRingObj.visible = true;
  }

  private hideSouvenirs(): void {
    this.souvenirObjs.forEach((s) => {
      if (s.id !== this.heldObject) s.obj.visible = false;
    });
    if (this.souvenirTable) this.souvenirTable.visible = false;
    if (this.souvenirRingObj) this.souvenirRingObj.visible = false;
  }

  /** Put every souvenir back on the table (autotest reset). */
  private resetSouvenirs(): void {
    this.souvenirObjs.forEach((s) => {
      if (s.homeParent) s.homeParent.add(s.obj);
      else s.obj.removeFromParent();
      s.obj.position.copy(s.homePos);
      s.obj.quaternion.copy(s.homeQuat);
      s.obj.scale.setScalar(1);
    });
    this.heldObject = null;
    this.photoObject = null;
  }

  private pauseDrive(): void {
    if (this.phase === 'enter' || this.phase === 'tutorial' || this.phase === 'tutdone') return;
    if (this.paused) {
      // resume - shift the clock so the ride continues where it stopped
      if (this.drive && this.drive.pausedAt !== null) {
        this.drive.pausedTotal += performance.now() - this.drive.pausedAt;
        this.drive.pausedAt = null;
      }
      this.paused = false;
      this.say('And we are moving again!');
      this.refreshUI();
      this.syncComponent();
      return;
    }
    this.paused = true;
    if (this.drive) this.drive.pausedAt = performance.now();
    this.say('Paused. Take your time - tap Resume, or say go, when you are ready.');
    this.refreshUI();
    this.syncComponent();
  }

  private stopDrive(): void {
    if (this.phase === 'enter' || this.phase === 'tutorial' || this.phase === 'tutdone') return;
    if (this.driving) {
      this.drive = null;
      this.driving = false;
      this.paused = false;
      if (this.nearbyTimer) {
        clearTimeout(this.nearbyTimer);
        this.nearbyTimer = null;
      }
      // the car stays where it stopped; the next drive starts from the
      // node ahead, so the car never reverses
      this.currentNode = this.nodePath[this.segIndex] ?? this.currentNode;
      this.say('Stopped. Where shall we go next?');
      this.setPhase('choose');
      this.syncComponent();
    } else {
      this.say('We are already stopped - take a photo, or tap Where next when you are ready.');
    }
  }

  /**
   * The left/right point gesture (only at the 'next' phase): point left
   * with the left hand, or right with the right hand, and hold it.
   */
  private updatePointGesture(): void {
    if (this.phase !== 'next') {
      this.pointHoldSince = null;
      this.pointDir = null;
      this.pointArmed = false;
      return;
    }
    const palms = this.readPalms();
    if (!palms) {
      this.pointHoldSince = null;
      this.pointDir = null;
      this.pointFired = false;
      this.pointArmed = false;
      return;
    }
    const head = this.headPos();
    const leftOut = palms.l.x < head.x - 0.3 && palms.l.y > head.y - 0.6;
    const rightOut = palms.r.x > head.x + 0.3 && palms.r.y > head.y - 0.6;
    let dir: 'left' | 'right' | null = null;
    if (leftOut && !rightOut) dir = 'left';
    else if (rightOut && !leftOut) dir = 'right';
    if (!dir) {
      this.pointHoldSince = null;
      this.pointDir = null;
      // hand lowered: the next point may fire again
      this.pointFired = false;
      // hands are down/neutral: a fresh, deliberate point may fire now
      this.pointArmed = true;
      return;
    }
    // not armed yet - her hand is still out from the photo/grab, and that
    // leftover pose must not turn the car. Wait until she lowers it first.
    if (!this.pointArmed) return;
    // already fired for this point: wait until she lowers her hand
    if (this.pointFired) return;
    if (this.pointDir !== dir) {
      this.pointDir = dir;
      this.pointHoldSince = performance.now();
      return;
    }
    if (
      this.pointHoldSince !== null &&
      performance.now() - this.pointHoldSince >= POINT_HOLD_MS
    ) {
      this.pointHoldSince = null;
      this.pointDir = null;
      // edge-triggered: do not fire again until she lowers her hand first,
      // or the drive would restart every 500 ms while she keeps pointing
      this.pointFired = true;
      this.requestTurn(dir);
    }
  }

  /** Test hook (autotest only): pretend she points left with her left hand. */
  private simulatePointLeft(): void {
    this.gestureDebug = true;
    // a deliberate point, after her hands were down - arm it directly
    this.pointArmed = true;
    const head = this.headPos();
    const mid = new Vector3(head.x, head.y - 0.4, head.z - 0.45);
    this.debugPalms = {
      l: new Vector3(head.x - 0.45, mid.y, mid.z),
      r: new Vector3(head.x + 0.1, head.y - 0.45, head.z - 0.45),
    };
  }

  /** Test hook (autotest only): pretend she points right with her right hand. */
  private simulatePointRight(): void {
    this.gestureDebug = true;
    // a deliberate point, after her hands were down - arm it directly
    this.pointArmed = true;
    const head = this.headPos();
    const mid = new Vector3(head.x, head.y - 0.4, head.z - 0.45);
    this.debugPalms = {
      l: new Vector3(head.x - 0.1, head.y - 0.45, head.z - 0.45),
      r: new Vector3(head.x + 0.45, mid.y, mid.z),
    };
  }

  private launchXR(): void {
    try {
      this.world.launchXR();
    } catch (e) {
      log('launchXR failed', e);
    }
  }

  /**
   * There is no Enter XR step: tapping either Welcome box starts the
   * XR session itself (a tap is the user gesture WebXR needs), and the
   * browser's Enter VR pill is off (iwsdk.config.json: xr.offer "none").
   * Guarded - calling launchXR while a session is active logs a
   * console error, so never ask twice.
   */
  private ensureXR(): void {
    if (this.world.session === undefined && !this.world.sessionRequestPending) {
      this.launchXR();
    }
  }

  // ================= voice =================
  /**
   * Unlock audio on a real user gesture. Browsers (and the Quest Browser)
   * refuse sound until the page has had a gesture; lines spoken from a
   * timer (nearby, arrival, thank-you) come after the tap that started
   * them, so without this they can be refused and Chitti goes silent.
   * Called before every button handler and on any pointer press, so the
   * first tap unlocks the page and later lines play. Also retries a clip
   * whose play() was refused earlier.
   */
  private unlockAudio(): void {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        if (!this.audioCtx) this.audioCtx = new AC();
        if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
      }
    } catch {
      /* no audio context here; clips use plain Audio elements */
    }
    this.audioUnlocked = true;
    if (this.pendingClip) {
      const file = this.pendingClip;
      this.pendingClip = null;
      this.playVoiceClip(file);
    }
  }

  private speak(text: string, opts?: { rate?: number; pitch?: number; glanceMs?: number }): void {
    // Chitti glances back at the rider when he speaks
    this.glanceUntil = performance.now() + (opts?.glanceMs ?? 1400);
    // his words also appear in the little cloud beside him
    this.setBubble(text);
    // 1) pre-recorded clip - this is how he talks on the Quest, which has
    // no speech engine (speechSynthesis is silent there)
    const clip = VOICE_BY_TEXT[text];
    if (clip) {
      this.playVoiceClip(clip);
      return;
    }
    // 2) browser speech (desktop / emulator). Only the dynamic "I heard
    // ..." line reaches here - its text varies, so it has no clip. Log it
    // so a line with no clip is visible instead of silently falling back.
    log('voice: no clip for line, speech fallback:', text);
    try {
      if (!('speechSynthesis' in window)) return;
      if (this.speakTimer !== null) clearTimeout(this.speakTimer);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts?.rate ?? 1.0;
      u.pitch = opts?.pitch ?? 1.25;
      // no echo: the mic stays shut while the fallback voice speaks
      u.onstart = () => {
        this.speaking = true;
      };
      u.onend = () => {
        this.speaking = false;
      };
      u.onerror = () => {
        this.speaking = false;
      };
      this.speaking = true;
      this.speakTimer = setTimeout(() => {
        this.speakTimer = null;
        try {
          window.speechSynthesis.resume();
          window.speechSynthesis.speak(u);
        } catch {
          /* silent on Quest - the line is on the panel */
          this.speaking = false;
        }
      }, 60);
    } catch (e) {
      log('speech unavailable', e);
      this.speaking = false;
    }
  }

  /** Play one pre-recorded Chitti line (works in XR on the Quest).
   * Clean voice, no echo: while a line plays, the mic is gated shut, so
   * his own voice can never echo back into the recogniser as a command.
   * Each clip has its own Audio element: cutting from one line to another
   * only pauses the old element, never changes a shared element's src
   * mid-load - that abort is what logged ERR_ABORTED on fast mic taps. */
  private playVoiceClip(file: string): void {
    try {
      if (this.speakTimer !== null) {
        clearTimeout(this.speakTimer);
        this.speakTimer = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (this.currentClipAudio && !this.currentClipAudio.paused) {
        this.currentClipAudio.pause();
      }
      let audio = this.clipAudios.get(file);
      if (!audio) {
        audio = new Audio();
        audio.preload = 'auto';
        audio.src = `${import.meta.env.BASE_URL}audio/voice/${file}`;
        this.clipAudios.set(file, audio);
      }
      const token = ++this.clipToken;
      this.currentClipAudio = audio;
      this.speaking = true;
      // record the attempt: the autotest reads these to prove the clip
      // actually started playing (a resolved play() = sound is coming out)
      this.lastClipPlayed = file;
      this.lastClipPlayOk = false;
      this.lastClipError = null;
      audio.onended = () => {
        if (token === this.clipToken) this.speaking = false;
      };
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (token === this.clipToken) this.lastClipPlayOk = true;
        }).catch((err) => {
          // refused (usually: no user gesture yet) - log it instead of
          // swallowing it, and retry on the next tap (see unlockAudio)
          log('voice clip play refused:', file, err?.name ?? err);
          if (token === this.clipToken) {
            this.speaking = false;
            this.lastClipPlayOk = false;
            this.lastClipError = err?.name ?? String(err);
            this.pendingClip = file;
          }
        });
      } else {
        // old-style play() with no promise: assume it started
        this.lastClipPlayOk = true;
      }
    } catch {
      /* audio unavailable; the line is on the panel */
      this.speaking = false;
    }
  }

  /** Speak + show the first short sentence on the panel. */
  private say(text: string): void {
    this.speak(text);
    const first = text.split('. ')[0] ?? text;
    const short = first.length > 110 ? `${first.slice(0, 107)}...` : first;
    this.setLine(/[.!?]$/.test(short) ? short : `${short}.`);
  }

  /** Chitti's words, written in the little cloud beside him - the live
   * English transcript of what he is saying, while he speaks. Shown from
   * the tutorial on (he is standing in front of her there, talking); only
   * the Enter screen has no bubble, because he is not there yet. */
  private setBubble(text: string): void {
    if (!this.speechBubble) return;
    if (this.phase === 'enter') return;
    const first = text.split('. ')[0] ?? text;
    const short = first.length > 90 ? `${first.slice(0, 87)}...` : first;
    const shown = /[.!?]$/.test(short) ? short : `${short}.`;
    this.bubbleText = shown;
    this.setEl('bubble-text', { text: shown });
    this.speechBubble.visible = true;
  }

  private saySoothing(text: string): void {
    this.speak(text, { rate: 0.85, pitch: 1.15 });
  }

  /** The tap-to-speak button: mic ON (listening) / mic OFF (muted). */
  private toggleListening(): void {
    if (this.listening) this.stopListening();
    else this.startListening();
  }

  private stopListening(): void {
    this.listening = false;
    this.updateMicButton();
    try {
      this.recog?.stop();
    } catch {
      /* already stopped */
    }
    this.recog = null;
    this.stopVoskListening();
    this.say('Mic off - tap the mic any time to talk to me.');
  }

  /** Mic button label shows the on/off state at a glance. */
  private updateMicButton(): void {
    // Google Meet-style mic icon button (Bhanu 2026-11-17 07:43): ONE
    // mic icon, no "Tap to speak" text - the icon IS the button. It
    // shows the mic state exactly like Meet: a plain mic on a dark
    // button while listening, a crossed-out mic on a red button while
    // muted. The icon swap is by display, the colour by background.
    this.micIconState = this.listening ? 'on' : 'off';
    this.micButtonBg = this.listening ? '#1f2937' : '#dc2626';
    this.showEl('btn-mic-icon-on', this.listening);
    this.showEl('btn-mic-icon-off', !this.listening);
    this.setEl('btn-mic', { backgroundColor: this.micButtonBg });
  }

  /** Load (and cache) the offline Vosk model. Separated out so the
   * autotest can prove the model loads without needing a microphone. */
  private async loadVoskModel(): Promise<boolean> {
    if (this.voskModel) return true;
    if (this.voskLoading) return false;
    try {
      this.voskLoading = true;
      const { createModel } = await import('vosk-browser');
      const modelUrl = `${import.meta.env.BASE_URL}models/vosk-model-small-en-us-0.15.tar.gz`;
      this.voskModel = await createModel(modelUrl);
      this.voskLoading = false;
      log('vosk model ready');
      return true;
    } catch (e) {
      this.voskLoading = false;
      log('vosk model failed to load', e);
      return false;
    }
  }

  private startListening(): void {
    const w = window as unknown as Record<string, unknown>;
    const SR =
      (w.SpeechRecognition as
        | (new () => {
            lang: string;
            interimResults: boolean;
            maxAlternatives: number;
            onresult: ((ev: unknown) => void) | null;
            onerror: (() => void) | null;
            start: () => void;
            stop: () => void;
          })
        | undefined) ??
      (w.webkitSpeechRecognition as
        | (new () => {
            lang: string;
            interimResults: boolean;
            maxAlternatives: number;
            onresult: ((ev: unknown) => void) | null;
            onerror: (() => void) | null;
            start: () => void;
            stop: () => void;
          })
        | undefined);
    if (!SR) {
      // The Quest Browser has no SpeechRecognition - use the offline Vosk
      // recogniser instead (same place names, no network, no key).
      this.listening = true;
      this.updateMicButton();
      void this.startVoskListening();
      return;
    }
    try {
      if (this.recog) {
        try {
          this.recog.stop();
        } catch {
          /* already stopped */
        }
      }
      const recog = new SR();
      this.recog = recog;
      recog.lang = 'en-US';
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.onresult = (ev: unknown) => {
        const e = ev as {
          results: Array<Array<{ transcript: string }>>;
        };
        const heard = e.results[0][0].transcript.toLowerCase();
        // no echo: if Chitti is speaking, this is his own voice - ignore it
        if (this.speaking) return;
        log('heard:', heard);
        this.handleCommand(heard);
      };
      recog.onerror = () => {
        this.say('I did not hear that clearly - tap a button, that works too.');
      };
      // keep listening while the mic is ON: restart after each phrase
      (recog as unknown as { onend: (() => void) | null }).onend = () => {
        if (this.listening && this.recog === recog) {
          try {
            recog.start();
          } catch {
            /* mic was turned off */
          }
        }
      };
      this.listening = true;
      this.updateMicButton();
      recog.start();
      this.say('I am listening - say a place, like Times Square.');
    } catch {
      this.listening = false;
      this.updateMicButton();
      this.say('Voice is not available - tap a button instead.');
    }
  }

  /** Voice input on the Quest: offline Vosk recognition (no speech engine
   * in the Quest Browser, no network, no key). The recogniser only listens
   * for the tour's own words, so it hears "Times Square" even in noise.
   * It keeps listening until she taps the mic again to mute it. */
  private async startVoskListening(): Promise<void> {
    if (this.voskLoading || this.vosk?.listening) return;
    this.say('I am listening - say a place, like Times Square.');
    const modelOk = await this.loadVoskModel();
    if (!modelOk || !this.voskModel) {
      this.listening = false;
      this.updateMicButton();
      this.say('Voice is not available - tap a button instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const node = audioCtx.createScriptProcessor(4096, 1, 1);
      // keep the processor running without playing the mic out loud
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      const recognizer = new this.voskModel.KaldiRecognizer(16000, VOSK_GRAMMAR);
      recognizer.on('result', (message) => {
        const text =
          (message as { result?: { text?: string } }).result?.text ?? '';
        if (!text.trim()) return;
        // no echo: if Chitti is speaking, this is his own voice - ignore it
        if (this.speaking) return;
        log('heard (vosk):', text);
        this.handleCommand(text.toLowerCase());
        // keep listening - she just keeps talking, no need to tap again
      });
      node.onaudioprocess = (event) => {
        // while Chitti speaks, his voice never enters the recogniser
        if (this.speaking) return;
        try {
          recognizer.acceptWaveform(event.inputBuffer);
        } catch {
          /* recogniser closed */
        }
      };
      source.connect(node);
      node.connect(gain);
      gain.connect(audioCtx.destination);
      this.vosk = { recognizer, listening: true, stream, audioCtx, node };
    } catch (e) {
      this.listening = false;
      this.updateMicButton();
      log('vosk unavailable', e);
      this.say('Voice is not available - tap a button instead.');
    }
  }

  private stopVoskListening(): void {
    const v = this.vosk;
    if (!v) return;
    v.listening = false;
    try {
      v.stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* already stopped */
    }
    try {
      void v.audioCtx.close();
    } catch {
      /* already closed */
    }
    try {
      v.recognizer.remove();
    } catch {
      /* already removed */
    }
    this.vosk = null;
  }

  private handleCommand(heard: string): void {
    if (/times square|time square/.test(heard)) return this.driveTo('times-square');
    if (/central park/.test(heard)) return this.driveTo('central-park');
    if (/statue of liberty|statue|liberty/.test(heard))
      return this.driveTo('statue-liberty');
    if (/broadway/.test(heard)) return this.driveTo('broadway');
    if (/grand central/.test(heard)) return this.driveTo('grand-central');
    if (/dumbo/.test(heard)) return this.driveTo('dumbo');
    if (/observation deck/.test(heard)) return this.driveTo('observation-deck');
    if (/brooklyn bridge/.test(heard)) return this.driveTo('brooklyn-bridge');
    if (/world trade|one world trade|\bwtc\b/.test(heard))
      return this.driveTo('world-trade-center');
    if (/garden park|\bgarden\b/.test(heard)) return this.driveTo('garden-park');
    // "are there any next places?" - he TELLS her the places (a list),
    // without ending the visit. (Checked before the "next place" rule
    // below, which finishes the visit and moves on.)
    if (/are there (any )?(next|other|more) places|what (other|next|more) places|any (other|next|more) places/.test(heard))
      return this.say(NEXT_PLACES_LINE);
    // "I'll drive" - she takes the driver seat (left), Chitti moves to
    // the passenger seat (right) and guides her; she steers with Turn
    // left / Turn right, and "Let Chitti drive" hands the wheel back.
    if (/i('ll| will) drive|let me drive|i want to drive|drive (it )?myself|my turn to drive/.test(heard))
      return this.startSelfDrive();
    if (/where next|next place/.test(heard)) return this.finishVisit();
    // "I'm done" - she has visited enough places and wants to finish
    // the whole tour: thank-you, Journal, then the Welcome screen.
    if (/i('m| am) done|i am finished|that'?s enough|end the tour|finish the tour/.test(heard))
      return this.endTour();
    if (/paris|eiffel/.test(heard))
      return this.say('Paris is coming in version 2 - tonight we enjoy New York. Shall we go to Times Square?');
    if (
      /history|how did it (become famous|start)|how it (became famous|started)|ball drop|tell me more|tell me the story|tell me about/.test(
        heard,
      )
    ) {
      if (/ball drop/.test(heard) && this.place === 'times-square')
        return this.tellHistory(2);
      if (this.place === 'times-square' || this.place === 'start')
        return this.tellHistory();
      return this.tellPlaceStory();
    }
    if (/left/.test(heard)) return this.requestTurn('left');
    if (/right/.test(heard)) return this.requestTurn('right');
    if (/nearby|famous/.test(heard)) return this.nearbyPlaces();
    if (/photo|picture/.test(heard)) return this.takePhoto();
    if (/stop/.test(heard)) return this.stopDrive();
    if (/pause/.test(heard)) return this.pauseDrive();
    if (/go|resume|continue/.test(heard) && this.paused) return this.pauseDrive();
    if (/tkts/.test(heard)) return this.driveTo('broadway');
    this.say(
      `I heard "${heard}". Try saying Times Square, Central Park, Statue of Liberty, go left, nearby, or photo.`,
    );
  }

  // ================= features =================
  private onHistoryButton(): void {
    if (this.place === 'times-square' || this.place === 'start') this.tellHistory();
    else this.tellPlaceStory();
  }

  private tellHistory(part?: number): void {
    const n = part === 2 || (part === undefined && this.historyTold >= 1) ? 2 : 1;
    this.historyTold = n;
    this.storyPart = n;
    this.storyCards = STORY_CARDS['times-square'][n - 1];
    this.storyIdx = 0;
    this.setPhase('story');
    this.saySoothing(n === 2 ? HISTORY_PART2 : HISTORY_PART1);
    this.syncComponent();
    log('history part', n, 'told');
  }

  private tellPlaceStory(): void {
    const p = PLACES[this.place];
    if (!p) {
      this.tellHistory();
      return;
    }
    const STORY_BY_PLACE: Record<string, string> = {
      'central-park': PARK_STORY,
      'statue-liberty': STATUE_STORY,
      broadway: BROADWAY_STORY,
      'grand-central': GRAND_CENTRAL_STORY,
      dumbo: DUMBO_STORY,
      'observation-deck': DECK_STORY,
      'brooklyn-bridge': BRIDGE_STORY,
      'world-trade-center': WTC_STORY,
      'garden-park': GARDEN_STORY,
    };
    const full = STORY_BY_PLACE[this.place] ?? BROADWAY_STORY;
    this.storyCards = STORY_CARDS[this.place]?.[0] ?? [];
    this.storyIdx = 0;
    this.setPhase('story');
    this.saySoothing(full);
    log('place story told for', this.place);
  }

  private nearbyPlaces(): void {
    const p = PLACES[this.place] ?? PLACES['times-square'];
    this.say(
      `Famous places near here: ${p.nearby.join(', ')}. Which one shall we visit? Say its name, or tap Times Square, Central Park, or the Statue of Liberty.`,
    );
  }

  /** Photo button / voice "photo": at the destination, first pick an object to hold. */
  private takePhoto(): void {
    if (this.phase === 'enter' || this.phase === 'tutorial' || this.phase === 'tutdone') {
      this.say('Start the game first, then take a photo.');
      return;
    }
    if (this.phase === 'arrived') {
      this.startPhotoPick();
      return;
    }
    if (this.phase === 'photopick') {
      this.takePhotoNow();
      return;
    }
    this.say('Take a photo when we arrive at a place - first, pick where to go!');
  }

  /** The photo moment: grab a souvenir from the table, hold it, photo taken. */
  private startPhotoPick(): void {
    if (this.phase !== 'arrived') return;
    this.setPhase('photopick');
    if (this.heldObject) {
      const name = SOUVENIR_NAMES[this.heldObject] ?? 'souvenir';
      this.speak(`You're holding the ${name}! Say cheese!`);
      setTimeout(() => {
        if (this.phase === 'photopick') this.takePhotoNow();
      }, 600);
      return;
    }
    // name THIS place's table items, not the old fixed four - the table
    // is place-specific now, so the prompt must be too. The line has no
    // pre-recorded clip (only the old fixed text did), so it falls
    // through to the desktop speech fallback - the bubble still shows it.
    const placeItems = [...new Set((PLACE_SOUVENIRS[this.place] ?? []).map((id) => SOUVENIR_NAMES[id] ?? 'souvenir'))];
    const listed =
      placeItems.length <= 1
        ? placeItems.join('')
        : `${placeItems.slice(0, -1).join(', ')}, or ${placeItems[placeItems.length - 1]}`;
    this.speak(`Grab something to hold in your photo - the ${listed}!`);
  }

  /** A souvenir was picked up (real pinch-grab, or the autotest hook). */
  private onObjectGrabbed(id: string): void {
    if (this.phase !== 'photopick' && this.phase !== 'arrived') return;
    if (!SOUVENIR_IDS.includes(id)) return;
    // the Grabbed subscription can fire several times as one pinch
    // settles (grab, release, re-grab): one grab is one grab
    if (this.heldObject === id) return;
    this.heldObject = id;
    const name = SOUVENIR_NAMES[id] ?? 'souvenir';
    if (this.phase === 'photopick') {
      // the photo moment: she holds it for the picture
      this.photoObject = id;
      this.setLine(`You're holding the ${name}! Say cheese!`);
      this.speak(`You're holding the ${name}! Say cheese!`);
      log('souvenir grabbed for photo:', id);
      // a beat to enjoy holding it, then the countdown
      setTimeout(() => {
        if (this.phase === 'photopick') this.takePhotoNow();
      }, 600);
      return;
    }
    // GRAB AND PLACE (arrived): she picked up a souvenir at the
    // destination - no photo countdown, no photo. She can put it down
    // anywhere; it stays where she drops it until she grabs it again.
    // Or send it to the Journal (the glowing ring) - the panel shows
    // the Send to Journal button while she holds it.
    this.setLine(`You're holding the ${name}! Put it down anywhere you like.`);
    this.speak(GRAB_NICE_LINE);
    this.refreshUI();
    log('souvenir grabbed and placed:', id);
  }

  /** A souvenir was put down (the hand let go of it). */
  private onObjectReleased(id: string): void {
    if (this.phase !== 'arrived') return;
    if (this.heldObject !== id) return;
    // tossed at the Journal ring? If she let go within close reach of
    // the glowing ring, the souvenir flies to the ring and is saved in
    // her tour Journal instead of staying where she dropped it. The
    // radius is tight (0.6 m) so putting something down near the ring
    // still counts as placing it, not sending it.
    const s = this.souvenirObjs.find((o) => o.id === id);
    if (s && this.journalRing) {
      s.obj.getWorldPosition(this.tmpArcA);
      this.journalRing.getWorldPosition(this.tmpArcB);
      if (this.tmpArcA.distanceTo(this.tmpArcB) < 0.6) {
        this.startJournalFly(id);
        log('souvenir tossed to Journal:', id);
        return;
      }
    }
    // it stays exactly where she dropped it - nothing snaps it back.
    // Clear the held flags so she can grab it again, and so the photo
    // flow is never confused by a placed object.
    this.heldObject = null;
    this.photoObject = null;
    this.speak(PLACED_LINE);
    this.refreshUI();
    log('souvenir placed:', id);
  }

  /** A real hand grabbed something (Grabbed tag) - is it one of our souvenirs? */
  private onGrabbedEntity(entity: { object3D?: Object3D }): void {
    const obj = entity.object3D;
    if (!obj) return;
    const found = this.souvenirObjs.find((s) => s.obj === obj);
    if (found) this.onObjectGrabbed(found.id);
  }

  /** A real hand let go of something - was it one of our souvenirs? */
  private onReleasedEntity(entity: { object3D?: Object3D }): void {
    const obj = entity.object3D;
    if (!obj) return;
    const found = this.souvenirObjs.find((s) => s.obj === obj);
    if (found) this.onObjectReleased(found.id);
  }

  /** Test hook (autotest only): pretend she grabbed a souvenir. */
  private simulateGrab(id: string): void {
    this.onObjectGrabbed(id);
  }

  /** Test hook (autotest only): pretend she put a souvenir down. */
  private simulateRelease(id: string): void {
    this.onObjectReleased(id);
  }

  /**
   * Capture the rider's current view as a PNG data URL.
   * The renderer's canvas cannot be read after the frame: its buffer is
   * cleared, and in XR it renders to the headset, not the canvas. So we
   * render the scene once, synchronously, to the canvas and read it in
   * the same task - the pixels are only valid until this task yields.
   */
  private capturePhoto(): string {
    const renderer = this.world.renderer;
    const camera = this.world.camera;
    const canvas = renderer.domElement;
    // render to the canvas, not the XR headset layer, for this one frame
    const xrEnabled = renderer.xr.enabled;
    renderer.xr.enabled = false;
    const prevAspect = camera.aspect;
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.render(this.world.scene, camera);
    const url = canvas.toDataURL('image/png');
    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();
    renderer.xr.enabled = xrEnabled;
    return url;
  }

  /** The 3-2-1 countdown + snapshot, then the thank-you closes the visit. */
  private takePhotoNow(): void {
    if (this.phase !== 'photopick' && this.phase !== 'arrived') return;
    // one grab (or one double-tap on Photo) takes exactly one photo:
    // the grab subscription and the 600 ms timers can each queue a
    // countdown, and without this guard one grab saved three photos
    if (this.photoInProgress) return;
    this.photoInProgress = true;
    this.say('Best photo spot! Get ready - 3, 2, 1!');
    let n = 3;
    this.setLine('3');
    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        this.setLine(`${n}`);
        return;
      }
      clearInterval(iv);
      this.setLine('Cheese!');
      setTimeout(() => {
        try {
          const url = this.capturePhoto();
          const a = document.createElement('a');
          a.href = url;
          a.download = `tour-photo-${this.place}.png`;
          a.click();
          this.photos++;
          // the photo goes into her tour Journal too, so she can look
          // through it any time (Bhanu 2026-11-16 22:06)
          this.savePhotoToJournal();
          const held = this.photoObject ? SOUVENIR_NAMES[this.photoObject] : null;
          this.say(
            held
              ? `Photo taken - you're holding the ${held}! It is saved in your Downloads.`
              : `Photo taken! It is saved in your Downloads. That is your souvenir from ${PLACES[this.place]?.name ?? 'New York'}.`,
          );
          this.syncComponent();
          // the photo is done: put the souvenir back on the table and
          // free her hand, so every button works again (a held object
          // blocks fingertip pokes)
          this.releaseHeldSouvenir();
          // the photo is done - the visit's last step is the thank-you
          setTimeout(() => this.sayThankYou(), 2000);
        } catch (e) {
          log('photo error', e);
          this.photoInProgress = false;
          this.releaseHeldSouvenir();
          this.say('Photo did not save this time - try again.');
          this.refreshUI();
        }
      }, 350);
    }, 700);
  }

  /**
   * After the photo, put the souvenir back on the table and free her hand.
   * A held object blocks fingertip pokes, so without this every button
   * stays dead until she guesses she must open her hand.
   */
  private releaseHeldSouvenir(): void {
    const held = this.heldObject;
    if (!held) return;
    const s = this.souvenirObjs.find((o) => o.id === held);
    if (s) {
      try {
        this.world.getSystem(GrabSystem)?.forceRelease(s.ent);
      } catch {
        /* not held by the grab system; just put it back */
      }
    }
    this.heldObject = null;
    // GrabSystem drops the Grabbed tag on its next frame; wait a beat,
    // then put the souvenir back where it belongs on the table
    setTimeout(() => {
      if (s) {
        if (s.homeParent) s.homeParent.add(s.obj);
        else s.obj.removeFromParent();
        s.obj.position.copy(s.homePos);
        s.obj.quaternion.copy(s.homeQuat);
        s.obj.scale.setScalar(1);
        s.obj.visible = true;
      }
      // clear the leftover point/gesture pose so it cannot turn the car
      this.clearPoseState();
    }, 150);
  }

  /** Clear every leftover hand-pose/gesture state (after a photo/grab). */
  private clearPoseState(): void {
    this.pointFired = false;
    this.pointDir = null;
    this.pointHoldSince = null;
    this.pointArmed = false;
  }

  private gentleWarn(): void {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    this.say(
      `Hey Bhanu, not that way - let us go this way, smoothly, careful. There is a ${side === 'left' ? 'chair' : 'bed'} on your ${side}.`,
    );
  }

  // ================= ECS mirror (inspect + drive from the CLI) =================
  private stateEntity(): {
    getValue: (c: unknown, f: string) => unknown;
    setValue: (c: unknown, f: string, v: unknown) => void;
  } | null {
    // queries.*.entities is a Set - take the first entity without allocating.
    let found: unknown = null;
    for (const e of this.queries.state.entities) {
      found = e;
      break;
    }
    return (found as {
      getValue: (c: unknown, f: string) => unknown;
      setValue: (c: unknown, f: string, v: unknown) => void;
    } | null) ?? null;
  }

  private syncComponent(force = false): void {
    const e = this.stateEntity();
    if (!e) return;
    const posXr = Math.round(this.pos.x * 10) / 10;
    const posZr = Math.round(this.pos.z * 10) / 10;
    const headingDegr = Math.round((this.heading * 180) / Math.PI);
    const liftR = Math.round(this.cityLiftY * 10) / 10;
    const want = [
      this.phase,
      this.place,
      String(this.paused),
      String(this.driving),
      String(this.historyTold),
      String(this.photos),
      String(this.selfDriving),
      this.journalSummary(),
      String(posXr),
      String(posZr),
      String(headingDegr),
      String(liftR),
    ].join('|');
    if (!force && want === this.lastSeen) return;
    try {
      e.setValue(TourState, 'phase', this.phase);
      e.setValue(TourState, 'place', this.place);
      e.setValue(TourState, 'paused', this.paused);
      e.setValue(TourState, 'driving', this.driving);
      e.setValue(TourState, 'historyTold', this.historyTold);
      e.setValue(TourState, 'photos', this.photos);
      e.setValue(TourState, 'selfDriving', this.selfDriving);
      e.setValue(TourState, 'journal', this.journalSummary());
      e.setValue(TourState, 'posX', posXr);
      e.setValue(TourState, 'posZ', posZr);
      e.setValue(TourState, 'headingDeg', headingDegr);
      e.setValue(TourState, 'cityLiftY', liftR);
    } catch (err) {
      log('syncComponent failed', err);
    }
    this.lastSeen = want;
    // keep the debug hook current
    const w = window as unknown as Record<string, unknown>;
    const dbg = w.__tour as Record<string, unknown> | undefined;
    if (dbg) {
      dbg.phase = this.phase;
      dbg.place = this.place;
      dbg.paused = this.paused;
      dbg.driving = this.driving;
      dbg.historyTold = this.historyTold;
      dbg.photos = this.photos;
      dbg.posX = Math.round(this.pos.x * 10) / 10;
      dbg.posZ = Math.round(this.pos.z * 10) / 10;
      dbg.headingDeg = Math.round((this.heading * 180) / Math.PI);
      dbg.currentNode = this.currentNode;
      dbg.destPlace = this.destPlace;
      dbg.pendingPlace = this.pendingPlace;
      dbg.lastClipPlayed = this.lastClipPlayed;
      dbg.lastClipPlayOk = this.lastClipPlayOk;
      dbg.lastClipError = this.lastClipError;
      dbg.audioUnlocked = this.audioUnlocked;
      dbg.pendingClip = this.pendingClip;
      dbg.chittiOut = this.chittiOut;
      dbg.heldObject = this.heldObject;
      dbg.photoObject = this.photoObject;
      dbg.selfDriving = this.selfDriving;
      dbg.journal = this.journalSummary();
      dbg.journalOpen = this.journalOpen;
      dbg.lastDriveMs = Math.round(this.lastDriveMs);
      dbg.nearbyToldFor = this.nearbyToldFor;
      dbg.nearbyToldAtMs = Math.round(this.nearbyToldAtMs);
      dbg.suggestion = this.suggestion;
      dbg.suggestionText = this.suggestionText;
      dbg.greeting = GREETING;
      dbg.line = this.currentLine;
      dbg.sub = this.currentSub;
      dbg.introStartMs = Math.round(this.introStartMs);
      dbg.introEndMs = Math.round(this.introEndMs);
      dbg.shownButtons = [...this.shownButtons];
      dbg.visited = [...this.visited];
    }
  }

  /** External commands via `ecs set-component` (phase/place/autotest/paused). */
  private readComponent(): void {
    const e = this.stateEntity();
    if (!e) return;
    let phase = '';
    let place = '';
    let autotest = false;
    let paused = false;
    let grabSouvenir = '';
    try {
      phase = String(e.getValue(TourState, 'phase') ?? '');
      place = String(e.getValue(TourState, 'place') ?? '');
      autotest = Boolean(e.getValue(TourState, 'autotest'));
      paused = Boolean(e.getValue(TourState, 'paused'));
      grabSouvenir = String(e.getValue(TourState, 'grabSouvenir') ?? '');
    } catch {
      return;
    }
    // ECS grab trigger (Bhanu 2026-11-17): a souvenir id in
    // grabSouvenir grabs it like a hand pinch, so the glowing arc to
    // the Journal ring appears. Fires once per distinct value.
    if (grabSouvenir && grabSouvenir !== this.lastGrabSouvenir) {
      this.lastGrabSouvenir = grabSouvenir;
      this.simulateGrab(grabSouvenir);
    }
    if (autotest && !this.testRunning) {
      this.runAutotest();
      return;
    }
    if (
      paused !== this.paused &&
      this.phase !== 'enter' &&
      this.phase !== 'tutorial' &&
      this.phase !== 'tutdone'
    ) {
      this.pauseDrive();
      return;
    }
    if (phase && phase !== this.phase) {
      if (phase === 'driving' && place && PLACES[place]) this.driveTo(place);
      else if (phase === 'choose') this.showChoice();
      else if (phase === 'story') this.onHistoryButton();
      else if (phase === 'tutorial') this.startTutorial();
      else if (phase === 'enter') this.setPhase('enter');
      else if (phase === 'tutdone') this.setPhase('tutdone');
      else if (phase === 'arrived') this.setPhase('arrived');
      else if (phase === 'getout') this.setPhase('getout');
      else if (phase === 'photopick') this.setPhase('photopick');
      else if (phase === 'thankyou') this.setPhase('thankyou');
      else if (phase === 'goodbye') this.setPhase('goodbye');
      else if (phase === 'next') this.showNext(); // build the board, not just the label
      else if (phase === 'ready') this.setPhase('ready');
      return;
    }
  }

  private debugState(): Record<string, unknown> {
    return {
      phase: this.phase,
      place: this.place,
      paused: this.paused,
      driving: this.driving,
      historyTold: this.historyTold,
      photos: this.photos,
      posX: this.pos.x,
      posZ: this.pos.z,
      headingDeg: (this.heading * 180) / Math.PI,
      currentNode: this.currentNode,
      destPlace: this.destPlace,
      pendingPlace: this.pendingPlace,
      chittiOut: this.chittiOut,
      heldObject: this.heldObject,
      photoObject: this.photoObject,
      lastDriveMs: Math.round(this.lastDriveMs),
      nearbyToldFor: this.nearbyToldFor,
      nearbyToldAtMs: Math.round(this.nearbyToldAtMs),
      suggestion: this.suggestion,
      suggestionText: this.suggestionText,
      greeting: GREETING,
      line: this.currentLine,
      sub: this.currentSub,
      bubbleText: this.bubbleText,
      micIconState: this.micIconState,
      micButtonBg: this.micButtonBg,
      listening: this.listening,
      speaking: this.speaking,
      voskReady: this.voskModel !== null,
      introStartMs: Math.round(this.introStartMs),
      introEndMs: Math.round(this.introEndMs),
      shownButtons: [...this.shownButtons],
      visited: [...this.visited],
    };
  }

  // ================= autotest =================
  private runAutotest(): void {
    if (this.testRunning) return;
    this.testRunning = true;
    this.testResults = {};
    // reset to the enter screen, like a fresh load
    this.drive = null;
    this.driving = false;
    this.paused = false;
    this.pos = { x: 0, z: 8 };
    this.heading = -Math.PI / 2;
    this.facing = { x: 0, z: -1 };
    this.currentNode = 'start';
    this.place = 'start';
    this.applyPlaceCityVisibility();
    this.destPlace = 'start';
    this.historyTold = 0;
    this.photos = 0;
    this.visited.clear();
    this.pendingPlace = null;
    this.gestureDebug = false;
    this.debugPalms = null;
    this.introStartMs = 0;
    this.introEndMs = 0;
    this.introLineIdx = 0;
    this.nearbyToldFor = null;
    this.nearbyToldAtMs = 0;
    this.driveStartMs = 0;
    this.lastDriveMs = 0;
    this.thankYouShown = false;
    this.suggestion = null;
    this.suggestionText = '';
    this.nextLeft = null;
    this.nextRight = null;
    this.pointHoldSince = null;
    this.pointDir = null;
    if (this.nearbyTimer) {
      clearTimeout(this.nearbyTimer);
      this.nearbyTimer = null;
    }
    if (this.thankYouTimer) {
      clearTimeout(this.thankYouTimer);
      this.thankYouTimer = null;
    }
    if (this.goodbyeTimer) {
      clearTimeout(this.goodbyeTimer);
      this.goodbyeTimer = null;
    }
    this.resetChittiToSeat();
    this.resetSouvenirs();
    this.hideSouvenirs();
    // self-drive, turn arrow and Journal reset with the tour
    this.selfDriving = false;
    this.journal = [];
    this.journalOpen = false;
    this.journalSavedIds.clear();
    this.hideJournalGallery();
    this.journalFlyActive = false;
    this.journalFlyId = null;
    this.hideTurnArrow();
    if (this.journalArc) this.journalArc.visible = false;
    this.city.visible = false;
    this.carObj.visible = false;
    this.cityRevealed = false;
    this.carReturnActive = false;
    this.trailN = 0;
    this.sawWest = false;
    this.sawEast = false;
    this.setPhase('enter');
    const check = (name: string, fn: () => boolean) => {
      try {
        this.testResults[name] = !!fn();
      } catch (err) {
        this.testResults[name] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      log('autotest check', name, '=', this.testResults[name]);
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    // wait until fn() is true, polling (slow emulator frames can't be rushed)
    const waitFor = (fn: () => boolean, timeoutMs: number): Promise<boolean> =>
      new Promise((resolve) => {
        const start = performance.now();
        const iv = setInterval(() => {
          let ok = false;
          try {
            ok = fn();
          } catch {
            ok = false;
          }
          if (ok || performance.now() - start >= timeoutMs) {
            clearInterval(iv);
            resolve(ok);
          }
        }, 250);
      });
    const buttonsAre = (expected: string[]): boolean => {
      const got = [...this.shownButtons].sort();
      const want = [...expected].sort();
      return got.length === want.length && got.every((v, i) => v === want[i]);
    };
    // press a button through the button itself (not by calling the flow
    // method directly): dispatch a click on the UIKit element when it
    // supports it, else invoke the handler the button is wired to. This
    // proves the button routes to its handler; the physical fingertip
    // press is proven separately, by hand in the emulator.
    const clickBtn = (id: string): void => {
      const el = this.els[id] as unknown as {
        dispatchEvent?: unknown;
      } | null;
      let done = false;
      if (el && typeof el.dispatchEvent === 'function') {
        try {
          (el as { dispatchEvent: (e: Event) => unknown }).dispatchEvent(
            new Event('click'),
          );
          done = true;
        } catch {
          done = false;
        }
      }
      if (!done) this.buttonHandlers[id]?.();
    };
    const trailOnRoad = (): boolean => {
      // every sampled drive position must be on a road (fix a)
      for (let i = 0; i < this.trailN; i++) {
        const x = this.trail[i * 2];
        const z = this.trail[i * 2 + 1];
        const onAve = Math.abs(x) <= 8.5 && z <= 44 && z >= -100;
        const onParkSt = z >= -43.5 && z <= -36.5 && x >= -19.5 && x <= 8.5;
        const onPlazaSt = z >= -63.5 && z <= -56.5 && x >= -19.5 && x <= 19.5;
        const onWestSt = x >= -19.5 && x <= -12.5 && z >= -60.5 && z <= -39.5;
        const onEastSt = x >= 12.5 && x <= 19.5 && z >= -60.5 && z <= -39.5;
        if (!(onAve || onParkSt || onPlazaSt || onWestSt || onEastSt)) return false;
      }
      return this.trailN > 5;
    };
    const chittiOffRoad = (): boolean => {
      // Chitti's step-out spot, back in city coordinates, must be off
      // every road - never standing on the road after any arrival
      // (roadAtCity is the shared ground truth: the Times Square island
      // pad and the promenade's south strip count as pedestrian ground
      // even though they overlap the drive rectangles)
      this.chittiObj.getWorldPosition(this.tmpPos);
      this.city.worldToLocal(this.tmpPos);
      return !this.roadAtCity(this.tmpPos.x, this.tmpPos.z);
    };
    // Chitti in front of her: the dot of (Chitti - head) with her
    // forward direction must be close to 1 (dead ahead), and he must be
    // off the road - the front-stand rule for every out-of-car moment
    const chittiInFront = (): boolean => {
      const head = this.headPos();
      const fwd = this.headLookDir(this.tmpFwd);
      this.chittiObj.getWorldPosition(this.tmpPos);
      const dx = this.tmpPos.x - head.x;
      const dz = this.tmpPos.z - head.z;
      const len = Math.hypot(dx, dz) || 1;
      const dot = (dx * fwd.x + dz * fwd.z) / len;
      if (dot <= 0.75) return false;
      // off the road once the city is there (the tutorial void has no
      // road to stay off)
      if (!this.city.visible) return true;
      this.city.worldToLocal(this.tmpPos);
      return !this.roadAtCity(this.tmpPos.x, this.tmpPos.z);
    };
    // Chitti in front in the DIRECTION OF TRAVEL, not just in front of
    // her head's current gaze: her head can be turned (she just pressed
    // a side button) when the car stops, and the step-out must still put
    // him ahead of her, where the destination lies. Guards the Central
    // Park case, where a turned head used to drop him on the lawn behind.
    const chittiInFrontOfTravel = (): boolean => {
      const head = this.headPos();
      const fwd = this.facingWorldDir(this.tmpFacingWorld);
      this.chittiObj.getWorldPosition(this.tmpPos);
      const dx = this.tmpPos.x - head.x;
      const dz = this.tmpPos.z - head.z;
      const len = Math.hypot(dx, dz) || 1;
      const dot = (dx * fwd.x + dz * fwd.z) / len;
      return dot > 0.75;
    };
    const chittiAt = (x: number, z: number): boolean => {
      this.chittiObj.getWorldPosition(this.tmpPos);
      return Math.abs(this.tmpPos.x - x) < 0.15 && Math.abs(this.tmpPos.z - z) < 0.15;
    };
    // HER standing spot (footpath rule): her city position after arrival
    // must be pedestrian ground and off the road - the footpath beside
    // the road, never the road itself. The Times Square island pad is
    // pedestrian ground but sits in the middle of the avenue, not a
    // sidewalk beside the road, so it does not count here.
    const herOnFootpath = (): boolean => {
      const x = this.pos.x;
      const z = this.pos.z;
      // the Times Square island is a pedestrian island - a footpath,
      // not a road - so standing on it counts (she stands on the
      // footpath, never the road). roadAtCity already returns false
      // for the island, and walkableAtCity covers it.
      return this.walkableAtCity(x, z) && !this.roadAtCity(x, z);
    };
    // D1: both panels must be IN FRONT of her head, not behind it -
    // distance and height alone cannot catch a panel 0.7 m behind her
    const panelsInFront = (): boolean => {
      if (!this.titlePanel || !this.tourPanel) return false;
      const head = this.headPos();
      const look = this.headLookDir(this.tmpFwd);
      this.titlePanel.getWorldPosition(this.tmpPos);
      const dTitle =
        (this.tmpPos.x - head.x) * look.x + (this.tmpPos.z - head.z) * look.z;
      this.tourPanel.getWorldPosition(this.tmpPos);
      const dTour =
        (this.tmpPos.x - head.x) * look.x + (this.tmpPos.z - head.z) * look.z;
      return dTitle > 0 && dTour > 0;
    };

    void (async () => {
      // ---- enter screen: only two options, nothing else ----
      check(
        'enterShown',
        () => this.phase === 'enter' && this.titlePanel !== null && this.shownButtons.length === 0,
      );
      // Welcome screen: the title shows alone first - the two boxes
      // are still hidden this soon after entering the screen
      check('welcomeBoxesHiddenAtFirst', () => !this.enterButtonsShown);
      check('cityHiddenAtEnter', () => !this.city.visible && !this.carObj.visible);
      // ---- landmarks: Empire State, Chrysler, Brooklyn Bridge, Statue ----
      const hasLandmark = (name: string): boolean => {
        let found = false;
        this.city.traverse((o) => {
          if (o.name === name) found = true;
        });
        return found;
      };
      check(
        'cityLandmarksPresent',
        () =>
          hasLandmark('empireState') &&
          hasLandmark('chrysler') &&
          hasLandmark('brooklynBridge') &&
          hasLandmark('statueLiberty'),
      );
      // ---- tap: the Enter panels must be within arm's reach in XR ----
      check('enterPanelsWithinReach', () => {
        if (!this.titlePanel || !this.tourPanel) return false;
        const head = this.headPos();
        this.titlePanel.getWorldPosition(this.tmpPos);
        const dTitle = this.tmpPos.distanceTo(head);
        this.tourPanel.getWorldPosition(this.tmpPos);
        const dTour = this.tmpPos.distanceTo(head);
        return dTitle < 1.0 && dTour < 1.0;
      });
      // ---- every panel at EYE LEVEL (a seated rider can see + tap it) ----
      check('panelsAtEyeLevel', () => {
        if (!this.titlePanel || !this.tourPanel) return false;
        const head = this.headPos();
        this.titlePanel.getWorldPosition(this.tmpPos);
        const titleDy = Math.abs(this.tmpPos.y - head.y);
        this.tourPanel.getWorldPosition(this.tmpPos);
        const tourDy = Math.abs(this.tmpPos.y - head.y);
        return titleDy < 0.15 && tourDy < 0.15;
      });
      // ---- panels must be IN FRONT of her head (D1: they were behind) ----
      check('panelsInFrontOfHead', panelsInFront);
      // ---- no Enter XR step: only the two boxes, and they start XR ----
      check('onlyTwoOptionsAtEnter', () => {
        if (!this.titlePanel) return false;
        const xrBtn = this.titlePanel.getElementById('btn-xr') as unknown;
        const t1 = this.titlePanel.getElementById('btn-start-tutorial') as unknown;
        const t2 = this.titlePanel.getElementById('btn-start-game') as unknown;
        return (xrBtn === null || xrBtn === undefined) && t1 != null && t2 != null;
      });
      // tapping "Start the game" must itself start the XR session (there
      // is no Enter XR step): spy on ensureXR, call the flow, and
      // confirm it asked. The guard skips the real launch while a
      // session is already running, so no console error is logged.
      let enterXrAsked = 0;
      const realEnsureXR = this.ensureXR.bind(this);
      this.ensureXR = () => {
        enterXrAsked++;
        realEnsureXR();
      };
      this.startGame();
      await wait(300);
      check('startGameStartsXR', () => enterXrAsked >= 1 && this.phase === 'choose');
      this.ensureXR = realEnsureXR;
      let tutXrAsked = 0;
      const realEnsureXR2 = this.ensureXR.bind(this);
      this.ensureXR = () => {
        tutXrAsked++;
        realEnsureXR2();
      };
      this.startTutorial();
      await wait(300);
      check('startTutorialStartsXR', () => tutXrAsked >= 1 && this.phase === 'tutorial');
      this.ensureXR = realEnsureXR2;
      // ---- tutorial: a real 10-20 s intro, then Skip / Restart ----
      this.startTutorial();
      await wait(300);
      check('tutorialIntroRuns', () => this.phase === 'tutorial');
      // Chitti's front face: two blue irises (left + right) and a smile,
      // all on the -Z face - the front proof must show both eyes + smile
      check('chittiFaceFront', () => {
        const irisL = this.chittiObj.getObjectByName('chitti-iris-l');
        const irisR = this.chittiObj.getObjectByName('chitti-iris-r');
        const smile = this.chittiObj.getObjectByName('chitti-smile');
        if (!irisL || !irisR || !smile) return false;
        return (
          irisL.position.x < -0.03 &&
          irisR.position.x > 0.03 &&
          irisL.position.z < -0.1 &&
          irisR.position.z < -0.1 &&
          smile.position.y < irisL.position.y
        );
      });
      // during the tutorial he stands in front of her, facing her
      // (not hidden in the car, not off to her left)
      check(
        'chittiInFrontDuringTutorial',
        () => this.chittiObj.parent !== this.carObj && chittiInFront(),
      );
      const firstIntroStart = this.introStartMs;
      await waitFor(() => this.phase === 'tutdone', 25000);
      check('tutorialIntroDuration', () => {
        const d = this.introEndMs - this.introStartMs;
        return this.phase === 'tutdone' && d >= 10000 && d <= 21000;
      });
      check('skipRestartShown', () => buttonsAre(['btn-skip', 'btn-restart']));
      // Restart / Skip through the BUTTONS (not the methods): Bhanu
      // reported both buttons doing nothing when tapped
      clickBtn('btn-restart');
      await wait(300);
      check('restartTutorialWorks', () => this.phase === 'tutorial');
      check(
        'restartReplaysIntro',
        () =>
          this.phase === 'tutorial' &&
          this.introStartMs > firstIntroStart &&
          this.introLineIdx === 0,
      );
      this.fastForwardIntro();
      await waitFor(() => this.phase === 'tutdone', 10000);
      clickBtn('btn-skip');
      await wait(300);
      check('skipTutorialWorks', () => this.phase === 'enter');
      // Skip goes DIRECTLY back to the main screen (Start tutorial /
      // Start the game) - not into the game, not into the tutorial
      check(
        'skipGoesToMain',
        () =>
          this.phase === 'enter' &&
          this.shownButtons.length === 0 &&
          !this.city.visible &&
          !this.carObj.visible,
      );
      // the two boxes appear 2 s after the title - wait for them before
      // tapping, or the tap lands on a hidden box
      await waitFor(() => this.enterButtonsShown, 5000);
      check('welcomeBoxesAppearAfter2s', () => this.enterButtonsShown);
      // start the game from the main screen: the conversation phase
      clickBtn('btn-start-game');
      await wait(300);
      check(
        'startGameFromMain',
        () => this.phase === 'choose' && !this.city.visible && !this.carObj.visible,
      );
      // the city and the car must be HIDDEN at the place choice, and
      // Chitti must be standing in front of her, facing her - the
      // conversation phase, before any place is named
      check(
        'carHiddenAtChoose',
        () => !this.carObj.visible && !this.city.visible,
      );
      check(
        'chittiInFrontAtChoose',
        () => this.chittiObj.parent !== this.carObj && chittiInFront(),
      );
      // panels re-aim at every phase change (D1/D6): still in front of her
      // after leaving the Enter screen
      check('panelsInFrontAfterChoose', panelsInFront);
      check('greetingShort', () => GREETING.length <= 90);
      check(
        'onePanelAtATime',
        () => buttonsAre(['btn-place-times', 'btn-place-park', 'btn-place-statue', 'btn-mic']),
      );
      // ---- buttons must actually work right after entering the game ----
      // (Bhanu: after entering XR, no button responded at all)
      let clickableAfterEnter = panelsInFront();
      clickBtn('btn-place-times');
      // naming a place boards Chitti first (1.5 s climb-in) - the
      // Start ride button waits only once he is in the car beside her
      await waitFor(() => this.phase === 'ready', 5000);
      clickableAfterEnter =
        clickableAfterEnter &&
        this.phase === 'ready' &&
        this.pendingPlace === 'times-square';
      // and she can always get back to the place choice from the car
      clickBtn('btn-back');
      await wait(300);
      clickableAfterEnter =
        clickableAfterEnter && this.phase === 'choose' && this.pendingPlace === null;
      check('buttonsClickableAfterEnter', () => clickableAfterEnter);
      // ---- no ride without a place: she must never sit in the car with
      // no destination and no way forward ----
      let noRide =
        this.phase === 'choose' && !this.driving && this.pendingPlace === null;
      // tapping Start ride with no place chosen must not drive
      this.tapStartRide();
      await wait(200);
      noRide = noRide && this.phase === 'choose' && !this.driving;
      // a drive with no destination must return to the choice, not drive
      this.startDrive([], 'no-such-place');
      await wait(200);
      noRide = noRide && this.phase === 'choose' && !this.driving;
      // choosing a place, then Start ride, drives her there
      clickBtn('btn-place-times');
      await waitFor(() => this.phase === 'ready', 5000);
      noRide =
        noRide && this.phase === 'ready' && this.pendingPlace === 'times-square';
      clickBtn('btn-start-ride');
      await wait(300);
      noRide =
        noRide && this.phase === 'driving' && this.driving && this.destPlace === 'times-square';
      this.stopDrive();
      await wait(300);
      noRide = noRide && this.phase === 'choose' && !this.driving;
      check('noRideWithoutPlace', () => noRide);
      // ---- voice: clips mapped, clip + Vosk model served, mic wired ----
      check('voiceClipsMapped', () => {
        const keys = Object.keys(VOICE_BY_TEXT);
        // 142, not 144: the two "Start the game first" guard lines have
        // no clip on purpose - the old clips said "Enter the game" and
        // were deleted, so those lines show in the bubble (and the
        // desktop speech fallback speaks them) instead of playing a clip.
        return (
          keys.length === 142 &&
          VOICE_BY_TEXT[GREETING] === 'greeting.mp3' &&
          VOICE_BY_TEXT[INTRO_LINES[0]] === 'intro-1.mp3' &&
          VOICE_BY_TEXT[READY_LINE] === 'ready.mp3' &&
          VOICE_BY_TEXT[NEXT_PLACES_LINE] === 'next-places.mp3' &&
          VOICE_BY_TEXT[THANK_YOU] === 'thankyou.mp3' &&
          VOICE_BY_TEXT[TURN_LEFT_LINE] === 'turn-left.mp3' &&
          VOICE_BY_TEXT[TURN_RIGHT_LINE] === 'turn-right.mp3' &&
          VOICE_BY_TEXT[SELFDRIVE_START_LINE] === 'selfdrive-start.mp3' &&
          VOICE_BY_TEXT[CHITTI_DRIVE_LINE] === 'chitti-drive.mp3' &&
          VOICE_BY_TEXT[DRIVE_NEXT_LINE] === 'drive-next.mp3' &&
          VOICE_BY_TEXT[GRAB_NICE_LINE] === 'grab-nice.mp3' &&
          VOICE_BY_TEXT[JOURNAL_SAVED_LINE] === 'journal-saved.mp3' &&
          VOICE_BY_TEXT[JOURNAL_OPEN_LINE] === 'journal-open.mp3' &&
          VOICE_BY_TEXT["You're holding the New York coffee cup! Say cheese!"] ===
            'holding-cup.mp3' &&
          VOICE_BY_TEXT["You're holding the mini Liberty torch! Say cheese!"] ===
            'holding-torch.mp3' &&
          VOICE_BY_TEXT["You're holding the vintage brass pocket-watch! Say cheese!"] ===
            'holding-watch.mp3' &&
          VOICE_BY_TEXT["You're holding the polaroid photo! Say cheese!"] ===
            'holding-polaroid.mp3' &&
          VOICE_BY_TEXT["You're holding the glowing miniature skyscraper! Say cheese!"] ===
            'holding-skyscraper.mp3' &&
          VOICE_BY_TEXT["You're holding the miniature Brooklyn Bridge! Say cheese!"] ===
            'holding-bridge.mp3' &&
          VOICE_BY_TEXT['Here is the destination - Times Square!'] ===
            'arrival-times-square.mp3' &&
          VOICE_BY_TEXT['Here is the destination - Grand Central Terminal!'] ===
            'arrival-grand-central.mp3' &&
          VOICE_BY_TEXT['Here is the destination - DUMBO!'] === 'arrival-dumbo.mp3' &&
          VOICE_BY_TEXT['Here is the destination - Observation Deck!'] ===
            'arrival-observation-deck.mp3' &&
          VOICE_BY_TEXT['Here is the destination - Brooklyn Bridge!'] ===
            'arrival-brooklyn-bridge.mp3' &&
          VOICE_BY_TEXT[GRAND_CENTRAL_STORY] === 'story-grand-central.mp3' &&
          VOICE_BY_TEXT[DUMBO_STORY] === 'story-dumbo.mp3' &&
          VOICE_BY_TEXT[DECK_STORY] === 'story-deck.mp3' &&
          VOICE_BY_TEXT[BRIDGE_STORY] === 'story-bridge.mp3' &&
          VOICE_BY_TEXT["Let's go left first - Central Park is that way!"] ===
            'suggestion-left-central-park.mp3' &&
          VOICE_BY_TEXT[
            'Great choice! Driving you to Times Square now - about 5 seconds. Enjoy the ride!'
          ] === 'drive-times-square.mp3' &&
          VOICE_BY_TEXT['Paused. Take your time - tap Resume, or say go, when you are ready.'] ===
            'paused.mp3' &&
          VOICE_BY_TEXT["You're holding the camera! Say cheese!"] === 'holding-camera.mp3' &&
          VOICE_BY_TEXT[
            'Hey Bhanu, not that way - let us go this way, smoothly, careful. There is a chair on your left.'
          ] === 'warn-left.mp3'
        );
      });
      const clipOk = await fetch(
        `${import.meta.env.BASE_URL}audio/voice/greeting.mp3`,
      )
        .then((r) => r.ok)
        .catch(() => false);
      check('voiceClipServed', () => clipOk);
      const modelOk = await fetch(
        `${import.meta.env.BASE_URL}models/vosk-model-small-en-us-0.15.tar.gz`,
        { method: 'HEAD' },
      )
        .then((r) => r.ok)
        .catch(() => false);
      check('voskModelServed', () => modelOk);
      check(
        'voiceInPathWired',
        () =>
          this.shownButtons.includes('btn-mic') &&
          typeof navigator.mediaDevices?.getUserMedia === 'function',
      );
      // ---- speech bubble: Chitti's words beside him, from the greeting ----
      // (the button checks above spoke other lines, so put the greeting
      // back in the bubble first - this is the state the check assumes)
      this.setBubble(GREETING);
      check(
        'speechBubbleShows',
        () =>
          (this.speechBubble?.visible ?? false) &&
          this.bubbleText.includes('where shall I take you today'),
      );
      // ---- bubble centred in her view, above eye level (D5: it was far
      // to her left and its text ran off the left edge) ----
      // Lateral offset is measured PERPENDICULAR to her look direction,
      // not in world X: the bubble is placed along her look axis, so
      // when she turns her head (sway / glance) its world-X offset
      // grows even though it stays dead-centre in her view. The old
      // |dx| < 0.15 test failed whenever her head was yawed.
      check('bubbleCenteredInView', () => {
        if (!this.speechBubble || !this.speechBubble.visible) return false;
        const head = this.headPos();
        const look = this.headLookDir(this.tmpFwd);
        this.speechBubble.getWorldPosition(this.tmpL);
        const dx = this.tmpL.x - head.x;
        const dy = this.tmpL.y - head.y;
        const dz = this.tmpL.z - head.z;
        const fwd = dx * look.x + dz * look.z;
        const lat = Math.abs(dx * look.z - dz * look.x);
        return lat < 0.15 && dy > 0.2 && dy < 0.7 && fwd > 0.5;
      });
      // ---- Chitti's voice: a spoken line must trigger its clip AND show
      // in the bubble. Audio itself cannot be heard in the emulator, so
      // the check proves the audio element actually started playing (the
      // play() promise resolved, the element is not paused) - not just
      // that play() was called. Runs after speechBubbleShows, because
      // speaking a line replaces the bubble text (that check wants the
      // greeting still there).
      this.say('Great choice! Driving you to Times Square now - about 5 seconds. Enjoy the ride!');
      await wait(900);
      check('chittiVoiceAndBubble', () => {
        const audio = this.currentClipAudio;
        return (
          this.lastClipPlayed === 'drive-times-square.mp3' &&
          this.lastClipPlayOk === true &&
          this.lastClipError === null &&
          audio !== null &&
          audio.paused === false &&
          this.bubbleText ===
            'Great choice! Driving you to Times Square now - about 5 seconds.' &&
          this.speechBubble !== null &&
          this.speechBubble.visible === true
        );
      });
      // ---- Meet-style mic icon button: one mic icon, no label text;
      // it toggles on/off and the button colour follows (dark while
      // listening, red while muted), exactly like Google Meet ----
      check('micButtonVisible', () => this.shownButtons.includes('btn-mic'));
      check('micIconToggle', () => {
        this.listening = false;
        this.updateMicButton();
        const offState = this.micIconState;
        const offBg = this.micButtonBg;
        this.listening = true;
        this.updateMicButton();
        const onState = this.micIconState;
        const onBg = this.micButtonBg;
        this.listening = false;
        this.updateMicButton();
        return (
          offState === 'off' &&
          offBg === '#dc2626' &&
          onState === 'on' &&
          onBg === '#1f2937'
        );
      });
      // ---- the offline voice ear actually loads (the Quest voice-in) ----
      const voskLoads = await this.loadVoskModel();
      check('voskModelLoads', () => voskLoads && this.voskModel !== null);
      // ---- the ride starts from the Start ride button (no gesture) ----
      // the place is chosen by a SPOKEN command, as she would say it
      this.trailN = 0;
      this.handleCommand('times square');
      await waitFor(() => this.phase === 'ready', 5000);
      check(
        'spokenCommandDrivesTour',
        () => this.phase === 'ready' && this.pendingPlace === 'times-square',
      );
      // ---- Chitti ANSWERS the voice: his words show in the bubble ----
      check('voiceResponds', () => this.bubbleText.toLowerCase().includes('start ride'));
      // ---- no echo: the mic gate engages the instant a line plays ----
      check('noEchoGate', () => {
        this.playVoiceClip('greeting.mp3');
        return this.speaking === true;
      });
      // ---- after she names a place, a big Start ride button appears ----
      check(
        'startRideButtonShown',
        () => this.shownButtons.includes('btn-start-ride'),
      );
      check(
        'readyShown',
        () => this.phase === 'ready' && this.pendingPlace === 'times-square',
      );
      // the Drive yourself option is offered before the ride too, as a
      // tap as well as a voice ask
      check(
        'selfDriveShownAtReady',
        () => this.phase === 'ready' && this.shownButtons.includes('btn-selfdrive'),
      );
      // ---- the black car, seats left-driver / right-passenger ----
      check('carIsBlack', () => {
        let body: Object3D | null = null;
        this.carObj.traverse((o) => {
          if (o.name === 'carBody') body = o as Object3D;
        });
        if (!body) return false;
        const mat = (body as unknown as { material?: { color?: { getHex?: () => number } } })
          .material;
        const hex = mat?.color?.getHex?.() ?? 0xffffff;
        return hex <= 0x0a0a0a;
      });
      check('seatsLeftRight', () => {
        // Chitti in the driver's seat, left (x -0.45); the rider's head is
        // on the right (passenger seat x +0.45)
        let chitti: Object3D | null = null;
        this.carObj.traverse((o) => {
          if (o.name === 'chitti') chitti = o as Object3D;
        });
        if (!chitti) return false;
        const p = (chitti as Object3D).position;
        const head = this.headPos();
        return p.x < 0 && Math.abs(p.x + 0.45) < 0.01 && Math.abs(p.z - 0.35) < 0.01 && head.x > 0;
      });
      // ---- the ride starts from the Start ride button (no gesture) ----
      // (the place is already named: Times Square, from the voice command)
      this.trailN = 0;
      check(
        'readyShown',
        () => this.phase === 'ready' && this.pendingPlace === 'times-square',
      );
      // the Start ride button starts the ride, from the button alone
      clickBtn('btn-start-ride');
      await wait(300);
      check(
        'driverSeatedAfterStartRide',
        () => this.driving && chittiAt(CAR_HOME_X - 0.45, CAR_HOME_Z + 0.35),
      );
      // the drive takes about 5 seconds, on roads, with the nearby
      // places told before arriving (the mid-drive turn is probed
      // separately at the end, so this leg still arrives at Times Square
      // from the avenue - the later left-turn checks need that node)
      await waitFor(() => !this.driving, 12000);
      check('arrivedTimesSquare', () => this.place === 'times-square' && !this.driving);
      check('driveAbout5s', () => this.lastDriveMs >= 4000 && this.lastDriveMs <= 6500);
      check('roadFollowing', trailOnRoad);
      check(
        'nearbyToldBeforeArrival',
        () =>
          this.nearbyToldFor === 'times-square' &&
          this.nearbyToldAtMs > this.driveStartMs &&
          this.nearbyToldAtMs < this.driveStartMs + 4500,
      );
      check(
        'arrivalLineSaid',
        () =>
          this.currentLine.includes('Here is the destination') &&
          this.currentLine.includes('Times Square'),
      );
      // ---- arrival: "here is the destination", then step out together ----
      await waitFor(() => this.phase === 'arrived', 10000);
      // Chitti must be off the road after EVERY arrival (Times Square,
      // Central Park, Statue) - accumulated, checked once after the Statue
      let chittiOffRoadTimes = false;
      let chittiOffRoadPark = false;
      let chittiOffRoadStatue = false;
      // in front of her after EVERY arrival (Times Square, Central Park,
      // Statue) - accumulated, checked once after the Statue
      let chittiFrontTimes = false;
      let chittiFrontPark = false;
      let chittiFrontStatue = false;
      // Chitti ahead in the DIRECTION OF TRAVEL at every arrival too
      let chittiTravelTimes = false;
      let chittiTravelPark = false;
      let chittiTravelStatue = false;
      // SHE must be on the footpath after EVERY arrival too (the
      // footpath rule) - accumulated, checked once after the Statue
      let herOnFootpathTimes = false;
      let herOnFootpathPark = false;
      let herOnFootpathStatue = false;
      check('gotOut', () => {
        if (!this.chittiOut) return false;
        if (this.chittiObj.parent === this.carObj) return false;
        if (this.carObj.position.z > -2) return false;
        return chittiAt(this.standSpot.x, this.standSpot.z);
      });
      // NEW FLOW: the whole car drives away behind them and is GONE at
      // the destination - no car parked there
      check('carGoneAfterArrival', () => !this.carObj.visible);
      // the footpath glide finishes after the phase change: wait for it
      // before reading her standing spot
      await waitFor(() => !this.footpathGlideActive, 15000);
      chittiOffRoadTimes = chittiOffRoad();
      chittiFrontTimes = chittiInFront();
      chittiTravelTimes = chittiInFrontOfTravel();
      herOnFootpathTimes = herOnFootpath();
      // the Times Square billboards ARE here - the square glows
      // (Bhanu 2026-11-17 18:17: they hide only at Central Park)
      check(
        'billboardsShownAtTimesSquare',
        () => (this.billboardGroup?.visible ?? false) === true,
      );
      check(
        'noLeftRightAtVisit',
        () =>
          !this.shownButtons.includes('btn-left') &&
          !this.shownButtons.includes('btn-right'),
      );
      // place-specific table (Bhanu 2026-11-17 17:38): at Times Square
      // exactly the Times Square set is out - camera, skyscraper, ball -
      // and every other souvenir is hidden, not just the table showing
      check(
        'souvenirsShown',
        () => {
          const want = PLACE_SOUVENIRS[this.place] ?? [];
          return (
            (this.souvenirTable?.visible ?? false) &&
            this.souvenirObjs.every((s) => s.obj.visible === want.includes(s.id))
          );
        },
      );
      // ---- grab and place: at the destination she can pick up a
      // souvenir and put it down anywhere (no photo, no countdown) ----
      // (Times Square item now: the glowing miniature skyscraper)
      this.simulateGrab('souvenir-skyscraper');
      await wait(300);
      check(
        'grabPlaceWorks',
        () => this.heldObject === 'souvenir-skyscraper' && this.photoObject === null,
      );
      // move it (the test moves the object by hand) and put it down:
      // it stays where she dropped it, and her hand is free again
      const tower = this.souvenirObjs.find((s) => s.id === 'souvenir-skyscraper');
      if (tower) tower.obj.position.set(0.5, 1.0, -0.5);
      this.simulateRelease('souvenir-skyscraper');
      await wait(300);
      check(
        'placedStaysPut',
        () =>
          this.heldObject === null &&
          tower !== undefined &&
          Math.abs(tower.obj.position.x - 0.5) < 0.01 &&
          Math.abs(tower.obj.position.z + 0.5) < 0.01,
      );
      // ---- grab-and-send to the Journal: the Times Square ball goes to
      // the glowing ring, then into her travel scrapbook ----
      // (the coffee cup lives at Central Park now, not Times Square)
      this.simulateGrab('souvenir-ball');
      await wait(300);
      check(
        'journalSendButtonShown',
        () =>
          this.heldObject === 'souvenir-ball' &&
          this.shownButtons.includes('btn-send-journal'),
      );
      await waitFor(() => this.journalArc?.visible === true, 5000);
      check('journalArcShown', () => this.journalArc?.visible === true);
      clickBtn('btn-send-journal');
      await waitFor(() => this.journal.length >= 1, 5000);
      const ball = this.souvenirObjs.find((s) => s.id === 'souvenir-ball');
      check(
        'journalSendWorks',
        () =>
          this.journal.length === 1 &&
          this.journal[0].name === 'Times Square ball' &&
          this.journal[0].place === 'Times Square' &&
          ball !== undefined &&
          ball.obj.visible === false &&
          this.heldObject === null,
      );
      // ---- the Journal view: open it, read the collection, close it ----
      clickBtn('btn-journal');
      await wait(300);
      check(
        'journalViewOpens',
        () =>
          this.journalOpen &&
          this.currentLine.includes('Times Square ball') &&
          this.currentLine.includes('Times Square') &&
          this.shownButtons.includes('btn-journal-close'),
      );
      // the Journal gallery: the saved ball's 3D object is laid out in a
      // row in front of her, like the open scrapbook in her picture
      check(
        'journalGalleryShown',
        () => ball !== undefined && ball.obj.visible === true,
      );
      clickBtn('btn-journal-close');
      await wait(300);
      check(
        'journalViewCloses',
        () => !this.journalOpen && this.currentLine.includes('Times Square'),
      );
      // the gallery hides again on close (the ball goes back to the Journal)
      check(
        'journalGalleryHides',
        () => ball !== undefined && ball.obj.visible === false,
      );
      // ---- photo with a grabbed object ----
      this.takePhoto();
      await wait(300);
      check(
        'photoPickShown',
        () => this.phase === 'photopick' && this.shownButtons.includes('btn-photo'),
      );
      this.simulateGrab('souvenir-camera');
      await wait(300);
      check(
        'grabWorks',
        () => this.heldObject === 'souvenir-camera' && this.photoObject === 'souvenir-camera',
      );
      await waitFor(() => this.photos >= 1, 10000);
      check('photoWithObject', () => this.photos >= 1 && this.photoObject === 'souvenir-camera');
      // D3: one grab takes exactly one photo (it used to take three)
      check('photoExactlyOne', () => this.photos === 1);
      // the photo is saved into her tour Journal too, so she can look
      // through it any time (the cup is already there from the send)
      check(
        'journalPhotoSaved',
        () =>
          this.journal.length === 2 &&
          this.journal.some((e) => e.kind === 'photo' && e.place === 'Times Square'),
      );
      // D2: the souvenir is back on the table and her hand is free, so
      // every button works again after the photo
      check(
        'souvenirReleasedAfterPhoto',
        () => this.heldObject === null && this.photoObject === 'souvenir-camera',
      );
      // ---- thank-you, then the left/right choice ----
      await waitFor(() => this.phase === 'thankyou', 10000);
      check(
        'thankYouShown',
        () => this.currentLine.includes('Thank you so much for taking me'),
      );
      await waitFor(() => this.phase === 'next', 10000);
      check(
        'leftRightOnlyAfterVisit',
        () =>
          this.phase === 'next' &&
          (this.shownButtons.includes('btn-left') || this.shownButtons.includes('btn-right')),
      );
      // NEW FLOW: when he asks "shall we go?", the SAME car comes back
      check('carReturnsAfterPhotos', () => this.carObj.visible === true);
      check(
        'suggestionShown',
        () =>
          this.suggestion !== null &&
          this.suggestionText.includes("Let's go") &&
          this.currentLine.includes("Let's go"),
      );
      // her picture: at Times Square the right choice is the Brooklyn
      // Bridge (not Broadway) - the board must promise it
      check(
        'timesRightIsBridge',
        () => this.nextRight !== null && this.nextRight.destPlace === 'brooklyn-bridge',
      );
      check(
        'gestureHintShown',
        () => this.currentSub.includes('POINT LEFT') && this.currentSub.includes('POINT RIGHT'),
      );
      // ---- point LEFT: Times Square -> Central Park ----
      this.sawWest = false;
      this.sawEast = false;
      this.trailN = 0;
      this.simulatePointLeft();
      await waitFor(() => this.driving, 10000);
      check('pointLeftTurns', () => this.driving);
      await waitFor(() => this.phase === 'arrived', 15000);
      check('turnedLeft', () => this.sawWest);
      check('arrivedParkAfterLeft', () => this.place === 'central-park' && !this.driving);
      // place-specific table: at Central Park the coffee cup MUST be on
      // the table (Bhanu 2026-11-17 17:38), with the bouquet and the tree
      check('parkTableHasCup', () => {
        const want = PLACE_SOUVENIRS[this.place] ?? [];
        const cup = this.souvenirObjs.find((s) => s.id === 'souvenir-cup');
        return (
          (this.souvenirTable?.visible ?? false) &&
          cup !== undefined &&
          cup.obj.visible === true &&
          this.souvenirObjs.every((s) => s.obj.visible === want.includes(s.id))
        );
      });
      await waitFor(() => !this.footpathGlideActive, 15000);
      chittiOffRoadPark = chittiOffRoad();
      chittiFrontPark = chittiInFront();
      chittiTravelPark = chittiInFrontOfTravel();
      herOnFootpathPark = herOnFootpath();
      // Central Park must feel like a park (Bhanu 2026-11-17 18:17):
      // the Times Square billboards are hidden here, and people are
      // enjoying the lawn - five of them, by the pond and the trees
      check(
        'billboardsHiddenAtPark',
        () => (this.billboardGroup?.visible ?? true) === false,
      );
      check('parkHasPeople', () => {
        const onLawn = this.crowd.filter(
          (p) =>
            p.position.x >= -55 &&
            p.position.x <= -19 &&
            p.position.z >= -70 &&
            p.position.z <= -42,
        );
        return onLawn.length >= 5;
      });
      // 14 taxis on the avenue now, not 10 (more life on the roads)
      check('taxisCount14', () => this.taxis.length === 14);
      check('roadFollowingLeft', trailOnRoad);
      // ---- Central Park visit ends without a photo: Where next? -> thank-you -> next ----
      this.finishVisit();
      await waitFor(() => this.phase === 'next', 10000);
      check(
        'suggestionShownPark',
        () => this.suggestion === 'left' && this.suggestionText.includes('Broadway'),
      );
      // ---- button LEFT: Central Park -> Broadway ----
      this.sawWest = false;
      this.sawEast = false;
      this.trailN = 0;
      this.requestTurn('left');
      await waitFor(() => this.phase === 'arrived', 15000);
      check('turnedLeftPark', () => this.sawEast);
      check('arrivedBroadwayAfterLeft', () => this.place === 'broadway' && !this.driving);
      check('roadFollowingPark', trailOnRoad);
      // ---- history only on asking ----
      check('historyOnlyOnAsk', () => this.historyTold === 0 && this.phase !== 'story');
      this.tellHistory(1);
      await wait(300);
      check(
        'historyShown',
        () =>
          this.phase === 'story' &&
          this.storyCards[this.storyIdx].includes('Longacre Square'),
      );
      this.tellHistory(2);
      await wait(300);
      check(
        'historyPart2',
        () => this.storyCards.some((c) => c.includes('December 31, 1907')),
      );
      // ---- Done button closes the story (btn-next, label "Done" on the
      // last card): press it with the real button, not the handler ----
      clickBtn('btn-next'); // card 0 -> 1 (label "Next")
      await wait(300);
      const storyAdvanced = this.phase === 'story' && this.storyIdx === 1;
      clickBtn('btn-next'); // card 1 -> 2, the last card (label "Done")
      await wait(300);
      const storyAtLast = this.phase === 'story' && this.storyIdx === 2;
      clickBtn('btn-next'); // "Done" must close the story -> arrived
      await wait(300);
      check(
        'storyDoneWorks',
        () => storyAdvanced && storyAtLast && this.phase === 'arrived',
      );
      // ---- Broadway visit ends: thank-you -> next, then button RIGHT ----
      // (after the road detour the car arrives at Broadway heading south,
      // so the turn back toward Central Park is a RIGHT)
      this.finishVisit();
      await waitFor(() => this.phase === 'next', 10000);
      check(
        'suggestionShownBroadway',
        () => this.suggestion === 'right' && this.suggestionText.includes('Central Park'),
      );
      this.sawWest = false;
      this.sawEast = false;
      this.trailN = 0;
      this.requestTurn('right');
      await waitFor(() => this.phase === 'arrived', 15000);
      check('turnedRight', () => this.sawWest);
      check('arrivedParkAfterRight', () => this.place === 'central-park' && !this.driving);
      check('roadFollowingRight', trailOnRoad);
      // ---- pause / resume / stop mid-drive to the Statue ----
      // (naming a place only opens the Start ride button now - tap it)
      this.driveTo('statue-liberty');
      await waitFor(() => this.phase === 'ready', 5000);
      clickBtn('btn-start-ride');
      await wait(2000);
      const zBefore = this.pos.z;
      const xBefore = this.pos.x;
      this.pauseDrive();
      await wait(1500);
      check(
        'pauseFreezes',
        () => this.paused && this.pos.z === zBefore && this.pos.x === xBefore,
      );
      this.pauseDrive(); // resume
      await wait(2500);
      check(
        'resumeMoves',
        () => !this.paused && (this.pos.z !== zBefore || this.pos.x !== xBefore),
      );
      await waitFor(() => this.place === 'statue-liberty' && !this.driving, 12000);
      check('arrivedStatue', () => this.place === 'statue-liberty' && !this.driving);
      // wait for the step-out to finish, then Chitti must be off the road
      await waitFor(() => this.phase === 'arrived', 10000);
      await waitFor(() => !this.footpathGlideActive, 15000);
      // place-specific table: at the Statue of Liberty exactly FIVE mini
      // Liberty statues are on the table and nothing else (Bhanu
      // 2026-11-17 17:38) - she grabs one for her Journal
      check('libertyTableFiveStatues', () => {
        const want = PLACE_SOUVENIRS['statue-liberty'] ?? [];
        return (
          want.length === 5 &&
          (this.souvenirTable?.visible ?? false) &&
          this.souvenirObjs.filter((s) => s.obj.visible).length === 5 &&
          this.souvenirObjs.every((s) => s.obj.visible === want.includes(s.id))
        );
      });
      chittiOffRoadStatue = chittiOffRoad();
      chittiFrontStatue = chittiInFront();
      chittiTravelStatue = chittiInFrontOfTravel();
      herOnFootpathStatue = herOnFootpath();
      // the bridge moved south (Bhanu 2026-11-17 18:17): its span must
      // stand well behind the island, clear of the statue's pedestal
      check('bridgeClearOfStatue', () => {
        let bz = 0;
        let found = false;
        this.city.traverse((o) => {
          if (o.name === 'brooklynBridge') {
            bz = o.position.z;
            found = true;
          }
        });
        return found && bz >= 160;
      });
      // nobody stands on the water: the harbour starts at z=45, and
      // every person must be on land (promenade z <= 44)
      check('noCrowdOnWater', () => this.crowd.every((p) => p.position.z <= 44.5));
      check(
        'chittiNotOnRoadAfterArrival',
        () => chittiOffRoadTimes && chittiOffRoadPark && chittiOffRoadStatue,
      );
      check(
        'chittiInFrontWhenOutOfCar',
        () => chittiFrontTimes && chittiFrontPark && chittiFrontStatue,
      );
      check(
        'chittiInFrontOfTravel',
        () => chittiTravelTimes && chittiTravelPark && chittiTravelStatue,
      );
      // FOOTPATH RULE: she stands on the footpath beside the road at
      // EVERY destination, never on the road
      check(
        'herOnFootpathAfterArrival',
        () => herOnFootpathTimes && herOnFootpathPark && herOnFootpathStatue,
      );
      // ---- "are there any next places?" - he TELLS her the list ----
      this.handleCommand('are there any next places');
      await wait(300);
      check(
        'nextPlacesListed',
        () =>
          this.currentLine.includes('Times Square') &&
          this.currentLine.includes('Central Park') &&
          this.currentLine.includes('Statue of Liberty'),
      );
      // ---- "I'll drive" at a destination - pick the next place first,
      // then she can drive; the flow continues ----
      this.handleCommand("i'll drive");
      await wait(300);
      check(
        'selfDriveAnswered',
        () =>
          this.currentLine.includes('pick where to go next first') &&
          this.phase === 'arrived',
      );
      // ---- stop mid-drive ----
      this.driveTo('central-park');
      await waitFor(() => this.phase === 'ready', 5000);
      clickBtn('btn-start-ride');
      await wait(2000);
      this.stopDrive();
      await wait(300);
      check('stopWorks', () => !this.driving && this.phase === 'choose');
      // the table must NOT follow her: back in the choice phase after
      // leaving a destination, the table and every souvenir are hidden
      // (Bhanu 2026-11-17 17:39) - it only ever appears at a destination
      check(
        'tableHiddenInChoose',
        () =>
          (this.souvenirTable?.visible ?? true) === false &&
          this.souvenirObjs.every((s) => s.obj.visible === false),
      );
      // ---- statue story ----
      this.driveTo('statue-liberty');
      await waitFor(() => this.phase === 'ready', 5000);
      clickBtn('btn-start-ride');
      await waitFor(() => this.place === 'statue-liberty' && !this.driving, 12000);
      this.tellPlaceStory();
      await wait(300);
      check(
        'statueStory',
        () =>
          this.phase === 'story' &&
          this.storyCards.join(' ').includes('Liberty Enlightening the World'),
      );
      // ---- the new places (Bhanu 2026-11-16 22:39, World Trade Center
      // 2026-11-17 05:18, Garden Park 2026-11-17 07:41): Grand Central,
      // Garden Park, DUMBO, Observation Deck, Brooklyn Bridge, World
      // Trade Center - each driveable, each arrival on the footpath
      // with Chitti in front, each with its story. Garden Park sits
      // second, NOT last: the mid-drive turn after the loop drives
      // from the last place to Times Square, and only the long WTC
      // route has a west leg at the 2 s turn click (from Garden Park
      // the drive is 32 m and the car is already at Times Square,
      // where the left turn goes to the deck, never west).
      const newPlaces: Array<{ key: string; storyWord: string }> = [
        { key: 'grand-central', storyWord: 'Grand Central opened in 1913' },
        { key: 'garden-park', storyWord: 'rose beds' },
        { key: 'dumbo', storyWord: 'Down Under the Manhattan Bridge Overpass' },
        { key: 'observation-deck', storyWord: 'whole of Midtown' },
        { key: 'brooklyn-bridge', storyWord: 'longest suspension bridge' },
        { key: 'world-trade-center', storyWord: 'tallest building in America' },
      ];
      for (const np of newPlaces) {
        this.showChoice();
        this.driveTo(np.key);
        await waitFor(() => this.phase === 'ready', 5000);
        // the two-hand circle ring shows while the ride waits (her new
        // picture: the glowing ring at eye level beside Start ride)
        check(
          `circleRingShown-${np.key}`,
          () => this.readyRing !== null && this.readyRing.visible === true,
        );
        clickBtn('btn-start-ride');
        await waitFor(() => this.place === np.key && !this.driving, 15000);
        await waitFor(() => this.phase === 'arrived', 10000);
        await waitFor(() => !this.footpathGlideActive, 15000);
        check(
          `arrival-${np.key}`,
          () =>
            this.place === np.key &&
            this.phase === 'arrived' &&
            chittiOffRoad() &&
            chittiInFront() &&
            chittiInFrontOfTravel() &&
            herOnFootpath(),
        );
        // place-specific table (Bhanu 2026-11-17 17:38): exactly this
        // place's souvenirs are on the table, nothing else
        check(
          `tableMatchesPlace-${np.key}`,
          () => {
            const want = PLACE_SOUVENIRS[np.key] ?? [];
            return (
              (this.souvenirTable?.visible ?? false) &&
              this.souvenirObjs.every((s) => s.obj.visible === want.includes(s.id))
            );
          },
        );
        // the billboards come back at every place that is not the park
        // (Bhanu 2026-11-17 18:17: they hide only at Central Park)
        check(
          `billboardsBackAtPlace-${np.key}`,
          () => (this.billboardGroup?.visible ?? false) === true,
        );
        // the traffic is parked out of sight while she is on foot
        // (Bhanu 2026-11-17: a gold bar crossed Chitti's face)
        check(
          `taxisHiddenOnFoot-${np.key}`,
          () =>
            this.taxis.every((t) => t.visible === false) &&
            (this.bus === null || this.bus.visible === false),
        );
        // the Observation Deck lift: the city drops 25 m as he steps
        // out, so she stands on the high platform, not the street
        if (np.key === 'observation-deck') {
          await waitFor(() => Math.abs(this.cityLiftY - 25) < 0.01, 5000);
          check('deckLifted', () => Math.abs(this.cityLiftY - 25) < 0.01);
        }
        // the ring is gone once the ride is over
        check(
          `circleRingHidden-${np.key}`,
          () => this.readyRing === null || this.readyRing.visible === false,
        );
        this.tellPlaceStory();
        await wait(300);
        check(
          `story-${np.key}`,
          () =>
            this.phase === 'story' &&
            this.storyCards.join(' ').includes(np.storyWord),
        );
        this.setPhase('arrived');
        await wait(300);
      }
      // ---- tap the Times Square button, then Start ride: the ride must
      // start from the buttons alone (Bhanu: the tap did not take her there)
      this.showChoice();
      clickBtn('btn-place-times');
      await waitFor(() => this.phase === 'ready', 5000);
      let tsClick = this.phase === 'ready' && this.pendingPlace === 'times-square';
      clickBtn('btn-start-ride');
      await wait(1000);
      tsClick = tsClick && this.driving && this.destPlace === 'times-square';
      check('timesSquareClickStartsRide', () => tsClick);
      this.stopDrive();
      // ---- tap fallback (first ride of a session, no gesture) ----
      this.showChoice();
      this.driveTo('times-square');
      await waitFor(() => this.phase === 'ready', 5000);
      this.tapStartRide();
      await wait(1000);
      check('tapFallbackWorks', () => this.driving && this.destPlace === 'times-square');
      this.stopDrive();
      // ---- mid-drive turn (self-contained probe, last): while
      // travelling she says "turn left" - the car turns at the next
      // junction (the park road) and drives on from there, a real
      // re-route, not a swerve. It runs last so the re-route cannot
      // disturb the main flow (it arrives at the west side of Times
      // Square, where no left turn exists for the later checks).
      this.showChoice();
      this.driveTo('times-square');
      await waitFor(() => this.phase === 'ready', 5000);
      clickBtn('btn-start-ride');
      await wait(2000);
      // the during-travel options are on the board as tap buttons, not
      // voice-only: Turn left / Turn right / Drive yourself, beside
      // Pause, Stop and the mic
      check(
        'driveOptionsShown',
        () =>
          this.phase === 'driving' &&
          this.shownButtons.includes('btn-turn-left') &&
          this.shownButtons.includes('btn-turn-right') &&
          this.shownButtons.includes('btn-selfdrive'),
      );
      this.sawWest = false;
      this.sawEast = false;
      // the Turn left BUTTON (not the voice path) starts the re-route:
      // Chitti confirms it out loud and the glowing arrow shows on the
      // road at the junction ahead
      clickBtn('btn-turn-left');
      await wait(500);
      check('turnLineSaid', () => this.currentLine.includes('Turning left'));
      check('turnArrowShown', () => this.turnArrow?.visible === true);
      await wait(3000);
      check('midDriveTurnLeft', () => this.sawWest && this.driving);
      // self-drive: she takes the driver seat (LEFT), Chitti moves to
      // the passenger seat (RIGHT) and faces her, guiding; the drive
      // goes on, and she steers with the turn buttons
      clickBtn('btn-selfdrive');
      await wait(300);
      check(
        'selfDriveSeatsSwap',
        () =>
          this.selfDriving &&
          this.driving &&
          Math.abs(this.carObj.position.x - (CAR_HOME_X + SELF_DRIVE_SHIFT)) < 0.01 &&
          Math.abs(this.chittiObj.position.x - 0.45) < 0.01 &&
          this.currentLine.includes("You're driving"),
      );
      check(
        'selfDriveHandBackShown',
        () => this.shownButtons.includes('btn-chittidrive'),
      );
      // hand the wheel back to Chitti: seats swap back, drive goes on
      clickBtn('btn-chittidrive');
      await wait(300);
      check(
        'selfDriveHandBack',
        () =>
          !this.selfDriving &&
          this.driving &&
          Math.abs(this.carObj.position.x - CAR_HOME_X) < 0.01 &&
          Math.abs(this.chittiObj.position.x + 0.45) < 0.01 &&
          this.bubbleText.includes("I'll take the wheel"),
      );
      this.stopDrive();
      // ---- "I'm done": end the whole tour from a destination ----
      // (Bhanu 2026-11-17: after visiting places, when she feels done,
      // there must be an end button - thank-you, Journal, Welcome)
      this.showChoice();
      this.driveTo('times-square');
      await waitFor(() => this.phase === 'ready', 5000);
      clickBtn('btn-start-ride');
      await waitFor(() => this.phase === 'arrived', 15000);
      await waitFor(() => !this.footpathGlideActive, 15000);
      check(
        'imDoneShownAtPlace',
        () => this.shownButtons.includes('btn-im-done'),
      );
      clickBtn('btn-im-done');
      await waitFor(() => this.phase === 'goodbye', 5000);
      check(
        'goodbyeShown',
        () =>
          this.phase === 'goodbye' &&
          this.currentLine.includes('Thank you so much for taking me'),
      );
      // Chitti's thank-you, then her Journal opens on the goodbye screen
      await waitFor(() => this.journalOpen, 10000);
      check(
        'goodbyeJournalShown',
        () =>
          this.journalOpen &&
          this.currentLine.includes('Times Square ball') &&
          this.shownButtons.includes('btn-journal-close'),
      );
      // closing the Journal ends the tour: back to the Welcome screen,
      // title first, then the two boxes after 2 s
      clickBtn('btn-journal-close');
      await wait(500);
      check('goodbyeReturnsToWelcome', () => this.phase === 'enter');
      await waitFor(() => this.enterButtonsShown, 5000);
      check(
        'welcomeBoxesReturn',
        () => this.enterButtonsShown && this.phase === 'enter',
      );
      // ---- finish ----
      const e = this.stateEntity();
      try {
        e?.setValue(TourState, 'testResult', JSON.stringify(this.testResults));
        e?.setValue(TourState, 'autotest', false);
      } catch (err) {
        log('autotest writeback failed', err);
      }
      (window as unknown as Record<string, unknown>).__tourTest = this.testResults;
      console.log(`[tour-test] ${JSON.stringify(this.testResults)}`);
      this.testRunning = false;
      log('autotest done', JSON.stringify(this.testResults));
    })();
  }

  // trail of sampled drive positions (preallocated; no per-frame allocation)
  private trail = new Float32Array(800);
  private trailN = 0;
  private trailTimer = 0;
  private sawWest = false;
  private sawEast = false;
  private headYaw = 0;
  private speedNow = 0;
  private tlCached = false;
  private trafficLights: Array<{
    lamps: Object3D[];
    phase: number;
  }> = [];

  // ================= update =================
  update(delta: number): void {
    this.elapsed += delta;
    const dt = Math.min(delta, 0.05);

    // when she puts the headset on and XR starts, aim the panels at her
    // real head (she may be sitting / facing any way in her room)
    const inXR = this.world.session !== undefined;
    if (inXR && !this.xrActive) {
      this.xrActive = true;
      this.placePanelsInFront();
    } else if (!inXR && this.xrActive) {
      this.xrActive = false;
    }
    // keep Chitti's speech bubble floating beside his head
    this.positionBubble();

    // ---- Welcome screen: the two boxes appear 2 s after the title ----
    // (wall clock: slow frames can't stall it; the boxes start hidden
    // in the panel markup and in setPhase('enter'))
    if (this.phase === 'enter' && !this.enterButtonsShown) {
      if (performance.now() - this.enterShownAtMs >= 2000) {
        this.enterButtonsShown = true;
        this.showEl('enter-buttons', true);
      }
    }

    // external commands from the CLI (ecs set-component)
    this.readComponent();

    // keyboard fallback (browser): arrows turn, P photo, Space advances
    try {
      const kb = this.input.keyboard;
      if (kb.getKeyDown('ArrowLeft')) this.requestTurn('left');
      if (kb.getKeyDown('ArrowRight')) this.requestTurn('right');
      if (kb.getKeyDown('KeyP')) this.takePhoto();
      if (kb.getKeyDown('Space') || kb.getKeyDown('Enter')) this.onNext();
    } catch {
      /* keyboard API unavailable in this runtime */
    }

    // ---- footpath glide: after arrival she walks from the car (road)
    // to the footpath beside the road; the city glides under her while
    // Chitti steps out. The same glide walks her back to the car (road)
    // when he boards again. The drive engine never runs during a glide.
    if (this.footpathGlideActive) {
      const t = clamp(
        (performance.now() - this.footpathGlideStartMs) / this.footpathGlideMs,
        0,
        1,
      );
      const e = t * t * (3 - 2 * t);
      this.pos.x =
        this.footpathGlideFrom.x + (this.footpathGlideTo.x - this.footpathGlideFrom.x) * e;
      this.pos.z =
        this.footpathGlideFrom.z + (this.footpathGlideTo.z - this.footpathGlideFrom.z) * e;
      if (t >= 1) this.footpathGlideActive = false;
    }

    // ---- tutorial intro: rotate the lines, end after INTRO_MS ----
    if (this.phase === 'tutorial') {
      const now = performance.now();
      const elapsedMs = now - this.introStartMs;
      if (elapsedMs >= INTRO_MS) {
        this.showTutDone();
      } else {
        const idx = Math.min(INTRO_LINES.length - 1, Math.floor(elapsedMs / 5000));
        if (idx !== this.introLineIdx) {
          this.introLineIdx = idx;
          this.setLine(INTRO_LINES[idx], 'CHITTI IS TALKING');
          // each rule is spoken as it appears, so the bubble beside him
          // is the live transcript of what he is saying
          this.speak(INTRO_LINES[idx]);
        }
      }
    }

    // ---- getting out / getting back in (wall clock: slow frames can't stall it) ----
    if (this.getOutPending && this.phase === 'getout' && performance.now() >= this.getOutAt) {
      this.getOutPending = false;
      this.beginStepOut();
    }
    if (this.stepOutActive) {
      const t = clamp((performance.now() - this.stepOutStartMs) / STEP_OUT_MS, 0, 1);
      const e = t * t * (3 - 2 * t);
      this.chittiObj.position.lerpVectors(this.animFromPos, this.animToPos, e);
      this.chittiObj.rotation.y = this.animFromYaw + (this.animToYaw - this.animFromYaw) * e;
      this.carObj.position.z = this.animCarFromZ + (this.animCarToZ - this.animCarFromZ) * e;
      this.carObj.position.x = this.animCarFromX + (CAR_HOME_X - this.animCarFromX) * e;
      if (t >= 1) {
        this.stepOutActive = false;
        this.chittiOut = true;
        // NEW FLOW: the whole car drives away behind them and is GONE -
        // she and Chitti stand at the destination like they just got
        // out, no car parked there.
        this.carObj.visible = false;
        this.showSouvenirs();
        this.setPhase('arrived');
        this.syncComponent();
      }
    }
    if (this.boardActive) {
      const t = clamp((performance.now() - this.boardStartMs) / this.boardMs, 0, 1);
      const e = t * t * (3 - 2 * t);
      this.chittiObj.position.lerpVectors(this.animFromPos, this.animToPos, e);
      this.chittiObj.rotation.y = this.animFromYaw + (this.animToYaw - this.animFromYaw) * e;
      this.carObj.position.z = this.animCarFromZ + (this.animCarToZ - this.animCarFromZ) * e;
      if (t >= 1) {
        this.boardActive = false;
        const then = this.pendingAfterBoard;
        this.pendingAfterBoard = null;
        this.resetChittiToSeat();
        this.hideSouvenirs();
        if (then) then();
      }
    }
    // ---- Observation Deck lift: the city glides down 25 m (or back
    // up) over 2 s, smoothstep - the platform comes up to her feet
    if (this.cityLiftY !== this.cityLiftTarget) {
      const lt = clamp((performance.now() - this.cityLiftStartMs) / 2000, 0, 1);
      const le = lt * lt * (3 - 2 * lt);
      this.cityLiftY =
        this.cityLiftFromY + (this.cityLiftTarget - this.cityLiftFromY) * le;
      if (lt >= 1) this.cityLiftY = this.cityLiftTarget;
      this.applyCityTransformFor(this.pos.x, this.pos.z);
    }
    // ---- the car driving back in after the photos ("shall we go?") ----
    if (this.carReturnActive) {
      const t = clamp((performance.now() - this.carReturnStartMs) / CAR_RETURN_MS, 0, 1);
      const e = t * t * (3 - 2 * t);
      this.carObj.position.z = this.animCarFromZ + (this.animCarToZ - this.animCarFromZ) * e;
      if (t >= 1) {
        this.carReturnActive = false;
        this.carObj.position.z = CAR_HOME_Z;
      }
    }

    // ---- glowing turn arrow: hide it once its time is up ----
    if (
      this.turnArrow &&
      this.turnArrow.visible &&
      this.turnArrowHideAt > 0 &&
      performance.now() >= this.turnArrowHideAt
    ) {
      this.hideTurnArrow();
    }

    // ---- a souvenir flying to the Journal ring (toss / Send to Journal) ----
    if (this.journalFlyActive && this.journalFlyId) {
      const s = this.souvenirObjs.find((o) => o.id === this.journalFlyId);
      const t = clamp(
        (performance.now() - this.journalFlyStartMs) / this.journalFlyMs,
        0,
        1,
      );
      const e = t * t * (3 - 2 * t);
      if (s) {
        // arc up and over to the ring; the object is a scene-root node
        // after the fly starts, so world == local here
        this.tmpFly.lerpVectors(this.journalFlyFrom, this.journalFlyTo, e);
        this.tmpFly.y += Math.sin(e * Math.PI) * 0.6;
        s.obj.position.copy(this.tmpFly);
      }
      if (t >= 1) this.finishJournalFly();
    }

    // ---- glowing Journal arc: from a held souvenir to the ring ----
    this.updateJournalArc();

    // ---- left/right point gesture (only after the visit ends) ----
    if (this.phase === 'next') this.updatePointGesture();

    // ---- souvenir glow: the table objects pulse gently while choosing ----
    if (this.phase === 'photopick') {
      const pulse = 1 + 0.08 * Math.sin(this.elapsed * 4);
      this.souvenirObjs.forEach((s) => {
        if (s.id !== this.heldObject) s.obj.scale.setScalar(pulse);
      });
    } else {
      this.souvenirObjs.forEach((s) => {
        if (s.obj.scale.x !== 1) s.obj.scale.setScalar(1);
      });
    }

    // ---- drive engine ----
    if (this.drive && !this.paused) {
      const d = this.drive;
      const elapsedS = (performance.now() - d.start - d.pausedTotal) / 1000;
      const speed = d.totalLen / 5; // every trip takes ~5 seconds
      this.speedNow = speed;
      let s = speed * elapsedS;
      if (s >= d.totalLen) {
        const last = d.waypoints[d.waypoints.length - 1];
        const prev = d.waypoints[d.waypoints.length - 2];
        this.pos.x = last.x;
        this.pos.z = last.z;
        this.facing = {
          x: (last.x - prev.x) / d.segLens[d.segLens.length - 1],
          z: (last.z - prev.z) / d.segLens[d.segLens.length - 1],
        };
        this.heading = Math.atan2(this.facing.z, this.facing.x);
        this.arrive(d.destNode, d.destPlace);
      } else {
        // find the current segment
        let acc = 0;
        let seg = 0;
        while (seg < d.segLens.length - 1 && s > acc + d.segLens[seg]) {
          acc += d.segLens[seg];
          seg++;
        }
        if (seg > this.segIndex) {
          // just arrived at an intermediate intersection
          const arrivedNode = this.nodePath[seg - 1];
          this.segIndex = seg;
          this.segFrom = arrivedNode;
        }
        const a = d.waypoints[seg];
        const b = d.waypoints[seg + 1];
        const t = (s - acc) / d.segLens[seg];
        this.pos.x = a.x + (b.x - a.x) * t;
        this.pos.z = a.z + (b.z - a.z) * t;
        const targetAngle = Math.atan2(b.z - a.z, b.x - a.x);
        const prevHeading = this.heading;
        this.heading = moveTowardAngle(this.heading, targetAngle, 2.2 * dt);
        this.turnRate =
          this.turnRate * 0.8 +
          ((this.heading - prevHeading) / Math.max(dt, 0.001)) * 0.2;
        // autotest observations (no allocation)
        this.trailTimer += dt;
        if (this.trailTimer >= 0.25 && this.trailN < 400) {
          this.trailTimer = 0;
          this.trail[this.trailN * 2] = this.pos.x;
          this.trail[this.trailN * 2 + 1] = this.pos.z;
          this.trailN++;
        }
        if (Math.abs(this.heading - Math.PI) < 0.4) this.sawWest = true;
        if (Math.abs(this.heading) < 0.4) this.sawEast = true;
      }
    } else {
      this.speedNow = 0;
      this.turnRate *= 0.9;
    }

    this.applyCityTransform(dt);

    // ---- car life: wheels spin, steering turns, Chitti looks around ----
    if (this.driving && !this.paused) {
      for (const w of this.wheels) w.rotation.x -= dt * this.speedNow * 2.5;
      this.steerWheel.rotation.z = clamp(-this.turnRate * 0.8, -0.6, 0.6);
      this.bobPhase += dt * 6.5;
    }
    let headTarget = Math.sin(this.elapsed * 0.9) * 0.35;
    if (performance.now() < this.glanceUntil) headTarget = -0.6;
    // in ready he waits on her (she taps Start ride) - he looks at her
    // the whole time, face in 3/4 toward the passenger, like her
    // Screen_3 (not just the 1.4 s glance when he speaks). Screen_3 has
    // his head turned ~60° to her, not 34°, so the turn is -1.1 rad.
    if (this.phase === 'ready') headTarget = -1.1;
    this.headYaw += (headTarget - this.headYaw) * Math.min(dt * 6, 1);
    this.robotHead.rotation.y = this.headYaw;

    // ---- living city (ambient; keeps moving while paused) ----
    const t = this.elapsed;
    for (const taxi of this.taxis) {
      const u = taxi.userData as { dir: number; speed: number };
      taxi.position.z += dt * u.speed * u.dir;
      if (u.dir > 0 && taxi.position.z > 30) taxi.position.z = -190;
      if (u.dir < 0 && taxi.position.z < -190) taxi.position.z = 30;
    }
    if (this.bus) {
      const u = this.bus.userData as { dir: number; speed: number };
      this.bus.position.z += dt * u.speed * u.dir;
      if (u.dir > 0 && this.bus.position.z > 30) this.bus.position.z = -190;
      if (u.dir < 0 && this.bus.position.z < -190) this.bus.position.z = 30;
    }
    // Bhanu 2026-11-17: a gold bar crossed Chitti's face in the
    // left/right and Grand Central pictures - the taxis (yellow, at eye
    // level) are the likeliest moving culprit, so while she and Chitti
    // are on foot the traffic is out of sight (it returns when he
    // boards the car again). The Grand Central rails were lowered too.
    const trafficVisible = !this.chittiOut;
    for (const taxi of this.taxis) taxi.visible = trafficVisible;
    if (this.bus) this.bus.visible = trafficVisible;
    if (this.ferry) {
      this.ferry.position.x += dt * 4.5;
      if (this.ferry.position.x > 95) this.ferry.position.x = -95;
    }
    if (this.statueFlame) {
      this.statueFlame.scale.setScalar(1 + 0.12 * Math.sin(t * 3.1));
    }
    if (this.spireTip) {
      this.spireTip.visible = Math.floor(t * 1.2) % 2 === 0;
    }
    if (!this.tlCached) {
      this.tlCached = true;
      // lamps are named 'trafficLamp' in the city asset; phases are plain
      // numbers in userData (object refs do not survive asset cloning)
      const lamps: Object3D[] = [];
      this.city.traverse((o) => {
        if (o.name === 'trafficLamp') lamps.push(o as Object3D);
      });
      const phases = this.city.userData.trafficLightPhases as
        | number[]
        | undefined;
      for (let i = 0; i + 2 < lamps.length; i += 3) {
        this.trafficLights.push({
          lamps: lamps.slice(i, i + 3),
          phase: phases?.[i / 3] ?? 0,
        });
      }
    }
    for (const tl of this.trafficLights) {
      const phase = (t + tl.phase) % 6;
      for (let li = 0; li < tl.lamps.length; li++) {
        const on = (phase < 3 && li === 0) || (phase >= 3 && li === 2);
        const lamp = tl.lamps[li] as unknown as {
          material?: { color?: { setHex?: (h: number) => void } };
        };
        lamp.material?.color?.setHex?.(
          on ? (li === 0 ? 0xef4444 : 0x22c55e) : 0x333333,
        );
      }
    }
    for (const p of this.crowd) {
      const u = p.userData as {
        phase: number;
        dir: number;
        speed: number;
        still: boolean;
        faceYaw: number | null;
        baseY: number;
      };
      if (!u.still) {
        p.position.z += dt * u.speed * u.dir;
        if (u.dir > 0 && p.position.z > 12) p.position.z = -132;
        if (u.dir < 0 && p.position.z < -132) p.position.z = 12;
        p.rotation.y = u.dir > 0 ? 0 : Math.PI;
        p.rotation.z = Math.sin(t * 2.4 + u.phase) * 0.045;
      } else if (u.faceYaw !== null) {
        p.rotation.y = u.faceYaw;
      }
      p.position.y = u.baseY + Math.abs(Math.sin(t * 2.2 + u.phase)) * (u.still ? 0.015 : 0.05);
    }

    if (this.uiDirty) this.refreshUI();
    this.syncComponent();
  }

  /** Treadmill: keep the car at the origin; move + turn the city instead. */
  private applyCityTransform(dt: number): void {
    this.applyCityTransformFor(this.pos.x, this.pos.z);
    void dt;
  }

  /** The city transform for a given city position (same heading). Used to
   * preview the final frame of a footpath glide before it runs. */
  private applyCityTransformFor(x: number, z: number): void {
    const psi = Math.PI / 2 + this.heading;
    const cos = Math.cos(psi);
    const sin = Math.sin(psi);
    let bobY = 0;
    if (this.driving && !this.paused) {
      bobY = Math.sin(this.bobPhase) * 0.03;
    }
    // the Observation Deck lift lowers the whole city so the high
    // platform comes up to her feet (see cityLiftY)
    this.city.position.set(-x * cos - z * sin, bobY - this.cityLiftY, x * sin - z * cos);
    this.city.rotation.y = psi;
  }
}
