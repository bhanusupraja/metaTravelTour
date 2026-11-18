/**
 * Travel Agent Tour v2.0 - app entry. One system drives the whole tour.
 */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { TourSystem } from './tour-system.js';

// Voice input inside XR: the Quest Browser only hands the microphone to an
// XR session that asked for it, and IWSDK's XR options have no microphone
// flag - so ask for it here, before the session is created. Without this,
// getUserMedia({audio}) stays silent while she is in the headset.
if (typeof navigator !== 'undefined' && navigator.xr) {
  const xr = navigator.xr as unknown as {
    requestSession: (mode: XRSessionMode, init?: XRSessionInit) => Promise<XRSession>;
  };
  const origRequestSession = xr.requestSession.bind(xr);
  xr.requestSession = (mode: XRSessionMode, init?: XRSessionInit) => {
    const optional = [...((init?.optionalFeatures as string[] | undefined) ?? [])];
    if (!optional.includes('microphone')) optional.push('microphone');
    return origRequestSession(mode, { ...(init ?? {}), optionalFeatures: optional });
  };
}

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(TourSystem);
});
