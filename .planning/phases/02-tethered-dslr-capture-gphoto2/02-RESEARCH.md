# Phase 2: Tethered DSLR Capture (gphoto2) — Research

**Researched:** 2026-05-20
**Domain:** gphoto2 subprocess management, MJPEG streaming via Node.js/Fastify, TetheredAdapter implementation
**Confidence:** MEDIUM-HIGH (core patterns verified; gphoto2 FPS on target camera body is an empirical gap)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `'camera_select'` to `ScreenName` type. App always boots to `camera_select`, never directly to `idle`.
- **D-02:** Picker shows 2 large tiles: DSLR (status from `/api/camera/info`) and Webcam (always "Available").
- **D-03:** No persistence — picker appears fresh on every boot. No `localStorage`.
- **D-04:** After tile tap, mutate the `cameraAdapter` singleton in `adapter.ts` (change `const` to `let`). Then transition to `idle`.
- **D-05:** Raw MJPEG passthrough — Fastify spawns `gphoto2 --capture-movie --stdout`, pipes stdout as `multipart/x-mixed-replace` on `GET /api/camera/stream`. No frame buffering or re-encoding on the server. (**Implementation clarification:** see Architecture Patterns section — raw JPEG passthrough requires SOI/EOI scanning to emit multipart boundaries; this is not a contradiction of D-05.)
- **D-06:** `TetheredAdapter.attachPreview(el)`: if `el instanceof HTMLImageElement` → `el.src = '/api/camera/stream'`; if `el instanceof HTMLVideoElement` → throw. Phase 2 updates `LivePreview.svelte` to render `<img>` or `<video>` based on adapter type, OR mounts a separate component.
- **D-07:** Stream endpoint path: `/api/camera/stream`.
- **D-08:** If no DSLR connected when host taps DSLR tile: `TetheredAdapter.init()` fails → DisconnectModal appears immediately.
- **D-09:** Detect gphoto2 `-53` error during `init()` or stream start. Surface via DisconnectModal with USB conflict message.
- **D-10:** Reuse DisconnectModal — add optional `message` prop; default message unchanged. No new component.
- **D-11:** No auto-kill of gvfs/PTPCamera. User must quit conflicting apps manually.
- **D-12:** `POST /api/camera/capture` determines session folder, runs `gphoto2 --capture-image-and-download --filename ./captures/session-{ts}/{index}.jpg --force-overwrite`, reads file, returns as `image/jpeg`.
- **D-13:** Captured JPEGs persist on disk at `./captures/session-{timestamp}/{shot-index}.jpg`. Not deleted. Session timestamp set on first capture (TetheredAdapter tracks internally).
- **D-14:** `TetheredAdapter.capture()`: POST to `/api/camera/capture` with `{ shotIndex, sessionId }` body. Parse response as `Blob`. Return blob.

### Claude's Discretion

- gphoto2 subprocess timeout values (suggested: 10s for `--capture-image-and-download`, 5s for stream start).
- MJPEG stream restart behaviour after Retry (re-set `img.src` to flush browser cache; append `?t={Date.now()}` if needed).
- Exact error string matching for gphoto2 `-53`.
- LivePreview.svelte update strategy: adapter-type check or separate component (planner decides).

### Deferred Ideas (OUT OF SCOPE)

- Auto-kill gvfs silently on startup (D-11 rejects; detect-and-prompt only).
- URL param / env flag for camera mode.
- Remember last camera selection in localStorage (D-03 rejects).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAM-03 | On Mac/Linux, camera preview uses gphoto2 MJPEG live view and capture triggers the actual DSLR shutter via gphoto2 subprocess | TetheredAdapter (browser) + CameraService (Node) + `/api/camera/stream` (MJPEG) + `/api/camera/capture` (gphoto2 shutter) — full stack mapped in this research |

</phase_requirements>

---

## Summary

Phase 2 adds the gphoto2 camera path to an already-working session loop. The browser-side code (TetheredAdapter, CameraSelectScreen, LivePreview update) is mostly straightforward. The complexity lives in the Node.js server: a `CameraService` singleton must own the gphoto2 subprocess lifecycle, because preview and capture cannot run simultaneously on a single USB device.

The single highest-risk unknown is how fast `gphoto2 --capture-movie --stdout` runs on the actual connected camera body. Field reports range from 2 fps + 4-5s lag (Canon 6D) to ~17 fps via `--capture-preview` polling (EOS 550D). The architecture should support swapping the live-view strategy (movie vs. preview-poll) without changing the browser-facing `GET /api/camera/stream` endpoint.

The second key insight is that `gphoto2 --capture-movie --stdout` outputs **raw concatenated JPEG bytes** (SOI `\xff\xd8` ... EOI `\xff\xd9`), not HTTP multipart with boundary headers. The server must scan for these markers and wrap each frame in multipart boundary lines before writing to the response. This is consistent with D-05's "no re-encoding" intent — bytes pass through; only boundary headers are synthesized.

**Primary recommendation:** Build a `CameraService` server-side singleton with `p-queue` concurrency 1. The stream handler spawns gphoto2 on connection and kills it on connection close. The capture handler tears down the stream, fires gphoto2 capture, then the browser reconnects the stream. Frontend mounts `<TetheredPreview>` (an `<img>` tag) separately from the existing `<LivePreview>` (a `<video>` tag).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera mode selection | Browser / Client | API / Backend | CameraSelectScreen reads `/api/camera/info` (backend provides truth); user taps tile in browser |
| Adapter singleton mutation | Browser / Client | — | `adapter.ts` `let` export mutated by CameraSelectScreen on tile tap |
| MJPEG live preview stream | API / Backend | Browser / Client | gphoto2 subprocess runs in Node; browser displays via `<img src="/api/camera/stream">` |
| MJPEG frame parsing + boundary synthesis | API / Backend | — | Raw SOI/EOI bytes from gphoto2 stdout → boundary-wrapped multipart in the server stream handler |
| DSLR capture (shutter trigger) | API / Backend | — | `gphoto2 --capture-image-and-download` runs in Node; result returned as JPEG binary to browser |
| Capture disk persistence | API / Backend | — | `./captures/session-{ts}/{index}.jpg` written by Node before HTTP response |
| USB conflict detection (`-53`) | API / Backend | Browser / Client | Node detects stderr error; browser shows DisconnectModal via `TetheredAdapter.init()` throw |
| Camera disconnect detection (mid-session) | API / Backend | Browser / Client | Node detects gphoto2 process exit; signals browser via `onDisconnect` callback (heartbeat or stream close) |
| CameraSelectScreen UI | Browser / Client | — | Svelte component; renders tile + status pill from `GET /api/camera/info` result |
| Session folder ID | Browser / Client | — | `session.sessionStartedAt` in session.svelte.ts; passed to server in POST body |

