# Technology Stack

**Project:** PhotoBooth — local web photo booth with DSLR/mirrorless capture, canvas strip editor, GIF + QR sharing
**Researched:** 2026-05-19
**Overall confidence:** HIGH on canvas/QR/build/backend; MEDIUM on GIF + camera bindings (validate during Phase 1)

---

## TL;DR — The Stack

| Layer | Pick | Version | Confidence |
|-------|------|---------|------------|
| Frontend framework | **Svelte 5** (primary) or vanilla TS | 5.55.x | HIGH |
| Canvas editor | **Konva.js** | 10.3.0 | HIGH |
| Camera (Windows) | **getUserMedia()** + native MediaStream API | — | HIGH |
| Camera (Mac/Linux) | **gphoto2 CLI subprocess** via `child_process.spawn` | system pkg | HIGH |
| Live view (Mac/Linux) | gphoto2 `--capture-movie` MJPEG stream OR periodic `--capture-preview` | — | MEDIUM |
| GIF encoder | **gifenc** (mattdesl) | 1.0.x | HIGH |
| GIF (high quality fallback) | **@ffmpeg/ffmpeg** (wasm) | 0.12.15 | MEDIUM |
| QR code | **qrcode** (soldair/node-qrcode) | 1.5.4 | HIGH |
| Upload to 0x0.st | Native **fetch** + `FormData` | — | HIGH |
| Backend framework | **Fastify 5** | 5.8.5 | HIGH |
| File uploads | **@fastify/multipart** | latest | HIGH |
| Realtime (live view, status) | **WebSocket** via `@fastify/websocket` | latest | HIGH |
| Build tooling | **Vite 8** | 8.0.13 | HIGH |
| Packaging | **Pure localhost Node server** (no Electron) | — | HIGH |

---

## Frontend Framework

### Pick: Svelte 5 (5.55.8, published 2026-05-18)

**Why:**
- Single-screen kiosk app — no SSR, routing, or hydration concerns. Svelte's compiler output is small, fast, and the runes API (Svelte 5) is excellent for the reactive state a photo session needs (countdown, current shot index, review/retake flow).
- Tight integration with `<canvas>` and `<video>` elements via direct `bind:this` — Konva and getUserMedia both want raw DOM refs, which Svelte hands out cleanly without `useRef`/`useEffect` ceremony.
- Tiny bundle suits a localhost kiosk where startup latency matters when the event setup is rushed.

**Acceptable alternatives:**
- **Vanilla TS + Vite** — totally defensible for an app this size. Pick this if the team is uncomfortable with a framework. Trade-off: more wiring for the strip editor's reactive state.
- **React 19** (19.2.6) — pick only if the team is already deep in React. Adds bundle weight and ref/effect complexity for no win on a single-screen app.

**Avoid:**
- **Next.js / Nuxt / SvelteKit (SSR mode)** — SSR is wasted overhead on localhost.
- **Vue 3** — fine technically but no advantage over Svelte 5 for this scope; smaller talent pool than React if hiring later.

---

## Canvas Editor — Layer Ordering, Photo Slots, Filters

### Pick: Konva.js 10.3.0 (pushed 2026-05-04, 14.4k stars, 19 open issues)

**Why:**
- The project's editor needs: strip background as image layer, photo slot regions positioned over it, per-photo filters, z-order drag (front/back). Konva's `Stage → Layer → Group → Shape/Image` hierarchy maps **1:1** to this mental model. Photo slot = `Konva.Group` containing `Konva.Image` + clip; layer order = `node.moveUp() / moveToTop()`.
- Built-in filter pipeline: `node.cache(); node.filters([Konva.Filters.Brighten, Konva.Filters.Grayscale, ...])`. No need to bolt on a separate filter library.
- Excellent transformer (`Konva.Transformer`) for the slot-placement UX — resize/rotate handles out of the box.
- Health signals are strong: 19 open issues on 14k stars (Fabric has 463 open on 31k stars — much higher noise/maintainer ratio).
- TypeScript types are first-class.

**Why not Fabric.js (7.4.0):**
- Fabric is more popular and more "general image editor" but its model (single canvas with a flat object list) requires extra work to express "background layer vs photo slot layer vs sticker layer." Doable, but Konva's explicit Layer concept is a better fit.
- Fabric 7 has been a breaking API churn — many community tutorials still target v5/v6. Konva's API has been stable for years.
- Both libraries are viable. If you already have Fabric expertise on the team, use it; otherwise Konva is the cleaner fit.

