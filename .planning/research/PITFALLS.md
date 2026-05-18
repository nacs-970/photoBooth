# Domain Pitfalls: PhotoBooth

**Domain:** Browser-based photo booth with DSLR/mirrorless camera integration
**Date:** 2026-05-19
**Confidence:** MEDIUM overall (training-data knowledge; flagged items should be empirically confirmed during Phase 1 spike)

---

## Critical Pitfalls

### 1. gphoto2 — Camera claimed by gvfs / kernel auto-mount

**What goes wrong:** On Linux (GNOME) and macOS, the OS volume daemon (`gvfs-gphoto2-volume-monitor` on Linux, `PTPCamera` on macOS) claims the USB interface the moment the camera is plugged in. gphoto2 fails with `Could not claim the USB device (-53)`.

**Warning signs:** First shot after fresh boot works, subsequent shots fail. Camera shows as a drive in Finder/Nautilus. Intermittent failures after replug.

**Prevention:**
- Linux: `pkill -f gvfs-gphoto2-volume-monitor && pkill -f gvfsd-gphoto2` at app startup.
- macOS: `killall PTPCamera` after plug-in.
- Wrap every gphoto2 invocation: on `-53`, kill daemon, wait 500ms, retry once.
- Serialize all camera ops through a single queue — no parallel gphoto2 calls.

**Phase:** Phase 1 (camera capture spike). Verify on clean machine before any UI work.

**Confidence:** HIGH

---

### 2. gphoto2 — Concurrent process / stuck session

**What goes wrong:** A previous crashed or unclean gphoto2 process still holds the camera. New captures hang or fail silently.

**Warning signs:** Capture takes >2s when normally <500ms; subsequent captures hang.

**Prevention:**
- `pkill gphoto2` at app startup.
- Serialize via `p-queue` concurrency 1 — never parallel captures.
- Capture timeout >5s → abort, kill, recover. Show "Camera reconnect needed" UI.
- Warm-up call on startup: `gphoto2 --get-config /main/status/model`.

**Phase:** Phase 1 + Phase 4 (resilience).

**Confidence:** HIGH

---

### 3. Camera disconnect mid-session

**What goes wrong:** USB jiggle, battery death, camera auto-sleep (30s–5min), or mode dial bump kills the session mid-capture. `videoTrack.readyState` becomes `"ended"` silently on getUserMedia path.

**Warning signs:** Frozen countdown; capture never resolves; `videoTrack.readyState !== 'live'`.

**Prevention:**
- Disable camera sleep in settings (document in setup checklist).
- Heartbeat every 5s: `gphoto2 --get-config /main/status/model` or `videoTrack.readyState` check.
- Dedicated "Camera disconnected — check cable" screen with retry button.
- Per-session state: allow re-shoot of one frame without restarting the whole session.
- External power (dummy battery / AC adapter) strongly recommended.

**Phase:** Phase 1 (basic detection) + Phase 4 (full resilience UX).

**Confidence:** HIGH

---

### 4. Browser permission prompts breaking kiosk flow

**What goes wrong:** Chrome/Edge show camera permission prompts on first use. Accidentally denied → camera unusable until site settings reset. `getUserMedia` requires secure context — `http://192.168.x.x` or `http://hostname.local` is NOT secure; only `http://localhost` or `https://` works.

**Warning signs:** `getUserMedia()` rejects with `NotAllowedError`; permission state is `"denied"` or `"prompt"`.

**Prevention:**
- Always use `http://localhost` — never IP or hostname.
- Launch Chrome kiosk with: `--kiosk --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required`.
- Or: dedicated Chrome profile with permission pre-granted.
- Detect via `navigator.permissions.query({name:'camera'})` — show setup screen if not granted.

**Phase:** Phase 1 + Phase 4 (kiosk launcher/setup script).

**Confidence:** HIGH

---

### 5. GIF memory blow-up with high-res photos

**What goes wrong:** Naively encoding 4–6 full-res DSLR shots (24 MP each) in-browser:
- Hundreds of MB of ImageData per frame → tab OOM crash
- Output exceeds 0x0.st 512 MiB limit
- 30s–2min encode on main thread → UI freezes

