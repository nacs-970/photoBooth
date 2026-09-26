---
phase: 02-tethered-dslr-capture-gphoto2
verified: 2026-09-26T09:00:00Z
status: human_needed
score: 9/13 must-haves verified
covered_files: [".gitignore",".planning/REQUIREMENTS.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-01-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-01-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-02-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-02-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-03-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-03-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-04-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-04-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-05-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-05-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-06-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-07-PLAN.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-07-SUMMARY.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-REVIEW-FIX.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-REVIEW.md",".planning/phases/02-tethered-dslr-capture-gphoto2/02-UAT.md",".planning/phases/02-tethered-dslr-capture-gphoto2/deferred-items.md","package.json","server/src/camera/CameraService.ts","server/src/camera/autoDetect.test.ts","server/src/camera/detect.ts","server/src/index.ts","server/src/routes/camera.ts","web/src/App.svelte","web/src/components/DisconnectModal.svelte","web/src/components/DisconnectModal.test.ts","web/src/components/LivePreview.svelte","web/src/lib/camera/TetheredAdapter.test.ts","web/src/lib/camera/TetheredAdapter.ts","web/src/lib/camera/adapter.ts","web/src/lib/camera/mjpeg.test.ts","web/src/lib/camera/mjpeg.ts","web/src/lib/config.ts","web/src/lib/session.svelte.ts","web/src/lib/types.ts","web/src/screens/CameraSelectScreen.svelte","web/src/screens/CameraSelectScreen.test.ts","web/src/screens/CountdownScreen.svelte","web/src/screens/IdleScreen.svelte","web/src/screens/IdleScreen.test.ts","web/src/screens/ReviewScreen.svelte","web/src/screens/ReviewScreen.test.ts"]
covered_digest: "v1:sha256:5cdf3883be14aa41bd5fa1c83268a5d3790f3c03cd9ea2308e750d957f86ec47"
behavior_unverified: 4
overrides_applied: 0
behavior_unverified_items:
  - truth: "ROADMAP SC #3 — unplugging the DSLR mid-session surfaces the disconnect UI and Retry resumes cleanly, using the code that exists TODAY (post code-review-fix)"
    test: "On real hardware: start a DSLR session, unplug mid-preview and mid-countdown, replug, tap Retry. Confirm the modal appears, the server keeps running, and the session resumes."
    expected: "Disconnect modal appears within a few seconds; after replug + Retry, the shell reopens (paying no more than the normal ~0.65s Sony wait) and the session continues without an app restart."
    why_human: "The current stopShell()/shellWaiter-settlement logic (commit 579d020, WR-02) was written and committed AFTER the 02-07 hardware UAT that exercised this recovery path. No automated test covers the queue/waiter state machine (02-REVIEW WR-11, deferred). Presence + code reading confirm the fix is sound, but the exact code path guarded against a real race has never been run against a physical camera."
  - truth: "ROADMAP SC #4 — relaunching while gvfs/PTP holds the USB claim recovers cleanly via the USB-conflict DisconnectModal message"
    test: "On real hardware: let gvfs claim the camera, launch the app, select DSLR tile, confirm the USB-conflict message, kill gvfs, tap Retry."
    expected: "DisconnectModal shows the verbatim D-09 message; after the conflicting process is killed, Retry succeeds and preview appears."
    why_human: "probe()'s single-queued-task restructuring (commit df4f6a1, WR-01) and the auto-detect row-parsing fix (commit f1053c6, CR-01) both post-date the 02-07 UAT that exercised SC #4 — that UAT ran the OLD probe() implementation. autoDetectFoundCamera() itself has an automated unit test (confirmed passing, ran directly this session), but the surrounding queue-ordering fix (WR-01) that decides shell-vs-auto-detect has no automated test and has not been re-run against a real gvfs conflict since it changed."
  - truth: "The gphoto2 shell survives real kiosk idling: IdleScreen detaches its own live preview after IDLE_PREVIEW_MS, which lets the server's SHELL_IDLE_MS timer actually fire, and the next tap reopens a working preview with no extra delay"
    test: "Leave the idle screen untouched for >IDLE_PREVIEW_MS + SHELL_IDLE_MS with a real DSLR attached. Confirm `pgrep -x gphoto2` disappears, then tap to wake and confirm the preview reopens promptly."
    expected: "Preview detaches from the DOM at IDLE_PREVIEW_MS (client), the canvas watchdog aborts the fetch, the server's subscriber count drops to 0 and SHELL_IDLE_MS closes the shell; a tap re-attaches and the preview reopens with no extra Sony startup wait."
    why_human: "02-REVIEW's own WR-03 finding states that IdleScreen mounted <LivePreview> unconditionally BEFORE this fix, so 02-UAT item 6 ('leave idle for 15 min') could not actually have exercised the idle-close path — the shell was a permanent subscriber, and SHELL_IDLE_MS could never fire from the real idle screen. The fix (commit f40690c) is unit-tested with fake timers only (IdleScreen.test.ts, confirmed passing this session) — the full client-timer -> canvas-detach -> server-unsubscribe -> shell-close -> reopen chain has never been exercised against a physical camera."
  - truth: "GET /api/camera/info never reports gphoto2Available:true for a camera that was unplugged while the app sat idle (02-07 must_have, shared root cause with SC #4)"
    test: "With the app idle and no recent preview frame, unplug the camera, then call GET /api/camera/info (or reload the picker)."
    expected: "gphoto2Available: false, and the DSLR tile shows 'Not detected' — not a stale 'Connected'."
    why_human: "CR-01's autoDetectFoundCamera() row-parsing fix is unit-proven, but the surrounding WR-01 queued-decision logic that calls it (shell-liveness check, get-config, stopShell+await, then the auto-detect fallback) has zero automated test and postdates the 02-UAT B1 pass, which ran the old probe() code."
