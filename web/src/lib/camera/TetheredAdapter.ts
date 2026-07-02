import type { CameraAdapter } from './CameraAdapter.ts';

export class TetheredAdapter implements CameraAdapter {
  private disconnectCallback: (() => void) | null = null;
  private sessionId: number | null = null;
  private imgEl: HTMLImageElement | null = null;

  async init(): Promise<void> {
    const res = await fetch('/api/camera/info');
    if (!res.ok) throw new Error('Camera backend unreachable');
    const info = await res.json();
    if (info.usbConflict) throw new Error('USB_CONFLICT');
    if (!info.gphoto2Available) throw new Error('No DSLR detected');
  }

  async attachPreview(el: HTMLVideoElement | HTMLImageElement): Promise<void> {
    if (!(el instanceof HTMLImageElement)) {
      throw new Error('TetheredAdapter requires HTMLImageElement');
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

    const res = await fetch('/api/camera/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shotIndex: session.currentShotIndex,
        sessionId: this.sessionId,
      }),
    });
    if (!res.ok) throw new Error(`Capture failed: ${res.status}`);

    // Re-connect preview: stream was killed during capture.
    // Cache-bust forces a new HTTP connection — no stale img cache.
    if (this.imgEl) {
      this.imgEl.src = `/api/camera/stream?t=${Date.now()}`;
    }

    return res.blob();
  }

  async dispose(): Promise<void> {
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