---

## Standard Stack

### New Packages Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `p-queue` | 9.3.0 | Serialize gphoto2 operations — concurrency 1, prevents simultaneous preview+capture | Only battle-tested async priority queue in the Node ecosystem; 10-year-old package [VERIFIED: npm registry] |
| `@fastify/multipart` | 10.0.0 | Parse `POST /api/camera/capture` request body (`{ shotIndex, sessionId }`) | Official Fastify multipart plugin; used for JSON body parsing on the capture endpoint [VERIFIED: npm registry] |

### No New Frontend Packages

The frontend changes are:
- New `CameraSelectScreen.svelte` screen component (Svelte 5 — already installed)
- New `TetheredPreview.svelte` component wrapping `<img>` (Svelte 5 — already installed)
- Full implementation of `TetheredAdapter.ts` (TypeScript — already installed)
- `types.ts` ScreenName extension
- `DisconnectModal.svelte` `message` prop addition
- `adapter.ts` `const` → `let`

### Installation

```bash
# Server only — add to server/package.json
cd server && npm install p-queue @fastify/multipart
```

**Note:** `@fastify/multipart` is needed to parse JSON body on `POST /api/camera/capture`. If the endpoint uses `Content-Type: application/json` instead of multipart, only `p-queue` is required and `@fastify/multipart` can be skipped — Fastify parses JSON bodies natively. Planner should decide: JSON body (simpler, no new dep) or formData body.

### Version Verification

```
p-queue 9.3.0 — published 2016-10-28 (9+ years), last modified 2026-05-16 [VERIFIED: npm registry]
@fastify/multipart 10.0.0 — published 2022-04-27 (4+ years), last modified 2026-04-07 [VERIFIED: npm registry]
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `p-queue` | npm | 9+ years | github.com/sindresorhus/p-queue | [OK] | Approved |
| `@fastify/multipart` | npm | 4+ years | github.com/fastify/fastify-multipart | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**slopcheck version:** 0.6.1 — ran successfully against npm registry on 2026-05-20.

---

## Architecture Patterns

### System Architecture Diagram

```
Boot: Browser → GET /api/camera/info → CameraSelectScreen renders
                                               │
                              ┌────────────────┴────────────────┐
                              │ Host taps DSLR tile              │ Host taps Webcam tile
                              ▼                                  ▼
                   cameraAdapter ← new TetheredAdapter()   cameraAdapter ← new WebcamAdapter()
                   session.screen = 'idle'                  session.screen = 'idle'
                              │
                              ▼
                   IdleScreen onMount: TetheredAdapter.init()
                        → GET /api/camera/info (re-probe)
                        → if gphoto2Available: resolve
                        → if -53 error: throw → DisconnectModal
                              │
                              ▼
                   TetheredAdapter.attachPreview(imgEl)
                        → imgEl.src = '/api/camera/stream'
                              │
                              ▼ HTTP GET /api/camera/stream
Node CameraService.startStream()
  spawn(['gphoto2', '--capture-movie', '--stdout'])
  proc.stdout → SOI/EOI scanner → multipart/x-mixed-replace → reply
  reply.raw.on('close') → proc.kill('SIGTERM')
                              │
               Browser: <img src="/api/camera/stream"> shows live MJPEG
                              │
                   CountdownScreen → capture trigger
                              ▼
                   TetheredAdapter.capture()
                        → POST /api/camera/capture { shotIndex, sessionId }
                              │
                              ▼ HTTP POST /api/camera/capture
Node CameraService.capture(sessionId, shotIndex)
  p-queue.add():
    1. Kill stream subprocess (SIGTERM)
    2. mkdir -p ./captures/session-{ts}/
    3. execFile('gphoto2', ['--capture-image-and-download',
                           '--filename', path, '--force-overwrite'])
    4. fs.readFile(path) → reply as image/jpeg
    5. (stream reconnect happens via browser re-setting img.src)
                              │
               Browser: TetheredAdapter receives Blob → saveShot()
               Browser: img.src = '/api/camera/stream?t=' + Date.now()  (reconnect)