human_verification:
  - test: "Launch the app with a real DSLR attached and pick the DSLR tile. Confirm the live preview appears and no USB-conflict message shows. Then unplug the camera and reload/re-probe (GET /api/camera/info or re-select the picker)."
    expected: "Live preview appears with no false USB-conflict message on the healthy-camera path; after unplug, the DSLR tile shows 'Not detected' and gphoto2Available is false — not a stale 'Connected'."
    why_human: "probe()'s queued single-decision restructuring (WR-01) and the autoDetectFoundCamera() row-parsing fix (CR-01) both post-date the last hardware UAT of this exact path; the queue-ordering logic has no automated test. Covers ROADMAP SC #4 and the /api/camera/info idle-honesty must_have."
  - test: "With the server running on its new default bind (HOST unset, so 127.0.0.1), confirm the web app via the Vite dev proxy can still reach /api/camera/info, the MJPEG stream, and the capture endpoint."
    expected: "No behavior change from before CR-02 — the proxy still works end to end."
    why_human: "02-REVIEW-FIX.md itself lists this as an unverified hardware check (CR-02, commit e73480d); the dev server was not started during this verification per task instructions."
  - test: "Start a DSLR session, unplug mid-preview and mid-countdown, replug, tap Retry."
    expected: "Disconnect modal appears within a few seconds; after replug + Retry, the shell reopens and the session resumes without restarting the app."
    why_human: "WR-02's shell-waiter-settlement and queued-stop fix postdates the last hardware UAT of this path; no automated test covers the queue/waiter state machine. Covers ROADMAP SC #3."
  - test: "Leave the idle screen untouched for longer than IDLE_PREVIEW_MS (5 min) plus SHELL_IDLE_MS (10 min default) with a real DSLR attached, then tap to wake."
    expected: "pgrep -x gphoto2 shows no process after the combined idle window; tapping re-attaches the preview promptly with no extra Sony startup delay."
    why_human: "WR-03 is the first fix that lets the idle screen's own preview ever detach — the original 02-UAT 'idle 15 min' item could not have exercised this per the reviewer's own finding."
  - test: "Confirm a normal capture still fires the shutter and shows a JPEG within ~4s after WR-04's added 15s AbortController timeout and the flash-duration fix."
    expected: "Capture completes normally; flash fades at ~300ms instead of persisting for the full capture duration."
    why_human: "Timing-sensitive UI behavior on physical hardware; only fake-timer tests exist. Low priority — additive safety change, not expected to alter the healthy-camera path."
  - test: "Confirm on the kiosk that a fast double-tap on the Keep button during a DSLR session still advances exactly one shot."
    expected: "One shot advance per Keep sequence, regardless of extra taps during the toast or the 250ms screen-fade."
    why_human: "Touch-timing behavior; only fake-timer/synthetic-click tests exist. Low priority."
