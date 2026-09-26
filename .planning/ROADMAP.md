# Roadmap: PhotoBooth

## Overview

PhotoBooth ships as five vertical MVP slices. We first prove the full session loop on the easy camera path (getUserMedia), then swap in the high-risk gphoto2 tethered DSLR behind the same adapter interface. Next we give hosts a way to bring their own strip designs and guests a way to pick one, then we deliver the canvas strip editor that defines the product. Finally we close the loop end-to-end with GIF, upload, QR, and offline fallback — the moment a guest can scan their phone and walk away with a real artifact.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Webcam Session Loop** - Scaffold the app and ship a full countdown → capture × N → retake session using getUserMedia behind a camera adapter
- [ ] **Phase 2: Tethered DSLR Capture (gphoto2)** - Add a gphoto2 live-view + shutter-trigger adapter so Mac/Linux sessions fire the real DSLR
- [ ] **Phase 3: Template Library & Picker** - Host can import/activate strip templates in an Admin Panel; guest picks one before each session
- [ ] **Phase 4: Canvas Strip Editor** - Captured photos auto-fill template slot regions, guest can reorder layers, and the composite exports as JPEG
- [ ] **Phase 5: GIF, Share & Offline Fallback** - Session ends with an animated GIF, optional frame selection, 0x0.st upload + QR, local save, and offline queueing

## Phase Details

### Phase 1: Foundation & Webcam Session Loop

**Goal**: A guest can walk up to the app on Windows (or any machine with a webcam), tap "Start," and complete a full countdown → multi-shot capture → per-shot retake session — proving the camera adapter interface on the easy path before gphoto2 lands.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CAM-01, CAM-02, CAM-04, SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):

  1. On startup the app auto-detects the OS and selects the getUserMedia camera path on Windows (and as a fallback elsewhere) without manual configuration
  2. Guest sees a live webcam preview and a "Start" control on the idle screen
  3. Guest completes a configurable multi-shot session (default 4 shots, 3-second countdown) with a white flash and shutter sound on every capture
  4. After each capture the guest sees a thumbnail review with a working "Retake this shot" option before the next countdown begins
  5. If the webcam is unplugged or revoked mid-session, the app shows a "Camera disconnected — check cable" screen with a working retry button instead of crashing

**Plans**: 4 plans
Plans:

**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold, CameraAdapter interface, idle screen with live webcam preview, capability probe

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Single countdown to capture: countdown ring, flash, shutter sound, one Blob saved

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Multi-shot session with per-shot retake, photo grid stub, reset to idle

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Camera disconnect modal with retry (CAM-04)

Cross-cutting constraints:

- `CameraAdapter` interface (defined in 01-01) is the contract all subsequent plans call — no plan may redefine it
- `session.svelte.ts` object export pattern (D-01) required by all plans — never export primitives
- All plans must `URL.revokeObjectURL()` on shot overwrite or session reset — object URL leak prevention
- Screen code must never branch on platform (CLAUDE.md) — all platform logic stays in Camera Adapters

**UI hint**: yes

### Phase 2: Tethered DSLR Capture (gphoto2)

**Goal**: On Mac/Linux the same session loop from Phase 1 now runs against a real DSLR — live preview is MJPEG from gphoto2 and pressing the on-screen shutter fires the physical camera at full quality.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CAM-03
**Success Criteria** (what must be TRUE):

  1. On Mac/Linux the app auto-routes to the gphoto2 adapter and a connected DSLR shows live preview frames on the booth screen within a few seconds of launch
  2. Pressing "Start" runs the full Phase 1 session and each capture audibly fires the DSLR shutter and returns the camera's JPEG (not a webcam frame) into the review thumbnail
  3. Unplugging the DSLR mid-session surfaces the same "Camera disconnected" recovery UI from Phase 1, and reconnecting + retry resumes without restarting the app
  4. Re-launching the app while a previous gphoto2/PTP claim is held (e.g. gvfs auto-mount) recovers cleanly instead of erroring out permanently

