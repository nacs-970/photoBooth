# Desktop App Packaging — Discussion Notes

**Date:** 2026-09-26
**Status:** Proposal. Nothing is decided or built yet.
**Trigger:** The user wants the photo booth to ship as a real executable instead of a localhost web app. Both the dev environment and the shipped file must be lightweight.

## Goal

- The guest-facing machine runs one double-clickable app. No browser tab and no `npm run dev`.
- The product file is small: target under ~20 MB, including gphoto2.
- The dev setup is small and fast: no multi-GB toolchain and no multi-minute builds.

## Current stack (what gets replaced)

- Frontend: Svelte 5 + Vite 8 + TypeScript. Canvas MJPEG preview (`web/src/lib/camera/mjpeg.ts`). 71 vitest tests.
- Backend: Fastify 5 on Node, run with `tsx`. About 415 lines, mostly `server/src/camera/CameraService.ts`.
  - It runs one persistent `gphoto2 --shell`, with commands serialized through `p-queue`.
- Camera: the gphoto2 CLI on Mac/Linux; `getUserMedia()` on Windows.

## Options compared

| Option | Product file | Dev weight | Verdict |
|---|---|---|---|
| Electron | ~100 MB installer, ~250 MB idle RAM | Light (JS only) | Product too heavy |
| Tauri (Rust backend) | ~5–10 MB | Heavy: Rust toolchain ~1–2 GB, `target/` ~2–4 GB, first build takes minutes | Dev too heavy |
| **Wails (Go backend)** | **~8–15 MB** | **Light: Go toolchain ~250 MB, builds in seconds** | **Recommended** |
| Go binary + system browser in `--kiosk` | ~8 MB | Lightest | Needs Chrome/Firefox installed on the machine |
| Native rewrite (Qt etc.) | small | Heavy | Rejected: it throws away Phases 1–2 |

All sizes are estimates, not measurements.

Node cannot ship small: a Node SEA or `pkg` binary is ~90 MB. So a lightweight product needs a compiled backend, and Go is the lightest one to develop in.

## Recommendation: Wails (Go) + bundled gphoto2

- **The frontend is unchanged.** The Svelte UI, canvas preview, MJPEG parser, vitest suite, and the planned Konva/gifenc/qrcode stay.
- **The backend is ported to Go.** The ~415 lines of Fastify/TS become Go (`os/exec`, `bufio`). Keep the same `/api/camera/*` routes so the frontend `fetch` calls do not change.
- **Dev:** `wails dev` gives Vite hot reload plus Go rebuilds. This drops `concurrently`, Fastify and the Node backend deps.
- **Product:** one binary with the UI embedded.

### Rules that must carry over to the Go port (learned in 02-06)

- One persistent `gphoto2 --force-overwrite --shell` session for preview and capture. Never spawn one process per frame or per capture.
- Never SIGKILL gphoto2, because it freezes the camera. Send `exit`, then SIGINT.
- Send `set-config capturemode=Single Shot` (unquoted) on every new shell session.
- Serialize all camera commands through one queue.
- The Sony ILCE-7M4 has a 3s wait from session start before the first capture. Keep the session warm during the countdown.

## Bundling gphoto2 inside the app

**Linux/Mac contents:**
- the `gphoto2` CLI binary, so the existing `--shell` logic stays
- `libgphoto2` and `libgphoto2_port`
- only the `ptp2` camlib (Sony/Canon/Nikon/Fuji over PTP), plus the `usb1` iolib
- `libusb-1.0` and `libltdl`

Estimated size is ~3–6 MB (unmeasured).

**Relocation:** the Go backend sets the `CAMLIBS` and `IOLIBS` env vars to the bundled folders when it spawns `gphoto2`.

**Per OS:**
- **Linux:**
  - Pack as an AppImage. `linuxdeploy`/`patchelf` fix the library paths.
  - The app needs a udev rule for non-root USB access. It installs the rule once on first run via `pkexec`.
  - The gvfs conflict stays, so keep the USB_CONFLICT message.
- **macOS:**
  - Bundle the dylibs into `.app/Contents/Frameworks` and fix paths with `install_name_tool`.
  - Everything must be code-signed and notarized.
  - The system daemon `ptpcamerad` grabs the camera, the same way gvfs does on Linux.
- **Windows:** do not bundle gphoto2. It needs a per-camera WinUSB driver swap through Zadig, which is bad kiosk UX. Keep the webcam path via `getUserMedia`. The WebView2 webview is Chromium-based.

