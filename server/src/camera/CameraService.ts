import PQueue from 'p-queue';
import { execFile, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, copyFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

// 'shell' (default): one persistent `gphoto2 --shell` session serves both preview and capture.
//   - preview: `capture-preview` in a warm session takes ~35ms (~25fps)
//   - capture: libgphoto2 forces a 3s "startup wait" on Sony A7 IV & co. measured from
//     SESSION start (camlibs/ptp2/library.c camera_sony_capture). A warm session skips it,
//     so the shutter fires ~0.65s after the request instead of ~3.6s.
// 'poll': legacy one-process-per-frame loop (~3fps) + one process per capture.
const STREAM_MODE: 'shell' | 'poll' = process.env.STREAM_MODE === 'poll' ? 'poll' : 'shell';

const SHELL_DIR = path.join(os.tmpdir(), 'photobooth-gphoto2');
const SHELL_PROMPT = '/> ';
const PREVIEW_FAILURES_BEFORE_DISCONNECT = 5;

type FrameListener = (frame: Buffer) => void;
type Subscriber = { onFrame: FrameListener; onEnd: () => void };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class CameraService {
  private queue = new PQueue({ concurrency: 1 });
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private capturing = false;
  private previewing = false;
  private previewGen = 0;
  private subscribers = new Set<Subscriber>();

  // gphoto2 --shell session
  private shell: ChildProcess | null = null;
  private shellExited: Promise<void> = Promise.resolve();
  private shellOut = '';
  private shellWaiter: { resolve: (out: string) => void; reject: (err: Error) => void } | null = null;

  async capture(sessionId: number, shotIndex: number): Promise<Buffer> {
    this.capturing = true;
    // 1. Stop the preview. Subscribers stay registered and get frames again afterwards.
    this.stopStream();

    try {
      // 2. Queue the capture. It waits for the current preview frame to finish.
      return await (this.queue.add(async () => {
        const dir = path.resolve('../captures', `session-${sessionId}`);
        await mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${shotIndex}.jpg`);

        if (STREAM_MODE === 'shell') {
          const out = await this.shellRun('capture-image-and-download', 20_000);
          // RAW+JPEG (or a burst) can save several files per press — keep the first JPEG, delete the rest.
          const saved = [...out.matchAll(/Saving file as (.+)/g)].map(m => path.join(SHELL_DIR, m[1].trim()));
          if (saved.length === 0) {
            // Start the next attempt from a clean session (drops stale camera state).
            this.stopShell();
            throw new Error(`Capture failed: ${out.trim().slice(-200)}`);
          }
          await copyFile(saved.find(f => /\.jpe?g$/i.test(f)) ?? saved[0], filePath);
          await Promise.all(saved.map(f => unlink(f).catch(() => {})));
          return readFile(filePath);
        }

        // Small pause to let the camera breathe between PTP sessions
        await sleep(200);
        await execFileAsync('gphoto2', [
          '--capture-image-and-download',
          '--filename', filePath,
          '--force-overwrite',
        ], { timeout: 15_000 });

        return readFile(filePath);
      }) as Promise<Buffer>);
    } finally {
      this.capturing = false;
      // Resume preview for anyone still watching
      if (this.subscribers.size > 0) this.startProducer();
    }
  }

  get isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Register a stream listener. Starts the preview on first subscriber and stops it
   * when the last one unsubscribes. onEnd is called if the camera stops answering,
   * so the client sees the stream end and shows the disconnect UI.
   * Returns the unsubscribe function.
   */
  subscribe(onFrame: FrameListener, onEnd: () => void): () => void {
    const sub = { onFrame, onEnd };
    this.subscribers.add(sub);
    if (!this.capturing) this.startProducer();
    return () => {
      this.subscribers.delete(sub);
      if (this.subscribers.size === 0) this.stopStream();
    };
  }

  private broadcast(frame: Buffer) {
    for (const sub of this.subscribers) sub.onFrame(frame);
  }

  stopStream() {
    this.isPolling = false;
    this.previewing = false;
    this.previewGen++;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startProducer() {
    if (STREAM_MODE === 'poll') {
      this.startStreamProcess(frame => this.broadcast(frame));
    } else {
      void this.previewLoop();
    }
  }

  private async previewLoop(): Promise<void> {
    if (this.previewing) return;
    this.previewing = true;
    // A quick stop+start must not leave the old loop running next to the new one.
    const gen = ++this.previewGen;
    const live = () => this.previewing && gen === this.previewGen;
    let failures = 0;

    while (live() && this.subscribers.size > 0 && !this.capturing) {
      try {
        await this.queue.add(async () => {
          if (!live() || this.capturing) return;
          const out = await this.shellRun('capture-preview', 5000);
          if (!out.includes('Saving file as')) throw new Error(out.trim().slice(-200));
          const frame = await readFile(path.join(SHELL_DIR, 'capture_preview.jpg'));
          if (live()) this.broadcast(frame);
        });
        failures = 0;
      } catch (err) {
        if (++failures >= PREVIEW_FAILURES_BEFORE_DISCONNECT) {
          console.error('[CameraService] camera stopped answering:', (err as Error).message);
          this.stopShell();
          for (const sub of this.subscribers) sub.onEnd();
          break;
        }
        await sleep(200);
      }
    }
    if (gen === this.previewGen) this.previewing = false;
  }

  /** Start the gphoto2 shell (if needed) and resolve once it shows its first prompt. */
  private async ensureShell(): Promise<void> {
    if (this.shell) return;
    // Previous session must release the USB device first (bounded, in case it hangs).
    await Promise.race([this.shellExited, sleep(5000)]);
    if (this.shell) return;
    await mkdir(SHELL_DIR, { recursive: true });

    const proc = spawn('gphoto2', ['--force-overwrite', '--shell'], {
      cwd: SHELL_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.shell = proc;
    this.shellOut = '';
    this.shellExited = new Promise<void>(resolve => { proc.once('exit', () => resolve()); proc.once('error', () => resolve()); });
    // Writing to a shell that just died (e.g. camera unplugged) emits EPIPE; without a
    // listener that would crash the server. The 'exit' handler below does the cleanup.
    proc.stdin!.on('error', () => {});

    const onData = (chunk: Buffer) => {
      if (this.shell !== proc) return;
      this.shellOut += chunk.toString();
      if (this.shellOut.endsWith(SHELL_PROMPT) && this.shellWaiter) {
        const out = this.shellOut;
        this.shellOut = '';
        const waiter = this.shellWaiter;
        this.shellWaiter = null;
        waiter.resolve(out);
      }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', onData);

    const onGone = () => {
      if (this.shell !== proc) return;
      this.shell = null;
      const waiter = this.shellWaiter;
      this.shellWaiter = null;
      waiter?.reject(new Error(`gphoto2 shell exited: ${this.shellOut.trim().slice(-200)}`));
    };
    proc.on('exit', onGone);
    proc.on('error', onGone);

    await this.waitForPrompt(10_000);

    // In PC Remote mode the A7 IV takes its drive mode from the host, not the body dial.
    // A continuous mode fires a burst per press (libgphoto2 holds the shutter until the
    // first image arrives) and leftover burst images break the next capture with
    // "PTP Invalid Object Handle". Force single shot on every new session.
    const out = await this.shellExec('set-config capturemode=Single Shot', 5000);
    if (/Error/i.test(out)) console.warn('[CameraService] could not force Single Shot:', out.trim());
  }

  private waitForPrompt(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.shellWaiter = null;
        this.stopShell();
        reject(new Error('gphoto2 shell timed out'));
      }, timeoutMs);
      this.shellWaiter = {
        resolve: (out) => { clearTimeout(timer); resolve(out); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      };
      // Prompt may already be waiting in the buffer
      if (this.shellOut.endsWith(SHELL_PROMPT)) {
        const out = this.shellOut;
        this.shellOut = '';
        this.shellWaiter.resolve(out);
        this.shellWaiter = null;
      }
    });
  }

  /** Run one shell command and resolve with its output. Callers must hold the queue. */
  private async shellRun(cmd: string, timeoutMs: number): Promise<string> {
    await this.ensureShell();
    return this.shellExec(cmd, timeoutMs);
  }

  private shellExec(cmd: string, timeoutMs: number): Promise<string> {
    this.shellOut = ''; // previous prompt was consumed; drop any stray output
    const done = this.waitForPrompt(timeoutMs);
    this.shell!.stdin!.write(`${cmd}\n`);
    return done;
  }

  /** Close the shell session cleanly: `exit`, then SIGINT if it lingers. Never SIGKILL. */
  private stopShell() {
    const proc = this.shell;
    if (!proc) return;
    this.shell = null;
    proc.stdin?.end('exit\n');
    setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGINT'); }, 2000);
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
    // The shell session holds the camera; a live session already proves it is available.
    if (this.shell) return { available: true };
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
