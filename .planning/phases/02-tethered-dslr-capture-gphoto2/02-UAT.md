---
status: complete
phase: 02-tethered-dslr-capture-gphoto2
source:
  - 02-06-SUMMARY.md
  - 02-07-SUMMARY.md
started: 2026-09-26T00:00:00Z
updated: 2026-09-26T00:00:00Z
user_story: "As a kiosk host, I want the DSLR pipeline to survive unplugging, idling and relaunching, so that an event never needs an app restart because of camera state."
hardware: Sony ILCE-7M4 (A7 IV), libgphoto2 2.5.34, Linux
approved_by_user: "2-07 approved"
---

## Current Test

[testing complete]

## Run Record

- **Date:** 2026-09-26
- **Camera:** Sony ILCE-7M4 (A7 IV), USB, PC Remote mode
- **Run by:** user (hardware operator), at the 02-07 Task 4 checkpoint
- **User response (verbatim):** "2-07 approved"
- **Failing items reported:** none

**Notes:** The user reported only an overall approval of the whole checklist. No per-item measurements were reported. The numbers in the `expected:` lines below (fps, lag, delays, MB) are the plan's **targets**. They are not measured values. Each result is recorded as "pass (user-approved)" on the strength of that single overall approval.

## Success-Criteria Mapping

| Phase 2 ROADMAP criterion | Covered by |
|---|---|
| SC #1: auto-route to gphoto2, live preview within a few seconds | 0, 1 |
| SC #2: full session fires the DSLR shutter, DSLR JPEG in review | A1, A4, 2 |
| SC #3: unplug shows "Camera disconnected", replug + Retry resumes | B1, 3 (SC #3a), 4 (SC #3b) |
| SC #4: relaunch while gvfs/PTP holds USB recovers cleanly | 5 |
| No SC (plan must_haves / phase goal: survive idling) | A2, A3, 6, 7 |

## Tests

### Section 0: Setup

#### 0. Dev start
expected: |
  `npm run dev` from the repo root starts both `[web]` and `[server]` after the root
  dependency cleanup (02-07 Task 3). The app loads in the browser.
maps_to: SC #1 (precondition)
result: pass (user-approved)

### Section A: Server shell behaviour (02-07 Task 1 manual checks)

#### A1. Overlapping captures
expected: |
  With the stream open, two overlapping `POST /api/camera/capture` calls both return
  200 JPEGs. No preview command runs between them and no preview error is logged.
maps_to: SC #2; must_have "Two overlapping POST /api/camera/capture calls never let a preview command run between them"
result: pass (user-approved)

#### A2. Idle shell close
expected: |
  With `SHELL_IDLE_MS=15000`, `pgrep -x gphoto2` shows no process about 15s after the
  last stream closes.
maps_to: must_have "The gphoto2 shell is closed after SHELL_IDLE_MS with no subscribers and no capture"
result: pass (user-approved)

#### A3. Reopen after idle close
expected: |
  After the idle close, the next stream request reopens the gphoto2 shell and preview
  frames arrive again.
maps_to: must_have "... and the next preview reopens it"
result: pass (user-approved)

#### A4. Fast first capture after idle close
expected: |
  The first capture after a 3s countdown (preview running through the countdown) fires
  quickly, with a total under 4.5s. There is no extra Sony 3s session wait.
maps_to: SC #2; must_have "The first capture after an idle close still skips the Sony 3s wait"
result: pass (user-approved)

### Section B: Probe honesty

#### B1. Unplug while idle shows unavailable
expected: |
  Unplug the camera while the app sits idle (shell open, no recent frame).
  `GET /api/camera/info` no longer reports `gphoto2Available: true`, and the app shows
  the camera as unavailable instead of a stale "available".
maps_to: SC #3; must_have "GET /api/camera/info never reports gphoto2Available:true for a camera that was unplugged while the app sat idle"
result: pass (user-approved)

### Section C: Phase 2 hardware UAT (02-07 Task 4, items 1–7)

#### 1. SC #1: live preview
expected: |
  Launch, pick DSLR. Live preview appears within a few seconds, is smooth (target ~25fps),
  and lag measured with a phone stopwatch is under 0.5s (target).
maps_to: SC #1
result: pass (user-approved)

#### 2. SC #2: 4-shot session
expected: |
  A full 4-shot session. Each shot fires within ~1s of the countdown hitting 0.
  Exactly one photo per press. The review shows the DSLR JPEG and the grid shows all 4.
maps_to: SC #2
result: pass (user-approved)

#### 3. SC #3a: unplug during live preview
expected: |
  Unplug during the live preview. The disconnect modal appears within ~3s and the server
  keeps running. Replug, press Retry, and the preview resumes.
maps_to: SC #3
result: pass (user-approved)

#### 4. SC #3b: unplug during countdown
expected: |
  Unplug during the countdown. The capture fails and shows "Capture failed" + Retake, or
  the disconnect modal. The app is never stuck.
maps_to: SC #3
result: pass (user-approved)

#### 5. SC #4: gvfs conflict on relaunch
expected: |
  Stop the app, then let gvfs claim the camera (replug with gvfs running). Relaunch.
  The USB conflict message is shown. After `pkill -f gvfs-gphoto2-volume-monitor`,
  Retry succeeds.
maps_to: SC #4
result: pass (user-approved)

#### 6. 15-minute idle
expected: |
  Leave the idle screen for 15 min (past the default SHELL_IDLE_MS), then run a session.
  It works, and the first shot has no extra 3s delay.
maps_to: phase goal (survive idling); must_have idle close + fast first capture
result: pass (user-approved)

#### 7. RAM
expected: |
  The browser tab stays under ~400 MB (target) over a 10-minute session.
maps_to: phase goal (02-06 memory fix holds with the 02-07 parser)
result: pass (user-approved)

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
