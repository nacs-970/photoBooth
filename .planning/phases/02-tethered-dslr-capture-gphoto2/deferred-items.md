# Phase 02 — Deferred Items

Out-of-scope findings logged during execution. Not fixed.

| Found in | Item | Notes |
|---|---|---|
| 02-07 Task 3 | `npm audit` at the repo root reports 2 critical issues in `shell-quote <=1.8.4`, a dependency of `concurrently 9.2.1` (dev-only, runs `npm run dev`) | The fix is `concurrently@9.2.4`, outside the pinned version. This was there before 02-07. It is a dev tool only and never runs in the kiosk request path. |
| 02-07 Task 2 | `web` `tsc --noEmit` shows 25 errors that were there before 02-07 (TS5097 `.ts` import extensions, missing node types in 2 tests, `app.css` side-effect import) | 02-07 added no new errors. The project has no svelte-check configured. |
