import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function detectCamera(): Promise<{
  platform: string;
  gphoto2Available: boolean;
  cameraMode: 'webcam' | 'tethered';
}> {
  const platform = os.platform();
  let gphoto2Available = false;

  // Mitigation T-01-DoS: timeout 3000ms; catch failure → fall back to webcam
  if (platform !== 'win32') {
    try {
      await execFileAsync('gphoto2', ['--version'], { timeout: 3000 });
      gphoto2Available = true;
    } catch {
      // gphoto2 not installed or failed — fall back to webcam
    }
  }

  const cameraMode: 'webcam' | 'tethered' = gphoto2Available ? 'tethered' : 'webcam';
  return { platform, gphoto2Available, cameraMode };
}
