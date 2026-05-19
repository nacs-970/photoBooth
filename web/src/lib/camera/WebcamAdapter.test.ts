import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebcamAdapter } from './WebcamAdapter.ts';

// Fake MediaStreamTrack
function makeFakeTrack() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    stop: vi.fn(),
    readyState: 'live' as const,
  };
}

// Fake MediaStream
function makeFakeStream(trackCount = 1) {
  const tracks = Array.from({ length: trackCount }, makeFakeTrack);
  return {
    getVideoTracks: vi.fn(() => tracks),
    getTracks: vi.fn(() => tracks),
    _tracks: tracks,
  };
}

// Stub navigator.mediaDevices
const fakeStream = makeFakeStream();
const mockGetUserMedia = vi.fn().mockResolvedValue(fakeStream);
const mockAddEventListenerDevices = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Re-stub navigator.mediaDevices
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        addEventListener: mockAddEventListenerDevices,
        removeEventListener: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput' }]),
      },
    },
  });
  // Reset fakeStream tracks
  fakeStream._tracks.forEach((t) => {
    t.addEventListener.mockClear();
    t.stop.mockClear();
  });
  mockGetUserMedia.mockResolvedValue(fakeStream);
  mockAddEventListenerDevices.mockClear();
});

describe('WebcamAdapter.init()', () => {
  it('calls getUserMedia with correct constraints', async () => {
    const adapter = new WebcamAdapter();
    await adapter.init();

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  });

  it('registers an ended event listener on the first video track', async () => {
    const adapter = new WebcamAdapter();
    await adapter.init();

    const track = fakeStream.getVideoTracks()[0];
    expect(track.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('fires the onDisconnect callback when the ended listener fires', async () => {
    const adapter = new WebcamAdapter();
    const disconnectCb = vi.fn();
    adapter.onDisconnect(disconnectCb);
    await adapter.init();

    const track = fakeStream.getVideoTracks()[0];
    // Simulate the 'ended' event by calling the registered listener
    const endedListener = track.addEventListener.mock.calls.find(
      (call) => call[0] === 'ended',
    )?.[1] as (() => void) | undefined;
    expect(endedListener).toBeDefined();
    endedListener!();

    expect(disconnectCb).toHaveBeenCalledTimes(1);
  });
});

describe('WebcamAdapter.attachPreview()', () => {
  it('sets srcObject on the video element and calls play()', async () => {
    const adapter = new WebcamAdapter();
    await adapter.init();

    const videoEl = {
      srcObject: null as unknown,
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement;

    await adapter.attachPreview(videoEl);

    expect(videoEl.srcObject).toBe(fakeStream);
    expect((videoEl as any).play).toHaveBeenCalled();
  });
});

describe('WebcamAdapter.dispose()', () => {
  it('calls stop() on every track and nulls out the stream', async () => {
    const adapter = new WebcamAdapter();
    await adapter.init();

    await adapter.dispose();

    fakeStream.getTracks().forEach((t) => {
      expect(t.stop).toHaveBeenCalled();
    });

    // After dispose, attachPreview should throw (stream is null)
    const videoEl = {
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement;
    await expect(adapter.attachPreview(videoEl)).rejects.toThrow();
  });
});

describe('WebcamAdapter.capture()', () => {
  it('resolves with a Blob (OffscreenCanvas fallback path)', async () => {
    // Ensure ImageCapture is NOT in window for canvas fallback path
    const originalImageCapture = (globalThis as any).ImageCapture;
    delete (globalThis as any).ImageCapture;

    const adapter = new WebcamAdapter();
    await adapter.init();

    // Set up a video element for the canvas fallback
    const mockBlob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }),
      convertToBlob: vi.fn().mockResolvedValue(mockBlob),
    };
    (globalThis as any).OffscreenCanvas = vi.fn().mockImplementation(() => mockCanvas);

    const videoEl = {
      srcObject: null as unknown,
      play: vi.fn().mockResolvedValue(undefined),
      videoWidth: 1920,
      videoHeight: 1080,
    } as unknown as HTMLVideoElement;

    await adapter.attachPreview(videoEl);
    const result = await adapter.capture();

    expect(result).toBeInstanceOf(Blob);

    // Restore
    (globalThis as any).ImageCapture = originalImageCapture;
    delete (globalThis as any).OffscreenCanvas;
  });
});
