# MVP verification record

Date: October 25, 2026. Phases 1–2 implement the local MVP. Verified on macOS with Node 24, pnpm 11.25.0, Docker Desktop, local Supabase PostgreSQL/Auth/private Storage, Redis, Next.js production output, a separate Playwright worker, controlled application fixtures, and packaged Chromium extensions. No deployment, hosted API key, AI, or customer credentials were required.

## Results

- **46 tests across five scanner/domain/network/contract/evidence test files passed.**
- **16 complete end-to-end tests passed** against the production web build and real local services.
- TypeScript, ESLint, Prettier, production web and extension builds, versioned migrations, and ZIP packaging passed.
- Consecutive extension packages are byte-identical with fixed ZIP metadata and sorted entries; installed source identity remains stable. Current distribution: `artifacts/accessly-extension-0.2.0.zip`.
- Configured server database URLs and service-role credentials were absent from the web static and extension bundles. Local environment permissions are 600.
- Published Supabase API, database, mail, and Redis ports were checked at `127.0.0.1`; the setup preserves gateway configuration/certificates and checks health and Auth reconnection. Global Docker settings are unchanged.
- An offline database/Auth/Storage backup was created privately. Hash checks and an isolated PostgreSQL restore passed, including matching Auth-user, finding, verification, and evidence-metadata counts. Temporary restore resources were removed.

## Requirement evidence

| Requirement | Local evidence |
| --- | --- |
| Account/application setup and authenticated assessment | Real sign-in/setup UI, interactive extension authorization, signed-in current-tab scan, role/context retained |
| Full authenticated repair loop | Packaged scanner finds the unnamed profile save button; fixture remedy adds its name; web remedy/version/steps form saves; extension selects a targeted retest; keyboard Enter still activates Save profile; the verification form records the scoped decision; a later matching failure reopens it |
| Reproduction history | User-provided steps and safe-input descriptions; separate attempts; original run/observation preserved |
| Separate assessment and work state | Explicit evidence assessment, attributed lifecycle/remedy edits, review reasons and immutable event/decision history |
| Appropriate verification | Explicit target presence/uniqueness/visibility and actual axe node outcome; comparable scope and required confirmations; contextual/unknown/incomplete rules require human review |
| Conservative closure | Missing/hidden controls, changed role/state/page/authentication/viewport/configuration, broad clean runs, partial execution, login redirects, missing confirmations, stale remedy snapshots, and outstanding adjacent review cannot silently resolve findings |
| Adjacent behavior | Pending required review blocks resolution and persists when a later request unchecks its requirement; recorded passed review/conditions supports the scoped decision |
| Reviewed closure | Feature retirement is counted separately from verified resolution; false-positive/applicability closure requires a specific attributed reason |
| Comparable recurrence | New comparable failure links to prior accepted verification and reopens the finding; incompatible context or previous human verification requires review |
| Finding views and comparison | Saved private filters, separate work/verification/closure counts, same-application run comparison with explicit not-assessed and selected-check-pass categories |
| Tenant access | Cross-workspace finding detail/edit, retest, verification, history, comparison, saved views and evidence operations denied or scoped |
| Evidence privacy and deletion | Private access, expiring links, minimized scan payload, optional screenshots, local masking/omission, opt-in workspace expiry, deletion/upload serialization, retained historical records |
| Recovery | Stable scan IDs, popup reopening, approved offline retries, PostgreSQL outbox recovery, cancelled/failed states, bounded worker execution and private-network/subresource denial |
| Accessly accessibility | Axe checks cover essential web/extension flows, remediation and automated/human verification forms; keyboard submission and fixture functionality; responsive/reflow and skip/navigation checks |
| Works without optional capabilities | Public and signed-in loops complete without AI, screenshots, team membership, hosting, or journey replay |

The headless extension harness adds only the exact controlled fixture origin to a temporary copy because it cannot click the real Chrome toolbar to grant `activeTab`. The distributable retains temporary current-tab access and its configured Accessly API origin. Broker authorization, scanner, service worker, popup, upload review, API and persistence are real.

Production-build testing avoids cold-start development reloads affecting interactive acceptance. `pnpm test:e2e:production` reproduces that configuration after local setup. Test identities/contract decisions and fixture feedback are disposable controlled data; they do not represent actual customer reports or completed human evaluations.

## Still open before external acceptance

1. A human evaluator must exercise the unmodified package in supported desktop Chrome: toolbar `activeTab`, permissions/capture denial, actual service-worker suspension, and updating.
2. A human screen-reader/assistive-technology evaluation must cover essential flows, status/error recovery, focus order/visibility, nonvisual evidence, zoom/reflow and motion preferences. Automated rules/keyboard checks do not establish full accessibility or conformance.
3. Select a real authorized pilot application/audience and controlled distribution or store submission. Gather actual reproduction usefulness and measured resolution effort; no efficacy, purchasing, or time-saving claim is established by fixture tests.
4. Choose external support, residency, retention/backup/deletion commitments. Local defaults and operator tools do not create managed provider guarantees. Offline backups include credentials/private evidence and require separate protection/deletion.
5. Full destructive restoration of live user data was not performed. The database was restored in isolation; Storage archives were integrity-checked. Follow the runbook and verify sign-in, historical findings/verification, signed image download, and new queue work after an actual recovery.
6. Deployment remains optional. Hosted isolation, network policy, provider selection, costs, and production operational validation remain open if deployment is requested.

Phases 3–5 are deferred. The original specification remains unchanged. No journey replay, cloud customer-session handling, AI, source attribution, team collaboration, CI/release gate, billing, or certification is claimed.

## Review artifacts

- `playwright-report/index.html`: complete 16-test end-to-end report.
- `artifacts/mvp-authenticated-verification.png`: actual authenticated fixture finding/verification workspace.
- `artifacts/mvp-finding-mobile.png` and `artifacts/mvp-verification-mobile.png`: mobile viewport checks.
- `artifacts/mvp-finding.png`: public-worker remedy/verification workspace.
- `artifacts/accessly-extension-0.2.0.zip`: local extension distribution.

These artifacts and traces are ignored by source control. Reports, traces, screenshots, and backup archives can contain test-session or private information; retain only what is needed and remove obsolete copies separately.