```

### D-05 Implementation Clarification (CRITICAL)

CONTEXT.md D-05 says "pipe stdout directly as `multipart/x-mixed-replace`." This is the **intent** — no transcoding, no buffering. However, `gphoto2 --capture-movie --stdout` emits **raw concatenated JPEG bytes** delimited by SOI (`\xff\xd8`) and EOI (`\xff\xd9`) markers. It does NOT emit HTTP multipart boundaries.

A literal `child.stdout.pipe(reply.raw)` will not display in `<img src=...>`. The server must:
1. Buffer incoming bytes into a rolling accumulator
2. Detect `\xff\xd8` (frame start) and `\xff\xd9\x00` or `\xff\xd9` followed by `\xff\xd8` (frame end)
3. When a complete frame is detected, emit:
   ```
   --frame\r\n
   Content-Type: image/jpeg\r\n
   Content-Length: {N}\r\n
   \r\n
   {JPEG bytes}\r\n
   ```
4. Flush immediately — no inter-frame buffering beyond one complete frame

This preserves D-05's "no re-encoding" intent. Each JPEG passes through unmodified; only boundary headers are synthesized. [VERIFIED: gphoto2-liveview-example C code uses `\xff\xd8` SOI + `\xff\xd9` EOI as frame delimiters; multipart format from cecilemuller gist]

**Alternative live-view strategy (fallback if `--capture-movie` is too slow):**

Instead of `--capture-movie`, repeatedly call `gphoto2 --capture-preview --filename - --force-overwrite` in a loop (100-200ms interval). This simpler approach:
- Returns one complete JPEG per invocation (no SOI/EOI parsing needed — just `execFile` + emit frame)
- Achieves ~5-10 fps (more predictable than `--capture-movie`'s variable rate)
- Same `GET /api/camera/stream` endpoint, same multipart response format
- Tradeoff: each invocation has process-spawn overhead (~30-100ms)

The `GET /api/camera/stream` endpoint interface is the same regardless of which strategy is used. Planner should add a Wave 0 spike task: **Verify `--capture-movie` FPS on target camera. If < 5 fps or > 2s lag, fall back to `--capture-preview` loop within the same endpoint.**

### Recommended Project Structure (Phase 2 additions only)

```
web/src/
├── lib/
│   ├── camera/
│   │   ├── TetheredAdapter.ts       # IMPLEMENT (Phase 1 stub → full)
│   │   └── adapter.ts               # MODIFY: const → let
│   ├── session.svelte.ts            # MODIFY: add sessionStartedAt field
│   └── types.ts                     # MODIFY: add 'camera_select' to ScreenName
├── components/
│   ├── DisconnectModal.svelte        # MODIFY: add optional message prop
│   ├── TetheredPreview.svelte        # NEW: <img> live preview for MJPEG
│   └── CameraTile.svelte            # NEW: picker tile (name + status pill)
├── screens/
│   └── CameraSelectScreen.svelte    # NEW: boots to this on every start
└── App.svelte                        # MODIFY: add camera_select route + import

server/src/
├── camera/
│   ├── detect.ts                     # UNCHANGED (probe used by CameraSelectScreen)
│   └── CameraService.ts             # NEW: p-queue singleton, stream + capture logic
└── routes/
    └── camera.ts                     # MODIFY: add GET /stream + POST /capture routes
```

### Pattern 1: CameraService Singleton with p-queue

**What:** A server-side singleton that owns the gphoto2 subprocess. Queues all operations at concurrency 1 to prevent simultaneous preview + capture.

**When to use:** Every gphoto2 operation goes through this singleton. Never spawn gphoto2 directly in a route handler.

**Critical:** gphoto2 cannot simultaneously run `--capture-movie` and `--capture-image-and-download`. The capture operation must SIGTERM the stream subprocess first.

```typescript
// [ASSUMED — pattern derived from ARCHITECTURE.md + p-queue docs + PITFALLS.md #1, #2]
// server/src/camera/CameraService.ts
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import PQueue from 'p-queue';
import type { ChildProcess } from 'node:child_process';

const execFileAsync = promisify(execFile);

class CameraService {
  private queue = new PQueue({ concurrency: 1 });
  private streamProc: ChildProcess | null = null;

  /** Kill the running stream subprocess. Safe to call when no stream is active. */
  async stopStream(): Promise<void> {
    if (this.streamProc) {
      this.streamProc.kill('SIGTERM');
      this.streamProc = null;
    }
  }

  /**
   * Start gphoto2 --capture-movie --stdout.
   * Emits raw JPEG bytes on the returned process stdout.
   * Caller (route handler) is responsible for scanning SOI/EOI and emitting multipart frames.
   * When the HTTP connection closes, caller must call stopStream().
   *
   * CRITICAL — queue guard: the stream GET handler must NOT call this while a capture
   * is in-flight (queue is busy). Check `this.isCapturing` before spawning, or
   * defer to `queue.add()` wrapping. Simplest: the route handler checks the queue size
   * and returns 503 if queue.size > 0, forcing the browser to retry after capture.
   */
  get isCapturing(): boolean {
    return this.queue.size > 0 || this.queue.pending > 0;
  }

  startStreamProcess(): ChildProcess {
    if (this.isCapturing) {
      throw new Error('CAPTURE_IN_PROGRESS');
    }
    this.streamProc = spawn('gphoto2', ['--capture-movie', '--stdout']);
    return this.streamProc;
  }

