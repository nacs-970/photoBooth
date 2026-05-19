---
phase: 01-foundation-webcam-session-loop
plan: "01"
subsystem: ui
tags: [svelte5, vite8, fastify5, typescript, vitest, webcam, getUserMedia, session-state]

# Dependency graph
requires: []
provides:
  - "CameraAdapter TypeScript interface — Phase 2 contract (attachPreview accepting HTMLVideoElement | HTMLImageElement)"
  - "WebcamAdapter: getUserMedia with dual disconnect detection (ended + devicechange)"
  - "TetheredAdapter: Phase 2 stub that type-checks the contract"
  - "session.svelte.ts: $state reactive object store with startSession/saveShot/nextShot/resetSession/showDisconnect/hideDisconnect/setCameraInfo"
  - "GET /api/camera/info: Fastify capability probe returning platform + gphoto2Available + cameraMode"
  - "IdleScreen.svelte: full-bleed webcam preview + Tap to Start CTA"
  - "App.svelte: session.screen router with fade/cubicOut transitions"
  - "Vitest 4.1.6 test infrastructure with happy-dom + @testing-library/svelte"
  - "Design token CSS custom properties (colors, spacing, typography, motion, touch)"
affects:
  - "01-02-PLAN: CountdownScreen + capture wiring — imports session.svelte.ts, WebcamAdapter, CameraAdapter"
  - "01-03-PLAN: ReviewScreen — imports session.svelte.ts, Shot type"
  - "01-04-PLAN: DisconnectModal — imports showDisconnect/hideDisconnect, WebcamAdapter.onDisconnect"
  - "All Phase 2+ plans that implement CameraAdapter interface"

# Tech tracking
tech-stack:
  added:
    - "svelte@5.55.8"
    - "@sveltejs/vite-plugin-svelte@7.1.2"
    - "vite@8.0.13"
    - "fastify@5.8.5"
    - "@fastify/static@9.1.3"
    - "typescript@6.0.3"
    - "concurrently@9.2.1"
    - "tsx@4.22.3"
    - "vitest@4.1.6"
    - "@testing-library/svelte@5.3.1"
    - "@testing-library/jest-dom@6.9.1"
    - "happy-dom@20.9.0"
  patterns:
    - "Two-package.json model: web/ + server/ independent, root orchestrates with concurrently"
    - "Svelte 5 $state object export (NOT primitives) for cross-module reactivity"
    - "CameraAdapter interface with attachPreview(el: HTMLVideoElement | HTMLImageElement) for Phase 2 compatibility"
    - "Singleton adapter pattern: web/src/lib/camera/adapter.ts exports cameraAdapter instance"
    - "TDD RED/GREEN: test files committed before implementation files"
    - "Object URL lifecycle management: revoke on overwrite + revoke all on reset (T-01-IL)"
    - "Vitest include pattern extended to cover .test.svelte.ts extension"

key-files:
  created:
    - "web/src/lib/camera/CameraAdapter.ts"
    - "web/src/lib/camera/WebcamAdapter.ts"
    - "web/src/lib/camera/TetheredAdapter.ts"
    - "web/src/lib/camera/adapter.ts"
    - "web/src/lib/session.svelte.ts"
    - "web/src/lib/types.ts"
    - "web/src/lib/config.ts"
    - "web/src/App.svelte"
    - "web/src/screens/IdleScreen.svelte"
    - "web/src/components/LivePreview.svelte"
    - "web/src/components/PrimaryButton.svelte"
    - "web/src/app.css"
    - "web/src/main.ts"
    - "web/index.html"
    - "web/vite.config.ts"
    - "web/vitest-setup.ts"
    - "web/tsconfig.json"
    - "web/package.json"
    - "server/src/index.ts"
    - "server/src/routes/camera.ts"
    - "server/src/camera/detect.ts"
    - "server/tsconfig.json"
    - "server/package.json"
    - "package.json"
    - ".gitignore"
    - "web/src/lib/session.test.svelte.ts"
    - "web/src/lib/camera/WebcamAdapter.test.ts"
  modified:
    - "web/vite.config.ts (added .test.svelte.ts include pattern + passWithNoTests)"

