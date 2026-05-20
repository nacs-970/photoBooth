---
status: complete
phase: 01-foundation-webcam-session-loop
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
started: 2026-05-20T00:00:00Z
updated: 2026-05-20T00:00:00Z
user_story: "As a guest, I want to complete a countdown → multi-shot → retake photo session using a webcam, so that I get a set of session shots I'm happy with."
mvp_mode: true
---

## Current Test

number: 12
name: Fresh Session State — No Leftover Data
expected: |
  After completing a full session and tapping "Start New Session":
  the session counter is back at 0, idle screen shows clean live feed.
  Optional: DevTools → Memory — no obvious blob: URLs lingering from the previous session.
awaiting: complete

## Tests

### Section A: User Flow

#### 1. Cold Start Smoke Test
expected: |
  Run `npm run dev` from repo root. Both `[web]` and `[server]` processes start without crashing.
  http://localhost:5173 loads a page. `curl http://localhost:3001/api/camera/info` returns JSON with `platform`, `gphoto2Available`, `cameraMode`.
result: pass (automated — server returns valid JSON, Vite builds 145 modules clean)

#### 2. Idle Screen — Webcam Preview + Tap to Start
expected: |
  Browser shows a full-screen webcam feed (you can see yourself or your camera view).
  A yellow "Tap to Start" button is centered on top of the feed.
  No console errors (permission prompt on first load is expected and OK).
result: pass

#### 3. Tap to Start → Countdown Screen
expected: |
  Tapping/clicking "Tap to Start" transitions to a Countdown Screen with a fade animation.
  A circular ring begins filling, the numeral counts down: 3 → 2 → 1.
  The webcam feed is still visible behind/inside the countdown ring.
result: pass (after fix — @keyframes replacement)

#### 4. Capture — Flash + Shutter Sound
expected: |
  At the end of the countdown (after "1") the screen briefly flashes white and an audible shutter click plays.
  The app transitions to a Review Screen immediately after.
result: pass

#### 5. Review Screen — Thumbnail + Keep/Retake
expected: |
  The Review Screen shows a thumbnail of the just-captured shot.
  Two buttons are visible: one to keep the shot, one to retake it.
  A shot progress indicator shows how many shots are done (e.g. "1 of 4").
result: pass

#### 6. Retake Shot — Goes Back to Countdown
expected: |
  Tapping the Retake button returns to the Countdown Screen.
  A new countdown starts (3 → 2 → 1), a new flash + shutter fires, and the Review Screen shows the replacement shot.
  The shot index has not advanced (still "1 of 4").
result: pass

#### 7. Keep Shot — Advances to Next Shot
expected: |
  Tapping the Keep button shows a brief toast notification, then starts the countdown for shot 2.
  The shot progress indicator advances (e.g. "2 of 4").
  Repeating Keep for shots 2, 3, 4 completes the session.
result: pass

#### 8. Photo Grid — All Shots Visible
expected: |
  After keeping the 4th shot, the app shows a Photo Grid screen.
  All 4 captured thumbnails are visible in the grid.
  A "Start New Session" button is visible.
result: pass

#### 9. Start New Session — Returns to Idle
expected: |
  Tapping "Start New Session" returns to the Idle Screen with the webcam feed and "Tap to Start".
  The photo grid is gone. No previous thumbnails visible anywhere.
result: pass

### Section B: Technical Checks (run after Section A passes)

#### 10. Camera Disconnect — Modal Appears
expected: |
  While the app is running (any screen), unplug or disable the webcam.
  Within ~2 seconds a "Camera disconnected" modal overlay appears.
  The modal shows a message about checking the cable and a Retry button.
  The app does not crash or show a blank screen.
result: pass

#### 11. Retry Camera — Reconnects
expected: |
  After the disconnect modal appears, reconnect the webcam (or re-enable it in OS settings).
  Tapping the Retry button on the modal: the modal dismisses and the webcam preview resumes.
result: pass

### Section C: Coverage Check

#### 12. Fresh Session State — No Leftover Data
expected: |
  After completing a full session (all 4 shots kept) and tapping "Start New Session":
  open browser DevTools, check for any object URLs still alive in memory (no obvious blob: URLs lingering).
  The session counter is back at 0. The idle screen shows a clean live feed.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
