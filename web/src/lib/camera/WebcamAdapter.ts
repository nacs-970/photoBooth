import type { CameraAdapter } from './CameraAdapter.ts';

/**
 * WebcamAdapter — Phase 1 getUserMedia implementation of CameraAdapter.
 *
 * Uses navigator.mediaDevices.getUserMedia for live preview and capture.
 * Two-layer disconnect detection (Pitfall 3, CAM-04):
 *   1. Primary: MediaStreamTrack 'ended' event
 *   2. Secondary: navigator.mediaDevices 'devicechange' event
 */
export class WebcamAdapter implements CameraAdapter {
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private disconnectCallback: (() => void) | null = null;
  private deviceChangeHandler: (() => void) | null = null;

  /**
   * Register a callback fired when the camera disconnects unexpectedly.
   * Call this BEFORE init() to ensure the callback is registered before the stream starts.
   */
  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  /**
   * Initialize camera access.
   * Requests getUserMedia with HD preferred resolution.
   * Attaches two-layer disconnect detection.
   */
  async init(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });

    // Primary disconnect detection: MediaStreamTrack 'ended' event (CAM-04)
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        this.disconnectCallback?.();
      });
    }

    // Secondary disconnect detection: devicechange event (Pattern 5 — Pitfall 3 fallback)
    this.deviceChangeHandler = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((d) => d.kind === 'videoinput');
      if (!hasCamera) {
        this.disconnectCallback?.();
      }
    };
    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
  }

  /**
   * Attach live preview to a DOM element.
   * Only supports HTMLVideoElement (webcam uses MediaStream, not MJPEG).
   * Stores the video element reference for canvas fallback in capture().
   */
  async attachPreview(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<void> {
    if (!this.stream) {
      throw new Error('WebcamAdapter not initialized — call init() first');
    }
    // Type-narrow: HTMLVideoElement has srcObject; HTMLImageElement does not
    if (!('srcObject' in el)) {
      throw new Error('WebcamAdapter requires HTMLVideoElement for attachPreview');
    }
    this.videoEl = el;
    el.srcObject = this.stream;
    await el.play();
  }

  /**
   * Capture one still frame as a JPEG Blob.
   * Prefers ImageCapture.takePhoto() (Chrome/Edge native quality).
   * Falls back to OffscreenCanvas for Firefox/Safari.
   */
  async capture(): Promise<Blob> {
    if (!this.stream) {
      throw new Error('WebcamAdapter not initialized — call init() first');
    }
    const track = this.stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('No video track available');
    }

    // Prefer ImageCapture API (Chrome/Edge) — native camera pipeline
    if ('ImageCapture' in window) {
      const ic = new (window as any).ImageCapture(track);
      return ic.takePhoto();
    }

    // Canvas fallback for Firefox/Safari
    if (!this.videoEl) {
      throw new Error('No video element — call attachPreview() first');
    }
    const canvas = new OffscreenCanvas(this.videoEl.videoWidth, this.videoEl.videoHeight);
    canvas.getContext('2d')!.drawImage(this.videoEl, 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  }

  /**
   * Stop all tracks and release resources.
   * Removes devicechange listener.
   */
  async dispose(): Promise<void> {
    if (this.deviceChangeHandler) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.videoEl = null;
  }
}
