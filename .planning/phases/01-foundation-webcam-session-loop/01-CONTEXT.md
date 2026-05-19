# Phase 1: Foundation & Webcam Session Loop - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the full application shell and deliver a working countdown → capture × N → per-shot retake session loop using getUserMedia. The CameraAdapter interface defined here is the contract Phase 2 (gphoto2) implements. No strip editor, no GIF, no upload, no QR — those are Phase 4 and Phase 5 scope.

</domain>

<decisions>
## Implementation Decisions

### Screen Flow & Routing

- **D-01:** Svelte store state machine — root `App.svelte` renders a different screen component based on a store value (`$screen`). No URL changes, no routing library. Store states: `idle | countdown_preview | review | photo_grid`.
- **D-02:** Screens in order: **Idle** → **Countdown+Preview** (combined — countdown overlays live webcam feed) → **Review** (per shot) → repeat until N shots done → **Photo Grid** stub → back to **Idle** via "Start New Session".
- **D-03:** Phase 1 post-session screen is a photo grid stub: shows all captured thumbnails in a grid. GIF/upload/QR slots are not present in Phase 1 — full share flow is Phase 5 scope.
- **D-04:** Screen transitions: Svelte fade/crossfade (~200–300ms). Clean transitions between all screen states.
- **D-05:** Camera disconnect (CAM-04) is an **overlay modal**, not a dedicated screen. Modal appears over whatever screen is active; session state is preserved beneath it. Retry dismisses the modal and resumes.

### Retake Flow

- **D-06:** Review screen **waits indefinitely** — guest must tap "Keep" or "Retake". No auto-advance timeout. Guest is in full control.
- **D-07:** Retake **overwrites the slot in place** — new capture replaces `shots[N]` at the same index. No history/discard tracking.
- **D-08:** Review screen shows: **full-size thumbnail + shot progress indicator** (e.g., "2 of 4") + Keep/Retake buttons.
- **D-09:** After "Keep" (not last shot): brief **"photo saved" confirmation** (exact timing: Claude's discretion), then transition back to Countdown+Preview for the next shot.

### Countdown & Capture Feel

- **D-10:** Countdown **triggers on guest tap** — a "Start" / "Go" button on the Countdown+Preview screen. Does not auto-start when the screen appears. Guest composes before tapping.
- **D-11:** Countdown visual: **progress ring/arc around the number**, filling as time passes — overlays the live webcam preview. Number is centered in the ring.
- **D-12:** On capture: **full-screen white flash + shutter sound simultaneously**. Flash duration and fade-out timing: Claude's discretion (~300ms suggested).
- **D-13:** Audio: **shutter sound only on capture**. Countdown ticks are silent.

### Idle / Attract Screen

- **D-14:** Idle screen shows **live webcam preview + large centered "Tap to Start" button** overlaid on the preview feed.
- **D-15:** Camera is **always running on idle** — webcam feed active as soon as app loads. Guests see themselves, which is the attract.
- **D-16:** After session ends (photo grid screen): **"Start New Session" button** resets state and returns to Idle. No auto-reset timeout in Phase 1.

### Claude's Discretion

- Flash fade-out duration (suggested ~300ms)
- "Photo saved" confirmation display duration (suggested 1–1.5s)
- Progress ring animation easing and speed
- Exact shutter sound asset (standard camera click .mp3/.ogg)
- Svelte transition duration for screen crossfades (suggested 200ms)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependency chain
- `.planning/REQUIREMENTS.md` — CAM-01, CAM-02, CAM-04, SESS-01, SESS-02, SESS-03, SESS-04 (the 7 Phase 1 requirements)

### Stack & Architecture Decisions
- `.planning/research/STACK.md` — Svelte 5, Vite, Fastify 5, gphoto2 CLI rationale; why getUserMedia on Windows
- `.planning/research/ARCHITECTURE.md` — CameraAdapter pattern, component topology, session state machine design
- `.planning/research/PITFALLS.md` — Top 5 are event-killers; read before planning (especially: getUserMedia on Linux, gphoto2 USB claim conflict, GIF on main thread)

### Project Constraints
- `.planning/PROJECT.md` — Hard constraints: no Electron, no physical printing, localhost-only, all gphoto2 ops through Node backend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — fresh project, no code files exist.

### Established Patterns
- None yet — this phase establishes the patterns all later phases follow.

### Integration Points
- `CameraAdapter` interface defined here is the Phase 2 integration point. Phase 2 (gphoto2) must implement the same adapter contract without changing screen code.
- Session shots array (`shots: Blob[]` or similar) defined here will carry into Phase 4 (canvas strip editor) and Phase 5 (GIF + share). Keep it clean.

</code_context>

<specifics>
## Specific Ideas

- Progress ring/arc countdown visual (user's specific preference — not a plain number)
- Full-screen white camera flash (user described as "camera flash" — not a border pulse or localized flash)
- Live webcam on idle as the attract mechanism (user preference — guests see themselves)

</specifics>

<deferred>
## Deferred Ideas

- **Full share flow** — user described the end-of-session screen as: "show all grid photo/gif, wait screen for file upload, if file is uploaded show qr/link ready button, when click show qr/link overlay." This is the Phase 5 flow (OUT-01 through OUT-06). Phase 1 delivers the photo grid stub only; the full share screen is built in Phase 5.
- **Auto-reset timeout** — timed kiosk reset after inactivity on the photo grid screen. Not in Phase 1; could be added in a later phase or as a v2 item (KIOSK-V2-03).

</deferred>

---

*Phase: 1 — Foundation & Webcam Session Loop*
*Context gathered: 2026-05-19*