**Avoid:**
- **PixiJS** — WebGL renderer is overkill, harder filter authoring for static strips.
- **Raw `<canvas>` + custom layer code** — you will reinvent hit testing, transformers, and serialization. Not worth it.
- **HTML/CSS layout for slots** — won't export to a single image cleanly, and z-ordering across `<img>`+`<canvas>` is fragile.

---

## Camera Integration

### Windows — `getUserMedia()` (UVC/webcam mode)

The DSLR is exposed as a regular UVC webcam (vendor utility required: Canon EOS Webcam, Sony Imaging Edge Webcam, Nikon Webcam Utility, Fujifilm X Webcam). From the browser, treat it as any USB camera:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: { exact: chosenId }, width: 1920, height: 1080 }
});
videoEl.srcObject = stream;
// Capture: draw videoEl to OffscreenCanvas, then canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
```

- Use `navigator.mediaDevices.enumerateDevices()` to list cameras and let the user pick (built-in webcam vs DSLR).
- Use `ImageCapture` API where supported for higher-quality stills than drawing video frames; fall back to canvas frame grab elsewhere.
- **HTTPS or localhost required** — the localhost dev/prod URL satisfies this automatically.

**Confidence: HIGH.** Standard browser API, no library needed.

### Mac/Linux — `gphoto2` CLI subprocess

### Pick: spawn the **gphoto2 CLI** via `child_process.spawn`. Do NOT use the `gphoto2` npm package.

**Why CLI, not the npm binding:**
- The npm package **`gphoto2`** (v0.3.2, last published 2020-04-21) is a NAN-based native addon. NAN is the legacy Node native API; modern Node strongly prefers N-API. The package's `package.json` declares `os: ["darwin", "linux"]` only (matches our needs) but `npm install` triggers `node-gyp rebuild` against `libgphoto2-dev`, which is fragile across Node major versions and electron rebuilds. GitHub repo last push 2024-03-28 — alive but not actively maintained for current Node.
- The **`gphoto2` CLI** is the upstream reference implementation, packaged on Homebrew (`brew install gphoto2`) and every Linux distro. It is rock-solid and version-stable.
- Subprocess isolation: if gphoto2 hangs (which it occasionally does on USB hiccups), we kill the process and retry — vs a native addon crash that takes down the Node server.

**Implementation sketch:**
```js
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

// One-shot capture to file
async function capture(outPath) {
  await exec('gphoto2', ['--capture-image-and-download', '--filename', outPath, '--force-overwrite']);
}

