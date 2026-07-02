---
phase: 02-tethered-dslr-capture-gphoto2
plan: 03
subsystem: camera
tags: [gphoto2, mjpeg, fastify, p-queue]

# Dependency graph
requires:
  - phase: 02-tethered-dslr-capture-gphoto2-02
    provides: stream strategy (option-poll)
provides:
  - CameraService singleton with p-queue managing gphoto2 subprocess
  - GET /api/camera/stream MJPEG endpoint using polling strategy
  - TetheredAdapter implementation handling initialization and preview streaming
  - LivePreview component supporting both <video> (webcam) and <img> (tethered) elements
affects: [02-04-capture]

# Tech tracking
tech-stack:
  added: [p-queue]
  patterns: [subprocess polling, MJPEG multipart response, adapter pattern]

key-files:
  created: 
    - server/src/camera/CameraService.ts
  modified: 
    - server/src/camera/detect.ts
    - server/src/routes/camera.ts
    - web/src/lib/camera/TetheredAdapter.ts
    - web/src/components/LivePreview.svelte

key-decisions:
  - "Used option-poll strategy with a 150ms interval for preview streaming due to lag constraints identified in spike"
  - "Updated detect.ts to return usbConflict boolean to properly detect -53 error code"
  - "Changed .ts to .js imports in server for type: module compatibility with tsc"

patterns-established:
  - "Pattern 1: Singleton service (CameraService) managing gphoto2 subprocess lifecycle"
  - "Pattern 2: MJPEG multipart boundary stream handling in fastify via reply.raw"

requirements-completed: [CAM-03]

# Metrics
duration: 15min
completed: 2026-07-02
---

# Phase 02: Tethered DSLR Preview Summary

**Live DSLR preview visible in browser via TetheredAdapter and MJPEG fastify stream.**

## Performance

- **Duration:** 15m
- **Started:** 2026-07-02T19:20:41+07:00
- **Completed:** 2026-07-02T19:24:00+07:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- CameraService singleton with p-queue managing gphoto2 subprocess
- GET /api/camera/stream MJPEG endpoint using polling strategy
- TetheredAdapter implementation handling initialization and preview streaming
- LivePreview component supporting both `<video>` (webcam) and `<img>` (tethered) elements

## Task Commits

Each task was committed atomically:

1. **Task 1: CameraService singleton + GET /api/camera/stream** - `a5ee590` (feat)
2. **Task 2: TetheredAdapter.init/attachPreview + LivePreview img/video branch** - `c751233` (feat)

## Files Created/Modified
- `server/src/camera/CameraService.ts` - Singleton for managing gphoto2 subprocess
- `server/src/camera/detect.ts` - Updated to return usbConflict
- `server/src/routes/camera.ts` - MJPEG stream endpoint
- `web/src/lib/camera/TetheredAdapter.ts` - DSLR adapter implementation for init and attachPreview
- `web/src/components/LivePreview.svelte` - Conditional rendering for img/video element depending on adapter type
- `web/src/lib/camera/TetheredAdapter.test.ts` - Tests for TetheredAdapter

## Decisions Made
- Used option-poll strategy (150ms interval) due to lag constraints identified in spike.
- Updated detect.ts to use CameraService probe and return usbConflict boolean properly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule X - Build fix] Changed .ts imports to .js in server**
- **Found during:** Task 1 (CameraService singleton + GET /api/camera/stream)
- **Issue:** TypeScript threw errors on `.ts` extensions in imports because `allowImportingTsExtensions` wasn't enabled. ESM in Node requires `.js` extensions for imports in compiled TS.
- **Fix:** Changed `.ts` extensions to `.js` in imports within `detect.ts`, `camera.ts` and `index.ts`.
- **Files modified:** `server/src/camera/detect.ts`, `server/src/routes/camera.ts`, `server/src/index.ts`
- **Verification:** Ran `npx tsc --noEmit` and it compiled successfully.
- **Committed in:** `a5ee590`

---

**Total deviations:** 1 auto-fixed (build fix)
**Impact on plan:** None - minor syntactic adjustment for compiler compatibility.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Tethered adapter preview is complete. Ready for capture implementation (Plan 04).

---
*Phase: 02-tethered-dslr-capture-gphoto2*
*Completed: 2026-07-02*
