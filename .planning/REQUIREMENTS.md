# Requirements: PhotoBooth

**Defined:** 2026-05-19
**Core Value:** Guests walk away with a custom photo strip they can instantly share via QR code, captured with a real camera.

---

## v1 Requirements

### Camera

- [ ] **CAM-01**: System auto-detects OS at startup and selects the appropriate camera mode (getUserMedia on Windows, gphoto2 on Mac/Linux) without manual configuration
- [ ] **CAM-02**: On Windows, camera preview and capture use `getUserMedia()` via the vendor UVC/webcam utility (Canon EOS Webcam, Sony Imaging Edge, etc.)
- [ ] **CAM-03**: On Mac/Linux, camera preview uses gphoto2 MJPEG live view and capture triggers the actual DSLR shutter via gphoto2 subprocess
- [ ] **CAM-04**: When camera disconnects mid-session, app shows a "Camera disconnected — check cable" screen with a retry button instead of crashing or freezing

### Session

- [ ] **SESS-01**: Guest experiences a multi-shot session: countdown → capture × N, where shot count and countdown duration are configurable (default: 4 shots, 3-second countdown)
- [ ] **SESS-02**: Each capture shows a white flash overlay as visual feedback
- [ ] **SESS-03**: Each capture plays a shutter sound as audio feedback
- [ ] **SESS-04**: After each shot, guest sees a thumbnail review screen with an option to retake that slot before moving to the next shot

### Template Selection

- [ ] **TMPL-01**: Host can import .jpg or .png files as strip templates via the Admin Panel
- [ ] **TMPL-02**: Host can activate or deactivate individual templates; only activated templates are visible to guests
- [ ] **TMPL-03**: Guest sees a thumbnail gallery of all activated templates before starting a session
- [ ] **TMPL-04**: Guest can tap a template to focus/preview it and swipe left/right to browse; confirmed template is used for the session's strip layout

### Strip Editor

- [ ] **EDIT-01**: Selected template is displayed as the background layer of the strip canvas
- [ ] **EDIT-02**: Host can define photo slot regions on a template (positioned rectangles); captured photos auto-fill their assigned slots in session order
- [ ] **EDIT-03**: Guest can reorder canvas layers (drag front/back) in the editor
- [ ] **EDIT-04**: Strip editor exports the composite as a JPEG

### Output & Sharing

- [ ] **OUT-01**: App generates an animated GIF from all session shots after the session ends
- [ ] **OUT-02**: Guest can select which session frames to include in the GIF before it is generated
- [ ] **OUT-03**: Strip and GIF are uploaded to 0x0.st via the Node backend (not browser-direct, to avoid CORS); strip is always saved to local disk regardless of upload success
- [ ] **OUT-04**: After successful upload, a QR code is rendered from the returned URL so guests can scan and walk away
- [ ] **OUT-05**: Guest can download the final strip image to local disk from the share screen
- [ ] **OUT-06**: If the venue has no internet, the app saves the strip+GIF locally and queues the upload; the share screen shows a clear "Saved locally — will retry" state

---

## v2 Requirements

### Editor Polish

- **EDIT-V2-01**: Per-photo filters (B&W, sepia, vintage, fade) applied per slot in the editor
- **EDIT-V2-02**: Multiple save/load template presets — host builds designs once, loads by name
- **EDIT-V2-03**: Custom branding overlay / watermark layer on the strip

### Output Polish

- **OUT-V2-01**: Frame-selection UI integrated into GIF preview (defer from v1 if time-constrained)
- **OUT-V2-02**: Print-ready export at 300 DPI (4×6 or 2×6 inch) for offline printing
- **OUT-V2-03**: Local gallery of past session outputs — host can re-download any strip from the night

### Kiosk UX

- **KIOSK-V2-01**: Fullscreen kiosk mode — hide browser chrome, lock browser zoom, show cursor-hide on idle
- **KIOSK-V2-02**: Configurable countdown sound / voice ("3… 2… 1… Cheese!")
- **KIOSK-V2-03**: Idle/attract screen with "Tap to start" after configurable timeout

### Camera

- **CAM-V2-01**: Admin Panel controls for gphoto2 camera config (ISO, shutter speed, aperture, white balance)
- **CAM-V2-02**: Boomerang-style burst GIF (rapid capture forward + reverse loop)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Physical printing | Driver hell across platforms; excluded in PROJECT.md |
| User accounts / auth | Kiosk mode — guests don't sign in |
| Cloud hosting / SaaS | Massive infra; localhost-only product |
| Email / SMS delivery | API keys, billing, GDPR — 0x0.st + QR is sufficient |
| Social media auto-posting | OAuth churn, brittle, out of scope |
| AI background removal / chromakey | Heavy ML, large separate scope |
| AR / face filters | Face tracking + asset pipeline — different product |
| On-screen text/sticker editor for guests | Kiosk queue killer; UX disaster |
| Multi-screen (operator + guest display) | Single screen kiosk; excluded in PROJECT.md |
| Booking / event management | Different product entirely |
| Multi-language localization | English-only at MVP |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAM-01 | Phase 1 | Pending |
| CAM-02 | Phase 1 | Pending |
| CAM-03 | Phase 2 | Pending |
| CAM-04 | Phase 1 | Pending |
| SESS-01 | Phase 1 | Pending |
| SESS-02 | Phase 1 | Pending |
| SESS-03 | Phase 1 | Pending |
| SESS-04 | Phase 1 | Pending |
| TMPL-01 | Phase 3 | Pending |
| TMPL-02 | Phase 3 | Pending |
| TMPL-03 | Phase 3 | Pending |
| TMPL-04 | Phase 3 | Pending |
| EDIT-01 | Phase 4 | Pending |
| EDIT-02 | Phase 4 | Pending |
| EDIT-03 | Phase 4 | Pending |
| EDIT-04 | Phase 4 | Pending |
| OUT-01 | Phase 5 | Pending |
| OUT-02 | Phase 5 | Pending |
| OUT-03 | Phase 5 | Pending |
| OUT-04 | Phase 5 | Pending |
| OUT-05 | Phase 5 | Pending |
| OUT-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

**Per-phase counts:**
- Phase 1 (Foundation & Webcam Session Loop): 7 requirements
- Phase 2 (Tethered DSLR Capture): 1 requirement
- Phase 3 (Template Library & Picker): 4 requirements
- Phase 4 (Canvas Strip Editor): 4 requirements
- Phase 5 (GIF, Share & Offline Fallback): 6 requirements

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 after roadmap creation (traceability populated)*
