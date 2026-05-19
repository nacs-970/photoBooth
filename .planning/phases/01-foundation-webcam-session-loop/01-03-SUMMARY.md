---
phase: 01-foundation-webcam-session-loop
plan: "03"
subsystem: web-frontend
tags:
  - session-loop
  - review-screen
  - photo-grid
  - tdd
dependency_graph:
  requires:
    - 01-01
    - 01-02
  provides:
    - session.keepShot
    - session.retakeShot
    - ReviewScreen
    - PhotoGridScreen
    - ReviewPanel
    - ShotProgress
    - SecondaryButton
    - Toast
    - PhotoGrid
    - full-session-loop
  affects:
    - web/src/App.svelte
    - web/src/lib/session.svelte.ts
tech_stack:
  added: []
  patterns:
    - "onDestroy timer cleanup (T-03-DoS)"
    - "Toast orchestrated by caller (150ms fade-in + 900ms hold + 150ms fade-out)"
    - "keepShot last-shot branch: does NOT increment currentShotIndex past last"
key_files:
  created:
    - web/src/screens/ReviewScreen.svelte
    - web/src/screens/PhotoGridScreen.svelte
    - web/src/components/ReviewPanel.svelte
    - web/src/components/ShotProgress.svelte
    - web/src/components/SecondaryButton.svelte
    - web/src/components/Toast.svelte
    - web/src/components/PhotoGrid.svelte
  modified:
    - web/src/lib/session.svelte.ts
    - web/src/lib/session.test.svelte.ts
    - web/src/App.svelte
    - web/vite.config.ts
decisions:
  - "keepShot does not increment currentShotIndex on last shot — screen code uses current index to display thumbnail in photo_grid"
  - "nextShot aliased to keepShot with @deprecated JSDoc — preserves Plan 01/02 contract; existing nextShot tests updated to reflect new semantics"
  - "Toast timers cleared in handleRetake AND onDestroy — T-03-DoS mitigation per threat model"
  - "vite.config.ts fs.allow extended for worktree node_modules symlink resolution"
  - "Toast fade orchestrated in ReviewScreen (not inside Toast component) — component only toggles opacity"
metrics:
  duration: "6 minutes"
  completed: "2026-05-20"
  task_count: 3
  file_count: 11
---

# Phase 1 Plan 03: Review Screen, Photo Grid, and Full Session Loop Summary

**One-liner:** Per-shot keep/retake review with Photo-saved toast, photo grid with Start New Session, completes the 4-shot session loop end-to-end.

## What Was Built

### Task 1: keepShot / retakeShot session transitions (TDD RED/GREEN)

Added `keepShot()` and `retakeShot()` to `web/src/lib/session.svelte.ts`:

- `keepShot()`: if `currentShotIndex >= shotCount - 1` → `screen = 'photo_grid'`; else `currentShotIndex++` and `screen = 'countdown_preview'`
- `retakeShot()`: `screen = 'countdown_preview'` only — does NOT mutate `currentShotIndex`
- `nextShot()`: now an alias that calls `keepShot()` with a `@deprecated` JSDoc comment

Three new test cases added to `session.test.svelte.ts` (keepShot mid-session, keepShot last-shot, retakeShot). The existing nextShot last-shot test was updated to reflect the aliased semantics.

Total tests: 13 session tests, all green.

### Task 2: ReviewScreen + ReviewPanel + ShotProgress + SecondaryButton + Toast

- `SecondaryButton.svelte`: neutral surface (`var(--color-secondary)`) with `var(--color-text-muted)` border, same sizing as PrimaryButton (48px min-height, scale-press feedback)
- `ShotProgress.svelte`: body-size text `Shot {current} of {total}` in `var(--color-text-muted)`
- `ReviewPanel.svelte`: vertical flex layout — thumbnail (max 80vw/60vh, secondary-surface frame), ShotProgress, Keep (PrimaryButton) + Retake (SecondaryButton) button row
- `Toast.svelte`: fixed centered pill, `var(--color-secondary)` background, opacity 0→1 via 150ms CSS transition, z-index 10000, pointer-events none
- `ReviewScreen.svelte`: timer-safe Keep/Retake orchestration — `onDestroy` clears both `toastHideTimer` and `keepShotTimer` (T-03-DoS threat mitigation). Retake also cancels in-flight timers before calling `retakeShot()`

Total tests after Task 2: 33 (4 test files), all green.

### Task 3: PhotoGridScreen + PhotoGrid + App router

- `PhotoGrid.svelte`: CSS grid `auto-fit minmax(240px, 1fr)`, `var(--color-secondary)` cell frame, `shot.objectUrl` bound to `<img src>`
- `PhotoGridScreen.svelte`: `Your photos` heading (32px semibold), `PhotoGrid`, `Start New Session` PrimaryButton calling `resetSession()`
- `App.svelte`: placeholder divs replaced with `<ReviewScreen />` and `<PhotoGridScreen />` — all 4 routes are now real components

