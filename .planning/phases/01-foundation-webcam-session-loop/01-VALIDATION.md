---
phase: 1
slug: foundation-webcam-session-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 |
| **Config file** | `web/vite.config.ts` (test block) — Wave 0 installs |
| **Quick run command** | `cd web && npx vitest run --reporter=dot` |
| **Full suite command** | `cd web && npx vitest run` |
| **Estimated runtime** | ~5 seconds (unit tests only) |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cd web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | SESS-01 | — | N/A | unit | `cd web && npx vitest run src/lib/session.test.svelte.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | SESS-01 | — | N/A | unit | `cd web && npx vitest run src/lib/session.test.svelte.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | SESS-04 | — | Object URL revoked on retake | unit | `cd web && npx vitest run src/lib/session.test.svelte.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | CAM-04 | — | N/A | unit | `cd web && npx vitest run src/lib/session.test.svelte.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 0 | SESS-03 | — | N/A | unit (mocked) | `cd web && npx vitest run src/lib/audio.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 0 | CAM-02 | — | N/A | unit (mocked) | `cd web && npx vitest run src/lib/camera/WebcamAdapter.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | SESS-02 | — | N/A | component | `cd web && npx vitest run src/components/FlashOverlay.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 1 | CAM-04 | — | N/A | component | `cd web && npx vitest run src/components/DisconnectModal.test.ts` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | CAM-01 | — | N/A | integration | manual smoke test (Fastify running) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/vitest-setup.ts` — `@testing-library/jest-dom/vitest` import
- [ ] `web/vite.config.ts` — test block with `svelteTesting()` plugin, `happy-dom` environment, `resolve.conditions: ['browser']` in test mode
- [ ] `web/src/lib/session.test.svelte.ts` — stubs for SESS-01, SESS-04, CAM-04 state machine
- [ ] `web/src/lib/audio.test.ts` — stubs for SESS-03 audio gating (mocked AudioElement)
- [ ] `web/src/lib/camera/WebcamAdapter.test.ts` — stubs for CAM-02 (getUserMedia mocked)
- [ ] `web/src/components/FlashOverlay.test.ts` — stubs for SESS-02
- [ ] `web/src/components/DisconnectModal.test.ts` — stubs for CAM-04 render
- [ ] Install dev deps: `vitest @testing-library/svelte @testing-library/jest-dom happy-dom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `GET /api/camera/info` returns `{ platform, cameraMode: 'webcam' }` on Phase 1 machine | CAM-01 | Fastify server must be running; requires live process | Start server with `npm run dev`, `curl http://localhost:3001/api/camera/info` and verify `cameraMode: 'webcam'` |
| Shutter sound plays on capture (no console error) | SESS-03 | Audio autoplay behavior depends on real browser gesture policy; not reliably testable in happy-dom | Load app in browser, tap Start, complete capture, verify audible click and no `NotAllowedError` in console |
| Physical webcam unplug shows DisconnectModal | CAM-04 | OS USB event; not triggerable in test environment | During idle screen, unplug webcam USB, verify modal appears within 2s |
| Camera permission denied shows dedicated screen (not crash) | CAM-04 | Browser permission state; requires browser settings manipulation | Set camera to denied in browser site permissions, reload app, verify appropriate error screen |
| Live webcam preview on idle screen | CAM-02 | Requires hardware camera | Load app, verify live feed visible on idle screen with no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
