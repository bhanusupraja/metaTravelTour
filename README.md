# Travel Agent Tour v2.0 — real IWSDK build

A VR travel experience: Chitti the robot drives you around New York City in a
**black luxury car**. You sit in the **passenger seat** beside him, name a
place, make a circle with both hands to open a portal, and the car drives you
there in about 5 seconds. Voice-first, hands-first, seated, controller-free.
Built with the Immersive Web SDK (IWSDK) — this is the rebuild of v1.5
(standalone Three.js) as a proper IWSDK project.

## The flow

1. **Welcome** — the title **"Welcome to Travel Tour"** shows alone.
   After 2 seconds two boxes appear on the same screen: **Start
   tutorial** or **Start the game**. Nothing else shows before that.
   No city, no car, no extra panels. Tapping a box itself starts VR —
   there is no Enter XR step.
2. **Start tutorial** — Chitti introduces himself and what he can do in
   10–20 seconds (short, interesting, no long list of rules). When it
   finishes, **Skip tutorial** (goes to the place-choice screen) and
   **Restart tutorial** (replays the intro) appear. One thing at a time.
3. **Start the game** — only now do the city and the robot appear. Chitti
   says: *"Today I'll take you somewhere in New York, I'm so excited to meet
   you."*
4. **Name a place** — say it ("Times Square") or tap its card. While
   driving there, Chitti tells you what places are nearby.
5. **Circle gesture** — put both palms on the desk. Two small glowing
   circles zoom from your hands; bring them together and they **collide into
   ONE big circle**, which grows into a portal. Then the black car comes.
   If your hands are not tracked, tap **"▶ Start ride"** instead — the ride
   starts without the gesture. The gesture is only needed for the first ride
   of a session; later rides start straight away.
6. **Drive** — about 5 seconds, on roads only, in traffic. Chitti drives on
   the **left**, you ride on the **right**. From the passenger seat you see
   his **side view** — his hands on the wheel at 10 and 2 — while Times
   Square is ahead of the car. The car is **black**.
7. **Arrive + get out** — Chitti says *"Here is the destination!"* (about
   2 seconds), then you and Chitti step out of the car together (within
   2 seconds) and stand at the destination.
8. **Photo with grab-and-go** — a small table holds a camera, a balloon and
   a little statue. Pick one up with your hand (pinch to grab), hold it, and
   the photo is taken with you holding it.
9. **Thank-you** — the visit's last step: *"Thank you so much for taking
   me!"*
10. **Where next?** — only after the visit ends does the left/right choice
    appear. Chitti suggests a nearby place first ("Let's go left first —
    Central Park is that way!") and a small hint shows the hand gesture
    (point left with your left hand / point right with your right hand).
    Say "take me left" or "take me right" (or point, or tap) and the car
    turns that way on the road.

History and stories are told **only when you ask** ("tell me more" /
History button) — never auto-played. Stories use verified facts only
(Times Square renamed 8 Apr 1904, first ball drop 31 Dec 1907, paused only
1942–43; Central Park 843 acres, opened 1858, Olmsted & Vaux; Statue
unveiled 28 Oct 1886, 151 ft). The agent speaks scripted lines only — no
open-ended chat, no bookings or payments, no third-party services.

## Voice — how Chitti talks and listens

- **Chitti's voice out:** 39 pre-recorded lines (Aria voice — warm, friendly,
  cute, a little higher and sweeter, speed 110) in `public/audio/voice/`.
  The Quest Browser has no speech engine, so pre-recorded clips are how he
  talks there. A browser speech fallback is kept for desktop/emulator lines
  with no clip (pitch 1.25).
- **Voice in:** the Quest Browser has no Web Speech API, so the tour uses
  **Vosk offline speech recognition** (`vosk-browser`, small English model
  in `public/models/`) — no internet, no API key. On desktop/emulator the
  browser's SpeechRecognition is tried first. Either way, say a place name
  ("Times Square", "Central Park", "Statue of Liberty", "Broadway"), "take
  me left/right", "pause", "stop", "go", "photo", "tell me more".
- **Mic toggle:** the **"🎤 Tap to speak"** button (with a mic symbol) sits
  on the tour panel at eye level. Tap once to turn the mic on (it shows
  "🔴 Listening… tap to mute" and keeps listening while it is on); tap again
  to mute. You speak by voice — no tap-to-talk each time.
- **No echo:** while Chitti is speaking, the microphone is gated shut, so
  his own voice can never echo back into the recogniser as if you said it.
  His lines play clean, with no echo and no reverb.
- **Speech bubble:** everything Chitti says also appears in a small white
  cloud beside him, so you can read it while you speak by voice.

## Tap — panels you can actually press

- Both panels are placed **right in front of you** (about 0.7 m away) and at
  **eye level**, and they follow your head when you enter XR — so you can
  reach every button with a hand pinch or tap. (Before, they sat 1.7 m away
  in fixed world space, too far to poke.)
- The tour panel sits slightly to your right so it never blocks the road
  while driving. The speech bubble floats beside Chitti's head.