key-decisions:
  - "CameraAdapter.attachPreview accepts HTMLVideoElement | HTMLImageElement union — enables Phase 2 MJPEG path without screen code changes"
  - "WebcamAdapter type-narrows via 'srcObject' in el (duck-typing) instead of instanceof HTMLVideoElement — happy-dom instanceof check fails on plain objects in tests"
  - "Singleton cameraAdapter exported from adapter.ts — avoids component-level instantiation, enables future platform switching in one place"
  - "vite.config.ts include pattern extended with '**/*.test.svelte.ts' — vitest default glob misses .svelte.ts extension"
  - "gphoto2 IS available on the dev machine — probe returns cameraMode: 'tethered' (correct behavior; plan expected 'webcam' but the logic is correct)"
  - "passWithNoTests: true added to vitest config — acceptance criteria requires exit 0 with no test files"

patterns-established:
  - "Pattern 1 (Session): export const session = $state({...}) — never export primitives; Svelte 5 cross-module reactivity via Proxy requires object property access"
  - "Pattern 2 (CameraAdapter): interface with attachPreview(el: HTMLVideoElement | HTMLImageElement) — no MediaStream in public signatures; Phase 2-safe"
  - "Pattern 3 (Router): {#key session.screen} + transition:fade in App.svelte — all screen transitions go through this single wrapper"
  - "Pattern 4 (TDD): test files RED-committed before implementation GREEN-committed; both in same task but separate commits"
  - "Pattern 5 (Object URLs): saveShot revokes prior objectUrl at index before overwriting; resetSession revokes all before clearing array"

requirements-completed:
  - CAM-01
  - CAM-02

# Metrics
duration: 12min
completed: "2026-05-20"
---

# Phase 01 Plan 01: Foundation Walking Skeleton Summary

**Svelte 5 + Fastify 5 walking skeleton: CameraAdapter interface locked, WebcamAdapter with getUserMedia + dual disconnect detection, reactive session state machine, Vitest 15/15 passing, and IdleScreen with full-bleed live webcam preview and Tap to Start CTA**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-20T00:35:41Z
- **Completed:** 2026-05-20T00:47:00Z
- **Tasks:** 3 (all complete)
- **Files modified:** 27 created + 1 modified

## Accomplishments

- Full repo scaffold with two independent package.json files (web/ + server/) + root concurrently orchestration
- CameraAdapter TypeScript interface locked — exact contract for Phase 2 TetheredAdapter implementation
- WebcamAdapter implementing getUserMedia with 1920x1080 preferred resolution, two-layer disconnect detection (track 'ended' + devicechange), and OffscreenCanvas capture fallback
- session.svelte.ts reactive object store with all 7 transition functions, correct object URL lifecycle (T-01-IL mitigation)
- Fastify GET /api/camera/info capability probe with 3s gphoto2 subprocess timeout (T-01-DoS mitigation)
- 15 unit tests passing: 9 session state machine + 6 WebcamAdapter
- IdleScreen renders full-bleed LivePreview with Tap to Start CTA; App.svelte routes via session.screen with 250ms fade/cubicOut transition

## Final CameraAdapter Interface

```typescript
// web/src/lib/camera/CameraAdapter.ts
export interface CameraAdapter {
  init(): Promise<void>;
  attachPreview(el: HTMLVideoElement | HTMLImageElement): Promise<void>;
  capture(): Promise<Blob>;
  dispose(): Promise<void>;
  onDisconnect(callback: () => void): void;
}
```

No `MediaStream` in any public method signature — Phase 2 TetheredAdapter can implement this with MJPEG `<img src=...>` without touching screen code.

## Final Session Store Shape

