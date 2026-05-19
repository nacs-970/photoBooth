# Phase 1: Foundation & Webcam Session Loop — Research

**Researched:** 2026-05-19
**Domain:** Svelte 5 SPA scaffold + getUserMedia camera loop + per-shot retake state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Svelte store state machine — root `App.svelte` renders a different screen component based on a store value (`$screen`). No URL changes, no routing library. Store states: `idle | countdown_preview | review | photo_grid`.
- **D-02:** Screens in order: Idle → Countdown+Preview (combined, countdown overlays live webcam) → Review (per shot) → repeat until N shots done → Photo Grid stub → back to Idle via "Start New Session".
- **D-03:** Phase 1 post-session screen is a photo grid stub: shows captured thumbnails in a grid. GIF/upload/QR slots are NOT present in Phase 1 — full share flow is Phase 5 scope.
- **D-04:** Screen transitions: Svelte fade/crossfade (~200–300ms). Clean transitions between all screen states.
- **D-05:** Camera disconnect (CAM-04) is an overlay modal, not a dedicated screen. Modal appears over whatever screen is active; session state is preserved beneath it. Retry dismisses the modal and resumes.
- **D-06:** Review screen waits indefinitely — guest must tap "Keep" or "Retake". No auto-advance timeout.
- **D-07:** Retake overwrites the slot in place — new capture replaces `shots[N]` at the same index. No history/discard tracking.
- **D-08:** Review screen shows: full-size thumbnail + shot progress indicator ("2 of 4") + Keep/Retake buttons.
- **D-09:** After "Keep" (not last shot): brief "photo saved" confirmation (~1–1.5s), then transition back to Countdown+Preview for the next shot.
- **D-10:** Countdown triggers on guest tap — a "Start"/"Go" button on the Countdown+Preview screen. Does not auto-start when the screen appears.
- **D-11:** Countdown visual: progress ring/arc around the number, filling as time passes — overlays the live webcam preview. Number centered in the ring.
- **D-12:** On capture: full-screen white flash + shutter sound simultaneously. Flash ~300ms duration.
- **D-13:** Audio: shutter sound only on capture. Countdown ticks are silent.
- **D-14:** Idle screen shows live webcam preview + large centered "Tap to Start" button overlaid on the preview feed.
- **D-15:** Camera is always running on idle — webcam feed active as soon as app loads. Guests see themselves, which is the attract.
- **D-16:** After session ends (photo grid screen): "Start New Session" button resets state and returns to Idle. No auto-reset timeout in Phase 1.

### Claude's Discretion

- Flash fade-out duration (suggested ~300ms) — locked in UI-SPEC at 300ms ease-out
- "Photo saved" confirmation display duration (suggested 1–1.5s) — locked in UI-SPEC at 1200ms total
- Progress ring animation easing and speed — locked in UI-SPEC as linear over countdownMs
- Exact shutter sound asset (standard camera click .mp3/.ogg)
- Svelte transition duration for screen crossfades (suggested 200ms) — locked in UI-SPEC at 250ms ease-out

### Deferred Ideas (OUT OF SCOPE)

- **Full share flow** — Phase 5 scope (OUT-01 through OUT-06). Phase 1 delivers the photo grid stub only.
- **Auto-reset timeout** — timed kiosk reset after inactivity. Not in Phase 1 (KIOSK-V2-03).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAM-01 | System auto-detects OS at startup and selects getUserMedia on Windows (or fallback elsewhere) without manual configuration | CameraAdapter pattern with `GET /api/camera/info` capability probe; `navigator.platform` + Node `os.platform()` |
| CAM-02 | On Windows, camera preview and capture use `getUserMedia()` via vendor UVC/webcam utility | WebcamAdapter implementation using MediaStream API; `enumerateDevices()` for device selection |
| CAM-04 | When camera disconnects mid-session, app shows "Camera disconnected — check cable" with retry button instead of crashing | `MediaStreamTrack` `ended` event + `devicechange` polling fallback; modal overlay pattern per D-05 |
| SESS-01 | Multi-shot session: countdown × N captures; shot count and countdown duration configurable (default 4 shots, 3s countdown) | `config.ts` constants module; session store state machine |
| SESS-02 | Each capture shows a white flash overlay as visual feedback | `<FlashOverlay>` component; CSS opacity transition 300ms |
| SESS-03 | Each capture plays a shutter sound as audio feedback | `<audio>` preloaded + `.play()` after first user gesture unlocks AudioContext |
| SESS-04 | After each shot, guest sees thumbnail review with option to retake that slot before moving to next shot | Review screen; slot overwrite pattern; `shots` array in session store |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold that establishes every pattern downstream phases will follow. The goal is a working countdown → capture × N → per-shot retake session loop using `getUserMedia` on the easy (Windows) camera path, while defining the `CameraAdapter` interface that Phase 2 (gphoto2) will implement behind the same contract.

The technology decisions are already locked in STACK.md and ARCHITECTURE.md (Svelte 5, Vite 8, Fastify 5). What this research resolves is the **Phase 1-specific implementation layer**: how to wire Svelte 5 runes into the session state machine, how to structure the repo scaffold, how to detect camera disconnect reliably, how to handle audio autoplay gating, and how to set up the test framework for a Svelte 5 + Vitest environment.

The most load-bearing deliverable of Phase 1 is the `CameraAdapter` TypeScript interface. If it ships with the wrong shape, Phase 2 will contort gphoto2 around bad abstractions or force screen code rewrites. The planner must make "Lock CameraAdapter interface" the first task, not the last.

