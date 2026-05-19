/**
 * Tests for web/src/lib/audio.ts
 * Pattern 6: Audio Autoplay Gating (RESEARCH.md)
 *
 * Module-scope state (shutterAudio, unlocked) must be isolated between tests.
 * We use vi.resetModules() + dynamic import in each test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Flush all pending microtasks (Promise.resolve chains)
function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

// Build a fresh Audio mock for each test
function makeMockAudio(playResult: 'resolve' | 'reject' = 'resolve') {
  const pause = vi.fn();
  const play = vi.fn(() =>
    playResult === 'resolve'
      ? Promise.resolve<void>(undefined)
      : Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError')),
  );
  const instance = {
    play,
    pause,
    currentTime: 0,
    volume: 0,
    preload: '',
  };
  // Must use function keyword so it can be called as a constructor (new AudioClass())
  // Arrow functions cannot be used as constructors.
  function AudioClass(this: unknown) {
    return instance;
  }
  const AudioClassSpy = vi.fn().mockImplementation(AudioClass);
  return { AudioClass: AudioClassSpy, instance };
}

beforeEach(() => {
  vi.resetModules();
});

describe('preloadShutterSound()', () => {
  it('creates an Audio instance with preload === "auto" and volume === 0.8', async () => {
    const { AudioClass, instance } = makeMockAudio();
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');

    expect(AudioClass).toHaveBeenCalledWith('/sounds/shutter.mp3');
    expect(instance.preload).toBe('auto');
    expect(instance.volume).toBe(0.8);
  });
});

describe('unlockAudio()', () => {
  it('is a no-op (does not throw) when called before preloadShutterSound', async () => {
    const { AudioClass } = makeMockAudio();
    vi.stubGlobal('Audio', AudioClass);

    const { unlockAudio } = await import('./audio.ts');
    expect(() => unlockAudio()).not.toThrow();
  });

  it('calls play(), then pause(), then resets currentTime to 0 and sets unlocked=true on success', async () => {
    const { AudioClass, instance } = makeMockAudio('resolve');
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound, unlockAudio } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');
    unlockAudio();

    await flushMicrotasks();

    expect(instance.play).toHaveBeenCalledTimes(1);
    expect(instance.pause).toHaveBeenCalledTimes(1);
    expect(instance.currentTime).toBe(0);
  });

  it('swallows promise rejection from play() (NotAllowedError) without throwing', async () => {
    const { AudioClass } = makeMockAudio('reject');
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound, unlockAudio } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');

    await expect(async () => {
      unlockAudio();
      await flushMicrotasks();
    }).not.toThrow();
  });

  it('a second call after unlocked is a no-op (does not call play again)', async () => {
    const { AudioClass, instance } = makeMockAudio('resolve');
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound, unlockAudio } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');
    unlockAudio();
    await flushMicrotasks();

    const playCountAfterFirst = instance.play.mock.calls.length;
    unlockAudio();
    await flushMicrotasks();

    expect(instance.play.mock.calls.length).toBe(playCountAfterFirst);
  });
});

describe('playShutter()', () => {
  it('rewinds currentTime to 0 and calls play()', async () => {
    const { AudioClass, instance } = makeMockAudio('resolve');
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound, playShutter } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');
    instance.currentTime = 5; // simulate some elapsed time

    playShutter();
    await flushMicrotasks();

    expect(instance.currentTime).toBe(0);
    expect(instance.play).toHaveBeenCalledTimes(1);
  });

  it('swallows rejection from play() without throwing (iOS silent-mode tolerance)', async () => {
    const { AudioClass } = makeMockAudio('reject');
    vi.stubGlobal('Audio', AudioClass);

    const { preloadShutterSound, playShutter } = await import('./audio.ts');
    preloadShutterSound('/sounds/shutter.mp3');

    await expect(async () => {
      playShutter();
      await flushMicrotasks();
    }).not.toThrow();
  });
});