```typescript
// web/src/lib/session.svelte.ts
export const session = $state({
  screen: 'idle' as ScreenName,         // 'idle' | 'countdown_preview' | 'review' | 'photo_grid'
  shots: [] as Shot[],                   // { blob: Blob; objectUrl: string }[]
  currentShotIndex: 0,
  disconnected: false,
  cameraInfo: null as CameraInfo | null, // populated by App.svelte onMount fetch
  config: {
    shotCount: 4,                        // from config.ts SHOT_COUNT
    countdownMs: 3000,                   // from config.ts COUNTDOWN_MS
  },
});
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold repo + Fastify capability probe + Vitest config** - `ab8e7b8` (chore)
2. **Task 2 RED: Failing tests for session + WebcamAdapter** - `5bfc2ed` (test)
3. **Task 2 GREEN: Session state machine + WebcamAdapter implementation** - `3fc5a4f` (feat)
4. **Task 3: App.svelte router + IdleScreen + LivePreview + PrimaryButton** - `1dcc103` (feat)

## Files Created/Modified

- `web/src/lib/camera/CameraAdapter.ts` — Phase 2 contract interface
- `web/src/lib/camera/WebcamAdapter.ts` — getUserMedia implementation with dual disconnect detection
- `web/src/lib/camera/TetheredAdapter.ts` — Phase 2 placeholder stub
- `web/src/lib/camera/adapter.ts` — Singleton cameraAdapter export (new file, unlisted in plan)
- `web/src/lib/session.svelte.ts` — Reactive state machine with 7 transition functions
- `web/src/lib/types.ts` — ScreenName, Shot, CameraInfo type definitions
- `web/src/lib/config.ts` — SHOT_COUNT=4, COUNTDOWN_MS=3000 with T-01-T range guard
- `web/src/App.svelte` — Screen router with fade transitions; fetches /api/camera/info on mount
- `web/src/screens/IdleScreen.svelte` — Full-bleed LivePreview + centered Tap to Start CTA
- `web/src/components/LivePreview.svelte` — `<video autoplay playsinline muted>` bound to adapter
- `web/src/components/PrimaryButton.svelte` — Accent fill, touch-min, label-size, scale press feedback
- `web/src/app.css` — Full design token set (colors, spacing, typography, motion, touch)
- `web/vite.config.ts` — Svelte + svelteTesting plugins, happy-dom, /api proxy, .test.svelte.ts include
- `server/src/camera/detect.ts` — gphoto2 probe with 3s timeout + T-01-DoS fallback
- `server/src/routes/camera.ts` — GET /api/camera/info route
- `server/src/index.ts` — Fastify app entry, port 3001

## Decisions Made

1. **CameraAdapter duck-typing fix:** `attachPreview` type-narrows via `'srcObject' in el` instead of `el instanceof HTMLVideoElement` — happy-dom doesn't provide a real HTMLVideoElement class, so instanceof fails on plain test objects. Duck-typing is semantically equivalent and works in all environments.

2. **adapter.ts singleton:** Added `web/src/lib/camera/adapter.ts` exporting `export const cameraAdapter: CameraAdapter = new WebcamAdapter()`. The plan allowed this as an option and the singleton avoids component-level instantiation, keeping camera lifecycle management out of Svelte component scope.

3. **gphoto2 IS installed on this dev machine:** The capability probe returns `cameraMode: 'tethered'` because gphoto2 is available. The plan expected `'webcam'` as the default but the detection logic is correct — Phase 1 success criteria are about the detection working, not the specific value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest .test.svelte.ts include pattern**
- **Found during:** Task 2 (verifying GREEN phase test run)
- **Issue:** Vitest default include glob `**/*.{test,spec}.?(c|m)[jt]s?(x)` does not match `.test.svelte.ts` extension. `session.test.svelte.ts` was silently skipped — 0 of 9 session tests ran.
- **Fix:** Added `'**/*.test.svelte.ts'` to `test.include` array in `web/vite.config.ts`
- **Files modified:** `web/vite.config.ts`
- **Verification:** `vitest run` now discovers both test files; 15/15 tests pass
- **Committed in:** `1dcc103` (Task 3 commit, because fix was finalized with Task 3 changes)

**2. [Rule 2 - Missing Critical] passWithNoTests: true in vitest config**
- **Found during:** Task 1 (verifying vitest runner exits 0 with no test files)
- **Issue:** vitest exits 1 when no test files are found; Task 1 acceptance criteria requires exit 0
- **Fix:** Added `passWithNoTests: true` to `test` block in `web/vite.config.ts`
- **Files modified:** `web/vite.config.ts`
- **Verification:** `vitest run --reporter=dot` exits 0 with no test files
- **Committed in:** `ab8e7b8` (Task 1 commit)

