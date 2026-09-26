---
phase: 02-tethered-dslr-capture-gphoto2
fixed_at: 2026-09-26T07:40:00Z
review_path: .planning/phases/02-tethered-dslr-capture-gphoto2/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-09-26T07:40:00Z
**Source review:** .planning/phases/02-tethered-dslr-capture-gphoto2/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04), chosen by the user
- Fixed: 7 (CR-01, WR-01 and WR-02 need a human check on hardware)
- Skipped: 0
- No change needed: 0
- Deferred: WR-05 to WR-11 and IN-01 to IN-05 (12 items), listed in `deferred-items.md`

## Fixed Issues

### CR-01: The probe fallback reports `available: true` when no camera is attached

**Status:** fixed: requires human verification
**Files modified:** `server/src/camera/CameraService.ts`, `server/src/camera/autoDetect.test.ts` (new), `server/package.json`
**Commit:** f1053c6
**Evidence:** The orchestrator confirmed on the host that `gphoto2 --auto-detect` exits 0 with only the header and the dashed line when no camera is attached. The old code never read stdout.
**Applied fix:**
- Added the pure function `autoDetectFoundCamera(stdout)`. It returns true only when at least one non-blank row follows the dashed separator line.
- I chose "any non-blank row" and not "only `usb:` rows", so serial or PTP/IP ports also count. No camera gives an empty table.
- The USB_CONFLICT stderr detection in the `catch` is unchanged.
- Added a `node:test` check (`npm test` runs `node --import tsx --test "src/**/*.test.ts"`, with no new dependency). It covers five cases: empty output, header only, header plus dashes, dashes plus trailing blank lines, and one `usb:` row.

### CR-02: The server listens on 0.0.0.0

**Status:** fixed
**Files modified:** `server/src/index.ts`
**Commit:** e73480d
**Applied fix:**
- The server now listens on `process.env.HOST || '127.0.0.1'`.
- The log line prints the host actually in use.

**Vite proxy:** `web/vite.config.ts` is unchanged and still targets `http://localhost:3001`. Evidence that this is safe:
- `0.0.0.0` is IPv4-only, and the proxy already worked with it (UAT passed).
- On this host `localhost` resolves to `::1` first. A Node 26 `http.get('http://localhost:<port>')` still reached a server bound only to `127.0.0.1`, because of happy-eyeballs fallback.

**Residual risk:** some shells or launchers export `HOST`. zsh defines it but does not export it, and it is not set in this environment. If a launcher exports it, the server binds to that name.

### CR-03: A double tap on Keep advances two shots

**Status:** fixed
**Files modified:** `web/src/screens/ReviewScreen.svelte`, `web/src/screens/ReviewScreen.test.ts` (new)
**Commit:** faa85f7
**Applied fix:**
- Keep returns early while `keepShotTimer` is pending, or once a `leaving` flag is set.
- `leaving` is set when a screen change is actually requested: a last-shot Keep, the Keep timer firing, or Retake. After that, every tap is ignored until the screen unmounts. This also covers taps on the old screen during the 250ms `{#key}` fade.
- Behaviour choice: Retake during the 1.2s "Photo saved" toast still cancels the Keep, as before.
- I did not add the `disabled` prop on the Keep button, to keep the change minimal.

**Tests:**
- "Double tap on Keep advances only one shot" and "tap on Keep after the timer fired is ignored" both failed before the fix (index 2), and pass after it (index 1).
- "Retake during the toast still cancels the Keep" passes.

### WR-01: `probe()` checks for the shell outside the queue

**Status:** fixed: requires human verification
**Files modified:** `server/src/camera/CameraService.ts`
**Commit:** df4f6a1
**Evidence:** `ensureShell()` sets `this.shell` only after several awaits, and it runs inside a queue task. The old `probe()` read `this.shell` when it was called but ran `--auto-detect` later, from its own queued task. So the finding is real.
**Applied fix:**
- The whole decision now runs inside one queued task: capture pending, recent frame, `get-config` on a live shell, `stopShell()` and await the exit (bounded to 5s), then the `--auto-detect` fallback.
- The `pendingCaptures` and recent-frame checks stay outside the task as fast paths.
- The 3s `get-config` timeout still starts inside the queue.

### WR-02: The preview loop's disconnect path leaves the running command's waiter hanging

