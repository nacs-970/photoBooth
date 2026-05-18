# Architecture Research: PhotoBooth

**Domain:** Browser-based photo booth with DSLR integration
**Date:** 2026-05-19
**Confidence:** HIGH for shape/patterns; MEDIUM for library specifics

---

## High-Level Topology

```
┌───────────────────────── LAPTOP (localhost only) ──────────────────────────┐
│                                                                            │
│   ┌───────────────── Browser (Chromium recommended) ─────────────────┐    │
│   │   UI Shell (SPA)                                                  │    │
│   │   ├─ BoothScreen   (idle → countdown → capture → review)          │    │
│   │   ├─ EditorScreen  (canvas: template + slots + filters + layers)  │    │
│   │   ├─ ShareScreen   (GIF preview + upload + QR)                    │    │
│   │   └─ AdminPanel    (camera config, template import, reset)        │    │
│   │                                                                   │    │
│   │   Camera Adapter (interface)                                      │    │
│   │   ├─ WebcamAdapter   → getUserMedia() (Windows + fallback)        │    │
│   │   └─ TetheredAdapter → fetch()/WS → backend (Mac/Linux)           │    │
│   │                                                                   │    │
│   │   Session Store (in-memory state machine)                         │    │
│   │   Canvas Engine (Fabric.js or Konva.js)                           │    │
│   │   GIF Encoder   (gif.js / gifenc, Web Worker)                     │    │
│   │   Uploader + QR (fetch → 0x0.st; qrcode lib)                      │    │
│   └─────────────────────────┬─────────────────────────────────────────┘    │
│                             │ HTTP + WebSocket (loopback)                   │
│   ┌─────────────────────────▼─────────────────────────────────────────┐    │
│   │   Node.js Backend (Express or Fastify)                            │    │
│   │   ├─ GET  /api/camera/info      capability detection              │    │
│   │   ├─ POST /api/camera/capture   trigger shutter + return JPEG     │    │
│   │   ├─ GET  /api/camera/preview   MJPEG stream (liveview)           │    │
│   │   └─ Static asset server        SPA bundle                       │    │
│   │                                                                   │    │
│   │   Camera Service (strategy pattern)                               │    │
│   │   ├─ Gphoto2Driver  (child_process.spawn → gphoto2 CLI)           │    │
│   │   └─ NullDriver     (dev mode — returns fixture JPEGs)            │    │
│   └─────────────────────────┬─────────────────────────────────────────┘    │
│                             │ libgphoto2 / PTP over USB                     │
│   ┌─────────────────────────▼─────────────────────────────────────────┐    │
│   │   OS Camera Layer                                                  │    │
│   │   ├─ Mac/Linux: gphoto2 CLI → libgphoto2 → PTP/USB → DSLR         │    │
│   │   └─ Windows:   UVC driver → camera webcam mode → getUserMedia    │    │
│   └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| UI Shell (SPA) | Screen routing, kiosk lifecycle, user input | Session Store, Camera Adapter |
| Camera Adapter | Unifies webcam vs tethered behind one API | Backend HTTP/WS or navigator.mediaDevices |
| Session Store | State machine + capture array + editor state | UI Shell, Canvas Engine, GIF Encoder |
| Canvas Engine | Layered template, slots, filters, z-order | Session Store; exports composite Blob |
| GIF Encoder | Animated GIF from captures (Web Worker) | Session Store, Uploader |
| Uploader / QR | POST multipart to 0x0.st; render QR from URL | Browser fetch only |
| Backend (Node) | OS bridge: spawn gphoto2, stream preview | Camera Service, browser over loopback |
| Camera Service | Subprocess lifecycle, command serialization | gphoto2 CLI |

**Key rule:** browser never talks to gphoto2 directly. All DSLR access goes through Node backend. Same SPA works in both camera modes.

---

## Data Flow

```
IDLE → user presses Start
  ↓
COUNTDOWN (n shots × t-second countdown)
  ├─ Windows:   getUserMedia stream → <video>
  └─ Mac/Linux: backend MJPEG → <img src="/api/camera/preview">
  on countdown=0 → CAPTURE
  ↓
CAPTURE
  ├─ Windows:   grab <video> frame → canvas.toBlob() → Blob
  └─ Mac/Linux: POST /api/camera/capture
                → gphoto2 --capture-image-and-download --filename - --force-overwrite
                → JPEG bytes piped → Blob
  Store Blob + ObjectURL in Session Store under slot index
  ↓
LOOP back to COUNTDOWN until all slots filled
  ↓
REVIEW (thumbnail grid, retake any slot)
  ↓
EDITOR
  ├─ Canvas builds: background template (z=0) → slots (z=1..n) → overlays (z=top)
  ├─ User: drag layers, reorder z-index, per-photo filters
  └─ Export: canvas.toBlob('image/jpeg')
  ↓
GIF BUILD (Web Worker, parallel with editor)
  ├─ Reads original capture Blobs (NOT canvas re-encode)
  ├─ Downscale, quantize palette
  └─ Encode → GIF Blob
  ↓
SHARE
  ├─ POST multipart/form-data to https://0x0.st (field: "file")
  ├─ Response: plain-text URL
  ├─ Render QR (qrcode lib, client-side)
  └─ Offer "Save to disk" + "New session" (reset store)
```

**Critical concurrency notes:**
- GIF encoding is CPU-bound — **must run in Web Worker** or UI freezes.
- Retain original JPEG Blobs; don't re-encode from canvas (double degradation).
- gphoto2 cannot preview and capture simultaneously — Camera Service must serialize with a mutex.

---

## gphoto2 Integration

**Recommendation: CLI subprocess via `child_process.spawn`** — no native bindings needed.

```bash
# Capture
gphoto2 --capture-image-and-download --filename - --force-overwrite
# JPEG bytes on stdout → pipe into HTTP response

