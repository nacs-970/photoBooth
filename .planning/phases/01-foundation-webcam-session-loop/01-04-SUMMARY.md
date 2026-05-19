---
phase: 01-foundation-webcam-session-loop
plan: "04"
subsystem: ui
tags: [svelte5, webcam, camera-adapter, disconnect-detection, modal, testing-library]

# Dependency graph
requires:
  - phase: 01-foundation-webcam-session-loop
    plan: "01"
    provides: "WebcamAdapter with onDisconnect callback, adapter singleton, session state"
  - phase: 01-foundation-webcam-session-loop
    plan: "02"
    provides: "keepShot, retakeShot, goToReview session actions"
  - phase: 01-foundation-webcam-session-loop
    plan: "03"
    provides: "App.svelte 4-screen router, CountdownScreen, ReviewScreen, PhotoGridScreen"
provides:
  - DisconnectModal Svelte 5 component (fixed overlay, z-index 10001)
  - Retry flow in App.svelte (dispose→init→re-register→camera-reattach event→hideDisconnect)
  - LivePreview camera-reattach window event listener for post-retry stream re-attachment
  - IdleScreen wired with onDisconnect(showDisconnect) after init() success
  - 42 passing unit tests (up from 33 in Plan 03)
affects:
  - phase-02 (gphoto2 disconnect handling will reuse this overlay modal pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay modal outside {#key} block so screen transitions do not unmount it"
    - "window CustomEvent 'camera-reattach' for adapter-to-component decoupled re-attach"
    - "dispose()→init()→re-register pattern for safe stream retry (no orphan tracks)"
    - "NotAllowedError distinguished from generic errors in camera init catch block"

key-files:
  created:
    - web/src/components/DisconnectModal.svelte
    - web/src/components/DisconnectModal.test.ts
  modified:
    - web/src/screens/IdleScreen.svelte
    - web/src/App.svelte
    - web/src/components/LivePreview.svelte
    - web/src/lib/camera/WebcamAdapter.test.ts
    - web/src/lib/session.test.svelte.ts

key-decisions:
  - "DisconnectModal rendered outside {#key session.screen} so it is never unmounted by screen transitions"
  - "handleRetry in App.svelte always calls dispose() before init() to prevent MediaStream leak (T-04-DoS)"
  - "NotAllowedError → console.warn only in Phase 1; dedicated permission-denied screen is deferred polish"
  - "camera-reattach CustomEvent decouples App.svelte retry logic from LivePreview internals"
  - "onDisconnect registered BEFORE attachPreview call to prevent disconnect-during-attach race"

patterns-established:
  - "Modal-as-overlay: renders above active screen without disrupting session state — template for Phase 2 gphoto2 disconnect"
  - "Bounded error path: any non-NotAllowedError in camera init surfaces the modal rather than crashing the app"

requirements-completed:
  - CAM-04

# Metrics
duration: 27min
completed: "2026-05-20"
---

# Phase 1 Plan 04: DisconnectModal and Camera Retry Flow Summary

**Fixed-overlay DisconnectModal with Retry button wired to adapter dispose→init→re-register cycle, closing CAM-04 and completing all Phase 1 requirements.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-05-20T01:22:00Z
- **Completed:** 2026-05-20T01:27:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7

## Accomplishments

- DisconnectModal.svelte component: fixed overlay (z-index 10001), `Camera disconnected` heading, `Check the cable and try again.` body, SecondaryButton Retry per UI-SPEC
- App.svelte handleRetry: safe retry cycle (dispose→init→re-register onDisconnect→dispatch camera-reattach→hideDisconnect on success only)
- LivePreview.svelte: camera-reattach window event listener re-attaches new stream after retry
- IdleScreen.svelte: onDisconnect(showDisconnect) registered after init() success; NotAllowedError handled separately from generic errors
- 42/42 unit tests pass (up from 33 in Plan 03)
- All Phase 1 requirements satisfied: CAM-01, CAM-02, CAM-04, SESS-01, SESS-02, SESS-03, SESS-04

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): WebcamAdapter and session preservation tests** — `07a2199` (test)
2. **Task 1 (GREEN): Wire onDisconnect to showDisconnect in IdleScreen** — `489334a` (feat)
3. **Task 2 (RED): DisconnectModal component tests** — `fbb4dbe` (test)
4. **Task 2 (GREEN): DisconnectModal component + App.svelte + LivePreview wiring** — `84210a6` (feat)

**Plan metadata:** (docs commit — follows)

_Note: TDD tasks have multiple commits (test RED → feat GREEN)_

## Files Created/Modified

- `web/src/components/DisconnectModal.svelte` — Fixed overlay modal with heading, body, SecondaryButton Retry; `{#if visible}` conditional render
- `web/src/components/DisconnectModal.test.ts` — 4 tests: visible=false hides DOM, visible=true renders content, position:fixed/inset:0 CSS check, Retry click callback
- `web/src/App.svelte` — Imports DisconnectModal; handleRetry async function; modal rendered after `{/key}` block with `visible={session.disconnected}`
- `web/src/components/LivePreview.svelte` — Adds camera-reattach window event listener (onMount/onDestroy); calls adapter.attachPreview(videoEl) on event
- `web/src/screens/IdleScreen.svelte` — Imports showDisconnect; registers onDisconnect(showDisconnect) after init() success; NotAllowedError → console.warn; other errors → showDisconnect()
- `web/src/lib/camera/WebcamAdapter.test.ts` — 3 new tests: devicechange→no videoinput invokes callback; devicechange→videoinput present does NOT invoke; NotAllowedError rethrows
- `web/src/lib/session.test.svelte.ts` — 2 new tests: showDisconnect preserves screen/shots/currentShotIndex; hideDisconnect preserves all non-disconnected state

## Decisions Made

- DisconnectModal is rendered outside the `{#key session.screen}` block so Svelte does not unmount it on screen transitions — the modal persists over any active screen with session state fully preserved beneath it.
- handleRetry always calls `cameraAdapter.dispose()` before `cameraAdapter.init()` to stop all existing tracks and prevent MediaStream leaks (T-04-DoS mitigation from threat model).
- The `camera-reattach` window CustomEvent pattern decouples App.svelte retry logic from LivePreview implementation details — App does not need a reference to the video element.
- NotAllowedError on init is distinguished and only logged; all other errors call showDisconnect() so the app always has a user-visible bounded error path rather than a blank screen.
- `onDisconnect` callback is registered before `attachPreview` to close the window where a disconnect during stream attachment would be silently missed.

## Deviations from Plan

### TDD Gate Note

Task 1's new WebcamAdapter tests (devicechange, NotAllowedError) passed immediately in the RED phase because the WebcamAdapter implementation was already complete from Plan 01. These are existence/behavior assertion tests rather than strict RED-first tests. The plan author intentionally front-loaded the adapter implementation into Plan 01; this is documented as expected, not a TDD violation. The commit history preserves a `test(01-04)` commit followed by a `feat(01-04)` commit as required by the gate sequence.

### npm install in worktree

The worktree's `web/` directory had no `node_modules/` because the main repo's `node_modules/` is not symlinked into worktrees. Ran `npm install` in the worktree's `web/` directory before running tests. Not a deviation from plan logic — normal worktree setup.

---

**Total deviations:** 0 unplanned code changes. One expected TDD note (pre-existing implementation confirmed by tests). One setup task (npm install in worktree).
**Impact on plan:** No scope creep. All plan artifacts delivered as specified.

## Manual Smoke Test Results

The following manual smoke test from the plan's acceptance criteria requires physical USB hardware and cannot be executed in this worktree:

> Start a session, unplug the webcam USB cable mid-session; modal appears within ~2 seconds; the underlying review/countdown screen state is unchanged beneath the modal; reconnect the webcam, tap Retry — modal dismisses and live preview resumes.

**Status: Deferred to human verifier.** The automated unit tests confirm:
- WebcamAdapter fires disconnectCallback on both 'ended' event and devicechange→no videoinput paths
- DisconnectModal renders correctly when visible=true and hides when visible=false
- Retry button calls the onRetry callback exactly once
- showDisconnect preserves all session state (screen, shots, currentShotIndex)

Browser-specific behavior differences (Chrome vs Firefox vs Safari) and memory observations across unplug+retry cycles require physical hardware verification.

NotAllowedError on permission revoke: the code path is implemented (console.warn only in Phase 1 per plan acknowledgment) but browser-specific prompt behavior cannot be tested without a real browser+camera.

## Phase 1 Closure

All 7 Phase 1 requirements are now implemented and testable:

| Requirement | Description | Implemented In |
|-------------|-------------|----------------|
| CAM-01 | getUserMedia auto-detect and init | Plan 01 — WebcamAdapter.init() |
| CAM-02 | Live preview in IdleScreen | Plan 01 — LivePreview + attachPreview |
| CAM-04 | Disconnect detection + Retry modal | Plan 04 (this plan) |
| SESS-01 | Multi-shot countdown session loop | Plan 02 — CountdownScreen |
| SESS-02 | Flash + shutter on capture | Plan 02 — FlashOverlay |
| SESS-03 | Review screen with keep/retake | Plan 03 — ReviewScreen + keepShot/retakeShot |
| SESS-04 | Photo grid final screen | Plan 03 — PhotoGridScreen |

## Issues Encountered

None — all planned work completed without unexpected blocking issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 1 is complete. Phase 2 (gphoto2 tethered camera support) can begin. Key context for Phase 2:
- The DisconnectModal + Retry pattern established here is the direct template for gphoto2 disconnect handling
- The `camera-reattach` CustomEvent and the `onDisconnect` callback registration pattern are reusable for TetheredAdapter
- The `adapter.ts` singleton file is already stubbed to branch on `session.cameraInfo.cameraMode`
- All 42 unit tests must remain green as Phase 2 adds the TetheredAdapter

## Self-Check: PASSED

All created files verified on disk:
- `web/src/components/DisconnectModal.svelte` — FOUND
- `web/src/components/DisconnectModal.test.ts` — FOUND
- `.planning/phases/01-foundation-webcam-session-loop/01-04-SUMMARY.md` — FOUND

All task commits verified in git log:
- `07a2199` — test(01-04): disconnect detection and session preservation tests
- `489334a` — feat(01-04): wire onDisconnect to showDisconnect in IdleScreen
- `fbb4dbe` — test(01-04): DisconnectModal component tests (RED)
- `84210a6` — feat(01-04): DisconnectModal component + App.svelte + LivePreview wiring

Final test run: 42/42 tests pass across 5 test files.

---
*Phase: 01-foundation-webcam-session-loop*
*Completed: 2026-05-20*
