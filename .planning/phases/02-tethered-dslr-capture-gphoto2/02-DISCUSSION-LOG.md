# Phase 2: Tethered DSLR Capture (gphoto2) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 02-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 02-tethered-dslr-capture-gphoto2
**Areas discussed:** MJPEG stream delivery, USB conflict recovery, Capture + download flow, Platform routing

---

## MJPEG Stream Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Raw MJPEG passthrough | Fastify pipes gphoto2 stdout as multipart/x-mixed-replace; img.src points at /api/camera/stream | ✓ |
| SSE frames (base64) | Per-frame base64 over Server-Sent Events | |
| WebSocket frames | Bidirectional WebSocket, unnecessary for one-way video | |

**User's choice:** Raw MJPEG passthrough

---

| Option | Description | Selected |
|--------|-------------|----------|
| /api/camera/stream | Consistent with /api/camera/info, existing Vite proxy covers it | ✓ |
| /camera-stream (top-level) | Separate from /api, needs new proxy rule | |
| You decide | Claude picks | |

**User's choice:** /api/camera/stream

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show disconnect modal immediately | TetheredAdapter.init() fails fast if no camera; reuse existing modal | |
| Fall back to webcam | Auto-fallback silently to getUserMedia | |
| Block app with dedicated screen | New "plug in your camera" blocking screen | |

**User's choice:** Initially selected "Show disconnect modal", then revised — user wants to fall back to webcam and let host select any camera type. Resolved into the startup picker (see Platform Routing).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fallback silently | No DSLR → silently use WebcamAdapter | |
| Startup picker screen | New screen before idle; host taps DSLR or Webcam tile | ✓ |
| URL param / env flag | Force mode via ?mode=tethered | |

**User's choice:** Startup picker screen

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always on startup | Every launch shows picker, host confirms camera | ✓ |
| Only when multiple cameras detected | Auto-select if only one found | |
| You decide | Claude decides | |

**User's choice:** Always on startup

---

| Option | Description | Selected |
|--------|-------------|----------|
| 2 tiles: DSLR + Webcam with detection status | DSLR shows Connected/Not detected; Webcam always Available | ✓ |
| Simple list labels only | No detection status | |
| You decide | Claude picks layout | |

**User's choice:** 2 tiles with detection status (Connected / Not detected / Available)

---

## USB Conflict Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-kill gvfs silently | pkill gvfs-gphoto2-volume-monitor before gphoto2 | |
| Detect -53 error, show user instructions | Surface specific USB conflict message via modal | ✓ |
| You decide | Claude handles | |

**User's choice:** Detect -53 error, show user instructions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse DisconnectModal with specific message | Add message prop to existing component | ✓ |
| New dedicated CameraErrorModal | Separate component, ~90% duplicate markup | |
| You decide | Claude decides | |

**User's choice:** Reuse DisconnectModal with message prop

---

## Capture + Download Flow

| Option | Description | Selected |
|--------|-------------|----------|
| --capture-image-and-download | Single command: shutter + download to temp path | ✓ |
| --trigger-capture then --get-all-files | Two-step: trigger then pull | |
| You decide | Researcher determines | |

**User's choice:** --capture-image-and-download

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete temp file after sending | /tmp cleanup, no disk buildup | |
| Keep in a session folder | Persist for debugging and Phase 5 local save | ✓ |
| You decide | Claude picks | |

**User's choice:** Keep in a session folder

---

| Option | Description | Selected |
|--------|-------------|----------|
| ./captures/session-{timestamp}/{shot-index}.jpg | Per-session folder, shot-ordered | ✓ |
| ./captures/{YYYY-MM-DD}/{timestamp}-{index}.jpg | Date-organized flat folder | |
| You decide | Claude picks | |

**User's choice:** ./captures/session-{timestamp}/{shot-index}.jpg

---

## Platform Routing

| Option | Description | Selected |
|--------|-------------|----------|
| No — always pick fresh on boot | Picker every launch, no localStorage | ✓ |
| Yes — remember last selection | localStorage persists last choice | |

**User's choice:** Always pick fresh on boot

---

| Option | Description | Selected |
|--------|-------------|----------|
| New 'camera_select' screen state | Add to ScreenName, app boots to camera_select | ✓ |
| Separate startup flow outside session state | Pre-session conditional at root level | |
| You decide | Claude picks | |

**User's choice:** New 'camera_select' screen state

---

| Option | Description | Selected |
|--------|-------------|----------|
| Mutate the adapter singleton | adapter.ts let cameraAdapter; CameraSelectScreen sets it | ✓ |
| Add selectedAdapter to session store | Session store holds CameraAdapter | |
| You decide | Claude decides | |

**User's choice:** Mutate the adapter singleton (change const → let in adapter.ts)

---

## Claude's Discretion

- gphoto2 subprocess timeout values
- MJPEG stream restart behaviour after Retry (cache-busting)
- Exact -53 error string matching in stderr
- LivePreview.svelte update strategy for HTMLImageElement support

## Deferred Ideas

- Auto-kill gvfs silently on startup (user prefers detect-and-prompt)
- URL param / env flag for camera mode
- Remember last camera selection in localStorage
