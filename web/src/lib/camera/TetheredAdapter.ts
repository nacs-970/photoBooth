import type { CameraAdapter } from './CameraAdapter.ts';
import { createMjpegParser } from './mjpeg.ts';

// WR-04: a normal capture takes ~4s (~7s from a cold shell). Past this, give up so the
// Review "Capture failed" path is reached instead of the countdown screen hanging.
export const CAPTURE_TIMEOUT_MS = 15_000;

export class TetheredAdapter implements CameraAdapter {
  private disconnectCallback: (() => void) | null = null;
  private sessionId: number | null = null;
  private imgEl: HTMLImageElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private streamAbort: AbortController | null = null;

  async init(): Promise<void> {
    const res = await fetch('/api/camera/info');
    if (!res.ok) throw new Error('Camera backend unreachable');
    const info = await res.json();
    if (info.usbConflict) throw new Error('USB_CONFLICT');
    if (!info.gphoto2Available) throw new Error('No DSLR detected');
  }

  async attachPreview(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<void> {
    if (el instanceof HTMLCanvasElement) {
      this.canvasEl = el;
      this.startCanvasStream();
      return;
    }
    if (!(el instanceof HTMLImageElement)) {
      throw new Error('TetheredAdapter requires HTMLImageElement or HTMLCanvasElement');
    }
    this.imgEl = el;
    this.imgEl.src = `/api/camera/stream?t=${Date.now()}`;
    this.imgEl.onerror = () => {
      this.disconnectCallback?.();
    };
  }

  async capture(): Promise<Blob> {
    const { session } = await import('$lib/session.svelte.ts');
    if (!session.sessionStartedAt) {
      session.sessionStartedAt = Date.now();
    }
    this.sessionId = session.sessionStartedAt;

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(new Error('Capture timed out')), CAPTURE_TIMEOUT_MS);
    try {
      const res = await fetch('/api/camera/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotIndex: session.currentShotIndex,
          sessionId: this.sessionId,
        }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`Capture failed: ${res.status}`);

      // Re-connect preview: stream was killed during capture.
      // Cache-bust forces a new HTTP connection — no stale img cache.
      if (this.imgEl) {
        this.imgEl.src = `/api/camera/stream?t=${Date.now()}`;
      }
      // Canvas stream stays connected through a capture (server resumes frames);
      // only reconnect if it dropped.
      if (this.canvasEl?.isConnected && !this.streamAbort) {
        this.startCanvasStream();
      }

      return await res.blob();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Read the MJPEG stream with fetch and paint each frame to the canvas.
   * Every ImageBitmap is closed right after drawing, so decoded frames are freed
   * immediately instead of piling up like frames of an <img> MJPEG stream.
   * While one frame decodes, newer frames replace the pending one (drop, never queue).
   */
  private startCanvasStream(): void {
    this.stopCanvasStream();
    const canvas = this.canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const abort = new AbortController();
    this.streamAbort = abort;

    // Screen changed and the canvas left the DOM: close the stream so the server can
    // stop the camera's live view. Checked on a timer too, because frames may never
    // arrive (camera busy or gone) and then the per-frame check below never runs.
    const watchdog = setInterval(() => {
      if (!canvas.isConnected) {
        abort.abort();
        if (this.streamAbort === abort) this.streamAbort = null;
      }
    }, 500);
    // Every abort route (watchdog, re-attach, dispose, frame check) clears the interval.
    abort.signal.addEventListener('abort', () => clearInterval(watchdog), { once: true });

    let pending: Uint8Array | null = null;
    let decoding = false;

    const paint = async () => {
      decoding = true;
      while (pending && !abort.signal.aborted) {
        const jpeg = pending;
        pending = null;
        try {
          const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }));
          if (!abort.signal.aborted) {
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
            }
            ctx.drawImage(bitmap, 0, 0);
          }
          bitmap.close();
        } catch {
          // Corrupt frame — skip it
        }
      }
      decoding = false;
    };

    const parser = createMjpegParser((jpeg) => {
      // Screen changed and the canvas left the DOM: close the stream so the
      // server can stop the camera's live view (an <img> did this implicitly).
      if (!canvas.isConnected) {
        abort.abort();
        if (this.streamAbort === abort) this.streamAbort = null;
        return;
      }
      pending = jpeg;
      if (!decoding) void paint();
    });

    (async () => {
      const res = await fetch(`/api/camera/stream?t=${Date.now()}`, { signal: abort.signal });
      if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(value);
      }
      throw new Error('Stream ended');
    })().catch(() => {
      if (abort.signal.aborted) return;
      // Stream failed on its own: nothing aborts the controller, so stop the watchdog here.
      clearInterval(watchdog);
      if (this.streamAbort === abort) this.streamAbort = null;
      this.disconnectCallback?.();
    });
  }

  private stopCanvasStream(): void {
    this.streamAbort?.abort();
    this.streamAbort = null;
  }

  async dispose(): Promise<void> {
    this.stopCanvasStream();
    this.canvasEl = null;
    if (this.imgEl) {
      this.imgEl.removeAttribute('src');
      this.imgEl.onerror = null;
      this.imgEl = null;
    }
    this.sessionId = null;
    this.disconnectCallback = null;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }
}