// Continuous live view (MJPEG stream on stdout)
function startLiveView(onFrame) {
  const proc = spawn('gphoto2', ['--capture-movie', '--stdout']);
  // Parse MJPEG boundaries from proc.stdout, emit each JPEG frame via WebSocket to browser
  return proc;
}
```

- For live view: `gphoto2 --capture-movie --stdout` produces MJPEG over stdout on most modern Canon/Nikon/Sony/Fuji bodies. Parse `\xff\xd8 ... \xff\xd9` JPEG boundaries server-side and forward each frame to the browser over WebSocket.
- Alternative live view: poll `gphoto2 --capture-preview` every 100-200ms — simpler but lower frame rate.
- Detect camera presence with `gphoto2 --auto-detect` on app start; fall back to getUserMedia if no camera found.

**Confidence: HIGH** on capture; **MEDIUM** on live view (MJPEG parsing has body-specific quirks — validate against the actual camera in Phase 1).

**Pre-flight check at startup:**
```js
try { await exec('gphoto2', ['--version']); } catch { /* fall back to getUserMedia */ }
```

**Document for the README:** users on Mac/Linux must install gphoto2 (`brew install gphoto2` / `sudo apt install gphoto2`). This is acceptable for a kiosk app.

---

## GIF Creation

### Pick: gifenc (mattdesl) — 332 stars, pushed 2024-09-19

**Why:**
- Fastest pure-JS GIF encoder in current benchmarks. Designed by mattdesl (well-known creative coder) for exactly this use case — encoding a sequence of frames into an animated GIF in the browser.
- Tiny (~10KB), no workers required, no wasm — just feed it RGBA `Uint8ClampedArray`s from your canvas:
  ```js
  import { GIFEncoder, quantize, applyPalette } from 'gifenc';
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, { palette, delay: 100 });
  }
  gif.finish();
  const blob = new Blob([gif.bytes()], { type: 'image/gif' });
  ```
- Quality tuning via `quantize(data, 256, { format: 'rgba4444' })` and per-frame palettes.

**Fallback for higher quality / large frames: @ffmpeg/ffmpeg 0.12.15**
- If users want 1080p strip GIFs with better color, fall back to ffmpeg.wasm with a `palettegen + paletteuse` two-pass filter. Adds ~30MB wasm download — gate behind a "high quality" toggle, not the default.

**Avoid:**
- **gif.js** (jnordberg) — last commit 2023, 94 open issues, dithering quality is mediocre, requires Web Worker setup that conflicts with modern bundlers. The historic default but no longer the right choice.
- **gifshot** — last release 2017. Dead.
- **modern-gif** — only 62 stars; viable but smaller community than gifenc; pick only if gifenc has a problem we can't work around.

**Confidence: HIGH** on gifenc fit; **MEDIUM** on whether end-result quality meets project standard — validate by encoding a real session in Phase 1 and inspecting output.

---

## QR Code Generation

### Pick: qrcode (soldair/node-qrcode) 1.5.4 (published 2025-11-13, 8k stars)

**Why:**
- The canonical, dependency-free, browser+node JS QR library. Renders to `<canvas>`, `<img>` (data URL), or SVG string. The browser bundle is ~50KB.
- Pure ECMAScript, no native deps. Works identically in Vite, in a worker, in a Service Worker, anywhere.
- Promise API:
  ```js
  import QRCode from 'qrcode';
  await QRCode.toCanvas(document.getElementById('qr'), url, { width: 400, margin: 2 });
  // or
  const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M' });
  ```

**Acceptable alternative: qr-code-styling 1.9.2** (Feb 2026, 2.8k stars)
- Pick this if the design calls for rounded dots, logo embedding, or gradient QR codes. Heavier (~120KB) and DOM-coupled. For a plain functional QR, `qrcode` wins on simplicity.

**Avoid:**
- **qrcode-generator** (kazuhikoarase) — older, awkward API.
- Server-side rendering of the QR — the URL only arrives after upload completes, so client-side is the natural fit anyway.

**Confidence: HIGH.**

---

## Upload to 0x0.st

### Pick: native `fetch` + `FormData`. No HTTP client library needed.

**0x0.st spec** (per the service's homepage; verify exact field names against `curl https://0x0.st/` during Phase 1):
- `POST https://0x0.st/`
- `Content-Type: multipart/form-data`
- Field name: **`file`** (binary file content)
- Optional fields: `expires` (hours or epoch timestamp), `secret` (use a long URL), `url` (URL-shorten mode)
- Response: **plain-text URL** in the response body (e.g. `https://0x0.st/abc.gif\n`)
- Limit: 512 MiB; default retention up to 1 year (scales with file size).

```js
async function uploadToZeroXZero(blob, filename) {
  const fd = new FormData();
  fd.append('file', blob, filename);
  // Optional: fd.append('expires', '24'); // delete after 24 hours
  const res = await fetch('https://0x0.st/', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`0x0.st upload failed: ${res.status}`);
  return (await res.text()).trim();
}
```

**Progress tracking:** `fetch` does not expose upload progress. If a progress bar is required:
- Use `XMLHttpRequest` with `xhr.upload.onprogress` (legacy but works), OR
- Proxy the upload through the local Fastify backend, which can stream the file and report progress over WebSocket to the browser. (Also dodges any future CORS surprises from 0x0.st.)

**Decision:** start with browser-direct `fetch` (simpler). If progress UX matters, move the upload server-side and report progress via WebSocket. Keep this in PITFALLS.

**Headers — be polite:** set a `User-Agent` if uploading from Node (browser sets its own UA). 0x0.st operators ask uncreative bots to identify themselves.

**Confidence: MEDIUM** on exact field semantics — verify with `curl -F'file=@test.jpg' https://0x0.st/` in Phase 1 before building UI around it.

---

## Backend Framework

### Pick: Fastify 5.8.5 (published 2026-04-14)

**Why:**
- Modern, TypeScript-native, schema-based validation built in (great for the small REST surface we need: `POST /upload`, `GET /devices`, `WS /liveview`).
- Plugin ecosystem covers everything we need:
  - `@fastify/multipart` — file uploads from the strip-editor save flow
  - `@fastify/websocket` — live view streaming and session status
  - `@fastify/static` — serve the built Vite frontend
