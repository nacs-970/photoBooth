# PhotoBooth

## Project

Photo booth web app — localhost kiosk, DSLR/mirrorless camera, canvas strip editor, GIF + QR sharing.

See `.planning/PROJECT.md` for full context.

## GSD Workflow

This project uses GSD for planning and execution.

- `.planning/ROADMAP.md` — phase structure and progress
- `.planning/REQUIREMENTS.md` — v1 requirements with traceability
- `.planning/STATE.md` — current project state
- `.planning/research/` — domain research (stack, features, architecture, pitfalls)

### Commands

```
/gsd:discuss-phase 1    # Gather context before planning
/gsd:plan-phase 1       # Create PLAN.md for a phase
/gsd:execute-phase 1    # Execute all plans in a phase
/gsd:progress           # Check current status
```

### Current Status

Phase 1 is next: **Foundation & Webcam Session Loop**

## Stack

- **Frontend:** Svelte 5 + Vite 8 + Konva.js 10
- **Backend:** Fastify 5 (Node.js) — OS bridge for gphoto2 + upload proxy
- **Camera (Windows):** `getUserMedia()` via vendor webcam utility
- **Camera (Mac/Linux):** `gphoto2` CLI subprocess
- **GIF:** gifenc in Web Worker
- **QR:** qrcode (soldair)
- **Upload:** POST to 0x0.st via Node backend (not browser-direct)

## Key Rules

- All gphoto2 operations go through Node backend — browser never calls gphoto2 directly
- All uploads go through `/api/share` on the Node backend — never browser-direct (CORS)
- Always save strip to disk before attempting upload — disk is reliable, internet is not
- GIF encoding always in a Web Worker — never on main thread
- Platform branching lives only in the Camera Adapter — screen code is platform-agnostic