- Every button carries both RayInteractable and PokeInteractable, so it
  answers to a hand poke and to a ray + pinch.

## How to run it (on your laptop)

Requirements: Node.js 20.19+ (tested on Node v24.22.1), npm.

```sh
npm install
npm run dev
```

Open the URL the terminal prints (usually `https://localhost:8081/`). Accept
the certificate warning if the browser shows one. The title screen
says "Welcome to Travel Tour"; after 2 seconds tap **Start tutorial**
or **Start the game** — that tap itself takes you into VR.

## How the ride starts (circle gesture)

1. Pick a place — say it ("Times Square") or tap its card.
2. Put both palms on your desk. Two small glowing circles appear, one at
   each hand.
3. Bring both hands together. The circles zoom toward each other, collide
   into ONE big circle, grow into a portal, and then you are in the
   passenger seat — Chitti driving beside you, Times Square ahead. If hands
   are not tracked, tap **"▶ Start ride"**.

## How to try it on the Quest (same Wi-Fi)

1. On your laptop, run `npm run dev` and note the **Network** URL it prints
   (looks like `https://192.168.x.x:8081/` — the Wi-Fi address, not localhost).
2. Put the Quest on the same Wi-Fi as the laptop.
3. In the Quest browser, type the Network URL, accept the certificate
   warning, wait 2 seconds for the two boxes, then tap **Start tutorial**
   or **Start the game** — that tap itself takes you into VR.
   Bookmark it as "My Tour".
4. Put the controllers down. Hand tracking is on: point, pinch, tap the
   floating buttons, or just talk (say "Times Square", "take me left",
   "pause", "stop", "photo"). Tap the mic button once to turn listening on.

## Production build

```sh
npm run build
```

The static build is in `dist/` — serve that folder from any static host.
(dist is about 51 MB: 39 voice clips + the 41 MB offline Vosk model.)

## Verification (this build)

- `npm run typecheck` — passes.
- `npm run build` — succeeds (dist/ ~51 MB).
- Autotest (in the IWER emulator, XR session active, hand input):
  **69/69 checks pass** — Enter screen (two options only, city hidden,
  panels within reach, panels at eye level), tutorial intro runs 10–20 s,
  Skip goes to the main page, Restart replays the intro, short greeting,
  one panel at a time, voice clips mapped + served, Vosk model served +
  loads, voice-in path wired, speech bubble shows beside Chitti, mic button
  visible + toggle label, spoken command drives the tour, Chitti answers,
  no-echo gate, Start ride button, two circles merge into one, portal opens,
  passenger seat, black car, seats left-driver/right-passenger, drive
  ~5 s, road-following (including the Park–Broadway detour), nearby told
  before arrival, arrival line, get-out within 2 s, souvenirs shown, grab
  works, photo with object, thank-you, left/right only after the visit,
  suggestion + gesture hint, point-left turn, left turn to Central Park,
  left turn to Broadway, history only on asking, history parts 1 + 2,
  right turn back to Central Park, pause freezes, resume moves, arrive at
  the Statue, stop works, statue story, tap fallback. See
  `travel-tour-v2-autotest-report.md` next to this project. The circle
  checks use simulated palm positions (the emulator cannot place both hands
  together on command); the tap fallback and the place buttons were also
  pressed live with a real emulator hand. Real-hand tracking on a real
  Quest is still to be tried.
- Console: **0 app errors.** (In the emulator the IWSDK runtime sometimes
  logs failed fetches for its hand/controller visual models from a CDN —
  the sandbox browser cannot reach it; on a real Quest with Wi-Fi those
  load fine, and input is still tracked.)
- One real bug found and fixed in this round: the photo used to look for
  the canvas under `#scene-container`, which is empty — it now renders the
  scene once to the canvas through the World's renderer and reads the
  pixels in the same task. A second real bug: the Park–Broadway drive cut
  across a sidewalk gap — it now detours via Times Square on real roads.
  A third: `setPhase('enter')` did not hide the city — it now does.

## Still to be tried (needs the real Quest)

- Real hand tracking: the circle gesture with her own two hands, and
  grabbing a souvenir with a real hand (the emulator run used simulated
  palms and a test hook; the tap fallback works as the backup).
- Live voice on the device: Chitti's recorded voice playing in the headset,
  and Vosk hearing her place names (the 'microphone' XR feature was not
  listed in the emulator's enabled features).
- Real-Quest rendering and 60 fps, and the Quest Network URL (her laptop +
  Wi-Fi address).
- Car sounds and background music are NOT in this build (music is the last
  thing, for the final pass).

`CIRCLE_GESTURE_SPEC.md` — the circle-portal start gesture from Bhanu's
2026-11-14 evening voice call, refined 2026-11-15 (two circles zoom from
her hands, collide into one big circle, then the portal) — is **implemented
in this build**. The passenger-seat view replaces the old back-seat view;
the old `travel-tour-v2-proof-driving.png` (back seat) is superseded by
`travel-tour-v2-proof-passenger.png` (passenger seat, Chitti in side view).
