---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 2
current_phase_name: tethered-dslr-capture-gphoto2
status: executing
stopped_at: "Completed 02-07-PLAN.md (UAT user-approved); next: code review + /gsd-verify-work 2"
last_updated: "2026-09-26T06:52:14.866Z"
last_activity: 2026-09-26
last_activity_desc: 02-07 complete (hardware UAT user-approved); Phase 2 awaiting code review + verification
state_head: 4a4b6e2b9c0a05c498b93c85020bb53bf8ff591e
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 10
  completed_plans: 10
milestone_name: milestone
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19)

**Core value:** Guests walk away with a custom photo strip they can instantly share via QR code, captured with a real camera.
**Current focus:** Phase 2 — tethered-dslr-capture-gphoto2

## Current Position

Phase: 2 (tethered-dslr-capture-gphoto2) — ALL PLANS DONE, NOT VERIFIED
Plan: 7 of 7 done — next: code review, then `/gsd-verify-work 2`
Status: 02-07 complete; hardware UAT user-approved 2026-09-26 (02-UAT.md)
Last activity: 2026-09-26 — 02-07 gap closure + hardware UAT (Sony ILCE-7M4, "2-07 approved")

Progress: [████████████████████] 7/7 plans (Phase 2 not verified yet — 02-UAT.md written, no 02-VERIFICATION.md)

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (complete) | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P07 | 1 session | 4 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Phases derived as vertical MVP slices, validating the camera adapter interface on getUserMedia (Phase 1) before gphoto2 (Phase 2) — the highest-risk integration sits in its own phase
- Roadmap: Templates (Phase 3) split from the canvas editor (Phase 4) per research guidance; Phase 3 ends at "confirmed template chosen for session"
- Phase 2 D-04: adapter.ts exports `let cameraAdapter` + `setCameraAdapter()` setter — ES module live binding pattern
- Phase 2 D-05: GET /api/camera/stream uses multipart/x-mixed-replace with SOI/EOI byte scanning (not raw pipe)
- Phase 2: p-queue concurrency 1 in CameraService — stream and capture are mutually exclusive on USB
- Phase 2 Wave 2: FPS spike required before implementing stream handler — measured FPS determines movie vs preview-poll strategy
- Phase 2 Wave 2: Decided on option-poll stream strategy for live preview due to lag constraints (2s lag on Sony camera). **SUPERSEDED by 02-06.**
- Phase 2 02-06 (2026-09-23): the stream strategy is now one persistent `gphoto2 --shell` session for preview and capture (~25fps; shutter ~0.65s after countdown). Reasons:
  - Spawning a process per frame capped the preview at ~3fps.
  - libgphoto2 forces a 3s wait from session start before any capture on the ILCE-7M4.
- Phase 2 02-06: the preview renders to `<canvas>` (fetch + createImageBitmap + close). An `<img>` MJPEG stream used 1.6–1.9 GB in Firefox; the canvas stays at ~300 MB. `attachPreview` accepts `HTMLCanvasElement` (additive widening).
- Phase 2 02-06: the server forces `capturemode=Single Shot` per session. The body dial is ignored in PC Remote mode.
- Phase 2 02-06: the shell stays open after the preview stops. 02-07 adds an idle close; this is safe because the countdown keeps the session more than 3s old before the shutter.
- Phase 2 02-06: `STREAM_MODE=poll` env keeps the legacy per-process path.
- Phase 2 02-07: probe() checks a live shell (pending capture / frame <2s / queued get-config capturemode) before trusting it; the shell closes after SHELL_IDLE_MS (default 10 min, not in poll mode)

### Pending Todos

- ~~Execute Phase 2 Wave 1 (02-01-PLAN.md): Camera picker foundation~~
- ~~After Wave 1: run FPS spike (02-02-PLAN.md) with physical DSLR connected~~
- ~~After FPS decision: implement DSLR preview (02-03-PLAN.md)~~
- ~~After preview: implement DSLR capture (02-04-PLAN.md)~~
- ~~Execute error recovery (02-05-PLAN.md)~~
- ~~Camera pipeline rework (02-06, hotfix)~~
- ~~Commit the 02-06 changes~~ — committed (9894466, fe5f4f2)
- ~~Execute 02-07-PLAN.md: gap closure plus hardware UAT (unplug, idle, gvfs relaunch)~~ — done 2026-09-26
- Code review of the 02-07 changes, then `/gsd-verify-work 2` and close Phase 2

### Blockers/Concerns

Empirical gaps flagged by research to validate during execution:

- ~~gphoto2 MJPEG live-view FPS on the target camera body~~ — resolved: ~25fps via persistent shell (02-06)
- ~~gphoto2 USB device claim conflict (`-53` from gvfs/PTPCamera) at startup: not yet re-verified with the shell design~~ — user-approved in 02-UAT.md item 5 (2026-09-26)
- ~~Mid-session unplug and long idle with the persistent shell: not verified on hardware~~ — user-approved in 02-UAT.md items B1, 3, 4, 6 (2026-09-26)
- Post-shutter download is ~3s for the 8.5 MB full-size JPEG. A smaller body JPEG size would cut it (deferred; Phase 4 decides the strip resolution)
- 0x0.st upload field name, CORS behavior, rate-limits (Phase 5 day 1)
- gifenc quality on real event-photo content (Phase 5)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-26T06:51:23.843Z
Stopped at: Completed 02-07-PLAN.md (UAT user-approved); next: code review + /gsd-verify-work 2
Resume file: None
