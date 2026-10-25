# Accessly Implementation Plan

**Version:** 1.4  
**Date:** October 25, 2026  
**Status:** Phases 1–3 are implemented locally. Phase 3 adds versioned journeys, explicit recording, bounded public/authenticated replay, checkpoint findings, focus/keyboard observations, safe action boundaries and original-context retests. Full verification results and limitations are recorded in Section 8 and [Phase 3 verification](./docs/PHASE_3_VERIFICATION.md). Human assistive-technology/real Chrome acceptance and external customer validation remain pending. Phases 4–5 have not started.  
**Product context:** [Accessly Product Idea Specification](./Accessly_Product_Idea_Specification.md)

## 1. Delivery goal and agreed direction

Build Accessly incrementally, with a usable MVP at the end of Phase 2. Validate that experience with real users before expanding into journey automation, intelligent remediation, and team workflows.

The product has two user-facing parts:

- **Web app:** Application setup, run results, findings, evidence, remediation tracking, comparisons, and verification history.
- **Browser extension:** User-initiated scans of the page currently open in the user's browser, including authenticated pages and manually reached interactive states.

A separate browser worker supports public-page scans requested from the web app. Later, it also supports configured authenticated journeys and scheduled assessments.

**Authenticated-page testing is part of the MVP.** Users sign into their own applications normally and scan the signed-in tab through the extension. Uploading customer cookies, passwords, or browser profiles is not required for this MVP workflow.

The phase structure follows our discussion:

| Phase | Outcome | Release boundary | Current status |
| --- | --- | --- | --- |
| 1 | Assess public and authenticated pages and understand findings | First usable assessment experience | **Done: local implementation and automated verification. Manual acceptance pending.** |
| 2 | Track remedies, retest, and preserve trustworthy verification | MVP complete | **Done: local MVP implementation. Human acceptance/customer validation pending.** |
| 3 | Define and replay interactive journeys | Repeatable interaction and authenticated automation | **Implemented locally; automated verification recorded in Section 8. Human/browser acceptance pending.** |
| 4 | Identify likely causes and assist remediation | Evidence-based intelligence | Not started |
| 5 | Coordinate teams and prevent recurrence | Collaboration, integrations, and release protection | Not started |

### Latest Phase 3 checkpoint — October 25, 2026

- [x] Implemented named immutable journey versions and ordered steps, preconditions, goal/outcomes, role/environment, stable locators, readiness assertions, checkpoints, explicit grants and separately assessed variations.
- [x] Added explicit extension recording and reviewable/importable drafts; trusted supported tab events omit all typed values, passwords, page text and sessions. Drafts survive popup closure, follow same-origin navigation, and expire/discard safely.
- [x] Implemented isolated public and protected Chromium replay, dedicated login recipes/explicit host-scoped session provisioning, exact role assertions, encrypted identity inputs, expiry/revocation, and environment/account serialization.
- [x] Preserved checkpoint findings, provenance, triggering actions, keyboard/focus observations, blocked step/recovery, and unassessed scope through incomplete runs, cancellation and worker/queue recovery. Journey side effects are never automatically retried.
- [x] Integrated finding-specific retests with the original saved journey and targeted checkpoint. A clean checkpoint cannot resolve a finding when its required journey/adjacent review is incomplete.
- [x] Implemented bounded passive branch suggestions with reviewable, unassessed variations. No autonomous scope expansion, Phase 4 intelligence or Phase 5 workflows were added.
- [x] Updated local setup, migrations, private key controls, recovery behavior and the [journey guide](./docs/PHASE_3_GUIDE.md). Local credentials are generated; no external account or deployment is required.
- [ ] Human assistive-technology, real Chrome toolbar/lifecycle acceptance and genuine customer evaluation remain pending. Optional hosted runtime/KMS and raw trace redaction support remain explicit open decisions.

### Completed MVP checkpoint — October 25, 2026 (historical Phases 1–2)

- [x] Completed Phase 1 assessment and Phase 2 remediation/verification implementation, including authenticated current-tab scans and the full signed-in scan → remedy → targeted retest → verification → recurrence workflow.
- [x] Passed **46 tests across five scanner/domain/network/contract/evidence test files** and **16 end-to-end tests** against real local services and the production web build. The Phase 1 counts below are the historical checkpoint, not the current suite totals.
- [x] Passed TypeScript, ESLint, Prettier, migrations, web/extension production builds, and extension packaging. Additional focused authenticated UI and tenant checks passed after the complete suite.
- [x] Packaged `artifacts/accessly-extension-0.2.0.zip`; consecutive packages were byte-identical. The current scanner version is `0.2.0`, with profile `wcag22aa-automated-v1` and engine versions recorded per run.
- [x] Checked browser bundles for configured server-credential leakage, verified loopback service bindings, and exercised an offline backup with isolated PostgreSQL restoration and Storage archive integrity checks. Live user data was not destructively restored.
- [x] Updated the [MVP guide](./docs/MVP_GUIDE.md), [verification record](./docs/MVP_VERIFICATION.md), [architecture](./docs/ARCHITECTURE.md), and [operating/recovery instructions](./docs/OPERATIONS.md).
- [ ] Complete the outstanding human/browser and external-pilot acceptance described in Section 7. Automated fixture results do not establish full accessibility, customer efficacy, or production readiness.

**Local development is the supported completion path. Deployment is optional.** The MVP runs with local Supabase PostgreSQL/Auth/Storage, Redis, web app, browser worker, fixtures, and a packaged extension. No hosted database connection or API key is required. Local automated acceptance does not substitute for outstanding human review or establish production readiness.

The product specification remains the source for product intent and trust requirements. This plan introduces recommended implementation choices; hosting vendors, quantitative targets, AI providers, and other explicitly open decisions remain proposals until selected. A phased plan does not imply that deferred product capabilities already exist.

## 2. MVP scope

### Included by the end of Phase 2

- Accessly account creation, sign-in, and sign-out.
- A simple application workspace, initially with one owner; tenant isolation exists from the beginning.
- Application and environment setup, with permitted origins and saved page URLs.
- A desktop Chrome extension connected to the user's Accessly account.
- Current-page scans of public and authenticated pages through the extension.
- Public-page background scans through the web app.
- Findings with rule information, affected elements, user-impact explanations, and reviewed rule-based remedy guidance.
- Optional screenshot evidence with element highlighting and a text alternative.
- Reproduction context, including user-entered preconditions, role, state, and steps.
- Finding filters, work states, run history, comparisons, and appropriate verification.
- Clear results for incomplete scans, inaccessible pages, unknown context, and manual-review needs.
- Basic private evidence access, evidence exclusion/deletion, and operational diagnostics.

### Original MVP deferrals and their current phase