**Primary recommendation:** Scaffold a single repo with `web/` (Svelte 5 + Vite 8) and `server/` (Fastify 5) separated by directory, sharing a root `package.json` with `concurrently` for dev. Define the `CameraAdapter` interface first, implement `WebcamAdapter` for Phase 1, stub `TetheredAdapter`. Everything else builds on top of that contract.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera live preview | Browser / Client | — | `getUserMedia` MediaStream drives a `<video>` element directly; no backend involvement on Windows path |
| Camera capture (still) | Browser / Client | — | Frame grab from `<video>` → `OffscreenCanvas` → `Blob`; stays in browser for Phase 1 |
| Camera disconnect detection | Browser / Client | — | `MediaStreamTrack.ended` event + `devicechange` polling lives in the WebcamAdapter |
| OS/platform detection | API / Backend | Browser / Client | Node `os.platform()` on the backend is authoritative; browser `navigator.platform` is unreliable and deprecated |
| Session state machine | Browser / Client | — | In-memory `$state` store in `web/src/lib/session.svelte.ts`; backend is stateless |
| Countdown UI + ring | Browser / Client | — | SVG animation in `<CountdownRing>` component; pure browser |
| White flash + shutter sound | Browser / Client | — | CSS opacity transition + `<audio>.play()` in browser |
| Static asset serving | API / Backend | — | Fastify `@fastify/static` serves `web/dist/` in production |
| Camera capability probe | API / Backend | Browser / Client | `GET /api/camera/info` returns `{ platform, cameraMode }` — single source of truth for adapter selection |

---

## Standard Stack

> Phase 1 install list only. Konva, gifenc, qrcode are NOT installed in Phase 1 — they belong to Phases 4–5.

### Core (Production)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | 5.55.8 | UI framework — runes reactivity, component model | Locked in STACK.md; compiler-first, zero runtime overhead, ideal for kiosk |
| `@sveltejs/vite-plugin-svelte` | 7.1.2 | Svelte compilation in Vite | Official plugin; required for Vite 8 + Svelte 5 [VERIFIED: npm registry — peer deps: `svelte ^5.46.4`, `vite ^8.0.0`] |
| `vite` | 8.0.13 | Build tool, dev server, HMR | Locked in STACK.md; industry default |
| `fastify` | 5.8.5 | Node backend — capability probe endpoint + static serving | Locked in STACK.md |
| `@fastify/static` | 9.1.3 | Serve `web/dist/` in production | Standard Fastify plugin for SPA hosting |
| `typescript` | 6.0.3 | Type safety across web/ and server/ | Locked in project stack; required for CameraAdapter interface |
| `concurrently` | 9.2.1 | Run `vite dev` + `tsx server/index.ts` together in development | Standard multi-process dev tool |
| `tsx` | 4.22.3 | TypeScript execution for Fastify dev server (no compile step) | Faster than ts-node; used with `tsx watch` |

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.6 | Test runner — Vite-native, same transform pipeline | All unit tests; required by `nyquist_validation: true` |
| `@testing-library/svelte` | 5.3.1 | Svelte 5 component testing with JSDOM | Component interaction tests (clicks, renders, state changes) |
| `@testing-library/jest-dom` | 6.9.1 | Custom DOM matchers for vitest (`toBeVisible`, `toHaveText`) | Setup file; used in all component tests |
| `happy-dom` | 20.9.0 | Fast DOM environment (faster than jsdom for CI) | Vitest environment (alternative: jsdom — both work) |

### Installation

```bash
# From project root
# Web (frontend)
cd web && npm install svelte @sveltejs/vite-plugin-svelte vite typescript
npm install -D vitest @testing-library/svelte @testing-library/jest-dom happy-dom

# Server (backend)
cd server && npm install fastify @fastify/static tsx typescript
npm install -D tsx concurrently
```

**Note:** A simpler alternative is a root-level `package.json` workspace with `web/` and `server/` as workspaces.

### Version Verification

All versions confirmed against npm registry on 2026-05-19:
- `svelte` 5.55.8 — published 2026-05-18
- `@sveltejs/vite-plugin-svelte` 7.1.2 — published 2026-05-07; peer deps `svelte ^5.46.4`, `vite ^8.0.0` [VERIFIED: npm registry]
- `vitest` 4.1.6 — published 2026-05-19; first released 2021-12-03 (stable, ~4.5 years old)
- `@testing-library/svelte` 5.3.1 — published 2025-12-25; first released 2019-06-01 (stable, ~7 years old)
- `happy-dom` 20.9.0 — first released 2019-09-15 (stable, ~6.5 years old)

---

## Package Legitimacy Audit

> slopcheck was run but detected packages against PyPI (wrong ecosystem — this is a Node.js project). slopcheck's PyPI check is irrelevant here. All packages verified against npm registry directly as the authoritative source.

| Package | Registry | Age | Source Repo | npm verify | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `svelte` | npm | 9+ years | github.com/sveltejs/svelte | `npm view svelte` → 5.55.8 | Approved |
| `@sveltejs/vite-plugin-svelte` | npm | 4+ years | github.com/sveltejs/vite-plugin-svelte | 7.1.2 | Approved |
| `vite` | npm | 5+ years | github.com/vitejs/vite | 8.0.13 | Approved |
| `fastify` | npm | 8+ years | github.com/fastify/fastify | 5.8.5 | Approved |
| `@fastify/static` | npm | 6+ years | github.com/fastify/fastify-static | 9.1.3 | Approved |
| `typescript` | npm | 13+ years | github.com/microsoft/TypeScript | 6.0.3 | Approved |
| `vitest` | npm | 4+ years (2021-12-03) | github.com/vitest-dev/vitest | 4.1.6 | Approved |
| `@testing-library/svelte` | npm | 7+ years (2019-06-01) | github.com/testing-library/svelte-testing-library | 5.3.1 | Approved |
| `@testing-library/jest-dom` | npm | 7+ years | github.com/testing-library/jest-dom | 6.9.1 | Approved |
| `happy-dom` | npm | 6+ years (2019-09-15) | github.com/capricorn86/happy-dom | 20.9.0 | Approved |
| `concurrently` | npm | 10+ years | github.com/open-cli-tools/concurrently | 9.2.1 | Approved |
| `tsx` | npm | 4+ years | github.com/privatenumber/tsx | 4.22.3 | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck checked wrong ecosystem — PyPI vs npm)
**Packages flagged as suspicious [SUS]:** none
**No postinstall scripts detected** on any package verified above.