  /**
   * Capture a still image.
   * Queued at concurrency 1 — stops stream, captures, file is persisted.
   */
  async capture(sessionId: number, shotIndex: number): Promise<Buffer> {
    return this.queue.add(async () => {
      await this.stopStream();

      const dir = path.resolve(`captures/session-${sessionId}`);
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

  /**
   * Probe camera availability. Lightweight version of detectCamera().
   * Returns null if not available, error message if -53/USB conflict.
   */
  async probe(): Promise<{ available: boolean; conflictError?: string }> {
    try {
      await execFileAsync('gphoto2', ['--auto-detect'], { timeout: 3_000 });
      return { available: true };
    } catch (err: unknown) {
      const msg = (err as { stderr?: string }).stderr ?? '';
      if (msg.includes('Could not claim the USB device') || msg.includes('-53')) {
        return { available: false, conflictError: msg };
      }
      return { available: false };
    }
  }
}

export const cameraService = new CameraService();
```

### Pattern 2: MJPEG Stream Route Handler

**What:** Fastify route handler that starts the gphoto2 stream subprocess and pipes frames as `multipart/x-mixed-replace`.

**Key point:** Raw gphoto2 stdout is JPEG bytes delimited by `\xff\xd8` and `\xff\xd9`. The handler must synthesize boundary headers.

```typescript
// [ASSUMED — pattern from cecilemuller gist + Fastify reply.send(stream) docs]
// server/src/routes/camera.ts — GET /api/camera/stream handler

app.get('/api/camera/stream', async (request, reply) => {
  const BOUNDARY = '--frame';

  reply.raw.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Connection': 'close',
  });

  const proc = cameraService.startStreamProcess();
  let buffer = Buffer.alloc(0);

  proc.stdout!.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Scan for complete JPEG frames (SOI...EOI)
    let start = -1;
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xd8) {
        start = i;
      }
      if (start !== -1 && buffer[i] === 0xff && buffer[i + 1] === 0xd9) {
        const frame = buffer.subarray(start, i + 2);
        buffer = buffer.subarray(i + 2);

        const header = `${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
        reply.raw.write(header);
        reply.raw.write(frame);
        reply.raw.write('\r\n');
        i = -1; // restart scan on remaining buffer
        start = -1;
        break;
      }
    }
  });

  proc.on('error', () => reply.raw.end());
  proc.on('close', () => reply.raw.end());

  // Tear down subprocess when browser disconnects
  request.raw.on('close', async () => {
    await cameraService.stopStream();
  });
});
```

**Note on `reply.raw`:** Fastify docs note that using `reply.raw` bypasses Fastify's lifecycle hooks. For a streaming long-lived connection like MJPEG this is the correct approach — Fastify's normal `reply.send(stream)` closes after first pipe completes, which is unsuitable for an endless multipart stream. [ASSUMED — based on Fastify docs note on reply.raw]

### Pattern 3: TetheredAdapter Implementation

**What:** Full implementation of the Phase 1 stub. Talks to `/api/camera/stream` and `/api/camera/capture`.

```typescript
// [ASSUMED — derived from CameraAdapter interface + CONTEXT.md decisions]
// web/src/lib/camera/TetheredAdapter.ts
import type { CameraAdapter } from './CameraAdapter.ts';

export class TetheredAdapter implements CameraAdapter {
  private disconnectCallback: (() => void) | null = null;
  private sessionId: number | null = null;
  private imgEl: HTMLImageElement | null = null;

  async init(): Promise<void> {
    const res = await fetch('/api/camera/info');
    if (!res.ok) throw new Error('Camera backend unreachable');
    const info = await res.json();
    if (!info.gphoto2Available) {
      throw new Error('No DSLR detected');
    }
    if (info.usbConflict) {
      const err = new Error('USB_CONFLICT');
      throw err;
    }
  }

  async attachPreview(el: HTMLVideoElement | HTMLImageElement): Promise<void> {
    if (!(el instanceof HTMLImageElement)) {
      throw new Error('TetheredAdapter requires HTMLImageElement, got HTMLVideoElement');
    }
    this.imgEl = el;
    el.src = `/api/camera/stream?t=${Date.now()}`;

    // Detect stream failures as disconnect
    el.onerror = () => {
      this.disconnectCallback?.();
    };
  }

  // NOTE: CameraAdapter.capture() is locked as capture(): Promise<Blob> — no args.
  // session state (currentShotIndex, sessionStartedAt) is read directly from the
  // session store. This keeps the interface unchanged.
  async capture(): Promise<Blob> {
    // Import inline to avoid circular module issues at test time (mock in tests)
    const { session } = await import('$lib/session.svelte.ts');

    // Initialize session ID on first capture; preserved until dispose() is called.
    if (!this.sessionId) {
      this.sessionId = session.sessionStartedAt ?? Date.now();
      if (!session.sessionStartedAt) {
        // Side-effect: stamp the session start time so all captures share the folder.
        // session.sessionStartedAt must be added to session.svelte.ts (see Wave 0 tasks).
        (session as Record<string, unknown>).sessionStartedAt = this.sessionId;
      }
    }

    const res = await fetch('/api/camera/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shotIndex: session.currentShotIndex,
        sessionId: this.sessionId,
      }),
    });
    if (!res.ok) throw new Error(`Capture failed: ${res.status}`);

    // After capture, the stream subprocess was killed server-side.
    // Re-connect preview by re-setting img.src with cache-bust.
    if (this.imgEl) {
      this.imgEl.src = `/api/camera/stream?t=${Date.now()}`;
    }

    return res.blob();
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
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
}
```

**Session ID note (RESOLVED):** The adapter signature `capture(): Promise<Blob>` (no args) is locked. `TetheredAdapter` imports `session` from `session.svelte.ts` and reads `session.currentShotIndex` and `session.sessionStartedAt` directly inside `capture()`. Pattern 3 above shows the full implementation. `session.sessionStartedAt` must be added to `session.svelte.ts` in Wave 0 (see Open Questions Q-1 — marked Resolved).

### Pattern 4: CameraSelectScreen

**What:** Boot screen that probes camera availability and lets host pick DSLR or Webcam before transitioning to idle.

```svelte
<!-- [ASSUMED — derived from CONTEXT.md D-01, D-02, D-04] -->
<!-- web/src/screens/CameraSelectScreen.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/session.svelte.ts';
  import { cameraAdapter, setCameraAdapter } from '$lib/camera/adapter.ts';
  import { TetheredAdapter } from '$lib/camera/TetheredAdapter.ts';
  import { WebcamAdapter } from '$lib/camera/WebcamAdapter.ts';
  import CameraTile from '../components/CameraTile.svelte';

  let dslrStatus: 'checking' | 'connected' | 'not_detected' = 'checking';

  onMount(async () => {
    const res = await fetch('/api/camera/info');
    if (res.ok) {
      const info = await res.json();
      dslrStatus = info.gphoto2Available ? 'connected' : 'not_detected';
    } else {
      dslrStatus = 'not_detected';
    }
  });

  function selectDSLR() {
    setCameraAdapter(new TetheredAdapter());
    session.screen = 'idle';
  }

  function selectWebcam() {
    setCameraAdapter(new WebcamAdapter());
    session.screen = 'idle';
  }
</script>

<div class="camera-select">
  <h1>Select Camera</h1>
  <div class="tiles">
    <CameraTile
      name="Tethered DSLR"
      status={dslrStatus}
      onclick={selectDSLR}
    />
    <CameraTile
      name="Webcam"
      status="available"
      onclick={selectWebcam}
    />
  </div>
</div>
```

**ES module live binding note:** `adapter.ts` changes `export const` to `export let cameraAdapter`. However, mutating an `export let` from another module requires a setter function (direct reassignment of an imported `let` is not permitted in ES modules — consumers get a live binding but cannot reassign through it). The planner must use: `export function setCameraAdapter(a: CameraAdapter) { cameraAdapter = a; }` in `adapter.ts` and call `setCameraAdapter(new TetheredAdapter())` from `CameraSelectScreen`. The existing Phase 1 code that reads `import { cameraAdapter } from '...'` receives the new instance after the setter runs — this works because `{#key session.screen}` in App.svelte will remount `IdleScreen` on the `camera_select → idle` transition, causing `onMount` to re-run with the new adapter. [ASSUMED — ES module live binding behavior]

### Pattern 5: DisconnectModal message prop

The existing `DisconnectModal.svelte` has `Props: { visible: boolean; onRetry: () => void }`.

Phase 2 adds an optional `message` prop:

```svelte
<!-- MODIFY DisconnectModal.svelte -->
interface Props {
  visible: boolean;
  onRetry: () => void;
  message?: string;  // optional; defaults to "Check the cable and try again."
}
let { visible, onRetry, message = 'Check the cable and try again.' }: Props = $props();
```

USB conflict message (verbatim from D-09):
`"Camera in use by another app — quit Image Capture, Shotwell, or gvfs, then tap Retry."`

`TetheredAdapter.init()` throws a typed error (e.g. `throw new Error('USB_CONFLICT')`). App.svelte's `handleRetry` (and the IdleScreen `onMount` error handler) checks the error type and passes the appropriate message to `DisconnectModal`.

### Anti-Patterns to Avoid

- **Spawning gphoto2 in route handlers:** All subprocess logic lives in `CameraService`. Route handlers call service methods only.
- **Running `--capture-image-and-download` while `--capture-movie` is still running:** Will fail with camera busy or USB conflict. Always kill stream before capture.
- **Passing `--stdout` to `--capture-image-and-download`:** The stdout flag is for `--capture-preview`/`--capture-movie` only. For download-and-save, use `--filename` with a real path. Attempting `--filename -` for stdout capture is unreliable.
- **Auto-killing gvfs:** D-11 explicitly rejects this. Do not add `pkill gvfs-gphoto2-volume-monitor` to startup — even though PITFALLS.md #1 recommends it. Surface the conflict via DisconnectModal instead.
- **Streaming preview via WebSocket binary frames:** D-05 locks on HTTP `multipart/x-mixed-replace` via `<img src=...>`. WebSocket is not needed for Phase 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async operation serialization | Custom mutex/lock with flags | `p-queue` concurrency 1 | Edge cases in flag-based locking (SIGTERM timing, error paths) cause hangs |
| JPEG frame boundary parsing | Regex on binary buffer | `\xff\xd8` / `\xff\xd9` byte scanning | Regex on Buffers is error-prone; byte-scanning is O(n) and simple |
| USB conflict detection | Custom USB device enumeration | Parse gphoto2 stderr for `"Could not claim the USB device"` | gphoto2 already surfaces this; redundant device scan adds complexity |
| Directory creation | `fs.mkdir` with custom exist-check | `fs.mkdir(path, { recursive: true })` | Built-in; atomic; race-condition-safe |

**Key insight:** gphoto2 itself handles all camera protocol complexity. Node.js is only a subprocess manager and HTTP bridge. Any code that re-implements camera protocol logic is wrong.

---

## Common Pitfalls

### Pitfall 1: Preview subprocess still running during capture

**What goes wrong:** `POST /api/camera/capture` is called while `gphoto2 --capture-movie` is running. gphoto2 errors with a camera-busy or USB conflict because the device is held.

**Why it happens:** Route handlers are stateless; without a shared singleton the stream proc is invisible to the capture handler.

**How to avoid:** `CameraService` owns both — `capture()` always calls `stopStream()` first. The `p-queue` concurrency 1 ensures a queued capture waits for any in-flight stream teardown.

**Warning signs:** Capture returns non-zero exit code; stderr contains "camera busy" or "Could not claim the USB device."

### Pitfall 2: Browser img.src stale after capture reconnect

**What goes wrong:** After a capture, the stream subprocess is killed. The browser's `<img>` element has its `src` pointing to `/api/camera/stream`. When the browser reconnects, Chrome may serve the dead connection from cache instead of issuing a new request.

**Why it happens:** HTTP keep-alive and browser image caching.

**How to avoid:** After `TetheredAdapter.capture()` resolves, re-set `img.src = '/api/camera/stream?t=' + Date.now()`. The cache-busting query param forces a new HTTP connection. This is under Claude's Discretion (D-06 note).

**Warning signs:** Preview freezes after first capture; no new HTTP request appears in the network tab.

### Pitfall 3: gphoto2 -53 USB conflict — gvfs holds the device

**What goes wrong:** Linux GNOME desktop's `gvfs-gphoto2-volume-monitor` and `gvfsd-gphoto2` claim the USB PTP interface the moment the camera is plugged in. Every gphoto2 invocation fails with `"Could not claim the USB device"` (error code -53 in stderr).

**Why it happens:** gvfs is auto-mounted at the OS level and does not release the device.

**How to avoid:** D-11 locks on user-prompt approach (no auto-kill). Detect the error string in `CameraService.probe()` and `TetheredAdapter.init()`. Surface via `DisconnectModal` with the USB conflict message. The user quits gvfs/Shotwell/Image Capture and taps Retry.

**Warning signs:** Every gphoto2 command (including `--auto-detect`) fails with `"Could not claim the USB device"` in stderr.

**Detection pattern:**
```typescript
// Check stderr from execFile catch block
const stderr = (err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '';
if (stderr.includes('Could not claim the USB device') || stderr.includes('-53')) {
  throw new Error('USB_CONFLICT');
}
```

[CONFIDENCE: HIGH — exact phrase verified against PITFALLS.md #1 which rates this HIGH based on known gphoto2 behavior]

### Pitfall 4: gphoto2 --capture-movie --stdout lag / low FPS

**What goes wrong:** On some camera bodies, `--capture-movie` introduces 2-5 second lag and drops to 2 fps. This makes live preview unusable for a photo booth kiosk.

**Why it happens:** Camera-body-specific: how quickly the camera transfers preview frames over PTP/USB. Canon 6D has known lag issues; EOS 550D was reported at ~17 fps via libgphoto2 binding.

**How to avoid:** Wave 0 spike task (first thing in Phase 2 execution): run `gphoto2 --capture-movie --stdout | ffplay -` against the actual connected camera and measure FPS + lag. If unacceptable, swap the `startStreamProcess()` implementation to `--capture-preview` polling loop. The endpoint interface (`GET /api/camera/stream`) does not change.

**Camera-body checkpoint:** This spike requires a physical DSLR connected via USB. No camera was detected in the development environment at research time (`gphoto2 --auto-detect` returned empty). The planner MUST add a `checkpoint:human-verify` task before this spike: "Plug in DSLR camera via USB, then run FPS test." The spike cannot execute unattended.

**Warning signs:** Preview feels sluggish; ffplay reports < 5 fps; camera model is known to have USB preview issues.

### Pitfall 5: capture-image-and-download output directory must exist first

**What goes wrong:** `gphoto2 --capture-image-and-download --filename ./captures/session-123/0.jpg` fails if `./captures/session-123/` does not exist. gphoto2 does not create directories.

**Why it happens:** gphoto2 is a file downloader, not a directory creator.

**How to avoid:** Always `await mkdir(dir, { recursive: true })` before every `execFileAsync('gphoto2', ...)` capture call. `recursive: true` is a no-op if the directory already exists.

**Warning signs:** gphoto2 exits non-zero with "No such file or directory" in stderr.

### Pitfall 6: CameraAdapter.capture() interface has no shotIndex/sessionId parameters

**What goes wrong:** The locked `CameraAdapter` interface is `capture(): Promise<Blob>` (no arguments). `TetheredAdapter` needs `shotIndex` and `sessionId` to build the server-side file path.

**Why it happens:** The interface was designed before D-12/D-13 defined the capture path format.

**How to avoid:** `TetheredAdapter` tracks `sessionId` internally (set on first capture, reset in `dispose()`). `shotIndex` is read from `session.currentShotIndex` via an import, OR the caller (CountdownScreen) invokes a wrapper that reads session state before calling `adapter.capture()`. **Do not change the CameraAdapter interface.** See Open Questions Q-1.

**Warning signs:** Planner changes `CameraAdapter.ts` to add args — this would break `WebcamAdapter` and all screen code.

---

## Code Examples

### gphoto2 CLI Syntax (Verified on gphoto2 2.5.32, Linux)

```bash
# Live view stream (raw JPEG bytes on stdout, SOI/EOI delimited)
gphoto2 --capture-movie --stdout

# Still capture with disk save
gphoto2 --capture-image-and-download \
  --filename ./captures/session-1716192000/0.jpg \
  --force-overwrite

# Camera availability probe
gphoto2 --auto-detect

# USB device check (returns non-zero + stderr contains -53 on conflict)
gphoto2 --auto-detect 2>&1

# Version check (used by detect.ts — already working)
gphoto2 --version
```

[VERIFIED: all flags confirmed against `gphoto2 --help` on the installed gphoto2 2.5.32]

### Fastify Reply Streaming Pattern

```typescript
// [CITED: fastify.dev/docs/latest/Reference/Reply/]
// Standard: reply.send(stream) — Fastify handles piping, headers set before
// For MJPEG (endless stream): reply.raw.write(...) / reply.raw.end()
// reply.raw bypasses Fastify lifecycle — correct for streaming responses

reply.raw.writeHead(200, {
  'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
  'Cache-Control': 'no-store',
});
// Then: reply.raw.write(boundary + headers + JPEG bytes) per frame
// Close: reply.raw.end() when gphoto2 process exits
```

### Node.js child_process.spawn for gphoto2

```typescript
// [CITED: nodejs.org/api/child_process.html]
// Always use spawn with args array — never string concat into exec (PITFALLS.md #11)
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Stream (long-running process)
const proc = spawn('gphoto2', ['--capture-movie', '--stdout']);
proc.stdout.on('data', (chunk: Buffer) => { /* process JPEG bytes */ });
proc.stderr.on('data', (chunk: Buffer) => {
  if (chunk.toString().includes('Could not claim the USB device')) {
    // USB_CONFLICT — signal TetheredAdapter via error event
  }
});
proc.on('close', (code) => { /* stream ended */ });

// One-shot capture (short-lived process)
const { stdout, stderr } = await execFileAsync(
  'gphoto2',
  ['--capture-image-and-download', '--filename', filePath, '--force-overwrite'],
  { timeout: 10_000 }
).catch((err) => {
  if (err.stderr?.includes('Could not claim the USB device')) {
    throw new Error('USB_CONFLICT');
  }
  throw err;
});
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| `gphoto2` npm package (lwille, NAN-based) | gphoto2 CLI subprocess via `child_process.spawn` | npm package is NAN-based (stale), fragile on Node 26; CLI is the reference implementation |
| Polling `--capture-preview` every 100-200ms | `--capture-movie --stdout` (primary), polling as fallback | Movie mode is push-based and more efficient if the camera supports it at good FPS |
| WebSocket binary frames for live view | HTTP `multipart/x-mixed-replace` via `<img src=...>` | `<img>` is native MJPEG consumer; no custom WS client parsing needed; D-05 locks on this |
| Base64-encode JPEG for WS | Raw JPEG bytes in multipart | 33% smaller payload; no encode/decode overhead |

**Deprecated/outdated:**
- `gphoto2` npm (lwille): NAN-based, last publish 2020. Do not use.
- WebSocket binary frame approach for preview: Works but adds unnecessary client parsing complexity when `<img>` handles multipart MJPEG natively.

---

## Runtime State Inventory

> Phase 2 is not a rename/refactor/migration phase — this section is N/A.

**Stored data:** None — `./captures/` directory is new, created by this phase. No migration needed.
**Live service config:** None affected by Phase 2.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None requiring migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v26.1.0 | — |
| gphoto2 CLI | All camera ops | ✓ | 2.5.32 | getUserMedia (D-04 provides picker) |
| DSLR camera via USB | Live view + capture | Not tested | — | Host picks "Webcam" tile in picker |
| p-queue (npm) | CameraService | not installed yet | 9.3.0 | — |
| @fastify/multipart (npm) | POST /api/camera/capture | not installed yet | 10.0.0 | Use application/json body (removes dep) |
| `plugdev` group membership | USB access without root | ✓ (Arch Linux default on Arch) | — | `usermod -aG plugdev $USER` + re-login |

**Missing dependencies with no fallback:** None — gphoto2 is installed; camera body is the only unknowable at plan time.

**Missing dependencies with fallback:** A connected DSLR camera body is required for smoke testing Phase 2. The webcam fallback (Phase 1) remains functional if no DSLR is available.

**Linux user group note:** On Arch Linux, gphoto2 USB access without `sudo` requires the user be in the `plugdev` group (or udev rules for libgphoto2 must be installed). Run `groups $USER` and verify `plugdev` appears. If not: `sudo usermod -aG plugdev $USER` and re-login. [ASSUMED — standard Linux gphoto2 setup requirement]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `web/vite.config.ts` (test block — already configured from Phase 1) |
| Quick run command | `cd web && npm test` |
| Full suite command | `cd web && npm test` |
| Server test command | No server-side test runner configured yet — Phase 2 adds unit tests only if server-side Vitest is configured |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAM-03 | `TetheredAdapter.init()` throws when camera probe fails | unit (mock fetch) | `vitest run src/lib/camera/TetheredAdapter.test.ts` | ❌ Wave 0 |
| CAM-03 | `TetheredAdapter.init()` throws `'USB_CONFLICT'` when info returns conflict | unit (mock fetch) | same file | ❌ Wave 0 |
| CAM-03 | `TetheredAdapter.attachPreview(imgEl)` sets `imgEl.src` to `/api/camera/stream?t=...` | unit (mock) | same file | ❌ Wave 0 |
| CAM-03 | `TetheredAdapter.attachPreview(videoEl)` throws | unit | same file | ❌ Wave 0 |
| CAM-03 | `TetheredAdapter.capture()` POSTs to `/api/camera/capture` and returns Blob | unit (mock fetch) | same file | ❌ Wave 0 |
| CAM-03 | `CameraSelectScreen` calls `/api/camera/info` on mount and renders DSLR status | component (mock fetch) | `vitest run src/screens/CameraSelectScreen.test.ts` | ❌ Wave 0 |
| CAM-03 | `DisconnectModal` renders custom `message` prop when provided | component | `vitest run src/components/DisconnectModal.test.ts` | ✅ (exists — needs message prop test added) |
| CAM-03 | `session.screen` starts at `'camera_select'` after Phase 2 change | unit | `vitest run src/lib/session.test.svelte.ts` | ✅ (exists — add initial screen assertion) |
| CAM-03 | Live view + capture smoke test via real gphoto2 | manual | `npm run dev` → pick DSLR tile → verify preview + capture | manual |

### Sampling Rate

- **Per task commit:** `cd web && npm test` (42 existing tests + new tests, ~5-10s)
- **Per wave merge:** `cd web && npm test` (full suite)
- **Phase gate:** Full suite green + manual DSLR smoke test before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/src/lib/camera/TetheredAdapter.test.ts` — covers CAM-03 adapter behavior (mock fetch)
- [ ] `web/src/screens/CameraSelectScreen.test.ts` — covers CameraSelectScreen probe + tile render
- [ ] Add `message` prop test to existing `web/src/components/DisconnectModal.test.ts`
- [ ] Add `camera_select` initial screen assertion to existing `web/src/lib/session.test.svelte.ts`
- [ ] Server-side CameraService tests: optional — if server-side Vitest is configured, add `server/src/camera/CameraService.test.ts` for the SOI/EOI parser and p-queue serialization

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — kiosk, no auth |
| V3 Session Management | no | N/A — in-memory session |
| V4 Access Control | no | N/A — single-user kiosk |
| V5 Input Validation | yes | Validate `shotIndex` (integer ≥ 0) and `sessionId` (number, timestamp range) in POST /api/camera/capture handler |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `shotIndex`/`sessionId` | Tampering | Use `parseInt()` validation + `path.join()` + `path.resolve()` on all capture paths; never embed untrusted strings directly in shell commands |
| gphoto2 command injection | Tampering | Always use `execFile`/`spawn` with args array (never `exec` with string concat); all args are internal server values, not user-controlled |
| Disk fill via unconstrained captures | DoS | Captures go to `./captures/` — acceptable for kiosk use; add file count limit if Phase 5 does not clean up |

**Phase 2 attack surface increase:** The server now has two new endpoints (`GET /api/camera/stream`, `POST /api/camera/capture`) and writes to disk. The primary security concern is path construction — always `path.resolve(projectRoot, 'captures', 'session-' + Number(sessionId), Number(shotIndex) + '.jpg')` with explicit integer coercion.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gphoto2 --capture-movie --stdout` outputs raw concatenated JPEG (SOI/EOI-delimited) with no HTTP multipart headers | Architecture Patterns — D-05 clarification | The parsing logic would need to change; fallback is `--capture-preview` polling which is simpler to parse |
| A2 | `"Could not claim the USB device"` appears in gphoto2 stderr on -53 error | Common Pitfalls | Wrong string → USB conflict not detected → confusing error message (but not a crash) |
| A3 | ES module `export let` mutation via setter function is visible to all importers after CameraSelectScreen runs | Pattern 4 / CameraSelectScreen | If Svelte's module resolution caches the export value, the adapter swap would silently fail — verify at integration time |
| A4 | `reply.raw.write()` is the correct Fastify pattern for endless MJPEG streaming | Pattern 2 | `reply.raw` bypasses Fastify hooks — acceptable for this use case; if it causes Fastify warnings, switch to a PassThrough stream piped via `reply.send()` |
| A5 | Linux `plugdev` group membership enables gphoto2 USB access without root on Arch | Environment Availability | May need different group or udev rule; `gphoto2 --auto-detect` will fail with permission error if wrong |
| A6 | `gphoto2 --capture-movie --stdout` produces usable FPS (≥ 5) on the target camera body | Common Pitfalls #4 | Fallback to `--capture-preview` polling loop is ready; endpoint interface unchanged |

**If this table is empty:** Not applicable — six assumptions documented.

---

## Open Questions

1. **[RESOLVED] CameraAdapter.capture() has no shotIndex/sessionId args — how does TetheredAdapter get them?**
   - Resolution: `TetheredAdapter.capture()` imports `session` from `session.svelte.ts` and reads `session.currentShotIndex` (shot index) and `session.sessionStartedAt` (session ID) directly. The `CameraAdapter` interface is unchanged.
   - Required: Add `sessionStartedAt: number | null` field to `session` in `session.svelte.ts`. Initialize to `null`; TetheredAdapter sets it to `Date.now()` on first capture of each session (also reset to `null` in `resetSession()`).
   - Pattern 3 shows the full implementation.

2. **LivePreview.svelte update strategy: single component or separate TetheredPreview.svelte?**
   - What we know: Current `LivePreview.svelte` renders `<video>` + uses `videoEl` binding. TetheredAdapter needs `HTMLImageElement`. D-06 leaves this to Claude's Discretion.
   - Recommendation: **Separate `TetheredPreview.svelte`** with `<img>` is cleaner. The reactive event surface differs (`<video>` has `loadedmetadata`/`readyState`; `<img>` has `load`/`error`). Parent screens use `{#if session.cameraInfo?.cameraMode === 'tethered'}<TetheredPreview />{:else}<LivePreview />{/if}`. No conditional logic inside a single component.

3. **Does `--capture-movie` stop automatically when the HTTP connection closes?**
   - What we know: `request.raw.on('close', ...)` can call `cameraService.stopStream()`. But if the browser disconnects abruptly (tab close), the server may not immediately detect it.
   - Recommendation: Attach the `close` listener in the route handler. Additionally, set `Connection: close` on the response header so the OS closes the TCP connection promptly. Use `proc.on('error')`/`proc.on('close')` to clean up `streamProc` reference.

---

## Sources

### Primary (HIGH confidence)
- `gphoto2 --help` and `man gphoto2` on installed gphoto2 2.5.32 — all CLI flags verified
- `fastify.dev/docs/latest/Reference/Reply/` — streaming response and `reply.raw` patterns [CITED]
- `nodejs.org/api/child_process.html` — `spawn`, `execFile`, process lifecycle [CITED]
- `.planning/research/PITFALLS.md` — gphoto2 USB conflict (#1, #2), disconnect (#3) — HIGH confidence
- `.planning/research/STACK.md` — gphoto2 CLI rationale, WebSocket vs MJPEG reasoning
- `.planning/research/ARCHITECTURE.md` — CameraService mutex pattern, process hygiene recommendations
- Phase 1 RESEARCH.md — CameraAdapter interface, established patterns

### Secondary (MEDIUM confidence)
- `github.com/aqiank/gphoto2-liveview-example` main.c — SOI `\xff\xd8` / EOI `\xff\xd9` frame parsing confirmed via WebFetch
- `gist.github.com/cecilemuller/c8e746a5cb828e83e55892d4742b8a5c` — multipart/x-mixed-replace boundary format (`--boundary\nContent-Type\nContent-Length\n\n{bytes}`)
- `forums.raspberrypi.com/viewtopic.php?t=117102` — performance data (2-25 fps range, capture-movie lag reports)
- `web.dev/articles/porting-gphoto2-to-the-web` — confirmed gphoto2 preview loop uses `gp_camera_capture_preview()` (repeated JPEG blobs)

### Tertiary (LOW confidence — marked [ASSUMED])
- gphoto2 `-53` exact stderr string "Could not claim the USB device": PITFALLS.md rates HIGH but not empirically verified in this session
- `reply.raw.write()` as the correct Fastify pattern for endless multipart: verified via docs that `reply.raw` is the escape hatch; specific MJPEG pattern is community pattern
- ES module live binding behavior for `export let cameraAdapter` + setter: standard JS spec behavior

---

## Metadata

**Confidence breakdown:**
- TetheredAdapter client implementation: HIGH — interface is locked; methods are straightforward HTTP calls
- CameraService server implementation: MEDIUM — p-queue + spawn patterns are standard; SOI/EOI parsing is community-verified but A1 is an assumption
- gphoto2 FPS performance on target camera: LOW — empirical gap flagged as Wave 0 spike
- USB conflict detection: HIGH (PITFALLS.md rates HIGH; error string well-documented)
- Fastify streaming pattern: MEDIUM — `reply.raw` approach is correct per docs; MJPEG-specific pattern is community-derived

**Research date:** 2026-05-20
**Valid until:** 2026-06-19 (30 days — gphoto2 and Fastify APIs are stable; Svelte 5 minor versions won't break patterns)