---

# Phase 2: Tethered DSLR Capture (gphoto2) — Verification Report

**Phase Goal:** On Mac/Linux the same session loop from Phase 1 now runs against a real DSLR. The live preview is MJPEG from gphoto2, and pressing the on-screen shutter fires the physical camera at full quality.
**Verified:** 2026-09-26T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC #1 — app auto-routes to gphoto2 adapter; connected DSLR shows live preview within a few seconds of launch | ✓ VERIFIED | `CameraSelectScreen.svelte` probes `/api/camera/info` on mount and boots to the DSLR tile; `TetheredAdapter.attachPreview(canvas)` → `mjpeg.ts` parser → `CameraService.previewLoop()` (persistent `gphoto2 --shell`, ~35ms/frame). 02-UAT item 1 passed on a Sony ILCE-7M4 (user-approved). Regression note: WR-01's probe restructuring post-dates this UAT run — the DSLR-selection happy path is covered by human item H-1 below (it is also the mechanism most likely to show a false USB-conflict on a healthy camera if WR-01 has a bug, so it is ranked first). |
| 2 | ROADMAP SC #2 — pressing Start runs the full session and each capture fires the DSLR shutter, returning the camera's JPEG into the review thumbnail | ✓ VERIFIED | `CameraService.capture()` runs `capture-image-and-download` inside the warm shell, saves to `captures/session-{id}/{idx}.jpg`, returns the buffer; `TetheredAdapter.capture()` POSTs, returns a `Blob`, and reconnects the stream. 02-UAT items 2 and A4 passed (user-approved). WR-04 added a 15s client-side `AbortController` timeout and fixed the flash to fade at 300ms instead of following the ~4s capture — additive safety, not a behavior regression, but not re-run on hardware after the change (human item H-5, low priority). |
| 3 | ROADMAP SC #3 — unplugging the DSLR mid-session surfaces the "Camera disconnected" recovery UI, and reconnect + Retry resumes without an app restart | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `TetheredAdapter`'s canvas watchdog / `imgEl.onerror` still calls `disconnectCallback` → `showDisconnect()`; `App.svelte handleRetry` still does `dispose()→init()→camera-reattach→hideDisconnect()`. But the server-side state machine underneath (`stopShell()` now settles a pending `shellWaiter`, and the 5-failure preview path now stops the shell **through the queue** — commit 579d020, WR-02) was written and committed after the 02-07 hardware UAT that exercised this exact recovery path (02-UAT items 3, 4, A1, B1). No automated test covers this queue/waiter state machine (02-REVIEW WR-11, deferred, unfixed). Code reading confirms the fix is logically sound, but the invariant itself (waiter settles, no stale `onEnd()` firing, capture and preview never interleave) has not been behaviorally re-proven against real hardware since it changed. Routed to human item H-3. |
| 4 | ROADMAP SC #4 — relaunching while a previous gphoto2/PTP claim is held (gvfs) recovers cleanly | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `autoDetectFoundCamera()` (CR-01 fix, commit f1053c6) is unit-tested (`server/src/camera/autoDetect.test.ts`, 4 cases) and independently confirmed by the orchestrator's automated gate ("returns false on the real `gphoto2 --auto-detect` output with no camera"). However `probe()`'s single-queued-decision restructuring (WR-01, commit df4f6a1) — which decides whether to trust a live shell, run `get-config`, or fall through to `--auto-detect` — has no automated test, and 02-UAT's SC #4 pass (item 5) ran against the OLD `probe()` implementation, before both CR-01 and WR-01 landed. Routed to human item H-1. |
| 5 | App boots to `CameraSelectScreen`, shows DSLR + Webcam tiles with correct probe-driven status, and tapping either tile routes correctly | ✓ VERIFIED | `session.svelte.ts` initial `screen: 'camera_select'`; `App.svelte` routes `camera_select` first; `CameraSelectScreen.svelte` probes `/api/camera/info`, renders `CameraTile` with checking/connected/not-detected/available states; `setCameraAdapter()` live-binding swap confirmed in `adapter.ts`. Covered by `CameraSelectScreen.test.ts` (6 tests) + 02-UAT item 0. |
| 6 | Captured JPEGs persist to disk at `./captures/session-{ts}/{idx}.jpg` (survive restart) and `captures/` is git-ignored | ✓ VERIFIED | `CameraService.capture()` does `mkdir` + `copyFile`/`readFile` under `path.resolve('../captures', ...)`; `.gitignore` contains `captures/` and `captures/**/*.jpg` (both lines confirmed present). 02-UAT items 2/A1/A4 confirm files land on disk (user-approved). |
| 7 | `DisconnectModal` renders the default cable message by default and the verbatim USB-conflict message (D-09) when `TetheredAdapter.init()` throws `USB_CONFLICT` | ✓ VERIFIED | `DisconnectModal.svelte` optional `message` prop, default text unchanged from Phase 1; `App.svelte` sets `disconnectMessage` to the exact D-09 string on `USB_CONFLICT`, clears it on every retry attempt and on success. `DisconnectModal.test.ts` covers both variants. |
| 8 | The gphoto2 shell survives real kiosk idling — the idle screen itself eventually releases the stream so `SHELL_IDLE_MS` can close the shell, and the next interaction reopens it cleanly | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `IdleScreen.svelte` now unmounts `<LivePreview>` after `IDLE_PREVIEW_MS` (5 min) via a `$state` flag + `pointerdown` reset (commit f40690c, WR-03); the canvas watchdog then aborts the fetch, letting the server's existing `armIdleClose()`/`SHELL_IDLE_MS` timer run. Unit-tested with fake timers (`IdleScreen.test.ts`, 3 tests — ran directly this session, all pass) and the server-only half was hardware-verified in isolation (02-UAT A2/A3, short `SHELL_IDLE_MS`). But 02-REVIEW's own WR-03 finding states the ORIGINAL 02-UAT item 6 ("idle 15 min") could not have exercised the real idle-close path, because `IdleScreen` held a permanent stream subscription before this fix. The end-to-end chain (client timer → canvas detach → server unsubscribe → shell close → reopen with no extra delay) has never been run against a physical camera. Routed to human item H-4. |
| 9 | (02-07 must_have) Two overlapping `POST /api/camera/capture` calls never let a preview command run between them | ✓ VERIFIED | `capture()`'s `pendingCaptures` counter and its `finally` block (only resumes `startProducer()` when the count reaches 0) are unchanged by the 02-REVIEW fixes. 02-UAT item A1 passed on real hardware (user-approved) against this exact, still-current code. |
| 10 | (02-07 must_have) Leaving the countdown screen closes the canvas stream within ~500ms even if no frame arrives | ✓ VERIFIED | `startCanvasStream()`'s 500ms `setInterval` watchdog checking `canvas.isConnected`, cleared via the abort-signal listener. Ran `npx vitest run src/lib/camera/TetheredAdapter.test.ts` directly this session (not merely trusting the orchestrator's aggregate number) — all tests in the file pass, including the fake-timer watchdog tests. |
| 11 | (02-07 must_have) The MJPEG parser does one copy per frame (no per-chunk re-copy of the whole buffer), one TextDecoder per parser instance | ✓ VERIFIED | `mjpeg.ts` keeps a pending-chunk list + running byte count, concatenates once per complete frame, searches the first 1KB for the header terminator before falling back to a full search. Ran `npx vitest run src/lib/camera/mjpeg.test.ts` directly this session — all tests pass, including the 200KB-in-16KB-chunks single-identical-frame case. |
| 12 | (02-07 must_have) The first capture after an idle shell close still skips the Sony 3s startup wait (preview during countdown keeps the session >3s old) | ✓ VERIFIED | `CountdownScreen.svelte` mounts `<LivePreview>` unconditionally for its own duration (no `IDLE_PREVIEW_MS` timer applies inside an active session) so the shell stays warm through the 3s countdown; `CameraService.capture()`'s warm-session path is unchanged by the review fixes. 02-UAT item A4 passed on real hardware against this exact, still-current mechanism (WR-03's idle-detach timer only runs on `IdleScreen`, not `CountdownScreen`). |
| 13 | GET /api/camera/info never reports gphoto2Available:true for a camera that was unplugged while the app sat idle | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See `behavior_unverified_items[3]` — CR-01's row-parsing fix is unit-proven; the WR-01 queued-decision logic that calls it is not, and 02-UAT B1 ran the pre-fix code. Routed to human item H-1. |

