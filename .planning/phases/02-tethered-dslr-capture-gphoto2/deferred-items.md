# Phase 02 — Deferred Items

Out-of-scope findings logged during execution. Not fixed.

| Found in | Item | Notes |
|---|---|---|
| 02-07 Task 3 | `npm audit` at the repo root reports 2 critical issues in `shell-quote <=1.8.4`, a dependency of `concurrently 9.2.1` (dev-only, runs `npm run dev`) | The fix is `concurrently@9.2.4`, outside the pinned version. This was there before 02-07. It is a dev tool only and never runs in the kiosk request path. |
| 02-07 Task 2 | `web` `tsc --noEmit` shows 25 errors that were there before 02-07 (TS5097 `.ts` import extensions, missing node types in 2 tests, `app.css` side-effect import) | 02-07 added no new errors. The project has no svelte-check configured. |

## Deferred from 02-REVIEW

- WR-05: webcam preview attached before `init()` resolves, so the first Idle mount may stay black (needs a browser check) — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-06: each return to idle re-runs `init()` without `dispose()`, so MediaStreams and devicechange listeners pile up — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-07: no guard against a double tap on a camera tile or on Retry (second adapter / leaked getUserMedia stream) — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-08: no way back to the camera picker from the disconnect modal, so an absent DSLR traps the kiosk — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-09: LivePreview branches on `instanceof TetheredAdapter`, breaking the "platform branching only in the adapter" rule — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-10: capture directory `path.resolve('../captures')` depends on the process working directory — deferred from 02-REVIEW (user choice 2026-09-26)
- WR-11: CameraService shell/queue state machine has no automated tests (needs injectable spawn/execFile) — deferred from 02-REVIEW (user choice 2026-09-26)
- IN-01: a RAW-only camera setting saves a RAW file as `N.jpg` and serves it as image/jpeg — deferred from 02-REVIEW (user choice 2026-09-26)
- IN-02: boot probe duplicated (App + CameraSelectScreen), `session.cameraInfo` unused, `CameraInfo` lacks `usbConflict` — deferred from 02-REVIEW (user choice 2026-09-26)
- IN-03: a 503 from the stream during a capture is shown as a disconnect instead of a retry — deferred from 02-REVIEW (user choice 2026-09-26)
- IN-04: route hygiene (no `reply.hijack()`, `request.raw` close, missing-body TypeError, gphoto2 output leaked in 500) — deferred from 02-REVIEW (user choice 2026-09-26)
- IN-05: stale scaffold comments in TetheredAdapter tests / CameraAdapter docs and a leaked `Date.now` spy — deferred from 02-REVIEW (user choice 2026-09-26)
