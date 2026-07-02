import PQueue from 'p-queue';
import { execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export class CameraService {
  private queue = new PQueue({ concurrency: 1 });
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;

  async capture(sessionId: number, shotIndex: number): Promise<Buffer> {
    // 1. Stop the polling loop from scheduling new frames
    this.stopStream();

    // 2. Queue the capture. It will automatically wait for the current preview frame (if any) to finish safely.
    return this.queue.add(async () => {
      // Small pause to let the camera breathe between PTP sessions
      await new Promise(r => setTimeout(r, 200));

      const dir = path.resolve('../captures', `session-${sessionId}`);
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${shotIndex}.jpg`);
      
      await execFileAsync('gphoto2', [
        '--capture-image-and-download',
        '--filename', filePath,
        '--force-overwrite',
      ], { timeout: 15_000 });
      
      return readFile(filePath);
    }) as Promise<Buffer>;
  }

  get isCapturing(): boolean {
    // True if there is a pending capture task in the queue
    return this.queue.size > 0 || this.queue.pending > 0;
  }

  stopStream() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  startStreamProcess(onFrame: (frame: Buffer) => void): void {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        await this.queue.add(async () => {
          if (!this.isPolling) return;
          const { stdout } = await execFileAsync('gphoto2', [
            '--capture-preview',
            '--stdout'
          ], {
            timeout: 5000,
            encoding: 'buffer'
          });
          
          if (this.isPolling && stdout && stdout.length > 0) {
            onFrame(stdout as Buffer);
          }
        });
      } catch (err) {
        // Ignore errors during preview fetch (e.g. timeout, camera busy)
      }

      if (this.isPolling) {
        // Schedule next frame. The 100ms delay ensures the queue empties
        // allowing capture() to jump in front of the next frame.
        this.pollTimer = setTimeout(poll, 100);
      }
    };

    poll();
  }

  async probe(): Promise<{ available: boolean; conflictError?: string }> {
    try {
      await this.queue.add(async () => {
        await execFileAsync('gphoto2', ['--auto-detect'], { timeout: 3000 });
      });
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
