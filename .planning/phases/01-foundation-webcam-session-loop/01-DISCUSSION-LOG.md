# Phase 1: Foundation & Webcam Session Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1 — Foundation & Webcam Session Loop
**Areas discussed:** Screen flow & routing, Retake flow behavior, Countdown & capture feel, Idle / attract screen

---

## Screen Flow & Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Svelte store state machine | One root App.svelte renders screen based on store value. No URL changes. Kiosk-native. | ✓ |
| SvelteKit file-based routes | Each screen is a +page.svelte. Navigation via goto(). URL reflects state. | |
| Manual import swap | No routing — conditional render in App.svelte. Simplest but scales poorly. | |

**User's choice:** Svelte store state machine

---

| Option | Description | Selected |
|--------|-------------|----------|
| Idle → Preview → Countdown → Capture → Review (per shot) | Separate screen states for each step. | |
| Idle → Countdown+Preview (combined) → Review (per shot) | Countdown overlays live preview — same screen. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Idle → Countdown+Preview (combined) → Review (per shot) → Photo Grid → Idle

---

| Option | Description | Selected |
|--------|-------------|----------|
| Back to Idle — 'Session complete' briefly | Flash done state, reset, return to Idle. Phase 1 stub. | |
| Hold on 'Session done' stub screen | Placeholder showing all thumbnails, no sharing yet. | |
| [Free text] | "show all grid photo/gif, wait screen for file upload, if file is uploaded show qr/link ready button, when click show qr / link overlay" | — |
| Stub screen with real photo grid only | Show captured photos. Upload/QR/GIF are Phase 5. | ✓ |

**User's choice:** Stub photo grid screen — full share flow deferred to Phase 5
**Notes:** User initially described the full end-to-end share flow (GIF + upload + QR). Redirected: that's Phase 5 scope (OUT-01–06). User agreed to photo grid stub for Phase 1.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant (no animation) | Fast transitions. | |
| Svelte fade/crossfade transitions | Smooth 200–300ms fade. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Svelte fade/crossfade transitions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated screen | App transitions to CameraError screen. Error is first-class state. | |
| Overlay modal | Modal appears over active screen. Session state preserved beneath. | ✓ |

**User's choice:** Overlay modal — session state preserved beneath

---

## Retake Flow Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Wait indefinitely — guest must tap 'Keep' or 'Retake' | No timeout. Guest controls pace. | ✓ |
| Auto-advance after timeout with manual override | Countdown on review screen. | |
| You decide | Claude picks. | |

**User's choice:** Wait indefinitely

---

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite in place | New capture replaces shots[N] at same index. Simple. | ✓ |
| Mark as discarded, append new | Old shot flagged, new appended. More history but complicates slot ordering. | |

**User's choice:** Overwrite in place

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-size thumbnail + Keep/Retake only | Minimal. No context. | |
| Full-size thumbnail + shot progress indicator + Keep/Retake | Guest knows how many shots remain. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Full-size thumbnail + "2 of 4" progress indicator + Keep/Retake

---

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately return to Countdown+Preview | Snap back, countdown starts. | |
| Brief 'photo saved' confirmation, then Countdown+Preview | 1–2s feedback before next countdown. | ✓ |

**User's choice:** Brief "photo saved" confirmation, then Countdown+Preview

---

## Countdown & Capture Feel

| Option | Description | Selected |
|--------|-------------|----------|
| Guest taps 'Start'/'Go' on preview screen | Explicit trigger. Guest composes before timer. | ✓ |
| Auto-starts when preview screen appears | No tap needed. Fast flow but no prep time. | |

**User's choice:** Guest taps 'Start'/'Go'

---

| Option | Description | Selected |
|--------|-------------|----------|
| Large centered number overlay | Number pulses or scales in on each tick. Classic. | |
| Progress ring/arc around the number | Circular timer + number in center. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Progress ring/arc filling as time passes, number centered in ring

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen white flash, ~300ms, fade out | Unmistakable. Classic photo booth feel. | |
| Full-screen white flash + camera click sound simultaneously | Flash + sound on same frame. | ✓ (interpreted) |
| Bright border pulse | White border around camera preview. Less intrusive. | |

**User's choice:** "camera flash" — interpreted as full-screen white flash + shutter sound simultaneously

---

| Option | Description | Selected |
|--------|-------------|----------|
| Shutter sound on capture only | Silent countdown, single sound on capture. | ✓ |
| Beep on each countdown tick + shutter on capture | Audible tick + shutter. | |
| You decide | Claude picks. | |

**User's choice:** Shutter sound on capture only — countdown silent

---

## Idle / Attract Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Live webcam preview + 'Tap to Start' button | Camera always running. Guests see themselves. | ✓ |
| Static splash screen, no webcam until 'Start' | Background + app name. Camera activates on tap. | |

**User's choice:** Live webcam preview always running

---

| Option | Description | Selected |
|--------|-------------|----------|
| Large centered button over the preview | Simple, obvious. | ✓ |
| Pulsing tap-anywhere overlay | Entire screen tappable, pulsing label. | |
| You decide | Claude picks. | |

**User's choice:** Large centered "Tap to Start" button over webcam preview

---

| Option | Description | Selected |
|--------|-------------|----------|
| 'Start New Session' button on photo grid screen | Explicit reset. | ✓ |
| Auto-reset after 30s inactivity | Safety net for kiosk. | |
| Both: auto-reset + manual button | Best kiosk behavior. | |

**User's choice:** 'Start New Session' button only — no auto-timeout in Phase 1

---

## Claude's Discretion

- Flash fade-out duration (suggested ~300ms)
- "Photo saved" confirmation display duration (suggested 1–1.5s)
- Progress ring animation easing and speed
- Shutter sound asset selection (.mp3/.ogg, standard camera click)
- Svelte transition duration (suggested 200ms)

## Deferred Ideas

- **Full share flow** — GIF + upload + QR (Phase 5, OUT-01–06). User described this as the desired end-state.
- **Auto-reset timeout** — idle reset after inactivity on photo grid screen (could be Phase 5 or v2 KIOSK-V2-03).