- Lower overhead than Express for the high-frequency live-view WebSocket frames.
- Active: minor release within the last 30 days.

**Acceptable alternative: Express 5.2.1** — fine if the team prefers it; Express 5 modernized error handling and async middleware. Marginally slower than Fastify but for a single-user kiosk that doesn't matter. Pick Express only if Fastify is unfamiliar.

**Avoid:**
- **Hono 4.x** — excellent framework but optimized for edge runtimes (Workers, Deno, Bun). On Node it's fine but offers no advantage over Fastify for this workload, and the Node-specific plugin ecosystem is smaller (multipart, native gphoto2 subprocess wrappers, etc.).
- **NestJS** — DI/decorator overkill for a single-screen app.
- **Koa** — maintained but Express 5 covers the same niche with a bigger ecosystem.

**Confidence: HIGH.**

---

## Build Tooling

### Pick: Vite 8.0.13 (published 2026-05-14)

**Why:**
- The de-facto standard for non-SSR JS/TS apps in 2026. First-class Svelte (and React/Vue) plugins, instant HMR, ESBuild for dev, Rollup for prod.
- Trivial config for the localhost kiosk: `vite build` outputs static assets that `@fastify/static` serves at the root.
- Works seamlessly with the wasm-loading patterns ffmpeg.wasm needs (if we add it).

**Avoid:**
- **Webpack** — slow, complex configs, no advantage here.
- **Parcel** — fine but smaller plugin ecosystem.
- **esbuild standalone** — too low-level; you'd reimplement what Vite gives you.
- **Turbopack** — Next.js-coupled, not a general-purpose option.

**Confidence: HIGH.**

---

## Image Processing (Backend)

**Recommendation: do not include Sharp in the initial stack.** All editing happens in the browser via Konva (filters, composition, export). The backend's only image responsibility is forwarding bytes to/from disk and (optionally) proxying to 0x0.st. Adding Sharp pulls in libvips and complicates packaging.

**If a feature later requires backend image ops** (e.g. server-side EXIF stripping, thumbnail generation, batch resize), add **Sharp** at that point. It's the unambiguous choice for Node image processing — but only if needed.

---

## Packaging — How This Ships

### Pick: Pure localhost Node server + system browser. NO Electron.

**Why:**
- The project context says "runs on a laptop brought to events." That means: install Node (one-time), `git clone`, `npm install`, `npm start`, open `http://localhost:3000` in Chrome/Edge/Firefox.
- Electron would add 100+ MB to the binary, complicate the gphoto2 native binding question (Electron rebuilds), and offer nothing the system browser doesn't already give us. The browser-vendor camera utilities (Canon EOS Webcam etc.) on Windows want a real browser, not a webview, for full getUserMedia support.
- A `start.sh` / `start.bat` that runs `node server.js` and opens the default browser is sufficient.

**If a single-binary distribution becomes a requirement:**
- **pkg** is stale (last update Feb 2024 from Vercel; project is effectively in maintenance) — avoid.
- **Node 22+ Single Executable Applications (SEA)** — official Node feature, still experimental but the future-proof option. Native dependencies (`gphoto2` npm binding) wouldn't fit in SEA, but since we're using the `gphoto2` CLI subprocess this is fine — SEA bundles the JS server, the user installs gphoto2 separately.
- **Tauri 2.x** — only if you want a desktop window with auto-update and code signing. Rust toolchain required to build. Overkill for v1.

**Confidence: HIGH** on the "no Electron" decision.

---

## Realtime Transport (Live View, Session Status)

### Pick: WebSocket via `@fastify/websocket`

**Why:**
- Live view from the Mac/Linux gphoto2 subprocess produces MJPEG frames that need to push to the browser at 15-30 fps. WebSocket binary frames are the right tool — one frame per WS message, the client renders to `<canvas>` or sets `<img src=URL.createObjectURL(blob)>`.
- Server-sent events (SSE) would work for status but are unidirectional and text-oriented — WS handles both binary frames and bidirectional control (shutter command from UI to server) over the same connection.

**On Windows** (getUserMedia path), no WS is needed for live view — the browser owns the camera directly.

**Confidence: HIGH.**

---

## Installation

