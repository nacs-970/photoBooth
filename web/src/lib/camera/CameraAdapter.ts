/**
 * CameraAdapter — THE contract for Phase 2.
 *
 * All screen components interact with the camera exclusively through this interface.
 * Platform-specific logic lives only in the adapter implementations (WebcamAdapter, TetheredAdapter).
 */
export interface CameraAdapter {
  /**
   * Initialize camera access.
   * Phase 1 (WebcamAdapter): calls navigator.mediaDevices.getUserMedia and stores the MediaStream.
   * Phase 2 (TetheredAdapter): establishes HTTP connection to gphoto2 backend.
   */
  init(): Promise<void>;

  /**
   * Attach live preview to a DOM element.
   * Phase 1 (WebcamAdapter): sets el.srcObject = MediaStream (requires HTMLVideoElement).
   * Phase 2 (TetheredAdapter): paints the MJPEG stream onto an HTMLCanvasElement
   * (or sets el.src = MJPEG endpoint URL on an HTMLImageElement).
   * The union type keeps Phase 2 compatible without touching screen code.
   */
  attachPreview(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<void>;

  /**
   * Capture one still frame.
   * Phase 1 (WebcamAdapter): uses ImageCapture.takePhoto() or canvas fallback.
   * Phase 2 (TetheredAdapter): POST /api/camera/capture to trigger gphoto2.
   * Returns a JPEG Blob.
   */
  capture(): Promise<Blob>;

  /**
   * Stop all tracks and release resources.
   * Called on session reset or app unmount.
   * Phase 1: calls track.stop() on all MediaStream tracks.
   * Phase 2: closes backend connection.
   */
  dispose(): Promise<void>;

  /**
   * Register a callback fired when the camera disconnects unexpectedly.
   * Phase 1: fired by MediaStreamTrack 'ended' event or devicechange polling.
   * Phase 2: fired by backend WebSocket heartbeat timeout.
   * Wired to session.showDisconnect() in IdleScreen (Plan 04 completes this).
   */
  onDisconnect(callback: () => void): void;
}
