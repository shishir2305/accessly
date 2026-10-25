# Phase 1 verification record (historical baseline)

For current MVP behavior and acceptance status, see [MVP verification](./MVP_VERIFICATION.md). This document preserves the Phase 1 checkpoint before Phase 2 implementation.

Date: October 24, 2026. Environment: local macOS, Node 24, Docker Desktop, local Supabase/PostgreSQL/Auth/Storage, Redis, Next.js, and bundled Playwright Chromium. No deployment or customer application credentials were required. The original specification and implementation plan were not edited.

## Automated results

- TypeScript type checking and ESLint pass.
- Source formatting is checked with Prettier.
- **27 tests** across scanner, contracts, proxy/network boundaries, and bitmap evidence masking pass.
- **9 end-to-end tests** against real local services pass.
- Web production compilation and extension production build are verified separately. Extension packaging produces `artifacts/accessly-extension-0.1.0.zip`.

| Phase 1 requirement | Evidence |
| --- | --- |
| Account creation, sign-in, sign-out, recovery UI and real recovery-link password change | Workspace end-to-end tests; local Supabase Auth |
| Owner workspace, application/environment, permitted origin, saved URLs | Real API/UI setup tests; cross-origin request validation |
| Authenticated current-tab scan | Packaged extension with actual interactive browser authorization; controlled signed-in dialog fixture |
| Sign-out/login redirect and unknown role handling | Protected-context extension guard and worker redirect tests; context retained as user-declared/unknown |
| Shared normalized public and extension results | Same bundled scanner/profile; both paths saved through real service functions |
| Known barriers and correct experiences | Browser scanner tests and public worker fixtures; correct fixture has no invented violations |
| Findings, impact, rule-based guidance, reproduction context | Result-page test and visible historical run evidence |
| Optional screenshots, masking, text alternative | Real private storage and description; pixel masking test; dashboard works with no image |
| Evidence freshness | Scanner installs an independent state guard; capture refuses changed documents/viewports. Worker masks pixels after capture so its own redaction does not mutate the assessed DOM |
| Tenant isolation | Another workspace cannot read the run or obtain its screenshot link |
| Bounded evidence access/deletion | 60-second signed links; object deletion makes existing links unusable; findings survive as historical evidence |
| Idempotent uploads | Stable scan IDs yield one run/occurrence set; extension approved offline upload recovers |
| Popup closure and durable preview | Packaged popup closes and reopens without losing the signed-in scan preview |
| Queue and worker recovery | Simulated lost dispatch marker recovers from PostgreSQL outbox; cancelled runs stay cancelled |
| Private-network restrictions | Address-class/proxy tests; redirect denial; actual private subresource service receives zero requests and the result exposes incomplete scope |
| Accessly accessibility | Axe checks on dashboard, application setup, settings, findings, and extension preview; keyboard skip-link and responsive navigation/reflow tests |
| Local-only completion path | Supabase, Redis, worker, fixtures, API, web app, and extension workflow execute without hosted keys or deployment |

The extension test temporarily adds only the exact fixture origin to a copied manifest because headless automation cannot grant `activeTab` by clicking Chrome's toolbar. It uses the real packaged scanner, popup, service worker, browser identity window, one-time code exchange, upload API, and local services. The distributed manifest retains `activeTab` and the Accessly API origin only.

Local development explicitly uses Next.js's webpack mode. Cold-start testing exposed repeated Turbopack page restarts in this environment; webpack development and production builds provide the verified configuration. Tailwind source scanning is explicitly limited to authored UI sources.

## Manual acceptance still required

These checks are not claimed as completed by an automated agent:

1. Load the unmodified distributable in supported desktop Chrome. Invoke it from the toolbar, confirm temporary permission prompts, scan a normal and protected tab, capture optional evidence, and check permission-denied behavior.
2. Use VoiceOver or another supported screen reader with a human evaluator. Test account setup, application creation, scan status updates, finding details, the nonvisual evidence description, extension preview, upload approval, and recovery errors.
3. Review focus visibility and order, zoom/reflow, motion preferences, and screenshot alternatives in actual use. Keyboard users can omit an image or mask the entire image; rectangle masking is a pointer interaction.
4. Exercise real Chrome service-worker suspension and extension updating. Automated coverage proves durable popup reopening and offline retry, but does not substitute for every browser lifecycle condition.
5. If starting an external pilot, choose distribution, support commitments, retention/deletion/backup policies, and a validated deployment isolation model. These remain open decisions, not shipping guarantees.

The phase's implementation is available locally. Release acceptance must retain these outstanding human/browser checks rather than imply complete accessibility, complete browser support, or production readiness. At this historical checkpoint, Phase 2 remediation tracking and fix verification had not been implemented; the current MVP now includes them.

## Review artifacts

- `artifacts/phase1-dashboard.png`: dashboard overview.
- `artifacts/phase1-results.png`: actual fixture findings and evidence context.
- `artifacts/phase1-mobile.png`: responsive workspace.
- `playwright-report/index.html`: end-to-end results.
- `artifacts/accessly-extension-0.1.0.zip`: loadable extension archive.

Reports and traces may contain ephemeral test sessions. They are ignored by source control and should be removed when no longer useful.
