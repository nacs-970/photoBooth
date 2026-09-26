---
phase: 02-tethered-dslr-capture-gphoto2
plan: 07
subsystem: camera
tags: [gphoto2, sony, probe, idle-close, mjpeg, watchdog, gap-closure, uat]
status: complete

# Dependency graph
requires:
  - phase: 02-tethered-dslr-capture-gphoto2
    provides: [persistent gphoto2 --shell CameraService (02-06), canvas MJPEG preview (02-06)]
provides:
  - probe() that checks a live shell instead of trusting that a shell exists
  - Idle close of the gphoto2 shell after SHELL_IDLE_MS
  - pendingCaptures counter (overlapping captures never let a preview run between them)
  - Detached-canvas watchdog in TetheredAdapter
  - Chunk-list MJPEG parser with one copy per frame
  - Phase 2 hardware UAT record (02-UAT.md)
affects: [camera-info, camera-preview, camera-capture, phase-2-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "probe(): pending capture → recent frame (2s) → queued `get-config capturemode` (3s) → stopShell + await exit → --auto-detect fallback"
    - "Idle timer: unref'd setTimeout, re-checked inside the queue before stopShell()"
    - "Canvas watchdog: 500ms setInterval on canvas.isConnected, cleared via the abort-signal listener"

key-files:
  created:
    - .planning/phases/02-tethered-dslr-capture-gphoto2/deferred-items.md
    - .planning/phases/02-tethered-dslr-capture-gphoto2/02-UAT.md
  modified:
    - server/src/camera/CameraService.ts
    - web/src/lib/camera/TetheredAdapter.ts
    - web/src/lib/camera/TetheredAdapter.test.ts
    - web/src/lib/camera/mjpeg.ts
    - web/src/lib/camera/mjpeg.test.ts
    - package.json
    - package-lock.json
  deleted:
    - .planning/phases/01-foundation-webcam-session-loop/.continue-here.md

key-decisions:
  - "probe() short-circuits to available while a capture is pending, in both shell and STREAM_MODE=poll modes"
  - "Idle close: SHELL_IDLE_MS env (default 600000); never armed in poll mode"
  - "Known limit kept: stopShell() waits at most 5s for exit and never sends SIGKILL (02-06 rule)"

requirements-completed: [CAM-03]

# Metrics
duration: 1 session (task commits 12:22–12:29 +07:00, UAT approved same day)
completed: 2026-09-26
commits: 5
plan_head_before: fe5f4f2
---

# Phase 02 Plan 07: Gap Closure + Hardware UAT Summary

**The probe now checks a live gphoto2 shell. The shell closes after SHELL_IDLE_MS idle. A capture counter replaces the `capturing` boolean. A 500ms watchdog closes the canvas stream when the canvas leaves the DOM. The MJPEG parser does one copy per frame. The user approved the Phase 2 hardware UAT on a Sony ILCE-7M4 ("2-07 approved", 2026-09-26).**

## Commits

| Task | Commit | Files |
|---|---|---|
| 1. Server: honest probe, idle shell close, capture counter | e23a70b `fix(02-07)` | server/src/camera/CameraService.ts |
| 2. RED tests | 1e41055 `test(02-07)` | web/src/lib/camera/TetheredAdapter.test.ts, web/src/lib/camera/mjpeg.test.ts |
| 2. GREEN: canvas watchdog + single-copy parser | aa65036 `feat(02-07)` | web/src/lib/camera/TetheredAdapter.ts, web/src/lib/camera/mjpeg.ts, TetheredAdapter.test.ts |
| 2. Review fix: headers > 1 KB fall back to a full search | 6b5878e `fix(02-07)` | web/src/lib/camera/mjpeg.ts, web/src/lib/camera/mjpeg.test.ts |
| 3. Housekeeping | 394b6f5 `chore(02-07)` | package.json, package-lock.json, deleted phases/01-.../.continue-here.md, new deferred-items.md |
| 4. Hardware UAT (checkpoint) | — (this docs commit) | 02-UAT.md |

**Commit count note:** 5 plan commits. `git rev-list --count fe5f4f2..HEAD` gives 6 at the time of writing, because the range also contains the unrelated commit 4d79f1e (`docs(research)`, desktop packaging notes). That commit is not part of this plan.

## Accomplishments

### Task 1: Server (`CameraService.ts`)

- **probe()** checks in this order:
  1. A capture is pending: return available. No camera command is sent.
  2. A frame was broadcast in the last 2s: return available.
  3. Otherwise, inside the queue, send `get-config capturemode` through shellExec. The 3s timeout starts inside the queue task.
  4. On failure: stopShell(), await the exit (at most 5s), then run the unchanged `--auto-detect` fallback. The USB_CONFLICT detection is unchanged.
- **Idle close:**
  - SHELL_IDLE_MS comes from env (default 600000). The timer is unref'd.
  - When the timer fires, it re-checks inside the queue before it calls stopShell().
  - It is armed when the last subscriber leaves, and at the end of a capture when there are no subscribers. subscribe() and capture() cancel it.
  - It is never armed in STREAM_MODE=poll.
- **`pendingCaptures` counter** replaces the `capturing` boolean. Preview resumes only when the count is 0. `isCapturing` returns `pendingCaptures > 0`.
- **Shell start cleanup:** leftover `tmpfile*` and `capt_*` files in SHELL_DIR are deleted before a shell is spawned.

### Task 2: Web

- **TetheredAdapter watchdog:**
  - A 500ms interval checks `canvas.isConnected` and aborts the stream when the canvas is detached.
  - It is cleared through the abort-signal listener, so every abort route clears it (dispose, re-attach, detach). It is also cleared in the stream-failure `.catch` path.
  - The existing per-frame check stays.
- **MJPEG parser (`mjpeg.ts`):**
  - A list of pending chunks with a running byte count. There is one concatenation per complete frame.
  - The header search looks at the first 1 KB. If the header terminator is not there, it falls back to a search of all pending bytes (6b5878e).
  - There is one TextDecoder per parser instance.
  - The `createMjpegParser(onFrame)` / `push(chunk)` API is unchanged.

### Task 3: Housekeeping

- Removed `p-queue` and `@fastify/multipart` from the root `package.json`. Nothing at the root imports them, and `server/package.json` keeps `p-queue`. The root now has only `concurrently`.
- Deleted the stale Phase 1 `.continue-here.md`.
- Created `deferred-items.md`.

### Task 4: Hardware UAT

- `02-UAT.md` records 13 items (0, A1–A4, B1, and plan items 1–7). All are "pass (user-approved)", mapped to ROADMAP SC #1–#4.
- The user gave one overall approval and reported no per-item measurements. The fps, lag and MB values in 02-UAT.md are plan targets, not measurements.

## Must-have truths: how each was verified

| Truth | Evidence |
|---|---|
| /api/camera/info never reports available for a camera unplugged while idle | UAT B1 (user-approved) |
| Shell closes after SHELL_IDLE_MS; next preview reopens it | UAT A2, A3, 6 (user-approved) |
| First capture after an idle close skips the Sony 3s wait | UAT A4, 6 (user-approved) |
| Overlapping captures never let a preview run between them | UAT A1 (user-approved) |
| Leaving the countdown closes the canvas stream within ~500ms | Unit tests with fake timers (TetheredAdapter.test.ts). Not measured on hardware |
| Parser does one copy per frame | Unit tests: 200 KB body in 16 KB chunks yields one identical frame, and a counting TextDecoder shows one decoder per parser (mjpeg.test.ts). Not measured on hardware |
| Phase 2 SC #1–#4 pass on hardware and are recorded in 02-UAT.md | 02-UAT.md (user-approved 2026-09-26) |

## Verification

Gates (re-run by the orchestrator):
- Web vitest: 78/78 pass (was 71).
- Server `tsc --noEmit`: clean.
- Web `tsc`: the same 25 errors as before 02-07. None are new (see deferred-items.md).

## TDD Gate Compliance (Task 2)

- **RED (1e41055):** 4 target tests failed on their assertions before the implementation.
- **GREEN (aa65036, 6b5878e):** all web tests pass.
- **Checker limit:** `gsd_run check tdd-red-evidence` returned `INVALID_RED / zero_tests_discovered`. The Vitest TAP output has no summary lines, so the checker found no tests. This is a limit of the checker format. The output was not edited to make the check pass.

## Deviations from Plan

1. **Orchestrator spec additions to probe() were applied:** short-circuit while a capture is pending, the timeout starts inside the queue, the shell exit is awaited before the fallback, and `.unref()` on the idle timer.
2. **probe() also short-circuits during a pending capture in STREAM_MODE=poll.**
3. **Commits went to master**, as the orchestrator instructed.
4. **Test technique:** the TextDecoder test uses a counting subclass through `vi.stubGlobal`.
5. **[Rule 1] Review fix (6b5878e):** the agy/Gemini first-pass review found that a part header over 1 KB would stall the parser. Fixed with a fallback to a full search. The other findings were either rejected (the old parser behaves the same) or accepted as known limits: the 5s exit wait, and no SIGKILL.
6. **Typing:** one non-null assertion was added in a test.
7. **Out of scope, logged in deferred-items.md:**
   - the critical `shell-quote` advisory through `concurrently 9.2.1` (dev-only)
   - the 25 web `tsc` errors from before 02-07

## Deferred (unchanged from the plan)

- **JPEG size:** the ~3s download after the shutter comes from the 8.5 MB full-size JPEG. This is a host decision.
- **Browser-side downscale** of each shot for review, grid and strip. Revisit in Phase 4.

## Next

Code review, then `/gsd-verify-work 2`, then close Phase 2.

---
*Phase: 02-tethered-dslr-capture-gphoto2*
*Completed: 2026-09-26*

## Self-Check: PASSED

- All 8 key files exist. The stale Phase 1 `.continue-here.md` is gone.
- Commits e23a70b, 1e41055, aa65036, 6b5878e and 394b6f5 exist in `git log --all`.
- The root `package.json` no longer lists `p-queue` or `@fastify/multipart`.
