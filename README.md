# Accessly

Accessly helps teams understand accessibility barriers in the context where they occurred. The MVP includes account/application setup, authenticated current-tab scans, public-page workers, actionable findings, private optional evidence, remediation history, comparable targeted retests, verification decisions, and linked recurrence. Phase 3 adds versioned interactive journeys, explicit recording, isolated authenticated replay, checkpoints and keyboard/focus evidence. The product specification remains unchanged; the implementation plan records implementation and outstanding human acceptance.

## Run locally

Prerequisites: Node.js 24 LTS, pnpm 11.25.0, and a running Docker-compatible runtime. No hosted account, database string, AI provider, or API key is required.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm local:setup
pnpm dev
```

Open [Accessly](http://127.0.0.1:3000), create an account, and add an application. Local email confirmation is disabled; recovery messages appear in the [local mail viewer](http://127.0.0.1:54324). Local setup writes generated credentials to ignored `.env.local` with owner-only file permissions, applies Drizzle migrations, creates a restricted database role, configures a private evidence bucket, and builds the extension.

The setup creates a dedicated `accessly-local` Docker network and explicitly binds this project’s published Supabase ports to `127.0.0.1`, preserving gateway configuration and checking service health. Redis also binds to `127.0.0.1`. Use `pnpm local:ports` to check/reapply those bindings without changing global Docker settings.

`pnpm dev` starts the web app, worker, and controlled fixture server. To stop those processes, press Ctrl+C. `pnpm local:stop` stops local database/storage and Redis services while retaining their volumes. Never use `supabase stop --no-backup` or delete Docker volumes unless you intend to remove local records.

## First signed-in assessment

1. Build the installable archive with `pnpm extension:package`, or use the unpacked build already produced by setup.
2. In desktop Chrome, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**. Select `apps/extension/dist` from this project.
3. Open the extension and choose **Connect to Accessly**. Sign in and approve the connection in the browser window.
4. In Accessly, create an application with permitted origin `http://127.0.0.1:4174`. Use environment name `Development` and save `http://127.0.0.1:4174/public` as a public page.
5. Open [the protected fixture](http://127.0.0.1:4174/protected). Sign in with any **test** email and password; the fixture does not validate real credentials. Choose a customer or administrator role. Optionally open **Edit address**.
6. Open the extension, select the application/environment, describe the reached state, and declare the role and authentication context. If protected content is required, select that requirement and confirm the intended signed-in page is visible.
7. Scan, inspect the text evidence, optionally capture and locally mask a screenshot, and explicitly approve the upload. Open the result in Accessly.

The target application's cookies, password, and browser profile are not extracted or transferred. Accessly uses a separate identity. A declared role or sign-in confirmation is **user-supplied context**, not automatically established identity. Recognizable login URLs are blocked for scans requiring protected content; unknown context stays unknown.

An already opened dialog can be scanned. A current-tab scan alone leaves its transitions unassessed. For explicit interaction/keyboard testing, use the [Phase 3 journey guide](docs/PHASE_3_GUIDE.md).

## Public background assessment

Choose a public URL belonging to an application's permitted origin and select **Assess public page**. The worker checks readiness and visits only that page; it does not crawl the site or submit forms. Its isolated browser context contains no customer login state.

Private, loopback, link-local, reserved, and unsupported-port targets are denied, including redirect and subresource destinations. The sole local exception is the **exact** `WORKER_FIXTURE_ORIGIN` configured by local setup, `http://127.0.0.1:4174`. This allows the controlled public fixtures to exercise the real job pipeline locally. It is not a private-network bypass: other ports, hosts, and local applications remain blocked. Remove this variable outside controlled local testing. Use the extension for private applications.

Worker screenshots are off by default. Selecting the screenshot option explicitly authorizes server capture and private storage; there is no pre-upload local preview for that path. Configured exclusion regions are masked. Use the extension when you need a local preview before upload. A page or viewport change detected between scanning and capture discards the screenshot while preserving accepted scan results.

## Evidence and limits

- Shared scanner profile: selected axe WCAG 2.2 A/AA-related tags, profile `wcag22aa-automated-v1`. Runs retain engine/scanner versions, rule outcomes, page/state, role, environment, viewport, dates, and execution mode.
- Violations, incomplete review candidates, passed checks, and inapplicable checks are distinct. A passing run is not full conformance or legal certification.
- Top-level ordinary HTTP(S) pages only. Frames and detected open shadow roots are excluded. Closed roots cannot be identified reliably and are always disclosed as a limitation.
- Default text evidence contains structural locators, geometry, rule/check identifiers, and reviewed explanations. HTML, page text, form values, URL query strings, and fragments are omitted. URL paths and user-entered context may still be sensitive: review them before upload.
- Invalid exclusions fail the scan. When exclusions are configured, extension screenshots are disabled because scanner exclusion does not guarantee visual redaction. Findings remain usable without images.
- Screenshot masking happens locally in the extension. Pointer users can mask rectangles; keyboard users can mask the whole image or omit it. A nonvisual description and explicit image approval are required.
- Pending extension scans and approved retry payloads expire after 30 minutes. Unapproved captured images in session storage expire after 10 minutes. Five automatic approved-upload attempts are allowed; manual retry remains available within the lifetime.
- Screenshots are private PNGs, at most 5 MB and 32 megapixels. Each run supports one immutable screenshot. Links expire after 60 seconds. Deleting an image removes the object and records a tombstone without erasing findings.
- Accepted screenshots use manual deletion by default. Workspace settings can opt into 1–365 day automatic expiry; cleanup runs approximately every minute while the worker is running. Finding/verification history is retained. Offline operator backups and an isolated restore check are available; backups need separate protection/deletion. No provider recovery or deletion SLA is implied.

## Development and verification

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm test:e2e:production
pnpm extension:package
```

`pnpm test` runs browser-backed scanner correctness/minimization, verification rules, network, and contract tests. `pnpm test:e2e` runs the real local Auth, PostgreSQL, storage, Redis, worker, web UI, and packaged extension. `pnpm test:e2e:production` first builds the production web app and then tests that build with the real worker/fixtures. It starts application processes when needed; run `pnpm local:setup` first. Tests use disposable local identities and fixtures, not real customer accounts.

The extension test uses bundled Chromium with a persistent context. Its temporary test copy adds **only** the fixture origin permission because headless automation cannot click Chrome's toolbar to grant `activeTab`. The distributable manifest has temporary `activeTab` access and the configured Accessly API origin, without persistent access to customer sites. Real Chrome toolbar invocation and human assistive-technology review remain manual acceptance checks; the automated suite does not claim those were performed.

Screenshots, traces, extension ZIPs, and reports are local ignored artifacts. Test traces may contain test sessions; treat them as sensitive and remove them when no longer needed. CI retains failure reports for three days.

See [architecture and decisions](docs/ARCHITECTURE.md), [MVP guide](docs/MVP_GUIDE.md), [MVP verification](docs/MVP_VERIFICATION.md), [Phase 1 verification](docs/PHASE_1_VERIFICATION.md), and [operations](docs/OPERATIONS.md).

## MVP and later phases

Phases 1–2 implement the local MVP. Follow the [scan-to-verification guide](docs/MVP_GUIDE.md). Automated local verification does not replace human screen-reader/real Chrome acceptance or a customer pilot.

Phase 3 journey recording, versioned replay, dedicated test identities, checkpoints, safe action boundaries, explicit variations and keyboard/focus evidence are implemented locally. Open [Journeys](http://127.0.0.1:3000/journeys) and follow the [Phase 3 guide](docs/PHASE_3_GUIDE.md). Raw journey screenshots/traces are disabled because exclusion redaction cannot be guaranteed. Human/real Chrome acceptance and hosted KMS/runtime validation remain open. Source insight, grouping and AI (Phase 4), and collaboration, manual finding authoring, integrations, baselines, release policy and monitoring (Phase 5) remain deferred.