---

## Architecture Patterns

### System Architecture Diagram

```
Guest Browser (http://localhost:5173 dev / http://localhost:3000 prod)
│
│  ┌─────────────── SPA (Svelte 5) ───────────────────────────────┐
│  │                                                               │
│  │  App.svelte ($screen store)                                  │
│  │  ├── <IdleScreen>       — live webcam feed + Tap to Start    │
│  │  ├── <CountdownScreen>  — live feed + ring overlay + flash   │
│  │  ├── <ReviewScreen>     — thumbnail + Keep / Retake          │
│  │  └── <PhotoGridScreen>  — grid stub + Start New Session      │
│  │       (+ <DisconnectModal> layered over any screen)          │
│  │                                                               │
│  │  lib/session.svelte.ts  (state machine — $state runes)       │
│  │  lib/camera/                                                  │
│  │  ├── CameraAdapter.ts   (interface contract)                 │
│  │  ├── WebcamAdapter.ts   (getUserMedia — Phase 1)             │
│  │  └── TetheredAdapter.ts (stub — Phase 2 implements)         │
│  │                                                               │
│  └───────────────────────────────────────────────────────────────┘
│                       │ fetch (capability probe only)
│  ┌─────────── Fastify 5 (server/) ──────────────────────────────┐
│  │  GET /api/camera/info  → { platform, cameraMode }            │
│  │  @fastify/static       → serves web/dist/ (prod)             │
│  └───────────────────────────────────────────────────────────────┘
```

**Phase 1 scope:** Only `GET /api/camera/info` is needed from the backend. `POST /api/camera/capture`, WebSocket live-view, `POST /api/share` are Phase 2+ endpoints — scaffold the routes but do NOT implement them in Phase 1.

### Recommended Project Structure

```
photoBooth/
├── web/                       # Svelte 5 + Vite 8 frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── camera/
│   │   │   │   ├── CameraAdapter.ts      # interface (THE contract)
│   │   │   │   ├── WebcamAdapter.ts      # getUserMedia (Phase 1)
│   │   │   │   └── TetheredAdapter.ts    # stub (Phase 2 fills this)
│   │   │   ├── session.svelte.ts         # $state state machine
│   │   │   ├── config.ts                 # SHOT_COUNT, COUNTDOWN_MS constants
│   │   │   └── audio.ts                  # shutter sound preload / play()
│   │   ├── components/
│   │   │   ├── LivePreview.svelte        # <video> bound to CameraAdapter stream
│   │   │   ├── CountdownRing.svelte      # SVG ring + numeral
│   │   │   ├── FlashOverlay.svelte       # full-screen white flash
│   │   │   ├── PrimaryButton.svelte      # accent-filled button
│   │   │   ├── SecondaryButton.svelte    # neutral-surface button
│   │   │   ├── ShotProgress.svelte       # "Shot N of Total"
│   │   │   ├── ReviewPanel.svelte        # thumbnail + progress + actions
│   │   │   ├── Toast.svelte              # "Photo saved" confirmation
│   │   │   ├── DisconnectModal.svelte    # overlay; preserves session state
│   │   │   └── PhotoGrid.svelte          # post-session thumbnail grid
│   │   ├── screens/
│   │   │   ├── IdleScreen.svelte
│   │   │   ├── CountdownScreen.svelte
│   │   │   ├── ReviewScreen.svelte
│   │   │   └── PhotoGridScreen.svelte
│   │   ├── App.svelte                    # $screen router + transition wrapper
│   │   ├── main.ts
│   │   └── app.css                       # CSS custom properties (tokens from UI-SPEC)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts                      # Fastify entry point
│   │   ├── routes/
│   │   │   └── camera.ts                 # GET /api/camera/info
│   │   └── camera/
│   │       └── detect.ts                 # os.platform() → cameraMode
│   ├── tsconfig.json
│   └── package.json
├── package.json                          # root: scripts with concurrently
└── CLAUDE.md
```

### Pattern 1: Svelte 5 Runes State Machine (session.svelte.ts)

**What:** Session state lives in a `.svelte.ts` file as a reactive object exported from a singleton module. The state machine uses `$state` for the reactive object and plain functions for transitions.

**When to use:** Shared application state that multiple components read/write — the session phase, captured shots array, disconnect modal visibility.

**Key rule:** Export an **object** (not primitives) so Svelte can proxy the properties for cross-module reactivity. Do NOT `export let screen = $state(...)` directly — it cannot be reassigned across module boundaries.

```typescript
// Source: mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/ + svelte.dev/docs/svelte/$state
// web/src/lib/session.svelte.ts

import type { ScreenName, Shot } from './types.ts';

export const session = $state({
  screen: 'idle' as ScreenName,
  shots: [] as Shot[],
  currentShotIndex: 0,
  disconnected: false,
  config: {
    shotCount: 4,        // SESS-01 default
    countdownMs: 3000,   // SESS-01 default
  },
});

// Transition functions — components call these, never mutate session directly
export function startSession() {
  session.shots = [];
  session.currentShotIndex = 0;
  session.screen = 'countdown_preview';
}

export function saveShot(blob: Blob, index: number) {
  session.shots[index] = { blob, objectUrl: URL.createObjectURL(blob) };
}

export function showDisconnect() { session.disconnected = true; }
export function hideDisconnect() { session.disconnected = false; }

export function nextShot() {
  session.currentShotIndex++;
  if (session.currentShotIndex >= session.config.shotCount) {
    session.screen = 'photo_grid';
  } else {
    session.screen = 'countdown_preview';
  }
}

export function resetSession() {
  // Revoke object URLs before clearing
  session.shots.forEach(s => URL.revokeObjectURL(s.objectUrl));
  session.shots = [];
  session.currentShotIndex = 0;
  session.screen = 'idle';
}
```

