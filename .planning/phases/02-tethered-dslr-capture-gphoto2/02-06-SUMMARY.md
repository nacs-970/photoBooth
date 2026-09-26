---
phase: 02-tethered-dslr-capture-gphoto2
plan: 06
subsystem: camera
tags: [gphoto2, sony, live-preview, capture, performance, hotfix]

# Dependency graph
requires:
  - phase: 02-tethered-dslr-capture-gphoto2
    provides: [CameraService, /api/camera/stream, /api/camera/capture, TetheredAdapter]
provides:
  - Persistent gphoto2 --shell session serving both preview and capture
  - Canvas-based MJPEG preview renderer (flat browser memory)
  - Forced Single Shot drive mode per session
  - Capture-failure recovery UI (Retake) and sparse-safe PhotoGrid
affects: [camera-preview, camera-capture, review-screen, photo-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single long-lived gphoto2 --shell child; commands serialized through p-queue; prompt '/> ' marks completion"
    - "Stream fan-out: CameraService.subscribe(onFrame, onEnd) → unsubscribe; producer runs while subscribers > 0"
    - "Client MJPEG: fetch + incremental multipart parser + createImageBitmap → canvas → bitmap.close()"

key-files:
  created:
    - web/src/lib/camera/mjpeg.ts
    - web/src/lib/camera/mjpeg.test.ts
  modified:
    - server/src/camera/CameraService.ts
    - server/src/routes/camera.ts
    - web/src/lib/camera/TetheredAdapter.ts
    - web/src/lib/camera/TetheredAdapter.test.ts
    - web/src/lib/camera/CameraAdapter.ts
    - web/src/lib/camera/WebcamAdapter.ts
    - web/src/components/LivePreview.svelte
    - web/src/components/PhotoGrid.svelte
    - web/src/screens/ReviewScreen.svelte
    - web/src/screens/CountdownScreen.svelte
    - web/src/lib/session.svelte.ts

key-decisions:
  - "Stream strategy: persistent `gphoto2 --shell` session (supersedes 02-02 option-poll)"
  - "Preview renders to <canvas>, not <img> MJPEG — attachPreview() union widened with HTMLCanvasElement"
  - "Server forces `capturemode=Single Shot` on every new shell session"
  - "Shell stays open after preview stops, so captures skip the Sony 3s startup wait"
  - "Legacy per-process path kept behind STREAM_MODE=poll"

requirements-completed: [CAM-03]

# Metrics
duration: 1 session
completed: 2026-09-23
---

# Phase 02 Plan 06: Camera Pipeline Rework (hotfix session) Summary

**Ad-hoc fix session, with no pre-written PLAN.** It was driven by hands-on testing with the Sony A7 IV (ILCE-7M4). The user reported five problems: a stuttering and laggy live preview, very high browser RAM, 1–2s shutter delay after the countdown, bursts of 3–4 shots per press, and a stuck UI after a failed capture. All were confirmed fixed by the user on 2026-09-23.

## Root causes (measured)

| Symptom | Root cause | Evidence |
|---|---|---|
| Preview stutter/lag | One `gphoto2 --capture-preview` process per frame (USB claim + PTP session + Sony init each time) + 100ms sleep → ~3fps | ~0.2s per spawned call; `--capture-movie` single session = 25fps |
| Preview froze after capture | Stream route race: old connection's `close` called `stopStream()` after the new connection started; a second client got no frames | Code read of `routes/camera.ts` (pre-fix) |
| Browser RAM 1.6–1.9 GB | Firefox keeps decoded frames of an `<img>` MJPEG stream (1024×680 ≈ 2.8 MB decoded × ~25fps) | RSS sampling: tab dropped to ~100 MB when preview stopped |
| 3–4s before shutter | libgphoto2 `camera_sony_capture` waits until 3s after **session start** for ILCE-7M4 & others (`camlibs/ptp2/library.c:4948-4978`, v2.5.34). A new process per capture paid the whole wait every shot | gphoto2 `--debug` log: "sony startup wait" 0.2s→3.39s, then S1/S2 press |
| Burst of 3–4 photos | In PC Remote mode the body drive-mode dial is ignored and the host `capturemode` was continuous. libgphoto2 holds the shutter until the first ObjectAdded (~0.6s) | 3 `capt_DSC*.JPG` files per press; `get-config capturemode` |
| `PTP Invalid Object Handle` on next shot | Leftover burst images in camera RAM | Server log 2026-09-23 |
| UI stuck at shot 4 "Keep" | Failed capture left `shots[i]` empty; `PhotoGrid` read `shot.objectUrl` of `undefined`; ReviewScreen showed a blank screen with no buttons | `captures/session-*` missing `2.jpg` |

## Accomplishments

- **Server (`CameraService.ts`)**
  - One `gphoto2 --force-overwrite --shell` child in `$TMPDIR/photobooth-gphoto2`.
  - Preview is `capture-preview`, then read `capture_preview.jpg`, then broadcast. That is ~35ms per frame, ~25fps over HTTP.
  - Capture is `capture-image-and-download` in the warm session. The shutter fires ~0.65s after the request (was ~3.6s). Total ~3.8–4.1s including the ~8.5 MB download.
  - `set-config capturemode=Single Shot` on every new session. Verified: `Current: Single Shot`, one file per press.
  - Subscriber set with `onEnd`. After 5 failed preview frames in a row the shell is closed and all streams end, so the client shows the disconnect modal.
  - Hardening:
    - EPIPE guard on shell stdin.
    - Preview-loop generation token, so no duplicate loops.
    - Waits (max 5s) for the old shell to exit before spawning a new one.
    - Picks the JPEG when RAW+JPEG is enabled.
    - Deletes extra files.
    - Resets the shell after a failed capture.
  - Shell shutdown uses `exit`, then SIGINT. Never SIGKILL (see commit 2dd3373).
- **Route (`camera.ts`)**
  - Per-connection `subscribe`/`unsubscribe`.
  - Drops frames for slow clients (`writableNeedDrain`).
  - Ends the response on camera loss.
- **Web**
  - `TetheredAdapter.attachPreview(canvas)` works as follows:
    - It reads the stream with `fetch` and `mjpeg.ts`.
    - It keeps only the latest pending frame.
    - It draws each frame with `createImageBitmap`, then calls `close()`.
    - It stops the stream when the canvas leaves the DOM.
    - Its error handling fires `onDisconnect`.
  - Browser tab RAM is 226–340 MB and flat (was 1.6–1.9 GB).
  - `ReviewScreen` shows "Capture failed — please try again." + Retake when the slot is empty.
  - `clearShot()` clears the slot on a failed capture, so a failed retake no longer shows the old photo.
  - `PhotoGrid` skips empty slots.

## Deviations

- **Interface change:** `CameraAdapter.attachPreview(el)` union gained `HTMLCanvasElement`. The ROADMAP cross-cutting constraint said the interface is locked. This is an additive widening: no signature is removed, and the `<img>` path is kept and still tested.
- **02-02 decision superseded:** option-poll is replaced by the persistent shell session. The 02-02 "2s lag" on `--capture-movie` could not be reproduced as a camera limit. In the browser, the persistent session shows no noticeable lag (user-confirmed).

## Verification

- Web tests pass (71/71), with 9 new tests:
  - 3 MJPEG parser tests
  - 5 canvas/disconnect tests (the old `it.todo` is resolved)
  - 1 re-attach abort test (mutation-checked)
- Server `tsc --noEmit` is clean.
- Live checks against the real camera with curl:
  - 4 of 4 and 3 of 3 captures returned distinct JPEGs.
  - The stream resumed after every capture.
  - The shell stayed up and no temp files were left over.
- User UAT 2026-09-23: full session works; preview smooth; no burst.

## Open items → 02-07-PLAN.md

- Unplug and idle behaviour are not verified on hardware.
- Remaining `/code-review` findings (stale probe, idle shell policy, stream close on unmount, overlapping captures, parser copying).
- SC #4 (relaunch while gvfs holds USB) needs re-verification with the shell design.

---
*Phase: 02-tethered-dslr-capture-gphoto2*
*Completed: 2026-09-23*
