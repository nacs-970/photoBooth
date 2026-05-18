# Features Research: PhotoBooth

**Domain:** Browser-based DSLR photo booth for event kiosk use
**Date:** 2026-05-19
**Confidence:** MEDIUM (training-data survey; web verification recommended before scope lock)

## Reference Products Surveyed

| Product | Notable For |
|---------|-------------|
| **dslrBooth** | Commercial Win/Mac, DSLR support, templates, green screen, GIF/boomerang |
| **Sparkbooth** | Classic strip workflow, simple templates |
| **photoboothproject/photobooth** | Open-source PHP/Node, Raspberry Pi, gphoto2, collages, QR sharing |
| **booth.party** | Web-based, getUserMedia only, props/filters |
| **Simple Booth HALO** | iPad-centric, GIFs, animated stickers, branded overlays |
| **Snappic / Salsa Booth** | AI background removal, social sharing |

---

## Table Stakes

Missing = product feels broken or amateur.

| Feature | Why Expected | Complexity |
|---------|--------------|------------|
| Live camera preview | Guests must see themselves before capture | Low |
| Countdown timer (3-2-1) | Without it every shot is a candid blur | Low |
| Visual/audio capture feedback | White flash + shutter sound confirms shot | Low |
| Multi-shot session | Photo booth = N shots in a row (3-4 typical) | Low |
| Review/retake last shot | Blink/blur recovery | Low |
| Strip composition (template + photos) | The output IS the strip | Medium |
| Final preview before sharing | "Here's your strip" moment | Low |
| Download/save to disk | Operator backup | Low |
| Share via QR code | Mobile-first — scan and walk away | Low |
| Upload to remote host | QR is useless without hosted URL | Low |
| Animated GIF from session | Core requirement; near-universal modern feature | Medium |
| Return-to-idle / start screen | Kiosk loop — reset for next guest | Low |
| Fullscreen kiosk mode | Hide browser chrome at events | Low |
| Error recovery (camera disconnect) | USB/DSLRs flake; must not require restart | Medium |
| Configurable session length | Operators want 3/4/6 depending on template | Low |

---

## Differentiators

| Feature | Value | Complexity |
|---------|-------|------------|
| Canvas-based strip editor with layers | Design in-app vs pre-rendering in Photoshop | High |
| Photo slot regions on template | Operator marks rectangles; capture auto-fills | Medium |
| Per-photo filters in editor | B&W, sepia, vintage per slot | Medium |
| Import existing image as template | Total visual freedom via .jpg/.png | Low |
| Layer ordering (front/back drag) | Overlays on top, background behind | Medium |
| Save/load template presets | Build night's design once, reuse | Low |
| Frame-selection for GIF | User picks which shots → GIF | Medium |
| DSLR shutter trigger (gphoto2) | Full-res vs compressed webcam — quality leap | High |
| Adaptive capture per-OS | Win webcam + Mac/Linux gphoto2 in one codebase | High |
| Mirror/flip live preview | Guests expect un-mirrored self-view when posing | Low |
| Print-ready export size | 4x6 / 2x6 at 300 DPI for downstream print | Low |
| Local gallery of session outputs | Operator re-share from the night | Medium |
| Configurable countdown sound/voice | Polished feel | Low |
| Custom branding overlay/watermark | Event logo on every strip | Low |

---

## Anti-Features

Scope traps — explicitly do NOT build.

| Anti-Feature | Why Avoid |
|--------------|-----------|
| User accounts / login | Kiosk mode — guests won't sign in |
| Cloud-hosted multi-tenant SaaS | Massive infra; localhost only |
| Email/SMS delivery | API keys, billing, GDPR |
| Native printer integration | Driver hell across platforms |
| Social media auto-posting | OAuth churn, brittle |
| AI background removal / chromakey | Heavy ML; large scope |
| AI face filters / AR | Face tracking + asset pipeline |
| Real-time multi-camera switching | Hardware orchestration explosion |
| Filter slider UI for guests | Kiosk guests won't use; freezes queue |
| Free-form text/sticker editor for guests | On-screen typing during queue is UX disaster |
| Multi-language localization | Speculative |
| Plugin/extension system | Scope explosion for a localhost tool |

---

## Feature Dependencies

```
Live preview → Countdown → Capture → Review/Retake → Session loop
                                                           │
                                                           ▼
Template import → Slot definition → Strip composition ← Session photos
                                           │
                                           ▼
                                     Final preview
                                           │
                         ┌─────────────────┼─────────────────┐
                         ▼                 ▼                 ▼
                     Download         GIF creation     Upload to 0x0.st
                                           │                 │
                                           └──► Upload ──────┘
                                                             │
                                                             ▼
                                                        QR code
                                                             │
                                                             ▼
                                                   Return to idle
```

**Critical path:** Capture → Slot composition → Upload → QR.

---

## MVP Recommendation

**Ship in MVP (table stakes):**
1. Live camera preview (getUserMedia path first)
2. Countdown + visual capture feedback
3. Multi-shot session (configurable, default 4)
4. Strip composition from template + slots
5. Final preview screen
6. Upload to 0x0.st + QR code
7. Download to disk
8. Return-to-idle / start screen
9. Fullscreen kiosk

**Ship in MVP (product identity differentiators):**
10. Canvas-based strip editor with slot definitions + template import + layer ordering
11. GIF creation (all-frames; frame selection can follow)
12. Adaptive capture (at least getUserMedia path + gphoto2 on one platform)

**Defer post-MVP:** Per-photo filters, multiple template choice, local gallery, boomerang, frame selection, configurable sounds.

---

## Suggested Phase Ordering

1. Foundation + capture (getUserMedia path) — validates the loop
2. Canvas editor + slot system — the product's identity
3. GIF + sharing (upload, QR, kiosk idle) — closes the user loop
4. DSLR / gphoto2 path — quality upgrade; own phase for subprocess complexity
5. Polish — filters, multiple templates, gallery, sounds

---

## Open Questions

- Does operator configure templates live in the canvas editor, or pre-bake and load JSON?
- Is GIF "all session frames" sufficient for v1 or is frame-selection table stakes?
- Retake policy: unlimited, single, or timed-window?

---
*Last updated: 2026-05-19*