- Recording and replaying multistep journeys — implemented locally in Phase 3.
- Worker authentication setup and repeatable authenticated journeys — implemented locally in Phase 3 with supported recipes/session provisioning; hosted deployment remains optional.
- State discovery — Phase 3 implements bounded passive branch suggestions; unconstrained autonomous exploration is not authorized or claimed.
- Keyboard/focus behavior — Phase 3 implements selected explicit key sequences and structural observations; actual assistive-technology assessment remains a human method.
- Source-file attribution and cross-page shared-cause grouping.
- AI-generated recommendations and proposed source changes.
- Team invitations, full reviewer roles, issue-tracker synchronization, and release gates.
- Scheduled monitoring, customer CI integrations, billing, and enterprise governance.
- Native mobile apps, document accessibility, and legal certification.

### Initial support boundary

Start with desktop Chrome for the extension and Chromium for cloud workers. Support ordinary HTTP/HTTPS pages where injection and assessment succeed. Begin with the top-level document; inaccessible frames, closed shadow roots, browser-internal pages, and other unsupported content must be disclosed rather than counted as assessed.

A user may manually open a dialog or reveal a form error and scan that state in the MVP. This evaluates the reached state; it does not establish that keyboard entry, exit, or the full journey was evaluated.

Treat local or private-network applications as extension-only in the MVP. Public workers must not access private networks or internal infrastructure. The local test setup permits only the exact configured controlled fixture origin (`WORKER_FIXTURE_ORIGIN`, default `http://127.0.0.1:4174`) so the public-worker pipeline can be tested locally. This is not a general private-network bypass and must be removed outside controlled local testing. Support for additional browsers, frames, and application environments expands only after validation.

## 3. Technology stack

### Core stack

| Layer | Choice | Use | First introduced |
| --- | --- | --- | --- |
| Language | TypeScript | Shared types and implementation across web, extension, and worker | Phase 1 |
| Runtime and repository | Node.js 24 LTS, pnpm 11.25.0 workspaces | One repository with separately buildable applications and shared packages | Phase 1 |
| Web application | Next.js App Router + React | Dashboard, setup, findings, evidence, and account flows | Phase 1 |
| Styling and components | Tailwind CSS + Radix/shadcn-style primitives | Reusable UI, with keyboard and assistive-technology verification of final compositions | Phase 1 |
| HTTP API | Next.js Route Handlers | Versioned endpoints for project setup, scans, findings, and evidence | Phase 1 |
| Validation | Zod | Validate API requests, extension messages, and shared result contracts | Phase 1 |
| Browser extension | Chrome Manifest V3 + TypeScript + Vite; React for extension UI | Popup, sign-in, current-tab scanning, highlighting, and evidence controls | Phase 1 |
| Automated checks | Bundled axe-core in extension and worker; `@axe-core/playwright` for Accessly accessibility tests | Shared profile and normalization across execution modes | Phase 1 |
| Browser automation | Playwright + Chromium | Public-page scans and screenshots; later authenticated journey replay | Phase 1, expanded in Phase 3 |
| Background work | Separate Node.js worker + BullMQ + Redis | Scan scheduling, bounded concurrency, retries, and later monitoring | Phase 1 |
| Database | Supabase PostgreSQL | Applications, contexts, runs, findings, evidence metadata, and decisions | Phase 1 |
| Database access | Drizzle ORM + Drizzle Kit | Typed server-side queries and version-controlled migrations | Phase 1 |
| Accessly authentication | Supabase Auth | Accessly user identities and sessions | Phase 1 |
| File storage | Supabase private Storage buckets | Optional screenshots and later trace artifacts, with bounded access | Phase 1 |
| Testing | Vitest and Playwright; React Testing Library available | Scanner/contracts/network tests, UI accessibility and keyboard checks, extension integration, and end-to-end tests | Phase 1 |
| Packaging and deployment | Docker; Docker Compose for local dependencies | Separate web and browser-worker deployments; reproducible development | Phase 1 |
| Internal CI | GitHub Actions, if hosted on GitHub | Type checks, tests, builds, extension packaging, and migration validation | Phase 1 |
| AI assistance | Server-side provider adapter; provider/model chosen in Phase 4 | Structured recommendations grounded in permitted evidence | Phase 4 |

Phase 1 dependencies are pinned in `package.json` and `pnpm-lock.yaml`. TypeScript 6 is used for compatibility with the installed ESLint tooling; Next.js development and production builds use webpack after cold-start tests exposed repeated Turbopack restarts in this environment. Continue to select compatible stable releases and retain the lockfile. Pin the Playwright package and browser image together. Record the axe version, rule profile, and scanner version on every run. Package executable extension code, including axe-core, with the extension.

