---
phase: 1
slug: foundation-webcam-session-loop
created: 2026-05-19
status: draft
---

# Phase 1 — Walking Skeleton

> The thinnest possible end-to-end stack that proves the architecture. Subsequent phases build on these decisions without renegotiating them.

---

## Architectural Decisions (locked in Phase 1)

| Concern | Decision | Source |
|---------|----------|--------|
| Frontend framework | Svelte 5.55.8 + Vite 8.0.13 | RESEARCH.md Standard Stack |
| Backend framework | Fastify 5.8.5 (Node.js) | RESEARCH.md Standard Stack |
| TypeScript | 6.0.3, strict mode in both `web/` and `server/` | RESEARCH.md |
| Test runner | Vitest 4.1.6 + `@testing-library/svelte` 5.3.1 + `happy-dom` 20.9.0 | VALIDATION.md |
| Repo layout | Two independent `package.json` (web/, server/) + root `package.json` with `concurrently` dev script (NOT npm workspaces) | RESEARCH.md Open Questions #3 |
| Cross-component state | `.svelte.ts` files exporting `$state` objects (NOT primitives) | RESEARCH.md Pattern 1 + Pitfall 4 |
| Camera abstraction | `CameraAdapter` interface with `attachPreview(el: HTMLVideoElement \| HTMLImageElement)` signature — supports both MediaStream (webcam) and MJPEG (`<img src>`, Phase 2) | RESEARCH.md Pattern 2 + Pitfall 1 |
| Platform branching | Lives only in the adapter implementations (`WebcamAdapter`, `TetheredAdapter`) — screen components never see platform info | RESEARCH.md Anti-Patterns |
| OS detection | Backend `os.platform()` at `GET /api/camera/info` is authoritative; frontend probes once on app init | RESEARCH.md Architectural Responsibility Map |
| Routing | NO router library — root `App.svelte` switches screens off `session.screen` store value | CONTEXT.md D-01 |
| Audio strategy | Single preloaded `<audio>` element; `unlockAudio()` called from first user gesture (`Tap to Start` button) | RESEARCH.md Pattern 6 |
| Object URL lifecycle | Track `objectUrl` on each `Shot`; revoke on retake overwrite and on `resetSession()` | RESEARCH.md Pitfall 6 + Security Domain |
| Dev orchestration | `npm run dev` at repo root → `concurrently` runs Vite (port 5173) + Fastify (port 3001); Vite proxies `/api` → Fastify | RESEARCH.md Open Questions #2 |
| Production serving | Fastify `@fastify/static` serves `web/dist/` (Phase 1 scaffolds the route; production build can wait) | RESEARCH.md Architecture |

---

## Directory Layout (created in Phase 1, extended by later phases)

```
photoBooth/
├── package.json                  # root: scripts only; devDeps: concurrently
├── web/
│   ├── package.json
│   ├── vite.config.ts            # Svelte + Vitest config; proxy /api → :3001
│   ├── tsconfig.json
│   ├── vitest-setup.ts
│   ├── index.html
│   ├── public/
│   │   └── sounds/shutter.mp3
│   └── src/
│       ├── main.ts
│       ├── App.svelte            # $screen router
│       ├── app.css               # design tokens from UI-SPEC
│       ├── lib/
│       │   ├── types.ts          # ScreenName, Shot, CameraInfo
│       │   ├── config.ts         # SHOT_COUNT, COUNTDOWN_MS, FLASH_MS, TOAST_MS, TRANSITION_MS
│       │   ├── session.svelte.ts # $state session store + transitions
│       │   ├── audio.ts          # preloadShutterSound, unlockAudio, playShutter
│       │   └── camera/
│       │       ├── CameraAdapter.ts   # interface (THE contract)
│       │       ├── WebcamAdapter.ts   # getUserMedia (Phase 1)
│       │       └── TetheredAdapter.ts # stub: throws "Not implemented in Phase 1"
│       ├── components/
│       │   ├── LivePreview.svelte
│       │   ├── CountdownRing.svelte
│       │   ├── FlashOverlay.svelte
│       │   ├── PrimaryButton.svelte
│       │   ├── SecondaryButton.svelte
│       │   ├── ShotProgress.svelte
│       │   ├── ReviewPanel.svelte
│       │   ├── Toast.svelte
│       │   ├── DisconnectModal.svelte
│       │   └── PhotoGrid.svelte
│       └── screens/
│           ├── IdleScreen.svelte
│           ├── CountdownScreen.svelte
│           ├── ReviewScreen.svelte
│           └── PhotoGridScreen.svelte
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts              # Fastify entry; binds 3001
        ├── routes/
        │   └── camera.ts         # GET /api/camera/info
        └── camera/
            └── detect.ts         # os.platform() + gphoto2 probe
```

