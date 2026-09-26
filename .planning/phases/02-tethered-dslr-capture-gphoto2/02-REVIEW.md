---
phase: 02-tethered-dslr-capture-gphoto2
reviewed: 2026-09-26T07:06:28Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - server/package.json
  - server/src/camera/CameraService.ts
  - server/src/camera/detect.ts
  - server/src/index.ts
  - server/src/routes/camera.ts
  - web/src/App.svelte
  - web/src/components/CameraTile.svelte
  - web/src/components/DisconnectModal.svelte
  - web/src/components/DisconnectModal.test.ts
  - web/src/components/LivePreview.svelte
  - web/src/components/PhotoGrid.svelte
  - web/src/lib/camera/CameraAdapter.ts
  - web/src/lib/camera/TetheredAdapter.test.ts
  - web/src/lib/camera/TetheredAdapter.ts
  - web/src/lib/camera/WebcamAdapter.ts
  - web/src/lib/camera/adapter.ts
  - web/src/lib/camera/mjpeg.test.ts
  - web/src/lib/camera/mjpeg.ts
  - web/src/lib/session.svelte.ts
  - web/src/lib/session.test.svelte.ts
  - web/src/lib/types.ts
  - web/src/screens/CameraSelectScreen.svelte
  - web/src/screens/CameraSelectScreen.test.ts
  - web/src/screens/CountdownScreen.svelte
  - web/src/screens/IdleScreen.svelte
  - web/src/screens/ReviewScreen.svelte
  - package.json
findings:
  critical: 3
  warning: 11
  info: 5
  total: 19
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-26T07:06:28Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

I reviewed the full Phase 2 surface (diff base `566411e^`): the persistent `gphoto2 --shell` CameraService, the stream and capture routes, the canvas MJPEG client and parser, the camera picker, and the screens that consume the adapter. I did not run gphoto2, the dev server or the test suite. All findings come from reading the code.

These were not re-opened: the 02-06 and 02-07 fixes (probe of a live shell, idle shell close, `pendingCaptures` counter, SHELL_DIR cleanup, canvas watchdog, single-copy parser) and the hardware constraints (no SIGKILL, one shell, unquoted `Single Shot`, poll mode kept). One exception is CR-01. It sits in the probe's `--auto-detect` fallback, which 02-07 kept "unchanged". That fallback makes `/api/camera/info` report a camera that is not there, so the "honest probe" goal is not met at the API level.

Main concerns:
1. The probe reports "available" whenever the gphoto2 binary exists (CR-01).
2. The server binds to all interfaces, and the new camera endpoints have no access control (CR-02).
3. A double tap on Keep skips a shot (CR-03).
4. There are several shell-lifecycle races around `probe()` and `stopShell()`.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The probe fallback reports `available: true` when no camera is attached

**File:** `server/src/camera/CameraService.ts:372-383` (consumed by `server/src/camera/detect.ts:15-20`)
**Issue:** The fallback treats "`gphoto2 --auto-detect` exited 0" as "a camera is present". `--auto-detect` lists what it finds and exits 0 even when the list is empty. The phase's own research records this: `02-RESEARCH.md:643` says "`gphoto2 --auto-detect` returned empty" on a machine with no camera, which means it produced an empty table, not an error. stdout is never inspected. So on any Linux or Mac host with gphoto2 installed:
- `/api/camera/info` returns `gphoto2Available: true, cameraMode: 'tethered'` with no camera plugged in.
- The DSLR tile shows a green "Connected" (`CameraSelectScreen.svelte:36`).
- `TetheredAdapter.init()` succeeds (`TetheredAdapter.ts:16`), so IdleScreen raises no error.
- The probe path 02-07 added makes this worse: after an unplug while idle, `get-config` fails, `stopShell()` runs, and then this fallback returns `available: true` again. So "GET /api/camera/info never reports gphoto2Available:true for a camera that was unplugged while idle" does not hold for `/info` itself.

UAT B1 does not contradict this. On the idle screen the preview is streaming, so an unplug reaches the modal through the 5-failure preview path (`CameraService.ts:193-197`) whatever `/info` returns.

Unverified side note: `--auto-detect` enumerates USB descriptors and may not claim the interface. If so, the `Could not claim the USB device` / `-53` branch at 379-381 would never fire from this call. UAT item 5 reports that the conflict message did appear, so check this rather than assume it.