Usage in a component:
```svelte
<!-- Source: svelte.dev/docs/svelte/$state cross-module pattern -->
<script lang="ts">
  import { session, startSession } from '$lib/session.svelte.ts';
</script>

{#if session.screen === 'idle'}
  <PrimaryButton onclick={startSession}>Tap to Start</PrimaryButton>
{/if}
```

### Pattern 2: CameraAdapter Interface (THE contract for Phase 2)

**What:** A TypeScript interface that abstracts the camera entirely. `WebcamAdapter` implements it for Phase 1; `TetheredAdapter` (Phase 2) must implement the same interface without touching screen code.

**When to use:** Any component that needs camera access goes through the adapter — never calls `navigator.mediaDevices.getUserMedia` directly.

**Critical design decision:** The adapter owns a `<video>` element attachment method, not a `MediaStream` return, because Phase 2's TetheredAdapter sends MJPEG via `<img src=...>` — there is no MediaStream. Provide `attachPreview(el: HTMLVideoElement | HTMLImageElement)` to keep Phase 2 compatible.

```typescript
// Source: ARCHITECTURE.md "Cross-Platform Camera Adapter" — extended for Phase 2 compatibility
// web/src/lib/camera/CameraAdapter.ts

export interface CameraAdapter {
  /** Initialize camera access (request permission, warm up connection) */
  init(): Promise<void>;

  /** Attach live preview to a DOM element. Phase 1: sets el.srcObject. Phase 2: sets el.src to MJPEG URL. */
  attachPreview(el: HTMLVideoElement | HTMLImageElement): Promise<void>;

  /** Capture one still frame. Returns a JPEG Blob. */
  capture(): Promise<Blob>;

  /** Stop all tracks and release resources. Called on session reset or app unmount. */
  dispose(): Promise<void>;

  /** Register a callback fired when the camera disconnects unexpectedly. */
  onDisconnect(callback: () => void): void;
}
```

WebcamAdapter implementation sketch:
```typescript
// web/src/lib/camera/WebcamAdapter.ts
import type { CameraAdapter } from './CameraAdapter.ts';

export class WebcamAdapter implements CameraAdapter {
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;  // stored in attachPreview for capture()
  private disconnectCallback: (() => void) | null = null;

  async init() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    // Attach ended listener for disconnect detection (CAM-04)
    this.stream.getVideoTracks()[0].addEventListener('ended', () => {
      this.disconnectCallback?.();
    });
  }

  async attachPreview(el: HTMLVideoElement) {
    if (!this.stream) throw new Error('WebcamAdapter not initialized');
    this.videoEl = el;  // store for use in canvas fallback capture()
    el.srcObject = this.stream;
    await el.play();
  }

  async capture(): Promise<Blob> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) throw new Error('No video track');
    // ImageCapture API preferred (Chrome/Edge full support); canvas fallback for Firefox/Safari
    if ('ImageCapture' in window) {
      const ic = new ImageCapture(track);
      return ic.takePhoto();
    }
    // Canvas fallback: use stored videoEl reference set during attachPreview()
    if (!this.videoEl) throw new Error('No video element — call attachPreview() first');
    const canvas = new OffscreenCanvas(this.videoEl.videoWidth, this.videoEl.videoHeight);
    canvas.getContext('2d')!.drawImage(this.videoEl, 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  }

  onDisconnect(callback: () => void) {
    this.disconnectCallback = callback;
  }

  async dispose() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.videoEl = null;
  }
}
```

### Pattern 3: App.svelte Screen Router

**What:** Root component reads `session.screen` and renders the matching screen component. Svelte `transition:fade` wraps screen transitions (D-04).

```svelte
<!-- Source: CONTEXT.md D-01, D-04; svelte.dev/docs/svelte/transition -->
<!-- web/src/App.svelte -->
<script lang="ts">
  import { session } from '$lib/session.svelte.ts';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import IdleScreen from './screens/IdleScreen.svelte';
  import CountdownScreen from './screens/CountdownScreen.svelte';
  import ReviewScreen from './screens/ReviewScreen.svelte';
  import PhotoGridScreen from './screens/PhotoGridScreen.svelte';
  import DisconnectModal from './components/DisconnectModal.svelte';
</script>

{#key session.screen}
  <div class="screen-wrapper" transition:fade={{ duration: 250, easing: cubicOut }}>
    {#if session.screen === 'idle'}
      <IdleScreen />
    {:else if session.screen === 'countdown_preview'}
      <CountdownScreen />
    {:else if session.screen === 'review'}
      <ReviewScreen />
    {:else if session.screen === 'photo_grid'}
      <PhotoGridScreen />
    {/if}
  </div>
{/key}

{#if session.disconnected}
  <DisconnectModal />
{/if}
```

### Pattern 4: SVG Progress Ring (CountdownRing — D-11)

**What:** Inline SVG `<circle>` with `stroke-dasharray` = circumference, `stroke-dashoffset` animated from circumference → 0 over `countdownMs`. No library needed.

**Implementation formula:**
- `r = 108` (radius for 240px diameter ring, accounting for stroke width)
- `circumference = 2 * Math.PI * r` ≈ 678.6px
- `dashoffset = circumference * (remaining / countdownMs)` — CSS transition: linear over countdownMs

