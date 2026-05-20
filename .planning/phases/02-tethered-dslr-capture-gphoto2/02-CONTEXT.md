# Phase 2: Tethered DSLR Capture (gphoto2) - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Swap the WebcamAdapter for a TetheredAdapter on Mac/Linux — same session loop, same screens, new camera backend via gphoto2 subprocess. Phase 2 also adds a startup camera picker screen (new `camera_select` state) so the host explicitly selects DSLR vs webcam on every boot.

Phase 2 does NOT change: session flow, countdown/flash/retake screens, DisconnectModal behaviour, or the CameraAdapter interface. Phase 2 does NOT implement permanent local save, GIF, upload, or QR (Phase 5 scope).

</domain>

<decisions>
## Implementation Decisions

### Startup Camera Picker (new in Phase 2)

- **D-01:** Add `'camera_select'` to `ScreenName` type. App always boots to `camera_select`, never directly to `idle`. After host selects a camera, transition to `idle`.
- **D-02:** Picker shows **2 large tiles** with detection status:
  - **DSLR** tile: "Connected" (green) or "Not detected" (grey) — status from `/api/camera/info` probe run on load.
  - **Webcam** tile: always "Available".
- **D-03:** No persistence — picker appears fresh on every boot. No `localStorage`. Kiosk always starts in a known state.
- **D-04:** After host taps a tile, **mutate the `cameraAdapter` singleton** in `web/src/lib/camera/adapter.ts` (change `const` to `let`). Set it to `new TetheredAdapter()` or `new WebcamAdapter()`. Then transition to `idle`. All screens importing `cameraAdapter` receive the chosen instance.

### MJPEG Live Preview Delivery

- **D-05:** **Raw MJPEG passthrough** — Fastify spawns `gphoto2 --capture-movie --stdout`, pipes stdout directly as a `multipart/x-mixed-replace` HTTP response on `GET /api/camera/stream`. No frame buffering or re-encoding on the server.
- **D-06:** TetheredAdapter's `attachPreview(el)` implementation: type-narrow — if `el instanceof HTMLImageElement` set `el.src = '/api/camera/stream'`; if `el instanceof HTMLVideoElement` throw `TetheredAdapter requires HTMLImageElement`. Phase 1's `LivePreview.svelte` passes an `HTMLVideoElement` — Phase 2 must update `LivePreview.svelte` to render either `<video>` or `<img>` based on adapter type, OR the `camera_select` decision drives which component is mounted.
- **D-07:** Stream endpoint path: `/api/camera/stream` — consistent with `/api/camera/info`. Existing Vite proxy `'/api': 'http://localhost:3001'` already covers it.
- **D-08:** If no DSLR connected when host taps DSLR tile and tries to start the stream: `TetheredAdapter.init()` fails → DisconnectModal appears immediately. Host plugs in DSLR and taps Retry.

### USB Conflict Recovery

- **D-09:** Detect gphoto2 `-53` error ("Could not claim the USB device") during `init()` or stream start. Surface via **DisconnectModal with a specific message prop**:
  `"Camera in use by another app — quit Image Capture, Shotwell, or gvfs, then tap Retry."`
- **D-10:** **Reuse DisconnectModal** — add an optional `message` prop to `DisconnectModal.svelte`. Default message stays "Camera disconnected — check the cable and try again." When `-53` is detected, pass the USB conflict message. No new component.
- **D-11:** No auto-kill of gvfs/PTPCamera. User must quit conflicting apps manually. The message tells them exactly what to do.

### Capture + Download Flow

- **D-12:** Fastify endpoint `POST /api/camera/capture`. Implementation:
  1. Determine session folder: `./captures/session-{startTimestamp}/` (folder created on first capture of session).
  2. Run `gphoto2 --capture-image-and-download --filename ./captures/session-{startTimestamp}/{shotIndex}.jpg --force-overwrite`.
  3. Read the saved file, return as `image/jpeg` binary response.
- **D-13:** Captured JPEGs **persist on disk** at `./captures/session-{timestamp}/{shot-index}.jpg`. Not deleted after sending. Survives server restart. Session timestamp is set on first capture of a session (TetheredAdapter tracks it internally).
- **D-14:** `TetheredAdapter.capture()`: POST to `/api/camera/capture` with `{ shotIndex, sessionId }` body. Parse response as `Blob`. Return blob. Matches `CameraAdapter.capture(): Promise<Blob>` contract.

### Inherited from Phase 1 (do not re-decide)

- CameraAdapter interface is **locked**: `init()`, `attachPreview(el: HTMLVideoElement | HTMLImageElement)`, `capture()`, `dispose()`, `onDisconnect(cb)` — TetheredAdapter implements this exact contract.
- All gphoto2 operations go through Node backend — browser never calls gphoto2 directly.
- DisconnectModal pattern: overlay modal outside `{#key session.screen}`, `dispose()→init()→re-register→camera-reattach→hideDisconnect` retry flow in App.svelte.

