# Research Summary: PhotoBooth

**Date:** 2026-05-19
**Confidence:** HIGH on direction; MEDIUM on three integration specifics (validate in Phase 2/4 spikes)

---

## Executive Summary

PhotoBooth is a single-screen kiosk SPA backed by a localhost Node server. The product anatomy is well-trodden: live preview → countdown → N captures → review/retake → canvas strip editor (template + slots + filters) → GIF + composite export → upload to 0x0.st → QR code → idle.

The product's identity lives in two places:
1. **In-app canvas strip editor** with slot regions, layer ordering, and per-photo filters
2. **Cross-platform camera capture** — DSLR-quality (gphoto2 on Mac/Linux) vs webcam-quality (getUserMedia on Windows) — behind a single adapter interface

---

## Stack

**Frontend:** Svelte 5 + Vite 8 + Konva.js 10 (canvas editor)
**Backend:** Fastify 5 (thin OS bridge — capture proxy + static serve)
**GIF:** gifenc (Web Worker) + @ffmpeg/ffmpeg as optional HQ fallback
**QR:** qrcode (soldair)
**Camera (Mac/Linux):** `gphoto2` CLI via `child_process.spawn` — NOT the stale npm package
**Camera (Windows):** `getUserMedia()` via vendor webcam utility
**Packaging:** Plain Node + system browser. NO Electron.

**Avoid:** Fabric.js, gif.js, the `gphoto2` npm package, Webpack, SSR frameworks.

---

## Table-Stakes Features (must ship in v1)

- Live camera preview (getUserMedia on Windows, MJPEG/WS on Mac/Linux)
- Countdown (3-2-1) with visual + audio feedback
- Multi-shot session (configurable, default 4)
- Review/retake per-slot
- Strip composition from template + slot regions
- Final preview before share
- **Always save to disk** (regardless of upload outcome)
- Upload to 0x0.st + QR code
- Animated GIF from session captures
- Return-to-idle / start screen + fullscreen kiosk
- Camera disconnect → "reconnect" UI (not app restart)

**Product identity (also v1):**
- Canvas editor: template import, slot regions, layer z-ordering
- Cross-platform camera adapter (getUserMedia + gphoto2)
- DSLR shutter trigger via gphoto2 (the quality leap)

**Defer post-MVP:** per-photo filters, frame-selection for GIF, multiple templates, local gallery, branding overlays.

---

## Architecture

```
Browser SPA                          Node Backend (Fastify)
─────────────────────────────        ──────────────────────────────
UI Shell                             GET  /api/camera/info
  BoothScreen (idle/count/capture)   POST /api/camera/capture → gphoto2 → JPEG
  EditorScreen (Konva canvas)        WS   /api/camera/preview → MJPEG frames
  ShareScreen (GIF + QR)             POST /api/share → 0x0.st → URL
  AdminPanel (config)                Static SPA
Camera Adapter (interface)
  WebcamAdapter  → getUserMedia      Camera Service (Node)
  TetheredAdapter → /api/camera/*      Gphoto2Driver (subprocess)
Session Store (state machine)          NullDriver (fixtures for dev)
Canvas Engine (Konva)
GIF Encoder (Web Worker, gifenc)
Uploader + QR (fetch → /api/share)
```

**Key rules:**
- Browser never talks to gphoto2 directly — all DSLR access through Node
- All platform branching in Camera Adapter only — screen code is platform-agnostic
- Retain original JPEG Blobs; never re-encode from canvas (double degradation)
- gphoto2 ops serialized via `p-queue` concurrency 1 (PTP is single-session)
- Session state lives in browser — backend is stateless

---

## Top 5 Pitfalls (event-killers)

1. **gphoto2 USB device claim (`-53`)** — `gvfs`/`PTPCamera` auto-mounts the camera. Fix: `pkill` daemon at startup; retry on `-53`. **Verify in Phase 2 day-one spike.**
2. **Camera disconnect mid-session** — USB jiggle, auto-sleep, battery death. Fix: 5s heartbeat; "reconnect" UI; AC adapter in setup docs.
3. **GIF memory blow-up** — 4×24MP JPEG in ImageData = OOM. Fix: downscale to 480–720px BEFORE encoding; gifenc in Web Worker.
4. **0x0.st CORS via browser-direct fetch** — may fail. Fix: **all uploads go through Node backend** (`/api/share`). **Verify in Phase 4 day-one.**
5. **Event venue has no internet** — Fix: **always save locally**; detect offline; queue uploads; "Saved locally" UI state.

---

## Suggested Phase Order

| # | Phase | Goal | Key Risks Addressed |
|---|-------|------|---------------------|
| 1 | Foundation + getUserMedia Loop | Scaffold + camera adapter + multi-shot session | Browser permissions, path handling, adapter interface |
| 2 | gphoto2 Tethered Camera | DSLR capture + MJPEG live view on Mac/Linux | USB claim, subprocess mutex, MJPEG parsing |
| 3 | Canvas Strip Editor | Konva template + slots + layers + export | Serialization, performance, DPR |
| 4 | GIF + Share + QR | Close user loop | GIF memory, CORS, offline fallback |
| 5 | Kiosk Hardening | Resilience + production launcher | Disconnect recovery, memory leaks, soak test |
| 6 | Polish (optional) | Filters, multiple templates, gallery | — |

**Phases 2 and 3 can run in parallel** after Phase 1 ships the `CameraAdapter` interface and `NullDriver`.

---

## Gaps to Validate Empirically

| Gap | When | How |
|-----|------|-----|
| gphoto2 MJPEG live-view on target camera body | Phase 2 day 1 | `gphoto2 --capture-movie --stdout > out.mjpeg` — verify JPEG boundaries, frame rate |
| 0x0.st upload field name, CORS, rate-limits | Phase 4 day 1 | `curl -F'file=@test.jpg' https://0x0.st/` + browser `fetch` |
| gifenc quality on real event-photo content | Phase 4 week 1 | Encode fixture session, inspect output |
| gphoto2 capture latency on target camera | Phase 2 spike | Measure end-to-end; subtract from countdown |
| Operator template workflow | Before Phase 3 | Decide: live editor vs pre-bake JSON |

---
*Last updated: 2026-05-19*