```bash
# Backend
npm install fastify @fastify/static @fastify/multipart @fastify/websocket

# Frontend
npm install svelte konva gifenc qrcode

# Optional (high-quality GIF, lazy-loaded)
npm install @ffmpeg/ffmpeg @ffmpeg/util

# Dev
npm install -D vite @sveltejs/vite-plugin-svelte typescript @types/qrcode

# System dependencies (Mac/Linux only, for DSLR shutter trigger)
# macOS:   brew install gphoto2
# Debian:  sudo apt install gphoto2 libgphoto2-dev
# Arch:    sudo pacman -S gphoto2
```

No `node-gyp` builds, no native compilation in our `npm install`. All native code (gphoto2) is the system package, invoked as a subprocess.

---

## Alternatives Considered (Quick Reference)

| Category | Recommended | Strong Alt | Rejected | Why Rejected |
|----------|-------------|------------|----------|--------------|
| Frontend | Svelte 5 | Vanilla TS, React 19 | Next.js / Nuxt | SSR is wasted on localhost |
| Canvas | Konva.js | Fabric.js | PixiJS, raw canvas | WebGL overkill / reinvention |
| Camera Mac/Linux | gphoto2 CLI subprocess | — | `gphoto2` npm (lwille) | NAN-based, stale (2020 npm pub), fragile native build |
| GIF | gifenc | @ffmpeg/ffmpeg (HQ) | gif.js, gifshot | Stale, mediocre dithering |
| QR | qrcode | qr-code-styling | qrcode-generator | Older, awkward API |
| Backend | Fastify 5 | Express 5 | Hono, NestJS, Koa | Wrong fit / overkill |
| Build | Vite 8 | — | Webpack, Parcel | Slower, larger configs |
| Packaging | Localhost server | Node SEA (future) | Electron, pkg, Tauri | Adds weight without benefit |
| Realtime | WebSocket | — | SSE | Need binary + bidirectional |
| Backend image ops | (none) | Sharp (if needed) | — | Browser/Konva handles it |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Canvas (Konva) | HIGH | Health metrics + API fit are unambiguous |
| QR (qrcode) | HIGH | Canonical lib, used everywhere |
| Build (Vite) | HIGH | Industry default |
| Backend (Fastify) | HIGH | Active, fits scope |
| Frontend (Svelte 5) | HIGH | Best fit, but vanilla/React are also valid |
| Camera Windows (getUserMedia) | HIGH | Standard browser API |
| Camera Mac/Linux (gphoto2 CLI) | HIGH | Stable system tool |
| gphoto2 live view (MJPEG stream) | MEDIUM | Body-specific; validate against real camera |
| GIF (gifenc) | HIGH on choice, MEDIUM on quality outcome — Phase 1 must validate visible result |
| 0x0.st upload | MEDIUM | Exact form field name and response format need a live `curl` check at implementation time |
| No Electron | HIGH | Project context (kiosk laptop) makes this clear |

---

## Sources

- npm registry (`npm view <pkg> version time.modified`) for all version data, queried 2026-05-19
- GitHub REST API for repo activity:
  - https://github.com/konvajs/konva (14.4k stars, pushed 2026-05-04, 19 open issues)
  - https://github.com/fabricjs/fabric.js (31.2k stars, pushed 2026-05-18, 463 open issues)
  - https://github.com/mattdesl/gifenc (332 stars, pushed 2024-09-19)
  - https://github.com/jnordberg/gif.js (4968 stars, pushed 2023-10-06 — stale)
  - https://github.com/qq15725/modern-gif (62 stars, pushed 2026-04-16)
  - https://github.com/lwille/node-gphoto2 (301 stars, pushed 2024-03-28, NAN-based)
  - https://github.com/soldair/node-qrcode (8.1k stars, pushed 2024-08-23)
  - https://github.com/kozakdenys/qr-code-styling (2.8k stars, pushed 2026-02-14)
- `gphoto2` npm `package.json` raw fetch (NAN dependency, `os: [darwin, linux]`, `preinstall` requires libgphoto2-dev)
- gphoto2 CLI manual (`gphoto2 --help`, `--capture-movie`, `--capture-image-and-download`, `--auto-detect`) — system-standard tool
- 0x0.st service — homepage spec to be verified at implementation (`curl -F'file=@x' https://0x0.st/`)
- Project context: `.planning/PROJECT.md`
