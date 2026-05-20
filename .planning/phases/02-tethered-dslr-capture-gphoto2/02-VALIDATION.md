---
phase: 02
slug: tethered-dslr-capture-gphoto2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 |
| **Config file** | `web/vite.config.ts` (test block — configured in Phase 1) |
| **Quick run command** | `cd web && npm test` |
| **Full suite command** | `cd web && npm test` |
| **Estimated runtime** | ~5–10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npm test`
- **After every plan wave:** Run `cd web && npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite green + manual DSLR smoke test
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CAM-03 | N/A | unit | `cd web && npm test -- --run src/lib/session.test.svelte.ts` | ✅ (add camera_select assertion) | ⬜ pending |
| 02-01-02 | 01 | 1 | CAM-03 | N/A | component | `cd web && npm test -- --run src/screens/CameraSelectScreen.test.ts` | ❌ Wave 0 | ⬜ pending |
| 02-03-01 | 03 | 3 | CAM-03 | spawn args array (no exec string concat) | unit | `cd web && npm test -- --run src/lib/camera/TetheredAdapter.test.ts` | ❌ Wave 0 | ⬜ pending |
| 02-03-02 | 03 | 3 | CAM-03 | USB_CONFLICT checked before gphoto2Available | unit (mock fetch) | `cd web && npm test -- --run src/lib/camera/TetheredAdapter.test.ts` | ❌ Wave 0 | ⬜ pending |
| 02-04-01 | 04 | 4 | CAM-03 | path.resolve + integer coercion on capture paths | unit (mock fetch) | `cd web && npm test -- --run src/lib/camera/TetheredAdapter.test.ts` | ❌ Wave 0 | ⬜ pending |
| 02-05-01 | 05 | 5 | CAM-03 | N/A | component | `cd web && npm test -- --run src/components/DisconnectModal.test.ts` | ✅ (add message prop test) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/src/lib/camera/TetheredAdapter.test.ts` — stubs for CAM-03 adapter behaviors (init, attachPreview, capture, dispose)
- [ ] `web/src/screens/CameraSelectScreen.test.ts` — probe + tile render tests
- [ ] `web/src/components/DisconnectModal.test.ts` — add message prop test to existing file
- [ ] `web/src/lib/session.test.svelte.ts` — add `camera_select` initial screen assertion to existing file
- [ ] Optional: `server/src/camera/CameraService.test.ts` — SOI/EOI parser unit tests if server-side Vitest is configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| gphoto2 FPS measurement on real camera | CAM-03 | Requires physical DSLR | Plan 02-02: run `gphoto2 --capture-movie --stdout | pv -r > /dev/null` for 10s, record fps |
| Live MJPEG preview visible in browser | CAM-03 | Requires physical DSLR over USB | `npm run dev` → pick DSLR tile → verify preview loads within 3s |
| Physical shutter fires on capture | CAM-03 | Requires physical DSLR | Complete 4-shot session → verify DSLR audibly fires + JPEG blob in review thumbnail |
| DSLR reconnect after mid-session unplug | CAM-03 | Requires physical DSLR | Unplug USB mid-session → DisconnectModal appears → replug → Retry → session resumes |
| USB conflict message on gvfs-held device | CAM-03 | Requires gvfs conflict state | Launch with Image Capture open → verify DisconnectModal shows USB conflict message verbatim |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