**Verify:** with the camera unplugged, run `gphoto2 --auto-detect; echo $?`. The output should be the header and dashed line only, and the exit code should be `0`.
**Fix:** Require at least one device row after the separator:
```ts
const { stdout } = await execFileAsync('gphoto2', ['--auto-detect'], { timeout: 3000 });
const rows = stdout.toString().split('\n')
  .slice(2)                                   // skip "Model  Port" + dashed separator
  .filter(l => /\busb:/.test(l));
return rows.length > 0 ? { available: true } : { available: false };
```
Keep the stderr conflict check in the `catch`.

### CR-02: The server listens on 0.0.0.0, so anyone on the network can reach the live camera feed and the shutter

**File:** `server/src/index.ts:9` (endpoints at `server/src/routes/camera.ts:10-53`)
**Issue:** `app.listen({ host: '0.0.0.0' })` exposes every route to the whole network the kiosk laptop joins, such as venue Wi-Fi. The bind address predates Phase 2, but Phase 2 added `GET /api/camera/stream` (a live video feed of the booth) and `POST /api/camera/capture` (fires the DSLR and writes files under `captures/`). No route has authentication or an origin check. Any device on the LAN can:
- watch guests through the live feed (a privacy exposure),
- fire the shutter mid-session, which queues extra captures, wastes shutter count and fills the disk,
- run probes that stop the shell (`probe()` → `stopShell()`).

PROJECT.md states "runs as localhost only". The Vite proxy targets `localhost:3001`, so nothing needs the wildcard bind.
**Fix:**
```ts
await app.listen({ port: 3001, host: '127.0.0.1' });
```
If LAN access is ever needed (for example a second display), make it opt-in through an env var and add a shared-secret header check.

### CR-03: A double tap on Keep advances two shots, which skips a slot or jumps to the grid

**File:** `web/src/screens/ReviewScreen.svelte:43-62`
**Issue:** `handleKeep()` has no in-flight guard, and each call overwrites `keepShotTimer` and `toastHideTimer` without clearing the previous timers. Trace of two taps about 100ms apart on a non-last shot:
1. Tap 1 sets K1 (1200ms).
2. Tap 2 sets K2 (1300ms). `keepShotTimer` now points to K2.
3. K1 fires. It sets `keepShotTimer = undefined`, which drops the only reference to K2, and calls `keepShot()`: index+1, screen `countdown_preview`.
4. `onDestroy → clearTimers()` finds `keepShotTimer === undefined`, so K2 is never cleared.
5. K2 fires and calls `keepShot()` again. The index advances a second time.

At index 1 this skips shot 3. At index 2 the second call sees `3 >= shotCount-1` and switches the fresh countdown straight to `photo_grid` with only 3 photos. Kiosk guests double-tap often. This code dates from Phase 1 (01-03) but is in a scoped file, and `PrimaryButton` has no debounce.
**Fix:**
```ts
let keeping = false;
function handleKeep(): void {
  if (keeping) return;
  keeping = true;
  clearTimers();
  // ...existing body...
}
function handleRetake(): void {
  keeping = false;
  clearTimers();
  // ...
}
```
Also pass `disabled={keeping}` to the Keep button (ReviewPanel needs a prop).

## Warnings

### WR-01: `probe()` checks for the shell outside the queue, so its `--auto-detect` can run while a shell holds USB

**File:** `server/src/camera/CameraService.ts:350-376`
**Issue:** The shell-or-no-shell branch is decided when `probe()` is called, but the command runs later from the queue. `ensureShell()` sets `this.shell` only after the awaited `shellExited` race, `mkdir`, `readdir` and `unlink` (lines 209-225). If `/api/camera/info` arrives inside that window, `probe()` sees `this.shell === null` and queues `--auto-detect`. That task then runs after the preview task, while the new shell holds the camera. The same window exists after a preview-loop `stopShell()` or an idle close.

This window opens during normal use. On picking the DSLR, IdleScreen's `init()` (`/api/camera/info`) and LivePreview's stream request go out at the same moment. By the code's own model (comment at 346-348), this collision produces a false `USB_CONFLICT`, and the host sees "Camera in use by another app" on a healthy camera.
**Fix:** Make the whole decision inside one queued task:
```ts
return this.queue.add(async () => {
  if (this.pendingCaptures > 0) return { available: true };
  if (this.shell) { /* recent-frame check, get-config, stopShell+await exit */ }
  /* --auto-detect fallback here, still inside this task */
});
```
Keep the cheap `pendingCaptures` and `lastFrameAt` checks outside as fast paths only.