**3. [Rule 1 - Bug] OffscreenCanvas mock as constructor function**
- **Found during:** Task 2 GREEN phase
- **Issue:** Test used `vi.fn().mockImplementation(() => mockCanvas)` for OffscreenCanvas — vitest spy is not a real constructor function, throws "is not a constructor"
- **Fix:** Changed mock to `function MockOffscreenCanvas() { return mockCanvas; }` — a real constructor function
- **Files modified:** `web/src/lib/camera/WebcamAdapter.test.ts`
- **Verification:** capture() test now passes
- **Committed in:** `3fc5a4f` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical, 1 Rule 3 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. The singleton adapter.ts file is an unlisted new file permitted by the plan's "Recommendation: create a singleton instance" language.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `TetheredAdapter` — all methods throw | `web/src/lib/camera/TetheredAdapter.ts` | Intentional Phase 2 placeholder per spec |
| CountdownScreen placeholder div | `web/src/App.svelte` | Intentional Plan 01-01 stub per spec; Plan 02 wires this |
| ReviewScreen placeholder div | `web/src/App.svelte` | Intentional Plan 01-02 stub; Plan 02 builds ReviewScreen |
| PhotoGridScreen placeholder div | `web/src/App.svelte` | Intentional Plan 01-03 stub; Plan 03 builds PhotoGridScreen |

None of these stubs prevent Plan 01-01's goal (walking skeleton with live webcam preview + Tap to Start transition).

## Threat Surface Scan

No new security-relevant surfaces beyond those modeled in the plan's `<threat_model>`. Mitigations confirmed:
- T-01-IL: `URL.revokeObjectURL` called in both `saveShot` (overwrite) and `resetSession` — verified by tests
- T-01-T: Config range guard in `config.ts` throws on `SHOT_COUNT <= 0 || SHOT_COUNT > 10 || COUNTDOWN_MS <= 0`
- T-01-DoS: `execFileAsync('gphoto2', ...)` called with `timeout: 3000` in `detect.ts`

## Verified Manual Smoke Result

CLI-verifiable automation confirmed:
- `vitest run` exits 0, 15/15 tests green
- `curl http://localhost:3001/api/camera/info` returns `{"platform":"linux","gphoto2Available":true,"cameraMode":"tethered"}` — valid JSON with all 3 required keys
- Session state machine: `startSession()` transitions `session.screen` from `'idle'` to `'countdown_preview'` — verified by session test suite

Physical kiosk smoke (live webcam feed visible + Tap to Start button tap → placeholder CountdownScreen) **cannot be verified from CLI in an autonomous worktree agent**. The visual verification is deferred to human review post-merge:
1. `npm run dev` at repo root (concurrently starts both Vite :5173 + Fastify :3001)
2. Open http://localhost:5173 — expect live webcam preview + yellow "Tap to Start" button
3. Tap the button — expect 250ms fade to "Countdown screen placeholder — Plan 02 wires this up"
4. No console errors expected except first-launch camera permission prompt

## Issues Encountered

- **gphoto2 unexpectedly installed:** Dev machine has gphoto2 installed, so the capability probe returns `cameraMode: 'tethered'` rather than the `'webcam'` the plan comment predicted. This is correct behavior — the detection logic works as designed. Phase 2 will not need any changes to the probe.
- **Port 3001 EADDRINUSE in final verify:** A prior verification run left the server process on port 3001. The `curl` still returned valid data (hitting the existing process). No impact on deliverables.

## Next Phase Readiness

Ready for Plan 01-02 (CountdownScreen + capture wiring):
- CameraAdapter interface is locked — Plan 02 imports and uses it without modification
- `session.svelte.ts` exposes `saveShot()` and `nextShot()` which Plan 02 needs
- `WebcamAdapter.capture()` returns a Blob — Plan 02 calls this on countdown completion
- `startSession()` already transitions to `'countdown_preview'` — Plan 02 mounts CountdownScreen there
- Vitest infrastructure running; Plan 02 can add tests to the existing setup

---
*Phase: 01-foundation-webcam-session-loop*
*Completed: 2026-05-20*
