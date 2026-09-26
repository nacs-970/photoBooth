# Phase 02 - Plan 02 Summary

## Tasks Completed
- **Task 1: DSLR FPS spike**: Measured capture-movie throughput on physical camera.
  - Camera: Sony Alpha-A7 IV (PC Control)
  - FPS: 23.8 fps
  - Lag: 2s
- **Task 2: Confirm stream strategy**: Strategy decided.

## Decisions
- **Stream Strategy:** Use `option-poll` (capture-preview poll loop via execFile every 150ms).
  - *Rationale:* Although the FPS (23.8) meets the >= 5fps requirement, the perceived lag is 2s, which hits the >= 2s constraint. Per the plan's decision rule, this means we must fall back to the polling loop to ensure a responsive live-view.


## Superseded (2026-09-23)

The `option-poll` strategy was replaced in 02-06 by one persistent `gphoto2 --shell` session. Spawning a process per frame capped the preview at ~3fps (~0.2s per spawn). It also forced the Sony 3s startup wait onto every capture. The 2s lag measured here for `--capture-movie` did not show up as a camera limit in the browser. See `02-06-SUMMARY.md`.
