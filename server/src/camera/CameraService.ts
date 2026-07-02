import PQueue from 'p-queue';
import { spawn, execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export class CameraService {
  private queue = new PQueue({ concurrency: 1 });
  private streamProc: ChildProcess | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  get isCapturing(): boolean {
    return this.queue.size > 0 || this.queue.pending > 0;
  }

  stopStream() {
    if (this.streamProc) {
      this.streamProc.kill('SIGTERM');
      this.streamProc = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startStreamProcess(onFrame: (frame: Buffer) => void): NodeJS.Timeout {
    if (this.isCapturing) {
      throw new Error('CAPTURE_IN_PROGRESS');
    }
    
    this.stopStream();
    
    this.pollInterval = setInterval(async () => {
      try {
        const { stdout } = await execFileAsync('gphoto2', [
          '--capture-preview',
          '--filename', '-',
          '--force-overwrite'
        ], {
          timeout: 5000,
          encoding: 'buffer'
        });
        
        onFrame(stdout as Buffer);
      } catch (err) {
        // ignore errors during poll
      }
    }, 150);

    return this.pollInterval;
  }

  async probe(): Promise<{ available: boolean; conflictError?: string }> {
    try {
      await execFileAsync('gphoto2', ['--auto-detect'], { timeout: 3000 });
      return { available: true };
    } catch (err: any) {
      const stderr = err.stderr ? err.stderr.toString() : '';
      if (stderr.includes('Could not claim the USB device') || stderr.includes('-53')) {
        return { available: false, conflictError: 'USB_CONFLICT' };
      }
      return { available: false };
    }
  }
}

export const cameraService = new CameraService();
