import type { CameraAdapter } from './CameraAdapter.ts';
import { WebcamAdapter } from './WebcamAdapter.ts';

/**
 * Singleton camera adapter instance — mutable via setCameraAdapter().
 *
 * D-04 (CONTEXT.md) — Phase 2 boot flow:
 *   App boots to CameraSelectScreen → user taps a tile → setCameraAdapter(new X())
 *   → session.screen = 'idle' → all downstream screens import the live binding.
 *
 * ES module live binding (RESEARCH.md Pattern 4):
 *   `export let cameraAdapter` gives every importer a live view of this binding.
 *   Consumers CANNOT reassign an imported `let` directly — only this module can.
 *   Hence the setCameraAdapter() setter below.
 *
 * Default value: WebcamAdapter so the first paint of any screen that imports
 * cameraAdapter never sees `undefined`. The default is harmless because the
 * CameraSelectScreen always overwrites it before transitioning to 'idle'.
 */
export let cameraAdapter: CameraAdapter = new WebcamAdapter();

/**
 * Replace the singleton camera adapter.
 * Called by CameraSelectScreen when the host picks a camera source.
 *
 * After this returns, every importer of `cameraAdapter` reads the new instance
 * (ES module live binding semantics — Pattern 4 in Phase 2 RESEARCH.md).
 */
export function setCameraAdapter(a: CameraAdapter): void {
  cameraAdapter = a;
}
