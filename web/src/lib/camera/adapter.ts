import type { CameraAdapter } from './CameraAdapter.ts';
import { WebcamAdapter } from './WebcamAdapter.ts';

/**
 * Singleton camera adapter instance.
 *
 * Phase 1: always WebcamAdapter.
 * Phase 2: this module will inspect session.cameraInfo.cameraMode and return
 *           TetheredAdapter if cameraMode === 'tethered'.
 *
 * Components import `cameraAdapter` from here — never instantiate adapters directly.
 */
export const cameraAdapter: CameraAdapter = new WebcamAdapter();