**Plans**: 7 plans (5 original + 02-06 hotfix + 02-07 gap closure)
Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Camera picker foundation: CameraSelectScreen, ScreenName + session shape changes, adapter setter, test scaffolds

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — FPS spike + stream strategy decision: measure gphoto2 --capture-movie FPS on actual DSLR, choose movie vs preview-poll

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — DSLR live preview: CameraService singleton + p-queue, GET /api/camera/stream MJPEG, TetheredAdapter init/attachPreview, LivePreview img/video branch

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — DSLR capture: POST /api/camera/capture, CameraService.capture(), TetheredAdapter.capture(), disk persistence, stream reconnect

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — USB conflict + disconnect recovery: DisconnectModal message prop, USB_CONFLICT error variant, mid-session unplug handling

**Wave 6** *(hotfix, 2026-09-23 — no pre-written plan)*

- [x] 02-06 — Camera pipeline rework (SUMMARY only): persistent `gphoto2 --shell` session for preview + capture, canvas MJPEG renderer, forced Single Shot, capture-failure Retake UI

**Wave 7** *(gap closure)*

- [ ] 02-07-PLAN.md — Honest probe, idle shell close, capture counter, detached-canvas watchdog, parser copy fix, housekeeping, hardware UAT (SC #1–#4)

Cross-cutting constraints:

- `CameraAdapter` interface is locked — no plan may change init/attachPreview/capture/dispose/onDisconnect signatures *(02-06: `attachPreview` union additively widened with `HTMLCanvasElement`)*
- All gphoto2 ops go through Node backend via CameraService — never spawn gphoto2 in browser code
- p-queue concurrency 1 is non-negotiable — stream and capture cannot run simultaneously on one USB device
- One persistent gphoto2 session per server (02-06) — never spawn a second gphoto2 while the shell holds the camera
- Do NOT break the 42 existing tests from Phase 1

**UI hint**: yes

### Phase 3: Template Library & Picker

**Goal**: Hosts can bring their own strip designs into the app and guests can browse and pick one before a session — the product stops being one hard-coded layout.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04
**Success Criteria** (what must be TRUE):

  1. From an Admin Panel, host can import a .jpg or .png file and it appears in the template library
  2. Host can toggle a template between active and inactive, and only active templates appear to guests
  3. On the guest start flow, the guest sees a thumbnail gallery of every active template
  4. Guest can tap a template to focus/preview it, swipe left/right to browse, and confirm a choice that is then carried into the session as the selected strip layout

**Plans**: TBD
**UI hint**: yes

### Phase 4: Canvas Strip Editor

**Goal**: After a session, the guest's photos compose onto their chosen template in a Konva canvas editor — slots auto-fill, layers are reorderable, and the result exports as a JPEG ready for sharing.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04
**Success Criteria** (what must be TRUE):

  1. The chosen template renders as the background layer of the strip canvas at the correct aspect ratio
  2. Captured photos auto-fill their template-defined slot regions in session order without manual placement
  3. Guest can drag canvas layers front/back and the visible z-order updates immediately
  4. Guest can confirm the strip and the app produces a final composite JPEG file (visible at a known path or as a downloadable blob)

**Plans**: TBD
**UI hint**: yes

### Phase 5: GIF, Share & Offline Fallback

**Goal**: The end-of-session share screen closes the loop — the guest sees their strip and GIF, scans a QR code, and walks away with a working URL; if there is no internet the artifact is still saved and queued.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, OUT-06
**Success Criteria** (what must be TRUE):

  1. At session end, the app generates an animated GIF from the session shots and the guest can select which frames to include before generation
  2. The strip JPEG is saved to a known local disk path on every session, regardless of upload outcome
  3. When online, strip and GIF upload to 0x0.st via the Node backend and a scannable QR code is rendered from the returned URL
  4. Guest can download the final strip image to local disk directly from the share screen
  5. When offline, the share screen shows a clear "Saved locally — will retry" state and queues the upload for later instead of erroring

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (Phase 2 and Phase 3 are parallel-friendly after Phase 1 ships the CameraAdapter interface)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Webcam Session Loop | 4/4 | Complete | 2026-05-20 |
| 2. Tethered DSLR Capture (gphoto2) | 6/7 | In Progress (02-07 gap closure + UAT) |  |
| 3. Template Library & Picker | 0/TBD | Not started | - |
| 4. Canvas Strip Editor | 0/TBD | Not started | - |
| 5. GIF, Share & Offline Fallback | 0/TBD | Not started | - |
