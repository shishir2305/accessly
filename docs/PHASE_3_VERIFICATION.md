# Phase 3 local verification — October 25, 2026

Local implementation covers explicit journeys/recording, versioned Chromium replay, dedicated authenticated automation, state checkpoints, selected keyboard/focus observations, safe action boundaries and explicit incomplete outcomes. Phases 4–5 were not implemented. The product specification is unchanged. The original MVP's human/browser/customer acceptance remains pending.

## Environment and commands

Node.js 24, pnpm 11.25.0, pinned Playwright 1.64.1/bundled Chromium, axe-core 4.14.0, local Supabase PostgreSQL/Auth/Storage, Redis, Next.js production build and controlled fixture server. Public/target identities are disposable local test accounts. No hosted credentials, AI provider, external customer application or deployment was used.

```sh
pnpm local:setup
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
ACCESSLY_SERVER_MODE=production pnpm exec playwright test
pnpm extension:package
```

Local setup applied migrations 0005–0006, denied direct browser grants to the new tables, generated/preserved the owner-only server encryption key ring and rebuilt the extension. The scanner stays at 0.2.0 because the axe profile/scanner implementation is unchanged; journey runner/definition version is 1 and extension package version is 0.3.0.

## Results

- TypeScript and ESLint passed.
- Prettier passed after formatting the generated migration metadata.
- All **54 tests in six integration/domain/network/contract/evidence files passed**, including eight new browser-backed journey tests.
- Web and extension production builds passed.
- All **23 end-to-end tests passed against the production web build** in 3.7 minutes, using the real local worker/Auth/database/storage/Redis/fixtures/packaged extension. Seven scenarios are new Phase 3 end-to-end tests; the existing sixteen MVP scenarios also passed. The seven affected journey scenarios were rerun against the rebuilt production app after the final stale-authorization correction (all seven passed in 1.8 minutes).
- The full 54-test integration/domain suite was rerun after the final reached-URL diagnostic and stale-authorization corrections. Diagnostics retain the actual stopped page after navigation. Scope changes invalidate old snapshots before further actions.
- Extension ZIP `artifacts/accessly-extension-0.3.0.zip` was built twice; SHA-256 equality passed. The archive contains the packaged recorder alongside the existing scanner/background/popup.
- Checked 42 client build files: no configured server database/service credentials or journey encryption keys were found. `.env.local` permission is 600.
- Local services were booted and tested through Docker with loopback-only published ports. No deployment or external account configuration was required.

## Tested behavior

- Complete public keyboard journey: menu, disclosure, tab, dialog, invalid input/error state and recovery, with six checkpoints and structural focus entry/movement/exit/restoration evidence.
- Public input references and secret omission; pointer-only runs explicitly leave keyboard operation unassessed. Programmatic fill/select is disclosed separately.
- Dedicated username/password login recipes and separately provisioned host-scoped browser sessions. Protected checkpoints require the exact intended role assertion. Wrong roles and invalid/expired/revoked sessions never establish protected coverage.
- Versioned encryption/authenticated tenant binding, tampering denial, metadata-only identity listings, expiry, revocation/deletion and serialized environment/account use. Raw target passwords/typed values do not appear in ordinary run output.
- Dialog and error-state axe failures remain attached to their triggering sequence even when later recovery fails. Focus mismatches remain observations/pattern guidance, separate from established axe failures.
- Explicit action grants and exact POST boundaries: an authorized test-setting update can execute; unapproved purchases, submits mislabeled UI and undeclared network writes stop. Missing locators, excluded controls, unsupported requested checks and cancellation retain reached evidence and recovery instructions.
- Checkpoint provenance, immutable saved versions, stale revision rejection, individually assessed/unassessed variations and reviewable passive suggestions. Queued/running snapshots and original-context targeted retests stop when the current journey version changes; old grants cannot bypass edited boundaries, and unreached targets become explicitly inconclusive.
- Finding-specific retests replay the original snapshot, role, identity and action sequence; clean initial-page scans cannot replace reached-state evidence. Incomplete journeys/adjacent review cannot establish automated resolution even when the targeted checkpoint passes.
- Durable outbox/idempotency, checkpoint retention, no automatic side-effect retry after worker interruption, and new-run recovery guidance.
- Cross-tenant denial for journey definition/edit/replay, run/checkpoint results and identities. Authenticated Supabase browser roles cannot directly read the new tables.
- Extension explicit-start recording, popup closure/reopening, same-origin document/SPA navigation reattachment, explicit unsupported gaps for query/fragment routes, safe runtime references, trusted-event boundary, stop/discard, expiry and origin changes. Its focused packaged-extension scenario was rerun after the final SPA/privacy refinement. The headless extension harness grants only the controlled fixture origin in a temporary copy; the distributable retains activeTab-based target access.
- Web journey authoring/saving/replaying using keyboard submission; identity provisioning/revocation; secret form reset; automated accessibility checks and responsive reflow. History link target-size failures found during development were corrected before final verification.
- Existing MVP account, public/current-tab scanning, evidence, remediation, verification, recurrence, queue recovery, tenant and retention scenarios remain in the complete end-to-end suite.

## Support limits and unresolved decisions

The supported worker remains Chromium/top-level/same-origin. Query/fragment-dependent replay routes, external SSO/MFA/CAPTCHA, sessionStorage/IndexedDB and unattended login renewal are unsupported; use explicit supported test routes and provisioning. Recorded drafts support stable IDs/test IDs; unsupported targets need manual review/authoring. Selected roles/branches are an explicit known denominator; exhaustive state discovery is not claimed.

Raw journey Playwright traces, screenshots, DOM snapshots, network bodies and typed values are disabled because redaction/exclusions cannot be guaranteed. Minimized action/focus evidence remains usable. Adding optional raw traces requires enforceable exclusion, private access and retention controls. Passive branch suggestions are never automatically executed or counted as assessed coverage.

Action declarations, rendered-control checks, exact request grants and network restrictions cannot infer every application-specific side effect. Use authorized disposable test data/accounts, especially for GET-based mutations and ambiguous business controls. There is no autonomous scope expansion or automatic side-effect retry.

The AES-256-GCM key ring is locally controlled in owner-only server configuration and protected backups. Hosted managed KMS, browser isolation/network controls, residency, customer retention guarantees and deployment were neither selected nor validated. Live revocation/expiry does not delete offline backup copies. Restored journey work is marked incomplete instead of replaying possible side effects; a destructive restoration of live data was not performed in Phase 3.

Human assistive-technology, focus visibility/meaningful order, zoom/motion/task-usability, unmodified real Chrome toolbar/activeTab/lifecycle acceptance and real customer pilot efficacy remain unverified. Automated fixture results are scoped evidence, not full WCAG conformance, production readiness or customer validation.

## Final local state

The full production end-to-end harness stops its web, worker and fixture processes on completion. Local Supabase/Redis and their retained volumes remain available through Docker. Run `pnpm dev` to review the application at `http://127.0.0.1:3000`; use `pnpm local:stop` to stop the local dependencies while retaining data. No live data restoration or deployment was performed.
