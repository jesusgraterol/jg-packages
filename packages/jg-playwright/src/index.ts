// error codes
export { ERRORS } from './shared/index.js';

// overflow
export { expectNoHorizontalOverflow } from './overflow/index.js';

// page assets
export { waitForPageAssets } from './page-assets/index.js';

// motion
export {
  type IMotionInspection,
  type IMovingAnimation,
  type ISpatialProperty,
  inspectMotion,
} from './motion/index.js';

// protected fields
export { fillProtectedField } from './protected-field/index.js';

// fake microphone
export {
  type IFakeMicrophoneOptions,
  installFakeMicrophone,
  waitForRecordedAudio,
} from './microphone/index.js';