### Claude's Discretion

- gphoto2 subprocess timeout values (suggested: 10s for `--capture-image-and-download`, 5s for stream start)
- MJPEG stream restart behaviour after Retry (re-set `img.src` to flush browser cache; append `?t={Date.now()}` if needed)
- Exact error string matching for gphoto2 `-53` (may appear as "Could not claim the USB device" or error code in stderr)
- LivePreview.svelte update strategy: adapter-type check or separate component (planner decides)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and dependency on Phase 1
- `.planning/REQUIREMENTS.md` — CAM-03 (the sole Phase 2 requirement)

### Architecture & Contracts
- `.planning/phases/01-foundation-webcam-session-loop/01-CONTEXT.md` — locked CameraAdapter interface, session state machine shape, adapter singleton pattern, DisconnectModal wiring
- `web/src/lib/camera/CameraAdapter.ts` — exact interface TetheredAdapter must implement
- `web/src/lib/camera/adapter.ts` — singleton to mutate in Phase 2 (change `const` → `let`)
- `web/src/lib/types.ts` — ScreenName type to extend with `'camera_select'`
- `web/src/lib/session.svelte.ts` — session store; Phase 2 adds no new session state beyond `camera_select`

### Research & Pitfalls
- `.planning/research/STACK.md` — gphoto2 CLI rationale, Mac/Linux only
- `.planning/research/PITFALLS.md` — gphoto2 USB claim conflict, MJPEG live view on target camera body (top empirical gaps to validate)
- `.planning/research/ARCHITECTURE.md` — CameraAdapter pattern and why MJPEG uses `<img>` not `<video>`

### Project Constraints
- `.planning/PROJECT.md` — All gphoto2 ops through Node backend; no Electron; localhost-only

### Existing Phase 2-relevant files
- `web/src/components/DisconnectModal.svelte` — add `message` prop (D-10)
- `web/src/screens/IdleScreen.svelte` — registers `onDisconnect` after `init()` — TetheredAdapter reuses this
- `web/src/App.svelte` — handleRetry flow; add `camera_select` → `idle` routing
- `server/src/camera/detect.ts` — existing gphoto2 probe; Phase 2 extends this for stream + capture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/DisconnectModal.svelte` — reuse with new optional `message` prop (D-10)
- `web/src/lib/camera/TetheredAdapter.ts` — Phase 1 stub (all methods throw) — Phase 2 implements it fully
- `web/src/lib/camera/adapter.ts` — `export const cameraAdapter` → change to `export let cameraAdapter` so CameraSelectScreen can mutate it
- `web/src/components/LivePreview.svelte` — currently renders `<video>`; Phase 2 must handle `<img>` for MJPEG (TetheredAdapter needs `HTMLImageElement`)
- `server/src/camera/detect.ts` — gphoto2 probe logic already exists; Phase 2 adds stream + capture routes alongside it

### Established Patterns
- Singleton adapter pattern (`adapter.ts`) — all screens import one instance; Phase 2 mutates it at startup picker
- DisconnectModal overlay pattern — outside `{#key session.screen}`, message configurable via prop
- TDD RED/GREEN commit pattern — test files committed before implementation (Phase 1 pattern to maintain)
- `onDisconnect` registration after `init()` success — established in IdleScreen; TetheredAdapter reuses same contract

### Integration Points
- `ScreenName` type in `types.ts` → add `'camera_select'`
- `App.svelte` router → add `{:else if session.screen === 'camera_select'}<CameraSelectScreen />`
- `session.svelte.ts` initial state → change `screen: 'idle'` to `screen: 'camera_select'`
- `server/src/routes/camera.ts` → add `GET /api/camera/stream` and `POST /api/camera/capture` routes

</code_context>

<specifics>
## Specific Ideas

- DisconnectModal USB conflict message verbatim: `"Camera in use by another app — quit Image Capture, Shotwell, or gvfs, then tap Retry."`
- Capture disk path pattern: `./captures/session-{timestamp}/{shot-index}.jpg` (relative to project root, created by server on first capture)
- `gphoto2 --capture-image-and-download --filename {path} --force-overwrite` — `--force-overwrite` needed if file already exists at same path (retake scenario)

</specifics>

<deferred>
## Deferred Ideas

- Auto-kill gvfs silently on startup — user chose detect-and-prompt instead (D-11); auto-kill could be added as a config flag later
- URL param / env flag for camera mode (`?mode=tethered`) — not needed given always-show picker
- Remember last camera selection in localStorage — deferred; kiosk always picks fresh (D-03)

</deferred>

---

*Phase: 02-tethered-dslr-capture-gphoto2*
*Context gathered: 2026-05-20*