**Score:** 9/13 truths verified (4 present, behavior-unverified)

### Superseded plan must-haves (informational, not scored)

02-02's `option-poll` strategy, 02-03's `<img>`-element MJPEG preview, and 02-04's per-process stream-kill-on-capture were all superseded by the 02-06 persistent-shell + canvas rework (documented in `02-06-SUMMARY.md`'s "Deviations" section and in ROADMAP's cross-cutting constraints). These are not re-checked as live must-haves since the current code intentionally does not implement them. To make this omission visible rather than silent, the developer may want to formalize it:

```yaml
overrides:
  - must_have: "GET /api/camera/stream emits multipart MJPEG frames using the option-poll or capture-movie strategy decided in 02-02"
    reason: "Superseded by the 02-06 persistent gphoto2 --shell design — poll/movie both replaced after measured Sony startup-wait cost made them impractical for capture. See 02-06-SUMMARY.md."
    accepted_by: "{developer name}"
    accepted_at: "{ISO timestamp}"
  - must_have: "TetheredAdapter.attachPreview(HTMLImageElement) sets img.src to the stream URL for live preview"
    reason: "Superseded by canvas-based rendering (02-06) to keep browser memory flat; the <img> path is kept only as a secondary code path, not the primary preview mechanism."
    accepted_by: "{developer name}"
    accepted_at: "{ISO timestamp}"
```