**Warning signs:** Encoder takes >5s; tab memory spikes >1 GB; blob exceeds 50 MB.

**Prevention:**
- **Downscale aggressively before encoding** — target 480–720px long edge for GIFs.
- **Web Worker** — gif.js and gifenc both support workers; main thread must stay live.
- Cap frame count — N frames from session, not every burst frame.
- Pre-compute palette across frames (gifenc feature) — smaller files.
- Keep original Blobs separate; don't re-encode from canvas (double degradation).
- Test on actual event laptop with realistic input sizes.

**Phase:** Phase 3 (GIF feature). Must include sizing budget in the spec.

**Confidence:** HIGH

---

### 6. 0x0.st — CORS / browser-direct upload failures

**What goes wrong:** `fetch()` to 0x0.st from browser may CORS-fail (designed for curl, not XHR). Rate-limits by IP at high volume. Response is plain-text URL, not JSON.

**Warning signs:** CORS error in console; `fetch` rejects; HTTP 429 or 503.

**Prevention:**
- **Route uploads through the Node.js backend** (`POST /api/share` → backend → 0x0.st). No CORS constraint. Easy to swap hosts later.
- Retry with exponential backoff on 5xx and network errors.
- Local fallback: if upload fails, save strip+GIF to disk and show "Try again later" message.
- Pre-flight 0x0.st at app startup (HEAD request) to detect no-internet before the event.

**Phase:** Phase 5 (sharing). Verify CORS behavior on day one of that phase.

**Confidence:** HIGH (CORS concern); MEDIUM (exact 0x0.st headers — verify empirically)

---

### 7. Event venue has no internet — upload silently fails

**What goes wrong:** Venue Wi-Fi is captive-portal'd, congested, or absent. Upload throws; guest has already finished their strip with no graceful path.

**Prevention:**
- Detect connectivity at session start: `navigator.onLine` + HEAD request to 0x0.st.
- Queue uploads — save to disk when offline, drain when connectivity returns.
- **Always save locally regardless of upload success** — disk is reliable, internet is not.
- Show clear "Uploading…" → "Share link ready" → "Saved locally (will retry)" states.

**Phase:** Phase 5 — must include offline fallback.

**Confidence:** HIGH

---

## Moderate Pitfalls

### 8. Canvas editor — serialization edge cases

**What goes wrong:** Fabric's `toJSON()` omits custom subclasses unless registered. Image sources serialize as huge data URLs. Filter params don't round-trip cleanly across versions.

**Prevention:**
- Define photo slots as primitive groups with metadata in `.data`, not custom subclasses.
- Store image sources as IDs that resolve through your own asset loader, not embedded data URLs.
- Version the serialization format: `{ schemaVersion: 1, ... }`.
- Round-trip test: save → reload → re-render → diff.

**Phase:** Phase 2 (canvas editor). Decide serialization format on day one.

**Confidence:** HIGH

---

### 9. Canvas editor — performance with large images + many layers

**What goes wrong:** 4K background + 4×24MP photos + filters = <30 FPS drag.

**Prevention:**
- Downsample on import — store working copy at 2× slot size, keep original for export.
- Cache unchanged layers: `object.cache()` (Konva) / `objectCaching: true` (Fabric).
- Throttle drag via `requestAnimationFrame`.
- Cap `devicePixelRatio` at 1.5–2 during editing; full DPR on final export only.

**Phase:** Phase 2.

**Confidence:** HIGH

---

### 10. Windows DSLR webcam mode — vendor utility quirks

**What goes wrong:** Canon/Sony/Nikon/Fuji webcam utilities each have quirks:
- Lock to 720p — not full sensor
- Require "Movie" mode (shutter = screenshot, not real capture)
- Conflict with other webcam software
- Camera must connect before service starts

**Prevention:**
- Set explicit expectations: Windows path = webcam-quality (720p screenshot); Mac/Linux gphoto2 path = DSLR-quality. This is architectural, not a bug.
- Document per-vendor setup checklist.
- Show resolution in camera-select UI.
- Save preferred `deviceId` to localStorage for auto-select.
- Test actual camera+laptop combo before every event.

**Phase:** Phase 1. Set expectations in PROJECT.md before Phase 1 starts.