**License (not legal advice):**
- libgphoto2 is LGPL-2.1 and the gphoto2 CLI is GPL-2.
- The app calls the CLI as a separate process, which is likely "aggregation". Our code can stay closed.
- We must ship the license texts and provide the source (or a written offer) for the bundled builds.

**Deferred:** Go cgo bindings straight to libgphoto2. They would remove the shell parsing, but cross-compiling cgo is painful and the proven 02-06 logic would be redone. Revisit only if the CLI shell becomes a bottleneck.

## Open risks — verify in a spike first

1. **MJPEG streaming through the Wails asset server.** It is unknown whether the asset server can stream multipart responses. Fallback: the Go side runs a small `net/http` server on 127.0.0.1, and the frontend fetches from it.
2. **Canvas preview speed in WebKitGTK (Linux).** The measured figures (~25 fps, ~300 MB RAM) came from Firefox/Chromium. WebKit is untested.
3. **Bundled gphoto2 on a clean machine.** Check that the AppImage finds its camlibs, and that the udev rule install works.

## Proposed next steps

1. Finish 02-07 and the Phase 2 hardware UAT. It validates the camera logic that the Go port copies.
2. `/gsd-spike` Wails, about 1 hour:
   - Stream MJPEG to a canvas in WebKitGTK and measure fps and RAM.
   - Try launching the bundled gphoto2 using `CAMLIBS`/`IOLIBS`.
3. If the spike passes:
   - Add a phase "Desktop app: Wails + Go backend + bundled gphoto2".
   - Update the stack in `PROJECT.md` and `CLAUDE.md`. Later phases (disk save, `/api/share` upload proxy) would be built in Go instead of Fastify.
4. If WebKitGTK fails: fall back to the Go binary + system browser in `--kiosk`, or accept Electron's size.

## Sharing: self-hosted public links with expiry (replaces 0x0.st)

**Want:** The photo is on the open internet, and anyone with the link can view it. Links expire after a set time. No third-party host or relay: no 0x0.st, no Cloudflare/ngrok tunnels, no S3 or R2.

**Hard fact:** A booth laptop at a venue sits behind NAT, and often behind CGNAT on mobile or ISP networks. The internet cannot reach it directly. There are two self-owned ways around this:

| Option | How | Verdict |
|---|---|---|
| **Own VPS (recommended)** | The booth uploads to your own small server (~$4–6/mo, plus a domain). The server holds the file until it expires. | Works at any venue. Links keep working after the booth shuts down. |
| Direct from the booth | Port-forward on the venue router to the booth | Only works if you control the router and have a real public IP (no CGNAT). The booth laptop is exposed to the internet, and links die when the booth goes offline. Not reliable. |

**Recommended shape: one Go binary, two modes**
- `booth` mode (Wails desktop app):
  - Save the strip and GIF to disk first (existing rule).
  - POST them to your server with an API key.
  - Render the QR code from the returned URL.
  - Offline: queue the upload and retry (OUT-06 stays).
- `share` mode (headless, on the VPS):
  - `POST /upload` (API key required) stores the file and returns `https://<domain>/s/<token>`.
  - `GET /s/<token>` serves the photo page and the download.
  - Once expired, it returns `410 Gone` and a cleanup goroutine deletes the files.
- The TTL is set by the host (e.g. 24h / 7d / 30d), per event or per upload.
- HTTPS in Go via `golang.org/x/crypto/acme/autocert` (Let's Encrypt). There is no extra web server to run. Caddy is the alternative.

**Security rules (required)**
- Upload is authenticated with an API key held by the booth. Otherwise strangers can use your server as free hosting.
- Each share gets an unguessable random token (128-bit). There is no directory listing and no index of shares.
- Look files up by token only, never from the URL path, so there is no path traversal.
- Limit upload size, check content type (JPEG/PNG/GIF only), and rate-limit.
- The booth's camera API is never exposed to the internet. Only the VPS is public.

**Requirement impact:**
- OUT-03: change "0x0.st" to "own share server".
- OUT-04: unchanged. The QR code still comes from the upload URL.
- OUT-06: unchanged. Offline queue and retry stay.
- Add a new requirement for link expiry.
- Phase 5 SC #3: change "0x0.st" to "own share server".
- Update the Out-of-Scope note ("0x0.st + QR is sufficient").
- Decide this before planning Phase 5.