### WR-02: The preview loop's disconnect path calls `stopShell()` outside the queue and leaves the running command's waiter hanging

**File:** `server/src/camera/CameraService.ts:192-197`, `301-307`, `246-252`
**Issue:** The `catch` in `previewLoop` runs after `queue.add()` rejects. By then p-queue has already started the next queued task. When the 5th failure calls `stopShell()`:
- If the next task is a probe, it has already written `get-config` and registered a `shellWaiter`. `stopShell()` sets `this.shell = null`, so `onData` and `onGone` both return early on the `this.shell !== proc` check. The waiter is never resolved or rejected and hangs until its 3s timeout. `/api/camera/info` stalls, then falls through to the (CR-01) auto-detect.
- If the next task is a capture, its first await is `mkdir`, so it gets a new shell. It pays the cold Sony 3s startup wait the shell design exists to avoid, and `onEnd()` has already closed every client stream mid-capture.

`stopShell()` never settles a pending waiter, so any caller that stops a busy shell leaves the waiter to its timeout.
**Fix:** Settle the waiter in `stopShell()`, and stop the shell from inside the queue:
```ts
private stopShell() {
  const proc = this.shell;
  if (!proc) return;
  this.shell = null;
  const w = this.shellWaiter; this.shellWaiter = null;
  w?.reject(new Error('gphoto2 shell stopped'));
  proc.stdin?.end('exit\n');
  setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGINT'); }, 2000);
}
// previewLoop catch:
if (++failures >= PREVIEW_FAILURES_BEFORE_DISCONNECT) {
  await this.queue.add(async () => this.stopShell());
  if (live()) for (const sub of this.subscribers) sub.onEnd();
  break;
}
```

### WR-03: The idle close never fires in the kiosk's real idle state