**Confidence:** HIGH

---

### 11. Cross-platform path handling

**What goes wrong:** Forward-slash hardcoding, `process.env.HOME` on Windows, spaces/unicode in usernames breaking shell-outs.

**Prevention:**
- Always `path.join()` / `path.resolve()`, never string concat.
- Use `os.homedir()`.
- Pass args as arrays to `spawn`, never string-concat into `exec`.
- Case-sensitivity: `Photo.jpg` ≠ `photo.jpg` on Linux.

**Phase:** Phase 1 onward, especially "save to disk."

**Confidence:** HIGH

---

### 12. Countdown / capture timing drift

**What goes wrong:** gphoto2 has 200–800ms latency after countdown ends (mirror flip + AF). Guests have broken pose by shutter click.

**Prevention:**
- Measure actual camera latency in Phase 1 spike, subtract from countdown.
- Pre-focus before countdown ends: `gphoto2 --set-config autofocusdrive=1`.
- Show "frozen frame" as immediate feedback — guests don't need to see the blank 300ms gap.
- Enforce inter-shot delay matching camera buffer rate.

**Phase:** Phase 1 spike.

**Confidence:** HIGH

---

### 13. Long-running kiosk — memory leaks

**What goes wrong:** After 6 hours, canvas references, MediaStream tracks, and GIF workers accumulate. Tab crashes or sluggishes.

**Prevention:**
- Stop tracks: `stream.getTracks().forEach(t => t.stop())` between sessions.
- Dispose canvas: `canvas.dispose()` / `stage.destroy()`.
- Terminate GIF workers after each encode.
- Optional: hard-reload between sessions (templates must persist to disk/localStorage).
- Memory profile at end of Phase 6 — mock sessions for 1 hour, watch for monotonic growth.

**Phase:** Phase 4 / final polish.

**Confidence:** HIGH

---

## Minor Pitfalls

| # | Pitfall | Fix | Phase |
|---|---------|-----|-------|
| 14 | QR too small or low error-correction | Use EC-M or Q; render ≥200×200px; test with dim lighting | Phase 5 |
| 15 | Strip export size (PNG = 20MB) | Export JPEG quality 0.9 for sharing; PNG for local archive | Phase 2/5 |
| 16 | Filename collisions on rapid sessions | Use `Date.now() + crypto.randomUUID().slice(0,8)` | Phase 1 |
| 17 | Browser zoom breaking kiosk layout | Lock zoom; use viewport units; resize listener re-fits canvas | Phase 4/6 |
| 18 | Color management — washed out on phone | Embed sRGB ICC profile in JPEG; don't use Display P3 for export | Phase 5 polish |
| 19 | 0x0.st privacy — public URLs | Show consent notice; document 1-year retention | Phase 5 |
| 20 | Event lighting — blurry/noisy shots | Admin panel with gphoto2 config controls (ISO, shutter, WB) | Phase 1+ admin |

---

## Phase-Specific Warning Summary

| Phase | Top Pitfalls |
|-------|-------------|
| Phase 1: Camera capture | gphoto2 USB claim (#1,#2), camera disconnect (#3), Windows quirks (#10), timing (#12) |
| Phase 1: Permissions | Browser permission UX (#4) |
| Phase 2: Canvas editor | Serialization (#8), performance (#9), zoom/DPI (#17) |
| Phase 3: GIF | Memory blow-up (#5) |
| Phase 4: Resilience | Disconnect recovery (#3), long-run leaks (#13), zoom (#17) |
| Phase 5: Sharing | CORS via backend (#6), offline fallback (#7), privacy (#19), QR size (#14), export format (#15) |
| Cross-cutting | Paths (#11), lighting (#20), filenames (#16), color (#18) |

---

## Top 5 — Fix Before Anything Else

1. **gphoto2 USB claim** (#1) — will hose your first event
2. **Camera disconnect resilience** (#3) — events are chaotic
3. **GIF memory budget** (#5) — OOM crash mid-event is catastrophic
4. **Upload via backend not browser** (#6) — avoid CORS dead-ends
5. **Offline sharing fallback** (#7) — venue Wi-Fi will fail

---
*Last updated: 2026-05-19*
