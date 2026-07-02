import PQueue from 'p-queue';
import { execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export class CameraService {
  private queue = new PQueue({ concurrency: 1 });
  private streamProc: ChildProcess | null = null;
  private activePollProc: ChildProcess | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  async capture(sessionId: number, shotIndex: number): Promise<Buffer> {
    return this.queue.add(async () => {
      await this.stopStream();
      // Wait a brief moment to ensure the OS releases the USB lock after SIGKILL
      await new Promise(r => setTimeout(r, 200));

      // Navigate up from the 'server' cwd to land in the repo root 'captures/' folder
      const dir = path.resolve('../captures', `session-${sessionId}`);
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${shotIndex}.jpg`);
      await execFileAsync('gphoto2', [
        '--capture-image-and-download',
        '--filename', filePath,
        '--force-overwrite',
      ], { timeout: 10_000 });
      return readFile(filePath);
    }) as Promise<Buffer>;
  }

  get isCapturing(): boolean {
    return this.queue.size > 0 || this.queue.pending > 0;
  }

  async stopStream() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    // Do NOT kill the active gphoto2 process! Interrupting it mid-transaction
    // leaves the physical camera's PTP session open and causes the camera to freeze.
    // Instead, wait for the current short-lived poll to finish naturally.
    if (this.activePollProc) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Only force kill if it's completely stuck for 3 seconds
          if (this.activePollProc) this.activePollProc.kill('SIGKILL');
          resolve();
        }, 3000);
        
        this.activePollProc!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.activePollProc = null;
    }
  }

  startStreamProcess(onFrame: (frame: Buffer) => void): void {
    if (this.isCapturing) {
      throw new Error('CAPTURE_IN_PROGRESS');
    }
    
    this.stopStream();
    this.isPolling = true;
    
    const poll = () => {
      if (!this.isPolling) return;
      
      this.activePollProc = execFile('gphoto2', [
        '--capture-preview',
        '--stdout'
      ], {
        timeout: 5000,
        encoding: 'buffer'
      }, (err, stdout) => {
        this.activePollProc = null;
        if (!this.isPolling) return;
        if (!err && stdout && stdout.length > 0) {
          onFrame(stdout as Buffer);
        }
        this.pollTimer = setTimeout(poll, 150);
      });
    };

    poll();
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