```svelte
<!-- Source: css-tricks.com/building-progress-ring-quickly/ pattern -->
<!-- web/src/components/CountdownRing.svelte -->
<script lang="ts">
  let { elapsed = 0, countdownMs = 3000, digit } = $props<{
    elapsed: number;
    countdownMs: number;
    digit: number;
  }>();

  const RADIUS = 108;
  const STROKE = 8;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  let dashoffset = $derived(CIRCUMFERENCE * (1 - elapsed / countdownMs));
</script>

<svg width="240" height="240" viewBox="0 0 240 240">
  <!-- Track ring (dim) -->
  <circle cx="120" cy="120" r={RADIUS} stroke="#1F1F25" stroke-width={STROKE} fill="none" />
  <!-- Progress arc — starts at top (rotate -90deg) -->
  <circle
    cx="120" cy="120" r={RADIUS}
    stroke="#FFCC00"
    stroke-width={STROKE}
    fill="none"
    stroke-linecap="round"
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={dashoffset}
    transform="rotate(-90 120 120)"
    style="transition: stroke-dashoffset {countdownMs}ms linear;"
  />
  <!-- Centered digit -->
  <text x="120" y="120" text-anchor="middle" dominant-baseline="central"
    font-size="96" font-weight="600" fill="#F5F5F7">{digit}</text>
</svg>
```

### Pattern 5: Camera Disconnect Detection (CAM-04)

**What:** Two-layer detection — primary is `MediaStreamTrack` `ended` event; secondary is `navigator.mediaDevices.devicechange` polling as a fallback for cases where the `ended` event misfires (browser-specific).

```typescript
// Source: developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event
// Reliability: Baseline Widely Available since Sept 2017; NOT fired when .stop() is called
// Supplement with devicechange for edge cases

// Primary: attach in WebcamAdapter.init()
videoTrack.addEventListener('ended', () => disconnectCallback());

// Secondary: devicechange cross-check (supplement, not replacement)
navigator.mediaDevices.addEventListener('devicechange', async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasCamera = devices.some(d => d.kind === 'videoinput');
  if (!hasCamera) disconnectCallback();
});
```

**Note:** `MediaStreamTrack.readyState === 'ended'` is a synchronous check useful for guards before capture, but `ended` event is the reactive trigger. Use both.

### Pattern 6: Audio Autoplay Gating (SESS-03)

**What:** Browsers block audio playback until a user gesture occurs. The "Tap to Start" button on the Idle screen (D-10, D-14) is the first user gesture — it implicitly unlocks the AudioContext and enables `<audio>.play()` for subsequent captures.

**Correct approach:** Preload the `<audio>` element on app init, but do NOT call `.play()` until after the first user gesture. After the first tap, audio is permanently unlocked for the session.

```typescript
// Source: developer.chrome.com/blog/autoplay + MDN Autoplay guide
// web/src/lib/audio.ts

let shutterAudio: HTMLAudioElement | null = null;
let unlocked = false;

export function preloadShutterSound(src: string) {
  shutterAudio = new Audio(src);
  shutterAudio.preload = 'auto';
  shutterAudio.volume = 0.8;
}

/** Call this once from the first user gesture handler (Tap to Start). */
export function unlockAudio() {
  if (unlocked || !shutterAudio) return;
  // Silent play to unlock AudioContext
  shutterAudio.play().then(() => {
    shutterAudio!.pause();
    shutterAudio!.currentTime = 0;
    unlocked = true;
  }).catch(() => {/* ignore */});
}

/** Call on each capture. Rewinds and plays. */
export function playShutter() {
  if (!shutterAudio) return;
  shutterAudio.currentTime = 0;
  shutterAudio.play().catch(() => {/* iOS silent mode — no crash */});
}
```

**Why not Web Audio API:** `<audio>` is sufficient for a single preloaded sound file. Web Audio API adds complexity (AudioBuffer, decodeAudioData) with no benefit for this use case.

### Pattern 7: Config Constants Module (SESS-01 configurability)

**What:** No Admin Panel until Phase 3. Configurability in Phase 1 = hardcoded constants in a `config.ts` module, imported by the session store. NOT URL params, NOT env vars.

```typescript
// web/src/lib/config.ts
export const SHOT_COUNT = 4;       // SESS-01 default
export const COUNTDOWN_MS = 3000;  // SESS-01 default
export const FLASH_DURATION_MS = 300;  // D-12; locked in UI-SPEC
export const TOAST_DISPLAY_MS = 1200;  // D-09; locked in UI-SPEC
export const TRANSITION_MS = 250;      // D-04; locked in UI-SPEC
```

### Anti-Patterns to Avoid

