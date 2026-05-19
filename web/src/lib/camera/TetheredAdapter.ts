import type { CameraAdapter } from './CameraAdapter.ts';

/**
 * TetheredAdapter — Phase 2 placeholder.
 *
 * Implements the CameraAdapter interface so TypeScript can verify the contract at compile time.
 * Every method throws; Phase 2 replaces this with real gphoto2 backend integration.
 */
export class TetheredAdapter implements CameraAdapter {
  async init(): Promise<void> {
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }

  async attachPreview(_el: HTMLVideoElement | HTMLImageElement): Promise<void> {
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }

  async capture(): Promise<Blob> {
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }

  async dispose(): Promise<void> {
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }

  onDisconnect(_callback: () => void): void {
    throw new Error('TetheredAdapter is a Phase 2 placeholder');
  }
}