# Preview loop (~5-10 fps)
gphoto2 --capture-preview --filename - --force-overwrite
# Backend loops, exposes as MJPEG multipart/x-mixed-replace
```

Node capture handler:
```js
const child = spawn('gphoto2', ['--capture-image-and-download', '--filename', '-', '--force-overwrite'])
res.setHeader('Content-Type', 'image/jpeg')
child.stdout.pipe(res)
child.on('close', code => { if (code !== 0) handleError(res, code) })
```

**Process hygiene:**
- Single Camera Service singleton; queue all requests with `p-queue` concurrency 1.
- On macOS: `killall PTPCamera` at startup (OS grabs the USB device).
- On Linux: ensure user in correct group (libgphoto2 udev rules).
- Clean orphan processes at startup: `pkill -f gphoto2` (configurable).

---

## Booth State Machine

```
IDLE ──start──► COUNTDOWN ──snap──► CAPTURING ──ok──► REVIEW_SLOT
                                        │
                                        └──fail──► IDLE (toast error)

REVIEW_SLOT ──more slots?──► COUNTDOWN
            ──last slot──► REVIEW_ALL ──retake──► COUNTDOWN (specific slot)
                                     ──ok────────► EDITOR

EDITOR ──done──► BUILDING_GIF ──ok──► SHARE
                               ──fail──► EDITOR (toast)

SHARE ──reset/timeout──► IDLE
```

### Store Shape (sketch)
```js
{
  phase: 'IDLE|COUNTDOWN|CAPTURING|REVIEW_SLOT|REVIEW_ALL|EDITOR|BUILDING_GIF|SHARE',
  config: { slotCount, countdownMs, cameraMode: 'webcam'|'tethered' },
  template: { id, imageBlob, slots: [{x, y, w, h, rotation}] },
  captures: [{ id, slotIndex, blob, objectUrl, takenAt }],
  editor: { layers: [...], filters: { perSlot: Map<id, FilterStack> } },
  gif: { status, blob?, objectUrl? },
  share: { status, url?, qrDataUrl? }
}
```

---

## Cross-Platform Camera Adapter

```ts
interface CameraAdapter {
  init(): Promise<void>
  getPreviewStream(): Promise<MediaStream | EventTarget>
  capture(): Promise<Blob>
  dispose(): Promise<void>
}

class WebcamAdapter  implements CameraAdapter { /* getUserMedia */ }
class TetheredAdapter implements CameraAdapter { /* hits /api/camera/* */ }
```

**Detection strategy:**
1. User setting in Admin Panel (webcam | tethered | auto) — persisted in localStorage.
2. Auto: `GET /api/camera/info` returns `{ platform, gphoto2: { installed, devices } }`. `win32` → Webcam; `darwin|linux` with devices → Tethered.
3. Active mode shown as badge in UI for operator debugging.

---

## Build / Serve Architecture

**Dev:** Vite (HMR) + tsx/ts-node-dev backend. `concurrently`. Vite proxies `/api` to Node port. `NullDriver` returns fixture JPEGs — no camera needed for frontend dev.

**Production:** `vite build` → `dist/`, Node serves statically + `/api/*`. Single `npm start`.

**Distribution options:**
- **Plain Node** (preferred) — smallest; requires Node + gphoto2 installed.
- **Electron** — bundles Chromium+Node; ~150 MB; removes Node install step for non-technical operators.
- **pkg / Node SEA** — single binary; still needs system gphoto2.

**Kiosk browser flags:**
```
--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream
```

---

## Key Patterns

1. **Capture-once-keep-Blob.** Hold originals; create ObjectURLs for rendering; revoke on reset.
2. **Camera Service mutex.** `p-queue` concurrency 1. Capture pauses preview, resumes after.
3. **Web Worker for GIF.** Never on main thread.
4. **Stateless backend.** Session lives in browser; backend stores nothing. Restart-safe.
5. **Capability probe at startup.** `/api/camera/info` once on boot; UI reflects availability.

## Anti-Patterns to Avoid

1. **Base64 JPEG over WebSocket for preview** — 33% inflation + JSON parse overhead.
2. **Canvas composition during countdown** — burns CPU; show raw camera feed until editor.
3. **Fake layers with positioned `<div>`s** — filters + rasterization-for-export becomes painful.
4. **Platform branches scattered through UI code** — all platform logic stays in the adapter.
5. **Default-on disk persistence** — fills disk; opt-in only.

---

## Suggested Build Order

| Phase | Goal | Exit Criterion |
|-------|------|----------------|
| A — Skeleton | Vite+Node scaffold, NullDriver, all screens routing | Walk all screens with fake captures |
| B — Real Capture | WebcamAdapter + Gphoto2Driver + auto-detection | Press capture, get real JPEG on both platforms |
| C — Preview | Live view during countdown on both platforms | Preview and capture work end-to-end |
| D — Editor | Canvas engine, template import, slots, layers, filters, export | Finished strip leaves editor as Blob |
| E — GIF | GIF encoder in Web Worker, size-safe output | Playable GIF under 0x0.st limits |
| F — Share | Upload, QR code, download, reset to IDLE | Scan QR, view upload on phone |
| G — Kiosk Polish | Production build, kiosk script, camera reconnect, admin panel | Cold-boot → event-ready |

---
*Last updated: 2026-05-19*