Official implementation references: [Next.js App Router](https://nextjs.org/docs/app), [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), [Drizzle with Supabase](https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase), and [BullMQ](https://docs.bullmq.io/).

### Local operation and optional deployment

- **Implemented locally:** `pnpm local:setup` configures local Supabase, private evidence storage, migrations, and Redis; `pnpm dev` starts the web app, worker, and controlled fixtures. See [setup instructions](./README.md).
- **Optional deployment:** run the web app and worker as separate services on a container-capable host. Provider selection, browser sandbox support, infrastructure network controls, cost, and deployment limits remain open until deployment is requested. Docker targets are authored but are not evidence of a deployed or validated hosting environment.
- Local Supabase provides PostgreSQL, Accessly Auth, and private object storage. Managed Supabase remains an optional hosting recommendation.
- Run Redis as a private service reachable by the API and worker.
- Keep development, staging, and production data and credentials separate.
- Use a worker runtime that supports isolated browser processes. Browser execution must not share the web server's privileges or expose database and storage credentials to page code.
- Start with bounded concurrency and poll the API for run progress. Add streaming updates only if needed.
- Maintain structured logs with run IDs, queue failures, timings, and error codes. Keep secrets and sensitive page content out of logs.

This uses one codebase and a small number of deployable services. A separate general-purpose API framework, Kubernetes, vector database, and dedicated search engine are unnecessary for the MVP.

## 4. How the system works

### A. Extension scan, including authenticated pages

1. The user signs into Accessly and connects the extension through an interactive authentication flow.
2. The user chooses an Accessly application and environment, then opens a permitted page in their own browser.
3. The user signs into the target application if necessary and reaches the desired state.
4. The extension asks for a state label and optional role/preconditions. Unknown details remain explicitly unknown.
5. On a scan action, the extension injects its packaged scanner into the permitted document and runs axe-core.
6. It captures the scan configuration, page/state context, affected-element information, and optional evidence.
7. The extension displays an upload preview. Screenshots can be omitted or locally masked; unnecessary page text and sensitive attributes are excluded before upload.
8. The authenticated Accessly API validates the result, checks application access and scope, and saves it in the common run/finding format.
9. The user opens the result in the web app and begins remediation.

The target application's session stays in the user's browser. Accessly's own account session is a separate identity. A scan of the current tab does not establish who the user is in the target app unless that context is supplied or validated.

**Implemented authentication choice:** Chrome's interactive identity window uses an Accessly authorization broker over the Supabase-authenticated web session. A single-use, 60-second code is bound to the extension's SHA-256 PKCE challenge; callback origin, configured extension ID, and state are validated. Exchange issues an opaque eight-hour connection token whose hash is stored server-side. This is not Supabase's native OAuth PKCE grant and does not transfer the web app's refresh token. The complete connection flow is covered by local end-to-end tests. Tokens stay in extension-owned contexts, are not exposed to content scripts, and are cleared on disconnect. Restrict extension storage access accordingly. The page itself is untrusted and cannot authorize API actions. See [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), and [Supabase PKCE guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

### B. Public-page scan from the web app

1. The user selects a saved public URL and scan profile.
2. The API validates authorization and scope, creates a durable run record, and dispatches a job.
3. The worker starts an isolated browser context, visits the URL, checks readiness, runs axe-core, and captures permitted evidence.
4. Results use the same normalized contract as extension scans.
5. The API serves status and results to the dashboard.

Apply network restrictions to navigation, redirects, DNS resolution, and subresource traffic; URL validation alone is insufficient. Enforce limits for time, pages, memory, and evidence size. Cloud workers do not crawl an entire site or submit business forms in the MVP.

### C. Retest after a remedy — implemented in Phase 2

1. A finding is marked ready for verification with the intended changed environment/version.
2. The user reaches the same state in the extension or requests a supported public-page retest.
3. Accessly records a new run and evaluates whether the original context was actually assessed.
4. Comparable evidence can show that the failure persists or that the relevant check passed. Incomplete context produces an inconclusive result.
5. Only appropriate completed verification supports a scoped resolution. Historical evidence is retained.

### Extension execution constraints

Use `activeTab`, `scripting`, `storage`, and `identity` as needed, plus access to Accessly's API origin. Avoid blanket persistent access to all customer sites for manual scans. Chrome grants temporary current-tab access after a user invocation. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)

Do not put scan durability in popup memory or rely on a permanently running extension service worker. Persist minimal job state, use idempotent uploads, and recover from popup closure, navigation, service-worker suspension, and connectivity loss. Sensitive pending evidence needs a bounded lifetime and a discard control. [Extension service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

## 5. Repository and shared foundations

Implemented repository layout (including Phase 2 lifecycle, comparisons, and verification):

```text
apps/
  web/                  Next.js application and API
  extension/            Chrome extension UI, scanner, and service worker
  worker/               Queue consumer and Playwright browser runner
packages/
  contracts/            Versioned request/result schemas and shared types
  scanner/              Rule profiles and axe result normalization
  domain/               Finding lifecycle, comparison, and verification rules
  database/             Drizzle schema, queries, and migrations
  ui/                   Shared accessible components where reuse is useful
tests/
  fixtures/             Controlled public, authenticated, correct, and broken pages
  integration/          API, storage, queue, and extension integration tests
  e2e/                  Complete user workflows
infra/                  Docker, local services, and deployment configuration
```

Keep browser-safe packages separate from server-only dependencies. Sharing scan contracts must not bundle database clients or service secrets into the extension. Begin with a single versioned API, such as `/api/v1`, rather than separate implementations for each client.

### Planned records and current delivery

| Record | Minimum responsibility |
| --- | --- |
| Workspace ownership | Implemented in Phase 1; tenant ownership and authorization with one owner. Expanded membership arrives in Phase 5 |
| Application and environment | Permitted origins, saved pages, and environment/version labels |
| Assessment context | Page, state label, user-declared role, viewport, execution mode, and known preconditions |
| Run and check result | Requested/reached scope, engine/configuration versions, completion, failures, and review needs |
| Finding | Tracked concern, immutable original observation/context, impact explanation, separate evidence assessment and remediation work state |
| Occurrence | Specific observed element and context, linked to the run and finding |
| Evidence | Private object reference, text description, capture time, omissions, and upload state |
| Verification | Implemented in Phase 2: original concern, remedy context, methods, outcomes, actor, outstanding review, and linked recurrence |
| Activity | Meaningful lifecycle, scope, and review changes without rewriting history |

Phase 3 adds journey definitions, versioned steps, test identities, and permitted action boundaries. Phase 4 adds source context, reviewed groups, and recommendation versions. Phase 5 adds expanded memberships, manual findings, baselines, exceptions, policies, connections, monitors, and notification preferences.

Keep origin, evidence confidence, work state, verification outcome, and exception status separate. Preserve axe's rule impact and explain any Accessly task-severity assessment independently. An engine rating alone must not imply that a task blocker was observed.

Start with conservative finding matching within an application, environment, page/state, role, rule, and element context. Store matching reasons and uncertainty. Do not assume that similar selectors establish a shared cause or that all occurrences of a rule are one finding.

### API and access responsibilities

- Validate every request and extension message. Treat submitted page content as untrusted text, including when rendered in the dashboard.
- Recheck workspace/application access for each read, write, run, and evidence operation. Client-supplied workspace IDs are not authorization.
- Use server-side Drizzle queries through a restricted database role and explicit tenant-scoped access. Do not assume Supabase RLS automatically scopes a privileged direct connection.
- Configure RLS and grants for any tables exposed through Supabase APIs, and private storage policies for evidence. Keep service credentials server-side.
- Authorize short-lived evidence upload/download links against the exact run, object, and workspace. Validate file type, size, ownership, and completion before attaching evidence.
- Use stable client scan IDs and idempotency keys so retries cannot create duplicate runs or findings.
- Keep Postgres as the durable source of run status. Recover jobs that fail between database creation and queue dispatch through a retryable outbox or reconciliation process.

Supabase private buckets require authorized access; temporary signed links must be treated as access-bearing links until expiration. [Storage access controls](https://supabase.com/docs/guides/storage/security/access-control)

## 6. Phase 1 — Public and authenticated page assessment — implemented

**Status:** Local implementation complete; automated verification passed. Manual acceptance and optional deployment are tracked separately below.  
**Status updated:** October 25, 2026.  
**Goal achieved locally:** A user can scan a public or signed-in page, inspect a concrete barrier, and understand what was assessed.

### Completed implementation

**1. Application foundation**

- [x] Created the TypeScript/pnpm monorepo, shared packages, validation contracts, linting, type checking, formatting, migrations, environment configuration, and production builds.
- [x] Added Supabase account creation, sign-in, sign-out, recovery requests, and real recovery-link password changes.
- [x] Implemented one-owner workspaces, restricted server database access, tenant-scoped API authorization, and denial of direct browser-role access to application tables.
- [x] Built the dashboard, application setup, recent assessments, result views, and loading, empty, permission-denied, unavailable, and recoverable error states.
- [x] Added applications/environments, permitted origins, saved page URLs, and the initial automated scan profile.
- [x] Added reproducible local Supabase/Auth/Storage and Redis setup; core operation needs no hosted credentials or deployment.

**2. Authenticated scanning through the extension**

- [x] Built and packaged the Manifest V3/React/Vite extension with a stable ID and interactive, PKCE-bound account connection; tokens stay in trusted extension storage and can be revoked on disconnect.
- [x] Added application/environment selection and user-initiated scans of the permitted current tab, including signed-in and manually reached dialog states.
- [x] Packaged axe-core with the extension without extracting target cookies, passwords, or browser profiles.
- [x] Captured declared role, state, preconditions, sanitized URL, viewport, application version, timing, scanner/engine metadata, and support limitations.
- [x] Added protected-page confirmation and recognizable login-page guards; identity and authentication remain explicitly user-declared or unknown.
- [x] Added failures for unsupported pages, disconnected accounts, injection/assessment interruptions, and changed page or evidence context.
- [x] Persisted bounded scan previews and approved uploads with stable IDs, retry/discard controls, popup recovery, and offline upload recovery.

**3. Common scanner pipeline**

- [x] Implemented shared profile `wcag22aa-automated-v1`, initially with scanner version `0.1.0`; Phase 2 advances the scanner to `0.2.0`. Scanner and axe-core versions are recorded on each run. Selected automated WCAG-related checks do not establish full conformance.
- [x] Kept violations, incomplete review candidates, passed checks, and inapplicable checks distinct; unsupported areas are disclosed as limitations.
- [x] Added structural element locators, safe geometry, rule/check identifiers, reviewed user-impact explanations, and rule-based remedy guidance without inventing business intent or source locations.
- [x] Used the same bundled scanner and normalization in both extension and Playwright worker; execution mode and historical context remain available.
- [x] Omitted HTML, page text, input values, URL queries, and fragments from default uploaded observations. User-entered context and URL paths still require review for sensitivity.
- [x] Disclosed top-level scope, excluded frames/open shadow roots, unknowable closed-root coverage, readiness limits, and current-state versus transition/journey boundaries.

**4. Public-page background scans**

- [x] Implemented the separate Playwright/Chromium worker, BullMQ/Redis queue, bounded concurrency/readiness/timeouts/retries, cancellation, and resource cleanup.
- [x] Added durable PostgreSQL runs and outbox reconciliation for interrupted dispatch and missing Redis jobs.
- [x] Enforced public-address checks for navigation, redirects, DNS resolution, and subresources, including a proxy that connects to validated IPs. The exact local fixture exception is described in Section 2.
- [x] Created isolated browser contexts without customer sessions; browser child environments exclude service credentials. State-changing HTTP methods, WebSockets, service workers, and downloads are restricted.
- [x] Preserved accepted and partial results; blocked content and failed readiness remain visible instead of becoming passes.
- [x] Authored optional web and worker Docker targets. Hosted image/runtime validation and deployment remain open, not completed release evidence.

**5. Evidence and result views**

- [x] Added finding outcome filters, expandable finding details, rule references, reproduction context, original run observations, scope, timestamps, and engine/profile metadata.
- [x] Added removable on-page highlighting and structural/text alternatives; result inspection remains usable without screenshots.
- [x] Added optional visible-viewport screenshots, capture dimensions, element coordinates, offscreen disclosure, and guards against changed document/state/viewport evidence.
- [x] Added extension upload preview, pointer rectangle masking, full-image masking for keyboard users, image omission, nonvisual descriptions, and explicit upload approval.
- [x] Disabled extension screenshot capture when scan exclusions are configured, explaining that scanner exclusions alone cannot guarantee visual redaction. Worker screenshot capture is explicitly selected before the run and masks exclusions in server memory; it does not provide a local pre-upload preview.
- [x] Added private PNG storage, validated size/dimensions/content hashes, idempotent registration, 60-second signed access links, pending/ready/failed/deleted evidence states, and deletion that retains finding history.
- [x] Bounded pending scans/approved upload data to 30 minutes and unapproved session screenshots to 10 minutes. At the Phase 1 checkpoint, accepted evidence used manual deletion. Phase 2 adds opt-in expiry and offline backup tooling; external-pilot guarantees remain open.

### Local verification completed — historical Phase 1 checkpoint

The complete current MVP suite has 46 tests and 16 end-to-end tests; see the latest checkpoint above and Section 7.

- [x] **27 scanner, contract, network-boundary, and image-masking tests passed.**
- [x] **9 end-to-end tests passed** against actual local Auth, PostgreSQL, Storage, Redis, web app, worker, fixtures, and packaged extension.
- [x] Verified public barriers, a correct fixture, signed-in dialog assessment, declared role separation, signed-out/login boundaries, and omission of target secrets from scan payloads.
- [x] Verified tenant denial, private evidence access/deletion, stable scan-ID retries, popup reopening, offline approved-upload recovery, lost queue dispatch recovery, cancellation, and blocked private subresources.
- [x] Verified real account signup/sign-in/sign-out, recovery-link password replacement, and rejection of the previous password.
- [x] Ran selected automated accessibility checks on essential web and extension views, plus keyboard skip-link/navigation and responsive reflow tests.
- [x] Passed TypeScript, ESLint, formatting, web production compilation, extension production build, and extension ZIP packaging. Checked client bundles for configured server-secret leakage.

See the [Phase 1 verification record](./docs/PHASE_1_VERIFICATION.md) for evidence and test limitations, [architecture](./docs/ARCHITECTURE.md) for implementation decisions, and [operations](./docs/OPERATIONS.md) for local configuration.

### Remaining acceptance and operational items

- [ ] Check the unmodified packaged extension in supported desktop Chrome through real toolbar invocation, temporary `activeTab` permission, capture/permission denial, service-worker suspension, and extension update behavior. Automated tests use a temporary copy with permission for only the controlled fixture origin; this does not establish every real Chrome lifecycle condition.
- [ ] Complete human screen-reader/assistive-technology review of essential web and extension flows, including focus, status updates, error recovery, and nonvisual evidence access. Automated checks do not substitute for this review.
- [ ] Complete human checks of zoom/reflow, motion preferences, and focus visibility/order in actual use; automated keyboard/reflow coverage is already present.
- [x] Phase 2 resolves local publication: setup explicitly binds project-specific Supabase ports to `127.0.0.1`, preserves gateway certificates/configuration, checks health, and waits for Auth reconnection. Actual published addresses were verified; global Docker settings are unchanged.
- [ ] Before external onboarding, choose pilot distribution and commercial retention/deletion/backup/support commitments. Local ZIP distribution, opt-in screenshot expiry, offline backups, isolated database recovery checks, usage limits, and an operator runbook are implemented; they do not select customer-facing guarantees. Hosted isolation is relevant only if deployment is chosen.
- [ ] **Optional:** select and validate a deployment host, build/run the container targets in that environment, and repeat relevant operational checks. Deployment is not a local Phase 1 or MVP prerequisite.

### Completion criteria and release interpretation

- [x] Public and protected fixtures can be scanned after ordinary target sign-in, and signed-out protected contexts cannot silently become successful protected-page results.
- [x] Results identify application/environment, page/state, execution mode, actual scope, and important limitations.
- [x] Known failures are reported, correct fixtures avoid invented violations, and text evidence remains useful without images.
- [x] Workspace boundaries protect evidence, while popup/upload/queue recovery preserves accepted results without duplicate scans.
- [x] A local stack and installable extension package support the Phase 1 workflow without deployment.
- [ ] Human/browser acceptance above remains required before claiming it has passed. Local implementation completion does not establish full accessibility, broad browser support, or production readiness.

**Deliverable completed locally:** First usable public and authenticated current-page assessment implementation. This was the Phase 1 checkpoint; the remediation tracking, comparisons, appropriate verification, and comparable reopening needed for the MVP are now implemented in Phase 2 below.

## 7. Phase 2 — Remediation tracking and verification

**Status:** Local implementation and automated verification complete; human/browser acceptance and customer pilot validation remain pending.
**Status updated:** October 25, 2026. See [MVP guide](./docs/MVP_GUIDE.md), [verification](./docs/MVP_VERIFICATION.md), and [operations](./docs/OPERATIONS.md). Outstanding human/browser acceptance and customer pilot evidence are retained below.

**Goal:** The same user can move from an observed barrier to an appropriately verified resolution, with the original evidence and comparison limits preserved.

### Features and implementation work

**1. Finding lifecycle**

- [x] Add new, under review, open, in progress, ready for verification, verification in progress, resolved, reopened, and closed-after-review states.
- [x] Keep evidence assessment separate from work progress; an uncertain concern can remain under review without being called a confirmed failure.
- [x] Record status changes, review reasons, remedy notes, environment/version, and the actor/date.
- [x] Distinguish a reviewed false positive or retired feature from a verified repair.

**2. Reproduction details**

- [x] Show the captured URL/state, role, preconditions, actual observation, and expected outcome.
- [x] Let the user add or correct manual reproduction steps and safe input descriptions.
- [x] Mark steps as user-provided; do not imply that a multistep sequence was recorded or replayed before Phase 3.
- [x] Record reproduction attempts as reproduced, not reproduced, blocked, or inconclusive without overwriting the original observation.

**3. Retesting and comparisons**

- [x] Offer a finding-specific retest action in the web app and extension.
- [x] For extension findings, guide the user to reopen the correct application, environment, role, and state before rescanning.
- [x] Compare the latest run with a selected prior run; show persistent findings, newly observed findings, relevant passed checks, and items not assessed.
- [x] Record scope, rule/configuration changes, viewport, application version, and execution-mode differences.
- [x] Prefer conservative matching; uncertain continuity requires review rather than automatic merging or closure.
- [x] Treat an element that disappeared, a login redirect, or a state that was never reached as insufficient proof of a fix.

**4. Verification decisions**

- [x] Define method requirements by finding type. A deterministic rule failure may be resolved through a comparable targeted reassessment when the original context and required behavior are confirmed.
- [x] Route ambiguous outcomes, replaced elements, or concerns requiring judgment into manual review.
- [x] Allow a recorded manual verification decision with method, conditions, actor, outcome, and limitations. Full manual-finding authoring and specialist queues arrive in Phase 5.
- [x] Keep incomplete checks and outstanding required review visible; marking a remedy ready does not resolve it.
- [x] Retest materially adjacent behavior when needed; preserve a follow-up review task if the MVP cannot automate it.
- [x] Reopen a resolved finding only when comparable evidence supports recurrence, linking the new failure to its previous verification.

**5. MVP usability and release readiness**

- [x] Add saved filters for open work and awaiting-verification findings, application run history, and clear next actions.
- [x] Automated keyboard submission, labels/statuses, contrast rules, responsive navigation, and nonvisual evidence access are covered locally.
- [ ] Human screen-reader, focus/order, zoom/reflow, motion-preference, and unmodified real Chrome acceptance still require a human evaluator.
- [x] Configure opt-in screenshot expiry, serialized deletion/upload/expiry, limits, private offline backups, an isolated PostgreSQL restoration check, and an operator recovery/support runbook. Manual deletion remains the default; no managed guarantee is invented.
- [x] Produce the pinned 0.2.0 extension build/ZIP and local installation/update instructions with a stable extension ID.
- [ ] Choose controlled external pilot distribution or complete store submission before external onboarding.
- [x] Exercise the complete workflow through real local services and an authorized controlled application, including signed-in extension retests, an applied remedy, keyboard functionality, recorded verification, and recurrence. Feedback/optional active-effort records are available.
- [ ] Gather actual customer pilot feedback and measured time to verified resolution. Controlled fixture tests do not establish customer efficacy or human acceptance.

### Completion criteria — MVP release gate

- [x] A user can add an application, connect the extension, scan a signed-in page, understand a finding, apply a remedy in the authorized controlled application, and retest the same state.
- [x] Appropriate verification can resolve the scoped finding, with method, conditions, date, actor/process, and limitations retained. Automated checks cover recorded human-review requirements; an actual human acceptance evaluation remains separate.
- [x] A missing state, inaccessible page, changed role, or incomplete scan cannot silently close previous findings.
- [x] A reviewed rejection or retired feature is counted separately from verified resolution.
- [x] A comparable failure after resolution can reopen the finding with linked history.
- [x] Work remains usable without AI, screenshots, or team collaboration.
- [x] Tenant isolation, evidence access, upload recovery, worker recovery, and essential automated accessibility/keyboard checks passed in the reproducible local environment. Human assistive-technology acceptance remains pending; staging checks apply only if deployment is chosen.
- [ ] An actual customer pilot completes the scan-to-verification loop and provides actionable feedback. Controlled fixture exercises and the implemented feedback form do not satisfy customer validation or establish efficacy/purchasing claims.

**Deliverable:** MVP: public and authenticated current-page testing, actionable findings, remediation tracking, and trustworthy retesting.

**Local completion evidence:** versioned schema/migrations and tenant-scoped endpoints; lifecycle/reproduction UI; saved work views; public and extension finding-specific retests; explicit per-target check observations; conservative run comparison; attributed automated/human verification; persistent adjacent-review requirements; separate reviewed closures; linked recurrence; retention/backup/recovery tooling. No AI, screenshots, deployment, or team membership is needed to complete the core loop.

**Release interpretation:** implementation of the MVP is complete locally. Human assistive-technology/real Chrome review, external pilot distribution, and genuine customer validation are not claimed complete. Whole-stack destructive restoration of live user data was not performed; PostgreSQL recovery was verified in isolation and storage archives were integrity-checked. These limits remain visible rather than being marked passed.

## 8. Phase 3 — Interactive journeys and repeatable authenticated automation

**Status:** Local implementation complete; automated verification recorded below. Human assistive-technology/real Chrome acceptance and external customer validation remain pending. Deployment is optional.

**Goal:** Assess important tasks repeatedly, including intermediate states and selected keyboard behavior, without weakening the completed MVP's evidence, verification, privacy or tenant boundaries.

### Completed implementation

- [x] Named journey definitions with goal, preconditions, expected task outcome, role, application/environment/version, ordered steps, checkpoints and authorized action boundaries. Versions and run snapshots retain original scope; stale-version mutations/replays fail rather than silently using different boundaries. Worker scope checks also stop queued/running snapshots and historical targeted replays if the saved version changes, preventing reuse of stale grants.
- [x] Explicit authoring and limited extension recording of navigation, activation, input references, selections and supported keys. Recording requires an explicit start; input/password values, page text, cookies and profiles are omitted. Unsupported controls remain explicit, document/SPA navigation reattaches within the origin, query/fragment routes become explicit unsupported gaps with values omitted, popup closure retains the draft, and expiry/discard/disconnect deletes it. Import requires review; it does not authorize consequential actions.
- [x] Version-1 declarative Playwright replay with stable ID/test-ID/role-name/label locators, uniqueness checks, readiness assertions, DOM stability, bounded step/run deadlines, exact blocked-step diagnostics and recovery actions. No arbitrary scripts are accepted.
- [x] Checkpoints assess menus, expanded sections, selected tabs, dialogs, invalid input/error states and recovery. Each uses the common scanner/finding pipeline with immutable parent/version/step provenance. Checkpoint acceptance and its parent evidence reference commit together.
- [x] Explicit key sequences and focus entry, movement, exit and restoration observations. Pointer runs say keyboard operation was unassessed. Programmatic fill/select is disclosed separately. Structural focus observations and pattern guidance remain separate from established standards failures, visual focus judgment and real screen-reader evaluation.
- [x] Partial runs preserve valid findings and reached scope. Missing/ambiguous locators, unstable readiness, blocked business actions/network content, unsupported checks, wrong access/role, cancellation and crashes leave visible incomplete outcomes. Jobs have one attempt and never automatically repeat possible side effects. Restored journey work also requires a new reviewed run.
- [x] Dedicated authorized test identities support explicit username/password POST recipes or explicit exact-host cookies/exact-origin local storage provisioning. The extension session is never automatically transferred. Reaching the configured exact signed-in role marker is required before protected assessments and after actions.
- [x] AES-256-GCM encrypted identity material and runtime inputs use a versioned server key ring and an authenticated workspace/application/environment/role/identity binding. Metadata-only listings, immediate expiry checks, periodic ciphertext expiry, live revocation/deletion and audit records are implemented. Local setup generates/preserves owner-only key configuration. Hosted managed KMS/provider controls remain an optional-deployment decision, not a claimed hosted capability.
- [x] Environment and identity serialization prevents concurrent journey interference within configured scope. State-changing actions require isolated disposable test data/accounts, a reviewed exact-step effect grant and exact request boundaries. Unapproved submissions, purchases, messages, deletions, settings and account operations stop before replay exceeds the boundary. Rendered-control checks and network enforcement supplement declarations; arbitrary application side effects still require authorized disposable data.
- [x] Minimized action histories and focus evidence are retained. Optional raw Playwright traces/screenshots are disabled because the current exclusion model cannot guarantee redaction of DOM, credentials and network payloads. This explicit evidence limit preserves privacy instead of implying exclusions were honored.
- [x] Bounded passive discovery suggests invalid-input/recovery, cancellation and alternate widget branches at reached states. Suggestions remain unreviewed and never execute or imply exhaustive coverage. Named variations replay separately in their defined order and remain individually assessed, partially assessed or not assessed.
- [x] Finding details link triggering actions/focus evidence. Finding-specific retests replay the original saved journey, boundaries, role, identity and variation, apply the remedy version and target only the original checkpoint/element/rule. Unreached targets are inconclusive. Automated resolution requires a completed parent journey; focus differences and incomplete adjacent behavior require appropriate human review. Existing MVP verification/recurrence rules remain intact.
- [x] Tenant checks protect definitions, versions, run/checkpoint results, identities, replay, edit, revoke and evidence operations. Supabase browser roles have no direct grants to the new tables. Secret values do not appear in ordinary reports, queue payloads, definitions or logs.

### Verification results

- [x] **54 integration/domain/scanner/network/contract/evidence tests passed** across six files, including eight new browser-backed journey tests. The full suite also passed after the final reached-URL diagnostic and stale-authorization corrections.
- [x] **23 production end-to-end tests passed** in 3.7 minutes using real local services: seven new Phase 3 scenarios plus the existing sixteen MVP scenarios. The seven affected journey scenarios passed again after the final stale-authorization correction (1.8 minutes); the packaged recording scenario was also rerun after SPA/query-route privacy handling was refined.
- [x] TypeScript, ESLint, Prettier, migrations and web/extension production builds passed. `accessly-extension-0.3.0.zip` was packaged twice with identical SHA-256 hashes.
- [x] Checked 42 client build files for configured server/database credentials and encryption-key leakage; none was found. Local environment configuration retains permission 600.

See [Phase 3 verification](./docs/PHASE_3_VERIFICATION.md) for exact commands, scenarios, results and limits. The full local regression run includes the existing MVP workflows and the new journey scenarios against the production web build. Controlled fixtures cover known failures and correct experiences, public and protected roles, login recipes and explicit sessions, six state checkpoints, keyboard/focus phases, interrupted recovery, blocked actions, unsupported checks, tenant denial, secret omission, recording and web authoring.

### Completion criteria

- [x] A public and protected journey replay with their configured role, checkpoints and expected-state assertions.
- [x] Dialog and error-recovery failures retain triggering steps, original state findings and focus observations when later recovery stops.
- [x] Pointer completion never establishes a keyboard assessment; focus guidance never silently becomes an established standards failure.
- [x] Expired/invalid/revoked sessions, wrong roles, changed locators, blocked actions and unsupported checks remain visible incomplete outcomes, with useful earlier evidence retained.
- [x] Replay stays within authorized origin, network and exact action boundaries. It never automatically resumes consequential actions after interruption.
- [x] Relevant variations remain individually assessed or explicitly unassessed; suggestions do not establish exhaustive discovery.
- [x] The MVP's finding lifecycle, targeted evidence, independent verification, adjacent-review requirements, conservative comparison and recurrence remain operational.
- [ ] Complete human assistive-technology/focus-visibility/task-usability review and unmodified real Chrome activeTab/toolbar/lifecycle acceptance. Automated checks do not substitute for these.
- [ ] Validate real customer usefulness and operating measures on a chosen pilot application. Fixture success is not customer evidence.
- [ ] **Optional deployment only:** choose/validate managed key custody, browser sandbox/infrastructure network isolation, hosting costs and customer retention/residency commitments. Raw trace support requires enforceable private redaction/retention before it can be enabled.

**Deliverable:** Repeatable local public/authenticated journey testing, beyond the MVP's manual current-tab scans. No deployment or external credentials are required. Read [Phase 3 guide](./docs/PHASE_3_GUIDE.md) for support boundaries and recovery. Phases 4–5 remain unimplemented.

Implementation references checked during this work: [Playwright authentication](https://playwright.dev/docs/auth), [stable locators](https://playwright.dev/docs/locators), and [trace diagnostics](https://playwright.dev/docs/trace-viewer). Reusable session material is treated as a secret; raw trace availability does not establish safe redaction.

## 9. Phase 4 — Source insight and intelligent remediation

**Status:** Planned; not started.

**Goal:** Reduce investigation and remedy-selection effort while preserving evidence, uncertainty, and independent verification.

### Features and implementation work

**1. Likely source and component attribution**

- Add opt-in source context from a selected repository connection or authorized local tooling; choose the first supported integration during this phase.
- Investigate source maps, development metadata, component information, and usage context where available. Do not promise exact source files from production DOM alone.
- Show the evidence, candidate component/file, revision, confidence, and limitations behind an attribution.
- Keep findings fully usable when source context is unavailable.

**2. Reviewed grouping**

- Suggest duplicate occurrences and shared-cause groups with explicit reasons.
- Let users confirm, split, merge, and correct groups while preserving original contexts and history.
- Separate a component defect from misuse in a particular application context.
- Coordinate a shared remedy while tracking verification for each affected usage or explicitly described representative sample.

**3. AI-assisted recommendations**

- Select a provider/model using representative evaluations of correctness, latency, cost, and approved data handling. Keep the model behind a server-side adapter.
- Provide structured context from permitted findings, state/journey evidence, standards references, and opt-in source snippets.
- Return the intended accessible outcome, proposed remedy, assumptions, alternatives, effects on other usages, uncertainty, and verification requirements.
- Require missing product intent when necessary instead of inventing icon meanings, image descriptions, or business behavior.
- Treat assessed-page and repository content as untrusted evidence, not instructions to change scope or share data.
- Label AI output, let users reject/revise it, record recommendation versions and feedback, and keep AI optional.
- Present reviewable proposed source changes only where an authorized integration supports them. Check that the source revision is current and that the user understands affected contexts before applying changes through that integration.
- Retest with the relevant scanner and human methods after changes. A generated explanation or confidence score is not verification.

### Completion criteria

- A source suggestion can be inspected and corrected; unsupported precision is never fabricated.
- Similar-looking issues with different causes can remain separate.
- A shared fix does not automatically resolve unassessed occurrences.
- AI recommendations improve reviewed benchmark tasks without hiding necessary functionality or introducing meaningless accessibility attributes.
- Missing intent produces a useful question or bounded recommendation.
- Recommendations cannot close findings without the required independent evaluation, and disabling AI leaves core workflows usable.

**Deliverable:** Reviewed source insight, grouping, and contextual remediation assistance.

## 10. Phase 5 — Collaboration and regression prevention

**Status:** Planned; not started.

**Goal:** Make accessibility work accountable across a team and detect relevant failures before and after release.

Deliver this phase in three smaller increments rather than as one release.

### 5A. Team collaboration and human evaluation

- Add invitations, membership revocation, project access, and maintainer/contributor/reviewer/viewer roles.
- Add finding assignment, comments, review requests, ownership views, and responsibility reassignment.
- Add manual finding creation, guided checks, assistive-technology environment details, evidence, and appropriate verification requirements.
- Preserve human observations when automated checks pass; browser-tree inspection is not labeled as actual screen-reader testing.
- Add a human review queue and optional independent-review requirements for selected decisions.
- Provide tenant-scoped search and reuse of historical findings and decisions with their original context visible.

### 5B. Integrations, baselines, and release checks

- Select the first issue-tracker and code-review providers from actual pilot demand; avoid committing to every provider.
- Transfer impact, reproduction, evidence references, ownership, source confidence, and verification status through integrations. Show sync failures and stale data.
- Keep external task closure separate from Accessly verification.
- Add named comparison baselines; importing existing findings into a baseline does not resolve them.
- Add customer CI/PR execution against preview environments with supported identity provisioning and scoped credentials.
- Return policy pass, attention required, or inconclusive independently of the accessibility findings and coverage report.
- Add exceptions and overrides with owner, reason, scope, authority, and expiry/review conditions.
- Distinguish newly observed findings from evidence of newly introduced barriers, including changes caused by new checks or expanded scope.

### 5C. Monitoring, reporting, and governance

- Schedule approved public pages and configured authenticated journeys using the existing job system.
- Alert on meaningful new failures, supported recurrence, or operational interruptions according to user preferences.
- Group unchanged concerns and avoid repeated non-actionable alerts. Keep expired access separate from accessibility failures.
- Report verified improvements, remaining barriers, outstanding human reviews, exceptions, and coverage changes.
- Add exports that retain dates, scope, methods, limitations, and relevant review history.
- Add bounded guest sharing, revocation, audit history, and organization-level settings for AI, evidence, integrations, and retention.
- Keep stricter residency, enterprise identity, procurement commitments, and billing as separately validated commercial extensions.

### Completion criteria

- A finding can move between QA, engineering, design, and review without losing context.
- Revoked members and unauthorized guests cannot access protected evidence or trigger scans.
- Human findings survive unrelated automated passes and require appropriate review for closure.
- Baselines and exceptions leave known barriers visible and are not counted as fixes.
- Required journeys that fail to run make the release evaluation inconclusive or require an explicit permitted override.
- A meaningful monitored change generates an actionable alert; unchanged findings follow notification preferences.
- Reports reveal reduced coverage, changed methods, and expired exceptions rather than presenting them as improvement.

**Deliverable:** Team workflows, release protection, and ongoing regression monitoring.

## 11. Verification strategy across phases

Use controlled fixtures with known barriers and correct experiences. Include public pages, authenticated pages, different roles, SPA navigation, dialogs, form errors, and deliberately unsupported content. Compare expected outcomes under the same engine/profile rather than rewarding a higher finding count.

| Area | Required verification |
| --- | --- |
| Scanner | Expected detections and correct experiences; incomplete results and supported scope; engine/profile metadata |
| Extension | Sign-in, user-initiated injection, current-tab context, navigation during scans, popup closure, suspension, permission denial, upload retry, and disconnect |
| Authenticated MVP | Signed-in and signed-out fixtures, wrong role/state, unknown context, local app scans, and absence of target credentials from payloads/logs |
| Data and evidence | Cross-workspace denial, signed-link expiry, upload authorization, sanitized dashboard rendering, omission/redaction behavior, and deletion |
| Worker | Network boundaries including redirects/subresources, timeouts, retry idempotency, queue-dispatch recovery, cancellation, and browser cleanup |
| Finding domain | Conservative matching, missed states, changed methods, false positives, retired features, appropriate resolution, and comparable reopening |
| Accessly accessibility | Automated checks plus keyboard and human assistive-technology review of essential web and extension flows |
| Later journeys | Step and role reproducibility, safe action boundaries, blocked access, checkpoint coverage, and meaningful focus observations |
| Later AI and grouping | Attribution correctness, harmful remedies, missing intent, false grouping, prompt injection, opt-out, and independent verification |

Use bundled Chromium with a persistent context when testing an unpacked extension through Playwright, and manually check the packaged extension in supported Chrome. [Playwright extension testing](https://playwright.dev/docs/next/chrome-extensions)

Do not create tests that merely mirror implementation details. Prioritize behaviors that protect finding correctness, tenant boundaries, evidence integrity, and reliable recovery. Repeat broader checks when changes or failures justify them.

## 12. Product validation and operating measures

At the end of each phase, demonstrate the complete user outcome on an authorized application and evaluate the new behavior before adding breadth.

- **Phase 1:** Can the user reach a useful finding on a public and a signed-in page and understand its scope?
- **Phase 2:** Can the user reproduce, remedy, and appropriately verify it with less investigation? Where does the handoff still fail?
- **Phase 3:** Can important journeys replay reliably, and are missed branches and authentication interruptions understandable?
- **Phase 4:** Are attribution, grouping, and recommendations correct and useful under expert review?
- **Phase 5:** Do team handoffs improve, release decisions use comparable evidence, and alerts lead to action?

Track time to first useful finding, reproduction success, time to verified resolution, false positives, incorrect closures, known missed barriers, and continuing use. Later add attribution accuracy, recurrence, journey coverage, and notification actionability.

The primary product outcome remains confirmed barriers in selected important journeys reaching appropriate verified resolution and remaining resolved in comparable assessments. Counts and speed must not improve by dropping coverage, concealing findings, or skipping required human review. Establish numeric targets from observed baselines rather than inventing them in this plan.

## 13. Decisions to resolve as implementation reaches them

| Decision | Resolve by | Recommended starting position |
| --- | --- | --- |
| Container host, hosted browser isolation, infrastructure network controls, and cost | Before optional deployment | Open. Local worker/network controls are implemented; hosted runtime validation is outstanding |
| Accessly sign-in method and extension callback configuration | Phase 1 first vertical slice | Implemented and tested locally: Supabase web identity plus Accessly’s PKCE-bound broker, stable extension ID, single-use code, eight-hour connection token, and revocation. Different build/origin configurations require revalidation |
| Rule configuration and initial support matrix | Phase 1 scanner | Implemented: `wcag22aa-automated-v1`, Chrome-oriented extension/Chromium worker, and top-level scope with explicit exclusions. Expanded profiles/support remain open; real Chrome manual acceptance is pending |
| Screenshot defaults, exclusions, pending-upload lifetime, and retention | Before external MVP pilot | Local behavior implemented: screenshots optional, extension preview/masking/omission, disclosed exclusion limits, 30-minute pending scans, 10-minute unapproved images, and private access. Opt-in accepted-screenshot expiry and private offline backups/isolated database restoration are implemented. Customer retention, residency, encryption/off-machine backup/deletion commitments remain open |
| Pilot users and application types | Before MVP evaluation | Teams maintaining interactive web apps with recurring remediation work |
| Extension distribution | Before external MVP onboarding | Controlled pilot route, with store packaging/review planned where applicable |
| Worker authenticated-login support | Phase 3 | Implemented locally: dedicated test identities, explicit username/password POST recipes, exact-host cookies/exact-origin local storage, role assertions, expiry/revocation. MFA/SSO/CAPTCHA/sessionStorage/IndexedDB/unattended renewal unsupported. Hosted KMS/runtime validation remains open |
| Journey discovery and raw trace policy | Phase 3 | Bounded passive suggestions; explicit reviewed variations. Raw traces/screenshots disabled because exclusion redaction cannot be guaranteed. Broader autonomous exploration and enforceable raw-trace redaction remain explicit open support decisions |
| First source/issue/review integrations | Phases 4–5 | Choose from observed user workflows and permitted data access |
| AI provider/model and information handling | Phase 4 | Provider adapter, reviewed evaluation set, opt-in source context, governed data use |
| Pricing, billing, enterprise commitments, and broader browser support | After MVP validation | Validate demand and operating cost before making commitments |

No calendar estimates are fixed here. Size each phase after the previous outcome is demonstrated; avoid treating all thirty product feature areas as prerequisites for launching the MVP.

## 14. Completed local Phases 1–3 and next work

**Completed locally:** account/application setup → extension connection → signed-in current-tab assessment → actionable finding → user-provided reproduction and remedy/version → comparable finding-specific retest → scoped verification → linked recurrence. Public-page worker assessment, private optional evidence, saved work views, run comparisons, recovery behavior, opt-in screenshot expiry, and offline backup tooling are also implemented.

Phases 1–2 cover the MVP. See the [MVP guide](./docs/MVP_GUIDE.md) and [verification record](./docs/MVP_VERIFICATION.md) for the working flow, checks, and limitations.

**Phase 3 completed locally:** explicit journey authoring/recording → reviewed saved version and action boundaries → public or separately provisioned protected replay → retained checkpoint findings and focus evidence → explicit stopped-step recovery → original-context targeted retest with conservative verification. See [guide](./docs/PHASE_3_GUIDE.md) and [verification](./docs/PHASE_3_VERIFICATION.md).

**Next:** complete outstanding human/browser acceptance and choose an actual pilot application/distribution route. Capture real reproduction usefulness and measured resolution effort. Hosted runtime/key management and raw trace redaction are optional future support decisions. Phases 4–5 remain outside this implementation; no AI/source attribution, team collaboration, integrations, baselines, CI policy or monitoring was added.

### Earlier saved shutdown state and resuming work

At the end of the earlier October 25 MVP session, Accessly's web app, worker, fixtures, Supabase, Redis, and Docker Desktop were stopped. Shutdown verification found no remaining Accessly/Docker Desktop processes or listeners on project ports 3000, 4174, 54321, 54322, 54324, or 6379. Source files, local configuration, database/storage volumes, and review artifacts were retained.

When ready to resume, start Docker Desktop and wait until it is ready, then run:

```sh
cd /Users/shishir/Developer/accessly
pnpm local:setup
pnpm dev
```

Open `http://127.0.0.1:3000`. The retained local setup needs no hosted database string, external API key, or deployment. Reload the extension from `apps/extension/dist` after rebuilding and reconnect if its eight-hour connection has expired. These are restart instructions. Phase 3 verification starts the local dependencies and controlled application processes as needed; see its verification record for the final local process state.

The product specification, open commercial/hosting/AI choices, and evidence/privacy/accessibility requirements remain intact. Automated fixture success does not settle those decisions or establish full accessibility or production readiness.
