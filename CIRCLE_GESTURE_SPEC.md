# Circle-Portal Start Gesture — v2.0 addition (Bhanu, voice call 2026-11-14 evening)

**Status: IMPLEMENTED 2026-11-16 (in this build, refined).** Verified live in
the Quest 3 emulator: autotest 69/69 (gesture checks included), 0 app console
errors. The gesture checks use simulated palm positions — the emulator cannot
place both hands together on command — and the tap fallback was pressed live
with a real emulator hand. Real-hand tracking on a real Quest is still to be
tried.

## The gesture, step by step (refined 2026-11-15 evening)
1. She talks to the agent (voice) and names a place (e.g. Times Square).
   A **"▶ Start ride"** button appears — she can press it with her hand
   instead of doing the gesture.
2. She puts both palms on her desk. **Two small glowing circles** appear,
   one zooming from each hand.
3. She brings both hands together. The two circles slide toward each other
   and **collide into ONE big circle** between her palms. The big circle
   grows and fades over 2 seconds as a portal.
4. After the portal: she is seated in the PASSENGER seat; Milo the robot is
   in the DRIVER'S seat right beside her, hands on the wheel, visible at all
   times, steering as the car turns. The car is **black**. The camera looks
   **forward** (Times Square ahead), and the view turns with the car when it
   turns left or right.
5. Drive: road-following with traffic; about 5 seconds to the destination.
6. Keep the **"▶ Start ride"** tap button as fallback for the gesture (if
   hands are not detected, tapping still starts the ride). The gesture gates
   only the first ride of a session; later rides start straight away.

## Bhanu feedback (voice call, 2026-11-14 evening — added after the build started)
- She is a passenger traveling with Robo (Milo). Robo must be CUTE and
  REALISTIC — not blocky. She will share reference photos of the robot she
  wants; until then, make him as cute and realistic as the stylised 3D allows
  (smooth rounded shapes, expressive glowing eyes, friendly face — not a dark
  box).
- From the passenger seat she must see the SIDE VIEW of his hands and body —
  his hands on the steering wheel and his body in profile, beside her.
- The current screenshots read wrong: they look like the agent/car is coming
  TOWARD her (front view) with Times Square behind. Fix the camera: she sits
  in the passenger seat looking FORWARD through the windshield, Times Square
  AHEAD of the car, Milo beside her (driver's side, left) in side view.
  Never a front view of the car coming at her.
- She will run the build herself and send more changes after that.

## Verification
Autotest: palms apart → two circles shown → palms together → circles merge
into one → portal opens → passenger-seat view with Milo driving beside
her. Proof screenshots: the circle gesture, and the passenger-seat drive view.

Implemented as: `gesture` + `portal` phases in `src/tour-system.ts`
(`driveTo` gates the first ride through the gesture; grip-space palm
detection with apart-first arming, 0.12 m close threshold, 350 ms hold;
TWO small torus rings (`ringL`/`ringR`) that grow and slide toward the
midpoint as the palms close, then hide and a single big portal ring grows +
fades over a 2 s wall-clock portal; `portalDone` makes later rides direct;
`btn-start-ride` fallback, labelled "▶ Start ride").
Player spawn is the passenger seat `[0.45, 0, 0.35]` in
`public/scenes/main.iwsdk.scene.json` (forward view, no rotation), hero view
matches. Milo's arms reach the wheel (wheel moved closer, steering
column added, hands on the rim at 10 and 2 o'clock). The car paint is
near-black (`0x050505`).

## Later refinements (2026-11-15/16, in this build)
- **Two circles, one merge:** the gesture is now two small circles zooming
  from her hands that collide into ONE big circle, then the portal — not a
  single ring. (`ensureRings`/`hideRings` in `src/tour-system.ts`.)
- **Start ride button:** after she names a place, a big "▶ Start ride"
  button appears that she can press with her hand — no gesture needed.
- **Voice:** Milo speaks in pre-recorded Aria clips (warm, cute, sweet);
  she talks back through offline Vosk recognition, toggled by the
  "🎤 Tap to speak" mic button. While he speaks, the mic is gated shut, so
  his voice never echoes back into the recogniser.
- **Speech bubble:** his words also appear in a small cloud beside him.
- **Panels at eye level, within reach:** both panels sit ~0.7 m in front of
  her head and follow it into XR, so every button is tappable by hand.
- **Arrival + get-out + photo + thank-you + left/right:** after the drive,
  Milo says "Here is the destination!", they both step out within 2 s,
  she grabs an object (camera / balloon / statue) for the photo, the visit
  ends with "Thank you so much for taking me!", and only then does the
  left/right choice appear — with Milo's suggestion and a small gesture
  hint. See the README for the full flow.