---

## CameraAdapter Contract (verbatim — Phase 2 must implement this exact shape)

```typescript
// web/src/lib/camera/CameraAdapter.ts
export interface CameraAdapter {
  /** Initialize camera access (request permission, warm up connection). */
  init(): Promise<void>;
  /** Attach live preview to a DOM element.
   *  Phase 1 (WebcamAdapter): sets el.srcObject = MediaStream.
   *  Phase 2 (TetheredAdapter): sets el.src = MJPEG endpoint URL. */
  attachPreview(el: HTMLVideoElement | HTMLImageElement): Promise<void>;
  /** Capture one still frame. Returns a JPEG Blob. */
  capture(): Promise<Blob>;
  /** Stop tracks and release resources. */
  dispose(): Promise<void>;
  /** Register a callback fired when the camera disconnects unexpectedly. */
  onDisconnect(callback: () => void): void;
}
```

**Why this exact signature:** Phase 2's `TetheredAdapter` reads MJPEG over HTTP — there is no `MediaStream` to expose. `attachPreview` accepting `HTMLImageElement` is the integration point that lets the same screen code work for both platforms.

---

## Session Store Shape (verbatim — downstream phases extend this)

```typescript
// web/src/lib/types.ts
export type ScreenName = 'idle' | 'countdown_preview' | 'review' | 'photo_grid';
export interface Shot { blob: Blob; objectUrl: string; }
export interface CameraInfo { platform: string; gphoto2Available: boolean; cameraMode: 'webcam' | 'tethered'; }

// web/src/lib/session.svelte.ts (exported reactive object)
export const session = $state({
  screen: 'idle' as ScreenName,
  shots: [] as Shot[],
  currentShotIndex: 0,
  disconnected: false,
  cameraInfo: null as CameraInfo | null,
  config: { shotCount: 4, countdownMs: 3000 },
});
```

---

## Capability Probe Endpoint (Phase 1 backend deliverable)

```
GET /api/camera/info
→ 200 { "platform": "linux"|"win32"|"darwin", "gphoto2Available": boolean, "cameraMode": "webcam"|"tethered" }
```

Phase 1 always returns `cameraMode: "webcam"` (gphoto2 not installed). Phase 2 installs gphoto2 and the same endpoint returns `"tethered"` without frontend changes.

---

## Dev Run Command (locked)

```bash
npm install           # at repo root; installs concurrently
cd web && npm install
cd ../server && npm install
cd ..
npm run dev           # concurrently runs Vite dev (5173) + Fastify (3001)
```

Open http://localhost:5173 — Vite proxies `/api/*` to http://localhost:3001.

---

## Design Tokens (from UI-SPEC, locked)

Source of truth for colors, spacing, typography. The executor writes these as CSS custom properties in `web/src/app.css`:

```css
:root {
  /* Color */
  --color-dominant: #0F0F12;
  --color-secondary: #1F1F25;
  --color-accent: #FFCC00;
  --color-text: #F5F5F7;
  --color-text-muted: #9A9AA3;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Type */
  --font-family: -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --size-body: 18px;
  --size-label: 24px;
  --size-heading: 32px;
  --size-display: 96px;
  --weight-regular: 400;
  --weight-semibold: 600;

  /* Motion */
  --motion-transition: 250ms;
  --motion-flash: 300ms;
  --motion-toast-total: 1200ms;

  /* Touch */
  --touch-min: 48px;
  --ring-diameter: 240px;
}
```

---

## Out-of-scope Now / Built Later

- Konva.js, gifenc, qrcode — Phases 4–5 only. **Do NOT install in Phase 1.**
- gphoto2 subprocess wiring — Phase 2. (Phase 1 scaffolds `TetheredAdapter.ts` as a stub that throws.)
- Template gallery, admin panel — Phase 3.
- Strip editor canvas — Phase 4.
- GIF generation, 0x0.st upload, QR code — Phase 5.
- Production build serving — Fastify `@fastify/static` route scaffolded but not exercised in Phase 1 dev flow.

---

*Skeleton locked: 2026-05-19*