This does not change the phase status — it is a documentation suggestion, not a gap.

### Decision Coverage

All 14 tracked `02-CONTEXT.md` decisions (D-01 to D-14) are honored in the shipped code. One exception is explicitly documented and superseded, not silently dropped: D-05 ("raw MJPEG passthrough via `gphoto2 --capture-movie --stdout`") was replaced by the persistent `gphoto2 --shell` + canvas-render design in 02-06, recorded in that plan's SUMMARY as an intentional supersession with rationale (measured Sony startup-wait cost). Non-blocking per the decision-coverage gate.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/camera/CameraService.ts` | Shell-backed singleton: preview, capture, probe, idle close, capture counter | ✓ VERIFIED | `class CameraService` exports `cameraService`; `capture()`, `subscribe()`, `probe()`, `armIdleClose()`, `pendingCaptures` all present and wired |
| `server/src/routes/camera.ts` | GET `/api/camera/stream` (multipart MJPEG), POST `/api/camera/capture` | ✓ VERIFIED | Both routes present; capture validates `shotIndex`/`sessionId` as integers with range checks |
| `server/src/camera/detect.ts` | Probe wrapper returning `usbConflict` | ✓ VERIFIED | Delegates to `cameraService.probe()`, maps `conflictError === 'USB_CONFLICT'` to `usbConflict: true` |
| `server/src/camera/autoDetect.test.ts` | Unit proof that `autoDetectFoundCamera()` requires a row after the separator | ✓ VERIFIED | 4 cases (empty, header-only, header+dashes, one usb row); matches the orchestrator's confirmed automated gate |
| `web/src/lib/camera/TetheredAdapter.ts` | init/attachPreview/capture/dispose/onDisconnect, canvas stream + watchdog, capture timeout | ✓ VERIFIED | All methods implemented; `CAPTURE_TIMEOUT_MS = 15_000` AbortController wired into `capture()`; 500ms `isConnected` watchdog wired into `startCanvasStream()` |
| `web/src/lib/camera/mjpeg.ts` | Chunk-list MJPEG parser, single TextDecoder | ✓ VERIFIED | `createMjpegParser`/`push` API present; header-search-then-fallback logic present (6b5878e fix) |
| `web/src/components/LivePreview.svelte` | Canvas for `TetheredAdapter`, video for others | ✓ VERIFIED | `{#if adapter instanceof TetheredAdapter}` branch renders `<canvas>`; else `<video>` |
| `web/src/components/DisconnectModal.svelte` | Optional `message` prop, default unchanged | ✓ VERIFIED | `message = 'Check the cable and try again.'` default; template renders `{message}` |
| `web/src/screens/CameraSelectScreen.svelte` | Boot picker, probe-driven DSLR tile status | ✓ VERIFIED | Probes on mount, `selectDSLR()`/`selectWebcam()` call `setCameraAdapter` + transition to `idle` |
| `.gitignore` | `captures/` excluded | ✓ VERIFIED | Both `captures/` and `captures/**/*.jpg` present |
| `.planning/phases/02-tethered-dslr-capture-gphoto2/02-UAT.md` | Hardware UAT record for SC #1–#4 | ✓ VERIFIED | 13/13 items recorded "pass (user-approved)" — see caveat above: several of these items exercised code later modified by the review-fix commits |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `web/src/App.svelte` | `web/src/screens/CameraSelectScreen.svelte` | `session.screen === 'camera_select'` first branch | ✓ WIRED | Confirmed in router |
| `web/src/screens/CameraSelectScreen.svelte` | `web/src/lib/camera/adapter.ts` | `setCameraAdapter(new TetheredAdapter()/new WebcamAdapter())` | ✓ WIRED | Confirmed |
| `web/src/components/LivePreview.svelte` | `web/src/lib/camera/TetheredAdapter.ts` | `adapter instanceof TetheredAdapter` branch | ✓ WIRED | Confirmed (deferred WR-09: this violates the "platform branching only in the adapter" project rule — logged, not fixed, user-accepted deferral) |
| `web/src/lib/camera/TetheredAdapter.ts` | `GET /api/camera/stream` | `fetch('/api/camera/stream?t=...')` in `startCanvasStream()` | ✓ WIRED | Confirmed |
| `server/src/routes/camera.ts` | `server/src/camera/CameraService.ts` | `cameraService.subscribe(...)`, `cameraService.capture(...)` | ✓ WIRED | Confirmed |
| `web/src/lib/camera/TetheredAdapter.ts` | `POST /api/camera/capture` | `fetch(..., { method: 'POST', signal })` in `capture()` | ✓ WIRED | Confirmed, with 15s AbortController timeout |
| `web/src/lib/camera/TetheredAdapter.ts` | `web/src/App.svelte` | `disconnectCallback` → `showDisconnect()` | ✓ WIRED | Confirmed via `onDisconnect(showDisconnect)` in `IdleScreen`/`App` |
| `web/src/App.svelte` | `web/src/components/DisconnectModal.svelte` | `message={disconnectMessage}` | ✓ WIRED | Confirmed |
| `web/src/screens/IdleScreen.svelte` | `server/src/camera/CameraService.ts` (idle close) | Canvas unmount → watchdog abort → `unsubscribe()` → `armIdleClose()` | ⚠️ PRESENT, NOT HARDWARE-VERIFIED | Chain is code-complete and unit-tested with fake timers on the client side only; see truth #8 |
| `web/vite.config.ts` (proxy) | `server/src/index.ts` (`127.0.0.1:3001` bind) | Vite dev proxy `/api → http://localhost:3001` | ⚠️ PRESENT, NOT HARDWARE-VERIFIED | CR-02 (commit e73480d) changed the bind address from `0.0.0.0` to `127.0.0.1`. `02-REVIEW-FIX.md` itself argues this is safe (Node happy-eyeballs falls back to `127.0.0.1`) but lists "the Vite proxy still reaches the server after the `127.0.0.1` bind" under its own "Hardware checks still needed." Not yet confirmed against a running dev server in this environment (dev server intentionally not started per task instructions). Routed to human item H-2. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `autoDetectFoundCamera()` requires a camera row (CR-01 fix) | `node --import tsx --test "src/**/*.test.ts"` (server) | Reported by orchestrator: 4/4 pass, including "returns false on the real `gphoto2 --auto-detect` output with no camera" | ✓ PASS |
| Detached-canvas watchdog + capture timeout (TetheredAdapter) | `npx vitest run src/lib/camera/TetheredAdapter.test.ts` — run directly by this verifier | 6 suites, 28 tests total (shared file with mjpeg below), 0 failed, 0 todo | ✓ PASS |
| MJPEG parser single-copy-per-frame | `npx vitest run src/lib/camera/mjpeg.test.ts` — run directly by this verifier (same invocation as above) | Included in the 28/28 pass result above | ✓ PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`) in phase-touched files | `grep -rn -E "TBD|FIXME|XXX" server/src/camera server/src/routes server/src/index.ts web/src/lib/camera web/src/screens web/src/components` | No matches | ✓ PASS |
| No active disabled tests (`it.skip`/`it.todo`/`describe.skip`) in phase-touched test files | `grep -rn -E "it\.skip\(|describe\.skip\(|it\.todo\(|xit\(|xdescribe\(" web/src/lib/camera web/src/screens web/src/components server/src` | No matches (one stale doc-comment mentions `it.todo(...)` as prose, IN-05, deferred, non-blocking) | ✓ PASS |
| `captures/` git-ignored | `grep -n captures .gitignore` | Two matching lines | ✓ PASS |
| Root housekeeping (WR/02-07 Task 3) — stray deps removed | `cat package.json` (root) | Only `concurrently` remains | ✓ PASS |
| Full gate suite (vitest, tsc, node:test) | Re-run by orchestrator prior to this verification | web vitest 85/85; server tsc clean; server `npm test` 4/4; web tsc same 25 pre-existing errors | ✓ PASS (accepted from orchestrator; the two files most relevant to this phase's new post-review-fix behavior were additionally re-run directly, above) |

Not run in this session (explicitly excluded by task instructions): any command touching real `gphoto2` hardware, and the dev server.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CAM-03 | 02-01, 02-02, 02-03, 02-04, 02-05, 02-07 | On Mac/Linux, camera preview uses gphoto2 MJPEG live view and capture triggers the actual DSLR shutter via gphoto2 subprocess | ✓ SATISFIED (by evidence, pending hardware re-check) | All truths above trace to this requirement; core mechanism (live preview + shutter trigger + JPEG return) is implemented, wired, and was hardware-approved once (02-UAT). **Note:** `.planning/REQUIREMENTS.md` line 14 still shows CAM-03 as `[ ]` (Pending) — this verifier does not edit REQUIREMENTS.md; flagging the discrepancy for the developer to update once the human-verification items below are closed. |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Phase 2 mapping table lists only CAM-03 against Phase 2, and it appears in every relevant plan's frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `web/src/lib/camera/TetheredAdapter.test.ts` | 8 | Stale doc-comment referencing "each `it.todo(...)` below MUST be" (no such calls remain) | ℹ️ Info | Cosmetic; already logged as IN-05 in `deferred-items.md`, user-accepted deferral |

No blocker or warning-level anti-patterns found in phase-touched files. All prior code-review findings not covered above (WR-05 through WR-11, IN-01 through IN-05) are explicitly deferred with recorded user approval in `deferred-items.md` — not reopened here (these are known, documented, user-accepted deviations, not silent gaps).

### Human Verification Required

1. **H-1 (highest priority — covers SC #4, truth #4, and truth #13):** Launch the app with a real DSLR attached and pick the DSLR tile. Confirm the live preview appears and **no** USB-conflict message shows (this is the WR-01 happy-path race the reviewer flagged: `init()`'s probe and the stream's first request go out at nearly the same moment). Then unplug the camera and reload/re-probe (`GET /api/camera/info` or re-select the picker). Confirm the DSLR tile shows "Not detected" and the response is `gphoto2Available: false` — not a stale "Connected".
   - **Why human:** `probe()`'s queued single-decision restructuring (WR-01) and the `autoDetectFoundCamera()` row-parsing fix (CR-01) both post-date the last hardware UAT of this exact path; the queue-ordering logic itself has no automated test.
2. **H-2:** With the server running on its new default bind (`HOST` unset → `127.0.0.1`), confirm the web app (via the Vite dev proxy) can still reach `/api/camera/info`, the MJPEG stream, and the capture endpoint.
   - **Expected:** No behavior change from before CR-02 — the proxy still works.
   - **Why human:** `02-REVIEW-FIX.md` itself lists this as an unverified hardware check; the dev server was not started during this verification per task instructions.
3. **H-3 (covers SC #3, truth #3):** Start a DSLR session, unplug mid-preview and mid-countdown, replug, tap Retry.
   - **Expected:** Disconnect modal appears within a few seconds; after replug + Retry, the shell reopens and the session resumes without restarting the app.
   - **Why human:** WR-02's shell-waiter-settlement and queued-stop fix postdates the last hardware UAT of this path; no automated test covers the queue/waiter state machine.
4. **H-4 (covers truth #8):** Leave the idle screen untouched for longer than `IDLE_PREVIEW_MS` (5 min) plus `SHELL_IDLE_MS` (10 min default) with a real DSLR attached, then tap to wake.
   - **Expected:** `pgrep -x gphoto2` shows no process after the combined idle window; tapping re-attaches the preview promptly with no extra Sony startup delay.
   - **Why human:** WR-03 is the first fix that lets the idle screen's own preview ever detach — the original 02-UAT "idle 15 min" item could not have exercised this per the reviewer's own finding.
5. **H-5 (low priority, covers truth #2):** Confirm a normal capture still fires the shutter and shows a JPEG within ~4s after WR-04's added 15s `AbortController` timeout and the flash-duration fix.
   - **Expected:** Capture completes normally; flash fades at ~300ms instead of persisting for the full capture duration.
   - **Why human:** Timing-sensitive UI behavior on physical hardware; only fake-timer tests exist.
6. **H-6 (low priority):** Confirm on the kiosk that a fast double-tap on the Keep button during a DSLR session still advances exactly one shot (CR-03 fix).
   - **Expected:** One shot advance per Keep sequence, regardless of extra taps during the toast or the 250ms screen-fade.
   - **Why human:** Touch-timing behavior; only fake-timer/synthetic-click tests exist.

### Gaps Summary

No gaps that block the phase goal outright — no artifact is missing or a stub, no key link is unwired, and no blocking anti-pattern was found. The reason this verification is `human_needed` rather than `passed` is timing: the 02-07 hardware UAT (13/13, user-approved 2026-09-26) was run against the code **before** the same-day code review (`02-REVIEW.md`, reviewed 07:06 UTC) found 3 critical + 11 warning issues, 7 of which were fixed the same day (`02-REVIEW-FIX.md`, commits 07:23–07:40 UTC). Those 7 fixes are well-reasoned, individually code-reviewed, and covered by new unit tests where the fix was unit-testable (CR-01, CR-03, WR-03, WR-04 — all confirmed passing, two of them re-run directly by this verifier) — but two of them (WR-01, WR-02) touch exactly the server-side state machine that `02-REVIEW`'s own WR-11 finding says has **zero automated test coverage**, and that state machine is the direct implementation of ROADMAP SC #3 and SC #4. CR-02 (server bind address) is a third change with no hardware confirmation, flagged by the fixer's own report. The fixes look correct on code reading, but "looks correct on reading" is not the same bar this phase already cleared once (a real hardware UAT) — and no hardware run has happened since. This is a request for a short, targeted hardware re-check (H-1 through H-4 in priority order), not a request to redo Phase 2.

---

_Verified: 2026-09-26T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