- **Platform branches in screen code:** Any `if (platform === 'windows')` in screen components is wrong. All platform logic lives in `WebcamAdapter` / `TetheredAdapter`. Screens talk to `CameraAdapter` only. (ARCHITECTURE.md anti-pattern #4)
- **Direct `navigator.mediaDevices.getUserMedia` in components:** Goes through `WebcamAdapter.init()` only.
- **Mutating session state directly from components:** Call the exported transition functions (`startSession()`, `saveShot()`, etc.), never `session.screen = '...'` from a component.
- **`export let screen = $state(...)` in session.svelte.ts:** Primitive exports cannot be reactive across module boundaries in Svelte 5. Export an object.
- **GIF encoding or Konva in Phase 1:** These are Phase 4–5 concerns. Do not install these packages.
- **Skip the Fastify scaffold:** Phase 2 adds `/api/camera/*` endpoints to the backend. Scaffold Fastify now so Phase 2 has a place — don't defer the backend scaffold.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Svelte cross-module reactive state | Custom pub/sub system, EventEmitter, Zustand | `.svelte.ts` object with `$state` | Svelte 5 runes handle cross-module reactivity natively via Proxy |
| Svelte fade/crossfade transitions | CSS `@keyframes` + JS class toggling | `import { fade } from 'svelte/transition'` | Built in, composable, interruptible — hand-rolling breaks during rapid taps |
| Progress ring animation | Canvas `arc()` loop, GSAP | Inline SVG `stroke-dashoffset` + CSS transition | Zero dependencies, hardware-accelerated, 10 lines of SVG |
| Test DOM environment | Browser launch, Playwright | `happy-dom` via `vitest` | Unit tests run in msec; Playwright is for E2E (Phase 6) |
| Camera capture from video element | Custom pixel manipulation | `ImageCapture.takePhoto()` with canvas fallback | `ImageCapture` uses native camera pipeline for higher quality stills |

**Key insight:** Svelte 5 built-ins (runes, transitions, actions) cover all the "framework glue" this phase needs. The only external UI state needed is the session store — everything else is local component state.

---

## Common Pitfalls

### Pitfall 1: CameraAdapter interface mismatch kills Phase 2

**What goes wrong:** Phase 1 ships `WebcamAdapter.getPreviewStream(): Promise<MediaStream>`. Phase 2's `TetheredAdapter` has no MediaStream — it uses MJPEG over HTTP. `LivePreview.svelte` hardcodes `el.srcObject = stream` and breaks when Phase 2 lands.

**Why it happens:** Phase 1 is tempting to optimize for the getUserMedia path.

**How to avoid:** Use `attachPreview(el: HTMLVideoElement | HTMLImageElement)` in the interface. Phase 1 sets `el.srcObject`; Phase 2 sets `el.src`. Screen code never sees a MediaStream.

**Warning signs:** Any component that calls `adapter.getPreviewStream()` and uses the result directly.

### Pitfall 2: Audio blocked on first capture (SESS-03)

**What goes wrong:** `playShutter()` called on capture, but the guest has not yet triggered a user gesture recognized by the browser. Shutter sound silently fails (Promise rejection eaten). Guest hears nothing.

**Why it happens:** Chrome/Edge block audio until user gesture. The "Tap to Start" button must also call `unlockAudio()` to prime the AudioContext.

**How to avoid:** See Pattern 6. Call `unlockAudio()` in the `startSession()` handler (first user tap). Subsequent `playShutter()` calls work.

**Warning signs:** Shutter sound works on second session but not first. Console shows `NotAllowedError` on `audio.play()`.

### Pitfall 3: Camera disconnect event not firing (CAM-04)

**What goes wrong:** `MediaStreamTrack.ended` does NOT fire when `track.stop()` is called programmatically. On some browser+OS combos (especially permission revocation via OS privacy settings), it fires late or not at all.

**Why it happens:** Per MDN: "The ended event is not fired when calling MediaStreamTrack.stop()." OS-level revocation behavior is platform-dependent.

**How to avoid:** Use both the `ended` event AND `devicechange` polling (Pattern 5). The `devicechange` event fires on physical plug/unplug regardless of `ended` behavior.

**Warning signs:** Physical USB unplug shows no modal; tap "Retry" causes infinite getUserMedia rejection.

### Pitfall 4: Svelte 5 state not reactive across modules

**What goes wrong:** Developer writes `export let screen = $state<ScreenName>('idle')` in `session.svelte.ts`. Importing components read stale values — the state is not reactive across the module boundary when exported as a primitive.

**Why it happens:** Svelte's rune transform applies per-file. Exporting a primitive doesn't cross the boundary reactively — the importer gets a snapshot, not a live binding.

**How to avoid:** Export an object (`export const session = $state({ screen: 'idle', ... })`). Object property access is proxied and reactive. See Pattern 1.

**Warning signs:** `$screen` updates in `session.svelte.ts` but App.svelte doesn't re-render.

### Pitfall 5: Browser permission prompt blocks kiosk (CAM-04 adjacent)

**What goes wrong:** First launch on a new machine triggers a Chrome camera permission dialog. Guest is confused. If denied, `getUserMedia` rejects with `NotAllowedError` and the app shows an unrelated error screen.

**Why it happens:** Chrome requires explicit permission grant; localhost gets no special treatment for first access.

**How to avoid:** On `getUserMedia` rejection, check `navigator.permissions.query({name:'camera'})`. If `state === 'denied'`, show a dedicated "Camera permission denied — open browser settings to allow access" state, NOT the generic disconnect modal. See PITFALLS.md #4.

**Warning signs:** Error modal on first launch instead of live preview.

### Pitfall 6: Object URL memory leak on retake / reset

**What goes wrong:** Each `URL.createObjectURL(blob)` allocation that is never revoked leaks memory. After 4 retakes per shot × 4 shots × many sessions, memory grows monotonically until the tab is slow.

**Why it happens:** Object URLs are held until `URL.revokeObjectURL()` is called or the page is closed.

**How to avoid:** Track all object URLs in the session store (ARCHITECTURE.md key pattern #1: "Hold originals; create ObjectURLs for rendering; revoke on reset"). Call `URL.revokeObjectURL(shot.objectUrl)` in `resetSession()` before clearing the shots array. Also revoke when a retake overwrites a slot.

**Warning signs:** Memory profile shows monotonic growth on repeat sessions (PITFALLS.md #13).

---

## Code Examples

### getUserMedia with preferred resolution and device selection

```typescript
// Source: MDN Web Docs — MediaDevices.getUserMedia()
// [VERIFIED: Baseline Widely Available]
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    deviceId: savedDeviceId ? { exact: savedDeviceId } : undefined,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
  audio: false,
});
```

### ImageCapture API with canvas fallback

```typescript
// Source: MDN Web Docs — ImageCapture
// [ASSUMED — ImageCapture support: Chrome/Edge full, Firefox partial, Safari limited]
async function grabFrame(videoTrack: MediaStreamVideoTrack, videoEl: HTMLVideoElement): Promise<Blob> {
  if ('ImageCapture' in window) {
    const ic = new ImageCapture(videoTrack);
    return ic.takePhoto({ imageWidth: 1920, imageHeight: 1080 });
  }
  // Canvas fallback
  const canvas = new OffscreenCanvas(videoEl.videoWidth, videoEl.videoHeight);
  canvas.getContext('2d')!.drawImage(videoEl, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
}
```

### Fastify capability probe endpoint

```typescript
// Source: fastify.dev docs — Route definition
// server/src/routes/camera.ts
import { FastifyInstance } from 'fastify';
import os from 'node:os';

export async function cameraRoutes(app: FastifyInstance) {
  app.get('/api/camera/info', async () => {
    const platform = os.platform(); // 'win32' | 'darwin' | 'linux'
    // CAM-01: auto-detect — probe gphoto2 availability even on Windows
    // Returns 'webcam' when gphoto2 is absent (Phase 1 always lands here; Phase 2 installs gphoto2)
    let gphoto2Available = false;
    if (platform !== 'win32') {
      try {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        await promisify(execFile)('gphoto2', ['--version'], { timeout: 3000 });
        gphoto2Available = true;
      } catch { /* gphoto2 not installed — fall back to webcam */ }
    }
    const cameraMode = gphoto2Available ? 'tethered' : 'webcam';
    return { platform, gphoto2Available, cameraMode };
  });
}
```

### Vitest + @testing-library/svelte setup

```typescript
// Source: testing-library.com/docs/svelte-testing-library/setup/
// [VERIFIED: npm registry — @testing-library/svelte 5.3.1]
// vite.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest-setup.ts'],
  },
  resolve: process.env.VITEST
    ? { conditions: ['browser'] }
    : undefined,
});

// vitest-setup.ts
import '@testing-library/jest-dom/vitest';
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Svelte 4 `writable` stores for cross-component state | Svelte 5 `.svelte.ts` files with `$state` object export | Stores still work in Svelte 5 — but `.svelte.ts` is idiomatic for new code |
| `svelte/transition` with `{#if}` blocks | `{#key}` + `transition:fade` for screen swaps | `{#key}` forces re-mount + animation; `{#if}` only transitions in |
| `video.captureStream()` for grabs | `ImageCapture.takePhoto()` with canvas fallback | ImageCapture uses native camera pipeline; higher quality |
| jsdom for Vitest Svelte tests | `happy-dom` (faster) or `jsdom` (more compliant) | Both work with `@testing-library/svelte` 5.x |

**Deprecated/outdated:**
- `@sveltejs/vite-plugin-svelte` v6: dropped Svelte 5 / Vite 8 support — must use v7 [VERIFIED: peer deps confirm]
- `gif.js` (jnordberg): stale (last 2023), mediocre dithering — use gifenc instead (Phase 5)
- `gphoto2` npm package (lwille): NAN-based, last npm publish 2020 — use CLI subprocess (Phase 2)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ImageCapture.takePhoto()` produces noticeably higher quality than `canvas.drawImage()` frame grab on Canon webcam drivers | Code Examples — capture | May need to drop ImageCapture and use canvas-only if vendor driver doesn't support it cleanly; canvas fallback already present |
| A2 | `os.platform() === 'win32'` is the correct discriminant for getUserMedia vs gphoto2 mode | Architecture Patterns — capability probe | If user runs Mac but has no camera, they'd fall back to getUserMedia anyway; fallback logic in WebcamAdapter handles this |
| A3 | `devicechange` event fires reliably on physical USB unplug for the camera disconnect fallback | Pitfall 3 | May need to add a `readyState` heartbeat poll (every 5s) as a third layer — cheap to add |

**If this table is empty:** Not applicable — three assumptions documented above.

---

## Open Questions

1. **Shutter sound asset source**
   - What we know: SESS-03 requires a shutter sound; D-13 specifies shutter-only (no countdown ticks); UI-SPEC says `.mp3/.ogg`
   - What's unclear: No asset file exists in the project yet. Where does it come from? Free asset site (freesound.org), embedded base64, or procedurally generated?
   - Recommendation: Planner should add a task to source and include a `shutter.mp3` in `web/public/sounds/`. freesound.org has public domain camera click sounds. Keep the clip <100KB.

2. **Fastify dev port vs Vite dev port proxy setup**
   - What we know: Vite dev server runs on 5173; Fastify backend on (e.g.) 3001; `GET /api/camera/info` needs to reach Fastify during dev
   - What's unclear: Vite's `server.proxy` config vs `concurrently` vs a root-level `vite.config.ts` in the repo root
   - Recommendation: Add Vite proxy in `web/vite.config.ts`: `server: { proxy: { '/api': 'http://localhost:3001' } }`. This is the standard Vite SPA + separate backend pattern. [CITED: vite.dev/config/server-options#server-proxy]

3. **Single-repo vs npm workspaces**
   - What we know: Project is greenfield; `web/` and `server/` separation recommended
   - What's unclear: Should this be npm workspaces (shared `node_modules`) or two independent `package.json` files?
   - Recommendation: Two independent `package.json` files (`web/package.json`, `server/package.json`) with a root `package.json` containing only `scripts` and `concurrently` as a dev dependency. Avoids workspace hoisting confusion. Phase 1 can always add workspaces later if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend + build tooling | ✓ | v26.1.0 | — |
| npm | Package installation | ✓ | 11.14.1 | — |
| Chromium | Frontend kiosk browser | ✓ | 148.0.7778.167 | Any modern browser |
| gphoto2 CLI | Phase 2 only | Not checked | — | N/A for Phase 1 |

**Missing dependencies with no fallback:** None for Phase 1 scope.

**Note:** Platform is Linux. Phase 1 (getUserMedia path) will work on Linux with any webcam. ROADMAP.md Phase 1 Success Criterion #1 explicitly requires the auto-detect to ship in Phase 1: *"On startup the app auto-detects the OS and selects the getUserMedia camera path on Windows (and as a fallback elsewhere)."* The `GET /api/camera/info` capability probe implements this by running `gphoto2 --version` and returning `cameraMode: 'webcam'` when gphoto2 is absent — which is always the case on Phase 1 dev machines. On Phase 2, gphoto2 is installed and the probe returns `cameraMode: 'tethered'` with no frontend changes needed. **Recommendation: (a) — implement the gphoto2 probe in Phase 1; it returns `webcam` everywhere until Phase 2 ships gphoto2.** CAM-01 is a Phase 1 deliverable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `web/vite.config.ts` (test block) — see Code Examples |
| Quick run command | `cd web && npx vitest run --reporter=dot` |
| Full suite command | `cd web && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `nextShot()` increments `currentShotIndex`; transitions to `photo_grid` after `shotCount` shots | unit | `vitest run src/lib/session.test.svelte.ts` | ❌ Wave 0 |
| SESS-01 | `config.shotCount` and `config.countdownMs` defaults are 4 and 3000 | unit | same file | ❌ Wave 0 |
| SESS-02 | `<FlashOverlay>` mounts with `opacity: 1` on capture and transitions to `0` | component | `vitest run src/components/FlashOverlay.test.ts` | ❌ Wave 0 |
| SESS-03 | `playShutter()` called after `unlockAudio()` does not throw | unit (mocked) | `vitest run src/lib/audio.test.ts` | ❌ Wave 0 |
| SESS-04 | `saveShot()` stores Blob at correct index; retake replaces at same index | unit | `vitest run src/lib/session.test.svelte.ts` | ❌ Wave 0 |
| CAM-04 | `showDisconnect()` sets `session.disconnected = true` | unit | `vitest run src/lib/session.test.svelte.ts` | ❌ Wave 0 |
| CAM-04 | `<DisconnectModal>` renders when `session.disconnected === true` | component | `vitest run src/components/DisconnectModal.test.ts` | ❌ Wave 0 |
| CAM-01 | `/api/camera/info` returns `{ platform, cameraMode }` with correct cameraMode | integration | manual smoke test (Fastify server must be running) | manual |
| CAM-02 | `WebcamAdapter.init()` calls `getUserMedia` (mocked) and stores stream | unit (mocked) | `vitest run src/lib/camera/WebcamAdapter.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd web && npx vitest run --reporter=dot` (unit tests only, ~5s)
- **Per wave merge:** `cd web && npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/src/lib/session.test.svelte.ts` — covers SESS-01, SESS-04, CAM-04 state machine
- [ ] `web/src/lib/audio.test.ts` — covers SESS-03 audio gating
- [ ] `web/src/lib/camera/WebcamAdapter.test.ts` — covers CAM-02 (getUserMedia mocked)
- [ ] `web/src/components/FlashOverlay.test.ts` — covers SESS-02
- [ ] `web/src/components/DisconnectModal.test.ts` — covers CAM-04 render
- [ ] `web/vitest-setup.ts` — `@testing-library/jest-dom/vitest` import
- [ ] `web/vite.config.ts` — test block with svelteTesting plugin, happy-dom environment

---

## Security Domain

> `security_enforcement` is not explicitly set to `false` in `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — kiosk, no auth |
| V3 Session Management | no | N/A — in-memory session, no tokens |
| V4 Access Control | no | N/A — single-user kiosk |
| V5 Input Validation | minimal | Session config (shotCount, countdownMs) — validate range in config.ts (e.g., `shotCount > 0 && shotCount <= 10`) |
| V6 Cryptography | no | N/A — no secrets, no encryption in Phase 1 |

### Known Threat Patterns for localhost kiosk

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Camera permission abuse (malicious page at same origin) | Spoofing | localhost-only; no multi-origin concern |
| Object URL blob data leakage | Information Disclosure | `URL.revokeObjectURL()` on session reset (Pattern 1) |
| Path traversal in future file save ops | Tampering | Use `path.join()` and `os.homedir()`, never string concat (PITFALLS.md #11) — Phase 1 has no disk writes, but scaffold correctly |

**Phase 1 has a minimal attack surface** — no network routes beyond the capability probe, no file system writes, no external API calls. The primary security concern is the object URL lifecycle and future path handling.

---

## Sources

### Primary (HIGH confidence)

- npm registry (`npm view <pkg> version`, `time.modified`, `time.created`) — verified 2026-05-19 for all 12 Phase 1 packages
- `@sveltejs/vite-plugin-svelte` peer dependencies — confirmed `svelte ^5.46.4`, `vite ^8.0.0` [VERIFIED: npm registry]
- `svelte.dev/docs/svelte/testing` — official Svelte 5 testing setup documentation
- `testing-library.com/docs/svelte-testing-library/setup/` — @testing-library/svelte vite config
- `developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event` — Baseline Widely Available since Sept 2017
- `mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/` — object export pattern for cross-module $state

### Secondary (MEDIUM confidence)

- `developer.chrome.com/blog/autoplay` — Chrome autoplay policy and user gesture unlock
- `css-tricks.com/building-progress-ring-quickly/` — SVG stroke-dashoffset countdown ring pattern
- `.planning/research/STACK.md` — STACK.md verified versions (same-day research 2026-05-19)
- `.planning/research/ARCHITECTURE.md` — CameraAdapter pattern, component topology
- `.planning/research/PITFALLS.md` — Top pitfalls, cross-references #3, #4, #10–#13, #16

### Tertiary (LOW confidence)

- None — no LOW-confidence claims in this research.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages npm-verified with dates and peer deps
- Architecture: HIGH — built on verified ARCHITECTURE.md + Svelte 5 official docs
- Svelte 5 runes patterns: HIGH — verified against svelte.dev + mainmatter.com
- Camera disconnect: MEDIUM — `ended` event is well-specified but browser behavior on OS-level revocation varies
- Audio autoplay: HIGH — Chrome autoplay policy is well-documented

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days — stack is stable; Svelte 5 minor versions won't break APIs)