**File:** `server/src/camera/CameraService.ts:113-120, 129-147`; `web/src/screens/IdleScreen.svelte:43-45`
**Issue:** This is a coverage gap, not a reopening of the 02-07 fix. IdleScreen renders `<LivePreview>`, so the attract screen is a permanent stream subscriber. `armIdleClose()` only runs when subscribers drop to 0, which happens on Review, PhotoGrid or CameraSelect. A booth waiting on the idle screen for hours therefore keeps the Sony in PC-Remote live view at about 25 fps and holds the USB claim, which drains the battery and heats the sensor. SHELL_IDLE_MS never applies there. UAT item 6 ("Leave the idle screen for 15 min, past SHELL_IDLE_MS") could not have tested the idle close.
**Fix:** Decide the policy explicitly. Either pause the idle-screen preview after N minutes with no interaction (end the client stream, show a "tap to wake" state, and let the server's idle timer run), or document that the idle close only covers non-preview screens and correct UAT-6.

### WR-04: The white flash stays at full opacity for the whole DSLR capture, and nothing bounds it on the client

**File:** `web/src/screens/CountdownScreen.svelte:79-102`; `web/src/lib/camera/TetheredAdapter.ts:42-49`
**Issue:** `flashVisible = true` is set before `await cameraAdapter.capture()`, and cleared only 300ms after it settles. With the tethered path, capture takes about 3.8–4.1s (shutter plus the 8.5 MB download, per 02-06). The guest sees a solid white screen for about 4s instead of the 300ms flash (D-12, SESS-02). The capture `fetch` has no timeout or AbortSignal. If the server is slow (queued preview up to 5s, `ensureShell` up to 5+10+5s, capture 20s), the screen stays white for up to about 45s with no feedback.
**Fix:** Run the flash on its own timer (`setTimeout(() => flashVisible = false, FLASH_DURATION_MS)` right after showing it). Show a "Saving photo…" state while `capture()` is pending. Give the capture request a client timeout, for example `AbortSignal.timeout(30_000)`, so the failure path (Review "Capture failed") is always reached.

### WR-05: The webcam preview is attached before `init()` resolves, so the first Idle mount stays black (needs a browser check)

**File:** `web/src/components/LivePreview.svelte:25-34`; `web/src/screens/IdleScreen.svelte:9-15`; `web/src/lib/camera/WebcamAdapter.ts:60-63`
**Issue:** LivePreview's `$effect` calls `attachPreview(videoEl)` as soon as it mounts. IdleScreen's `onMount` awaits `cameraAdapter.init()` (getUserMedia, which is always async). Whichever effect runs first, `this.stream` is still `null` when `attachPreview` runs, so it throws "WebcamAdapter not initialized" and only logs it. Nothing re-attaches afterwards: the effect's only reactive dependency is `adapter`, and `camera-reattach` fires only on Retry. The preview would then appear only from the CountdownScreen on.

This contradicts 01-UAT item 2 (pass), and the Phase 2 UAT covered only the DSLR. Confirm it in a browser before fixing. The tethered path is unaffected because it needs no `init()`.
**Fix:** Have IdleScreen dispatch `camera-reattach` after `init()` resolves, or make `WebcamAdapter.attachPreview` wait on an internal `ready` promise that `init()` resolves.

### WR-06: Each return to idle re-runs `init()` without `dispose()`, so MediaStreams and listeners pile up

**File:** `web/src/screens/IdleScreen.svelte:9-15`; `web/src/lib/camera/WebcamAdapter.ts:30-53`
**Issue:** IdleScreen mounts again after every `resetSession()`, and each mount calls `cameraAdapter.init()` again. `WebcamAdapter.init()` overwrites `this.stream` without stopping the old tracks, attaches another `ended` listener, and replaces `deviceChangeHandler`. The old handler stays registered on `navigator.mediaDevices` and `dispose()` can never remove it. Over an event of a few hundred sessions, that is a few hundred live tracks and handlers. With the TetheredAdapter it only adds an extra probe per session. This dates from Phase 1, but the Phase 2 picker keeps this adapter for the whole kiosk lifetime.
**Fix:** Make `init()` idempotent:
```ts
async init() {
  if (this.stream?.getVideoTracks().some(t => t.readyState === 'live')) return;
  await this.dispose();
  // ...existing body...
}
```

### WR-07: Nothing stops a double tap on a camera tile or on Retry

**File:** `web/src/screens/CameraSelectScreen.svelte:45-53`; `web/src/App.svelte:42-62`
**Issue:**
- Tiles stay clickable during the 250ms `{#key}` fade-out. A second tap builds a second adapter, so the adapter IdleScreen renders (`adapter={cameraAdapter}` is read once and is not reactive) can differ from the one `init()` and capture later use. Tapping DSLR then Webcam quickly leaves a TetheredAdapter preview next to a WebcamAdapter `init()`.
- `handleRetry` can run several times at once, each doing `dispose()` → `init()`. For the webcam that means two getUserMedia calls, and one stream is leaked.

**Fix:** Add a `let busy = false` guard to `selectDSLR`, `selectWebcam` and `handleRetry`. Return early while it is set, and in `handleRetry` reset it in a `finally`.

### WR-08: There is no way back to the camera picker, so a DSLR selected with no camera traps the kiosk in the modal

**File:** `web/src/App.svelte:42-62`; `web/src/screens/CameraSelectScreen.svelte:45-48`
**Issue:** `camera_select` is reached only at boot. If the host picks the DSLR while it is absent, CR-01 makes this likely because the tile says "Connected". The flow is then: preview fails → modal → Retry → `init()` succeeds (CR-01) → preview fails again → modal, with no way to switch to the webcam short of a browser reload. The same applies when the camera dies mid-event.
**Fix:** Add a secondary "Use a different camera" action to DisconnectModal. It should `dispose()` the adapter, `hideDisconnect()`, and set `session.screen = 'camera_select'`.

### WR-09: LivePreview branches on the adapter type, which breaks the project rule that platform branching stays in the adapter

**File:** `web/src/components/LivePreview.svelte:4, 16, 27, 46`
**Issue:** CLAUDE.md says: "Platform branching lives only in the Camera Adapter — screen code is platform-agnostic". LivePreview imports `TetheredAdapter` and does `adapter instanceof TetheredAdapter` in three places to choose `<canvas>` or `<video>`. Any new adapter, such as a future `<img>` MJPEG adapter or a mock in tests, has to edit this component. `instanceof` also fails silently across module duplicates, for example with test mocks.
**Fix:** Add a capability to the contract, for example `readonly previewKind: 'video' | 'canvas'` on `CameraAdapter`, and branch on `adapter.previewKind` in LivePreview.

### WR-10: The capture directory depends on the process working directory

**File:** `server/src/camera/CameraService.ts:61`
**Issue:** `path.resolve('../captures', …)` resolves against `process.cwd()`. It is correct only when the server is started from `server/` (`npm --prefix server run dev`). If it is started as `tsx server/src/index.ts` from the repo root, or by a future desktop wrapper (see the research on desktop packaging), photos go to the directory above the repo. The project rule "always save to disk first" then writes to an unexpected place without any error.
**Fix:**
```ts
const CAPTURES_DIR = process.env.CAPTURES_DIR
  ?? fileURLToPath(new URL('../../../captures', import.meta.url));
```

### WR-11: The server state machine has no automated tests

**File:** `server/src/camera/CameraService.ts` (whole file); `server/package.json:5-8`
**Issue:** The riskiest code in the phase has no automated tests and no `test` script. That code covers prompt-framed shell I/O, the queue ordering between preview, capture, probe and idle close, the `pendingCaptures` counter, the waiter timeouts and the `Saving file as` parsing. All 02-07 server "truths" rest on one overall UAT approval with no per-item measurements (02-UAT.md notes). CR-01, WR-01 and WR-02 are the kind of defect a fake-child-process test would catch.
**Fix:** Inject `spawn` and `execFile`, or wrap them in a small module that vitest can mock. Emit scripted stdout (`/> `, `Saving file as …`, `*** Error`) and assert the queue order, the waiter settlement on stop, and the probe results with an empty `--auto-detect` table.

## Info

### IN-01: A RAW-only camera setting saves a RAW file as `N.jpg`

**File:** `server/src/camera/CameraService.ts:74`
**Issue:** `saved.find(jpeg) ?? saved[0]` copies an `.ARW` into `${shotIndex}.jpg`, and the route serves it as `image/jpeg`. The review screen then shows a broken image instead of the "Capture failed" path.
**Fix:** If no JPEG was saved, delete the files and throw `Capture failed: camera is not saving JPEG (set RAW+JPEG or JPEG)`.

### IN-02: The boot probe is duplicated, and `CameraInfo` does not match the API

**File:** `web/src/App.svelte:25-33`; `web/src/lib/types.ts:13-17`; `web/src/lib/session.svelte.ts:16, 133-135`
**Issue:**
- App.svelte and CameraSelectScreen both call `/api/camera/info` on boot, so two gphoto2 probes run at once.
- The App result is stored in `session.cameraInfo`, which nothing reads.
- `CameraInfo` has no `usbConflict`, but the server returns it.

**Fix:** Remove the fetch in App.svelte (or share one result), and add `usbConflict: boolean` to `CameraInfo`.

### IN-03: A 503 from the stream during a capture is shown as a disconnect

**File:** `web/src/lib/camera/TetheredAdapter.ts:132-147`; `server/src/routes/camera.ts:11-14`
**Issue:** The route says "retry in 2s", but the canvas client treats any `!res.ok` as a camera loss and opens the modal. This can happen when a stream is opened during an in-flight capture, for example Retry or a re-attach.
**Fix:** On a 503, retry after a delay instead of calling `disconnectCallback`. Alternatively, let the server subscribe during a capture, since frames resume on their own once the capture ends.

### IN-04: Route hygiene

**File:** `server/src/routes/camera.ts:10-35, 38, 50`
**Issue:**
- The stream handler writes to `reply.raw` without `reply.hijack()`, so Fastify still thinks it owns the reply.
- `request.raw.on('close')` is used where `reply.raw.on('close')` is the reliable client-gone signal.
- `const { … } = request.body as …` throws a TypeError (500) when the body is missing, instead of a 400.
- The gphoto2 output inside `Capture failed: …` is returned to the client.

**Fix:** Call `reply.hijack()` before `writeHead`, listen on `reply.raw`'s `close` event, use `request.body ?? {}`, and log the gphoto2 output on the server while returning a generic 500 message.

### IN-05: Stale comments and a leaked spy in tests

**File:** `web/src/lib/camera/TetheredAdapter.test.ts:1-14, 27, 141`; `web/src/lib/camera/CameraAdapter.ts:18-19, 43`
**Issue:**
- The test header still says "scaffold ONLY / placeholder that throws / it.todo", and the suite is named "(Wave 3/4 contract — todo)".
- `vi.spyOn(Date, 'now')` at line 141 is never restored. The file only calls `vi.unstubAllGlobals()`, and there is no `restoreMocks` setting or `vitest-setup.ts` hook, so the spy leaks into every later test in the file.
- CameraAdapter's documentation still describes a "backend WebSocket heartbeat" and an `<img>` MJPEG path as the Phase 2 design.

**Fix:** Update the comments, and add `vi.restoreAllMocks()` to the `afterEach` hook.

---

_Reviewed: 2026-09-26T07:06:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
