import os from 'node:os';
import { cameraService } from './CameraService.js';

export async function detectCamera(): Promise<{
  platform: string;
  gphoto2Available: boolean;
  cameraMode: 'webcam' | 'tethered';
  usbConflict: boolean;
}> {
  const platform = os.platform();
  let gphoto2Available = false;
  let usbConflict = false;

  if (platform !== 'win32') {
    const probeRes = await cameraService.probe();
    if (probeRes.available) {
      gphoto2Available = true;
    } else if (probeRes.conflictError === 'USB_CONFLICT') {
      usbConflict = true;
    }
  }

  const cameraMode: 'webcam' | 'tethered' = gphoto2Available ? 'tethered' : 'webcam';
  return { platform, gphoto2Available, cameraMode, usbConflict };
}