**Status:** fixed: requires human verification
**Files modified:** `server/src/camera/CameraService.ts`
**Commit:** 579d020
**Applied fix:**
- `stopShell()` now rejects any pending `shellWaiter` immediately with "gphoto2 shell stopped". Before, `onData` and `onGone` ignored a process that was no longer `this.shell`, so the waiter hung until its timeout.
- The 5-failure path in `previewLoop` now stops the shell through the queue. It stops only if its loop is still `live()`. If a capture or a newer loop has taken over, it does nothing.
- Subscribers get `onEnd()` only when that stop actually ran, so a stale loop cannot end a healthy stream after a capture.
- `stopShell()` still sends `exit`, then SIGINT after 2s. It never sends SIGKILL.

### WR-03: The idle close never fires in the kiosk's real idle state

**Status:** fixed
**Files modified:** `web/src/screens/IdleScreen.svelte`, `web/src/lib/config.ts`, `web/src/screens/IdleScreen.test.ts` (new)
**Commit:** f40690c
**Evidence:**
- `IdleScreen.svelte` mounted `<LivePreview>` unconditionally, so the idle screen was a permanent stream subscriber.
- The server's `armIdleClose()` runs only when the subscriber count drops to 0.
- On the client, only the canvas watchdog (canvas left the DOM) closes the stream.

**Applied fix:**
- Added `IDLE_PREVIEW_MS = 5 * 60_000` in `config.ts`.
- IdleScreen unmounts LivePreview after `IDLE_PREVIEW_MS` with no `pointerdown`, handled through `<svelte:window>`. The canvas watchdog then closes the stream, and the server's `SHELL_IDLE_MS` close (10 min) follows.
- The next tap re-attaches the preview and restarts the timer.
- Server subscriber semantics are unchanged.
- Known limit: with the webcam adapter, only the `<video>` element unmounts. The MediaStream stays live (outside WR-03's gphoto2 scope).

**Tests:** three fake-timer tests (detach, re-attach on tap, interaction restarts the timer). All three failed before the fix and pass after it.

### WR-04: The white flash stays up for the whole DSLR capture, and nothing bounds the capture on the client

**Status:** fixed (the "Saving photo…" state from the review suggestion was not added)
**Files modified:** `web/src/lib/camera/TetheredAdapter.ts`, `web/src/lib/camera/TetheredAdapter.test.ts`, `web/src/screens/CountdownScreen.svelte`
**Commit:** fe70040
**Applied fix:**
- `capture()` uses an AbortController. The POST, including the body read, aborts after `CAPTURE_TIMEOUT_MS = 15_000` with the reason "Capture timed out", so CountdownScreen reaches the Review "Capture failed" path. The timer is cleared in `finally`.
- The flash fix was one line: CountdownScreen now calls `setTimeout(() => (flashVisible = false), FLASH_DURATION_MS)` right after showing the flash. The existing post-capture timers are unchanged.
- The existing capture test now expects `signal`. A fake-timer timeout test was added, and it failed before the fix.

**Knock-on, not fixed:**
- After a client abort, the server keeps capturing.
- An immediate Retake can then open the stream mid-capture and get a 503. The client shows that 503 as a disconnect (IN-03, deferred).
- No "Saving photo…" state is shown while the capture is pending.

## Skipped Issues

None.

## Deferred (user choice 2026-09-26)

WR-05, WR-06, WR-07, WR-08, WR-09, WR-10, WR-11 and IN-01 to IN-05 are listed one per line in `deferred-items.md`.

## Verification

**Where the gates ran:**
- During fixing, the gates ran in the isolated worktree (`.claude/worktrees/rf-02-…`). Its `node_modules` were symlinks to the main checkout, and a gitignored `web/vitest.worktree.config.ts` added `server.fs.allow`, which Vite needs for the symlinked deps.
- After the fast-forward, the gates ran again in the main checkout with the stock config. Those are the numbers below.

| Gate | Result |
|---|---|
| `server: npx tsc --noEmit -p .` | clean |
| `server: npm test` (node:test via tsx) | 4/4 pass |
| `web: npx vitest run` | 85/85 pass (was 78, plus 7 new) |
| `web: npx tsc --noEmit` | 25 errors, the same as the existing count |

**Hardware checks still needed:**
- With the camera unplugged, `/api/camera/info` returns `gphoto2Available: false`.
- The Vite proxy still reaches the server after the `127.0.0.1` bind.
- The idle screen detaches the preview after 5 minutes, and the shell closes about 10 minutes later.
- A normal capture finishes well under 15s, and the flash fades at about 300ms.
- A double tap on Keep on the kiosk advances only one shot.

---

_Fixed: 2026-09-26T07:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
