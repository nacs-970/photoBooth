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
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }

  async dispose(): Promise<void> {
    if (this.imgEl) {
      this.imgEl.src = '';
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