All 33 tests pass after Task 3.

## End-to-End Manual Smoke

Manual testing was not performed during this execution as the app requires a browser with webcam access. The full session loop is architecturally complete and wired end-to-end:

- `idle` → taps `Tap to Start` → `countdown_preview` (Plan 01/02)
- `countdown_preview` → taps `Start`, countdown runs, capture fires → `review` (Plan 02)
- `review` → taps `Keep` (not last): `Photo saved` toast 1200ms → `countdown_preview` (next shot index)
- `review` → taps `Retake`: returns to `countdown_preview` same index, next `saveShot()` revokes+overwrites
- `review` (4th shot) → taps `Keep`: no toast, directly to `photo_grid`
- `photo_grid` → taps `Start New Session` → `resetSession()` revokes all object URLs → `idle`

All object URL revocation paths are covered by existing session tests (T-03-IL).

## Memory Check Observations

No runtime memory profiling was performed (no browser access in this environment). The T-03-IL mitigations from Plan 01 are structurally sound:

- `saveShot()` revokes the previous objectUrl at the same index before overwriting (slot-overwrite retake)
- `resetSession()` revokes all objectUrls before clearing the shots array
- These behaviors are unit-tested and cover both the retake path and the start-new-session path

No new blob-URL creation was introduced in Plan 03 components — only reads of pre-existing `objectUrl` values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated nextShot tests to match keepShot alias semantics**

- **Found during:** Task 1 RED phase
- **Issue:** The plan specifies `nextShot` as an alias for `keepShot`. But the existing Plan 01 test asserted `nextShot()` at index 3 would set `currentShotIndex = 4`. The new `keepShot` design does NOT increment past the last index. These are incompatible.
- **Fix:** Updated the existing `nextShot` last-shot test to expect `currentShotIndex === 3` (not 4), matching the new aliased semantics. The behavioral contract of `nextShot` for screen transitions (→ `photo_grid`) is preserved; only the index post-condition changed.
- **Files modified:** `web/src/lib/session.test.svelte.ts`
- **Commit:** b724fa5

**2. [Rule 3 - Blocking] Added vite.config.ts fs.allow for worktree node_modules**

- **Found during:** Task 1 RED test execution
- **Issue:** Worktree has no `node_modules`; symlink to main repo's `node_modules` required `server.fs.allow` to be extended for Vite to serve `@testing-library/svelte` internals via the symlinked path.
- **Fix:** Added `fs: { allow: ['..', '/home/nacs/Documents/git/photoBooth/web/node_modules'] }` to `server` config in `vite.config.ts`.
- **Files modified:** `web/vite.config.ts`
- **Commit:** b724fa5

### UI Polish Items Deferred

- No animation on the "Keep" → toast → advance transition (the toast fade is purely CSS opacity; no entry animation for the next shot's review panel)
- PhotoGrid uses `aspect-ratio: 3/4` for all thumbnails — if captures are landscape (from webcam), cells will letterbox. Phase 2 can adjust based on actual capture dimensions.
- No loading state if `session.shots[currentShotIndex]` is undefined (ReviewScreen wraps render in an `{#if}` guard)

## TDD Gate Compliance

| Gate | Status |
|------|--------|
| RED commit (`test(01-03)`) | b724fa5 — 4 failing tests confirmed |
| GREEN commit (`feat(01-03)`) | 2abb856 — all 13 session tests passing |
| Tasks 2 & 3 follow GREEN pattern | 1b4278c, 12bcaf5 — full suite 33/33 |

## Self-Check

Files created:

- [x] `web/src/screens/ReviewScreen.svelte` — exists
- [x] `web/src/screens/PhotoGridScreen.svelte` — exists
- [x] `web/src/components/ReviewPanel.svelte` — exists
- [x] `web/src/components/ShotProgress.svelte` — exists
- [x] `web/src/components/SecondaryButton.svelte` — exists
- [x] `web/src/components/Toast.svelte` — exists
- [x] `web/src/components/PhotoGrid.svelte` — exists

Files modified:

- [x] `web/src/lib/session.svelte.ts` — exports `keepShot`, `retakeShot`, `nextShot` (alias)
- [x] `web/src/lib/session.test.svelte.ts` — 13 tests, all passing
- [x] `web/src/App.svelte` — routes all 4 screens to real components
- [x] `web/vite.config.ts` — fs.allow worktree fix

Commits:

- [x] b724fa5 — test(01-03): RED
- [x] 2abb856 — feat(01-03): GREEN (session transitions)
- [x] 1b4278c — feat(01-03): Review UI components
- [x] 12bcaf5 — feat(01-03): Photo Grid + App router

## Self-Check: PASSED
