# PhotoBooth

## What This Is

A self-contained web photo booth app that runs locally on a laptop at events. It uses a DSLR/mirrorless camera (via USB webcam mode on Windows, or gphoto2 shutter trigger on Mac/Linux) to capture photos, lets guests customize their strip in a canvas-based editor, creates a GIF from the session, uploads to 0x0.st, and generates a QR code for instant sharing — all on a single screen.

## Core Value

Guests walk away with a custom photo strip they can instantly share via QR code, captured with a real camera.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Camera live view and shutter capture (getUserMedia on Windows, gphoto2 on Mac/Linux)
- [ ] Photo session: countdown → capture → review loop
- [ ] Strip canvas editor: import background/template, place photo slots, layer ordering, filters
- [ ] GIF creation from session photos (all shots + user frame selection)
- [ ] Upload final strip/GIF to https://0x0.st/
- [ ] QR code generation from upload URL for instant sharing
- [ ] Save/download strip image to disk

### Out of Scope

- Physical printing — user downloads and prints elsewhere
- Multi-screen (operator + guest display) — single screen for now
- Cloud hosting — runs as localhost only
- User accounts / auth — no login needed, event-mode only
- Paid hosting / CDN — 0x0.st handles sharing

## Context

- Runs on a laptop brought to events (local server, no internet required except for upload/QR)
- Camera connects via USB — on Windows the camera must be in UVC/webcam mode (getUserMedia); on Mac/Linux gphoto2 triggers the actual shutter for full quality
- Strip editor is canvas-based (Fabric.js or Konva.js territory) — user imports existing .jpg/.png as strip template, places photo slot regions, controls layer z-order (front/back drag), and applies per-photo filters
- GIF creation: all session shots animated + option for user to pick specific frames
- 0x0.st is a free anonymous file host (max 512MiB, 1 year retention) — no API key needed, simple POST upload
- QR code is generated client-side from the returned URL

## Constraints

- **Platform**: Cross-platform (Mac, Linux, Windows) — Node.js backend required for gphoto2 on Mac/Linux
- **Deployment**: Localhost at events — no cloud infra needed
- **Camera (Windows)**: getUserMedia() via UVC/webcam mode only
- **Camera (Mac/Linux)**: gphoto2 for shutter trigger; also supports getUserMedia fallback
- **File size**: 0x0.st 512MiB limit — GIFs must stay within reasonable size
- **No auth**: Event kiosk mode — no login, no accounts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js backend + browser frontend | gphoto2 needs OS-level access; Electron or localhost server enables this | — Pending |
| Canvas editor (Fabric.js / Konva.js) | Layer ordering + slot placement requires proper canvas library, not CSS | — Pending |
| 0x0.st for sharing | Free, no API key, anonymous — perfect for event kiosk | — Pending |
| Single screen | Simplifies setup — no second display required at events | — Pending |
| Adaptive camera capture | Windows: live stream frame; Mac/Linux: gphoto2 shutter | — Pending |
| DSLR: one persistent `gphoto2 --shell` session for preview + capture | Per-process spawns cost ~0.2s/frame (3fps). libgphoto2 also forces a 3s wait from session start before a Sony A7 IV capture (`ptp2/library.c` camera_sony_capture) | ✓ Good — ~25fps preview, shutter ~0.65s after countdown (2026-09-23) |
| DSLR preview drawn to `<canvas>` via fetch + `createImageBitmap` | `<img>` MJPEG in Firefox held 1.6–1.9 GB of decoded frames | ✓ Good — tab flat at 226–340 MB |
| Force `capturemode=Single Shot` per session | In PC Remote mode the body dial is ignored; continuous mode fired 3–4 shots per press and broke the next capture | ✓ Good — one file per press |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after Phase 2 camera pipeline rework (02-06)*
