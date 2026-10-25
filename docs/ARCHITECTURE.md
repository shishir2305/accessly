# MVP architecture and decisions

## Components

- `apps/web`: Next.js App Router/React dashboard, Supabase account UI, extension approval page, and `/api/v1` Route Handlers. Shared Radix/shadcn-style buttons use Tailwind/CSS styling with explicit keyboard and contrast checks.
- `apps/extension`: Vite-built React popup, Manifest V3 background service worker, packaged axe scanner, temporary current-tab access, local preview/masking, and bounded durable uploads. No remotely loaded executable code or content-script access to connection tokens.
- `apps/worker`: separate BullMQ consumer; browser-per-run isolation, network-checking proxy, cancellation and bounded readiness/timeouts, common result normalization, optional screenshot capture, and outbox recovery.
- `packages/contracts`: Zod-validated scan, context, input, evidence, and extension-message contracts.
- `packages/scanner`: shared axe profile, deterministic structural locators, minimal element observations, and evidence freshness guard.
- `packages/database`: Drizzle schema/migrations, restricted PostgreSQL connection, tenant-scoped service functions, private storage operations, and connection grants.
- `packages/domain`: reviewed rule-based explanation/remedy content and conservative context-based finding fingerprints. Fingerprints do not claim a shared cause or verified continuity.
- `packages/ui`: reusable accessible button primitives.

## Data flow

For a tab scan, the user signs into the target normally, chooses Accessly scope, declares context, and starts a scan. The packaged scanner runs in Chrome's isolated extension world. It returns minimized observations, not a browser session. The extension persists a reviewable result for at most 30 minutes. Only explicit approval authorizes upload. The API rechecks ownership and permitted origin, validates the payload, saves immutable run evidence and occurrences transactionally, and matches tracked findings conservatively. Duplicate client scan IDs are idempotent and cannot cross tenants.

For a public scan, an authorized API request inserts a queued run and outbox record in one database transaction. The worker dispatch loop reconciles undispatched entries and older entries whose Redis job is missing. PostgreSQL remains authoritative. Redis jobs have deterministic IDs and bounded attempts. A cancelled or already accepted run is not evaluated again. Run completion and accessibility outcomes remain separate.

The browser's outbound proxy resolves every destination, rejects nonpublic address classes, and connects to a validated IP directly rather than relying on a later browser DNS lookup. Playwright also validates requests, blocks state-changing HTTP methods and WebSockets, disables service workers/downloads, and enforces timeouts. Blocked content makes results partial. Proxy sockets and browser processes are closed in all exits. Chromium receives an environment allowlist that excludes service credentials. Container/host sandbox support must be validated before deployment to untrusted public workloads.

## Authentication decision

Accessly account identities come from Supabase Auth. The web app keeps its normal Supabase client session and sends a bearer token to the API, which validates it with Auth. Server endpoints do not trust a client workspace ID.

The extension uses a small **Accessly authorization broker over the Supabase-authenticated web session**, rather than exporting Supabase browser refresh tokens. Chrome's interactive identity window opens the approval page. A one-time, 60-second authorization code is tied to the extension's SHA-256 PKCE challenge. The extension validates callback origin, state, and request age before exchange. Exchange consumes the code atomically and issues an opaque eight-hour connection token. Only its hash is stored server-side. Disconnect revokes the token and clears extension data. A web sign-out and an extension disconnect are separate session operations.

This is an explicit implementation choice for the plan's open extension authentication flow; it is not Supabase's native OAuth PKCE grant and does not claim to be. The manifest's public key provides a stable extension ID. Only that configured ID can obtain grants. Change the configured API origin and ID together when deliberately preparing a different build. No target credentials are part of this flow.

## Tenant and storage boundaries

The API uses `accessly_api`, a nonsuperuser/nonowner database role. Supabase's browser roles have no grants to application tables; RLS also denies them. The trusted API role has a server policy and must scope all operations explicitly. This does **not** claim that RLS independently tenant-scopes a privileged server connection. Tenant denial is tested at each public application/run/evidence entry point.

Evidence buckets are private with no public browser read policy. A caller must have access to the exact run/object before upload, signed-link creation, or deletion. PNG signatures, dimensions, size, content hash, and run association are validated. Database row locking and a unique run index serialize evidence registration; the committed pending object reference and content hash make identical upload retries recoverable. Repeated identical uploads return the existing reference; different data cannot silently overwrite accepted evidence. Stored paths are not included in normal result responses. Deletion leaves an attributable historical record.

## Evidence and state decisions

A finding's first/last observation may advance, but a run retains its original check result, context, and occurrence evidence. Historical run responses use the original run check instead of the finding's latest mutable explanation. No absence, element removal, or new successful run closes a previous concern in Phase 1. Phase 2 adds attributed remediation history and explicit verification; a generic scan still cannot imply closure.

User-declared target roles and authentication are explicit. Protected-page expectations require confirmation; recognizable sign-in URLs produce a wrong-context warning or failure. Unknown target state cannot establish protected coverage. Automated identity recognition is not claimed.

Public worker screenshots require an explicit pre-run choice and may upload without a local preview. They are masked in server memory after capture, so mask overlays do not themselves change the assessed DOM. Run evidence states distinguish pending, ready, failed, and deleted processing. Extension screenshots require a local preview and approval. Excluded extension scans omit screenshots entirely; this is a conservative supported limitation rather than an assertion of complete automatic redaction. Manual pointer masks, full-image keyboard masking, and image omission remain available for scans without exclusions.

## Open decisions preserved

Hosting provider, isolated browser deployment controls, external pilot audience, external extension distribution, expanded support matrix, alternate standards profiles, retention/residency/backup guarantees, independent review policies, benchmarks and numeric quality targets, integrations, AI providers/data policies, pricing, and enterprise commitments remain open. The packaged Docker targets and GitHub workflow are optional development aids, not a deployed or certified service.

## Remediation and verification

Finding work state and evidence assessment are separate. Edits require an optimistic revision and a reason; event records retain before/after remedy/reproduction details. Reproduction attempts append actual conditions without replacing the original observation. Retests snapshot the original run, structural target, selected rule, remedy/version, and exclusions. Public retests use the durable outbox; extension requests are selected and executed manually on the current tab.

The scanner records whether the original target is present, unique, visible, and explicitly included in the selected rule’s actual axe nodes. Broad rule-level passes are insufficient. Context comparison blocks changes of application/environment/page/state/role/authentication, viewport, execution mode, profile/engine/scanner, exclusions, incomplete execution, or scans predating their source/request. Application version and preconditions changes remain disclosed; users must confirm actual context and capability.

A verification decision locks the finding and checks its revision and retest/remedy snapshot. Supported deterministic checks require a comparable targeted pass and contextual confirmations. Incomplete, contextual, and unknown rule types require named human review with actual scope/version and completion. Outstanding adjacent review persists across later decisions. Decisions and events are immutable through the API. Reviewed false positives or retirement remain separate from verified resolutions.

Comparable later failures reopen resolved automated findings with the prior verification linked. Incompatible contexts or a previous human verification require a new review rather than an automated recurrence conclusion. Generic edit endpoints cannot set resolved or reopened. All new detail, retest, verification, comparison, feedback, filter, and settings operations recheck tenant ownership.

Evidence registration commits a pending reference before storage I/O. Subsequent upload/deletion/expiry serializes on that evidence row so a deletion cannot be undone by a concurrent retry. Expiry is opt-in; offline backups include PostgreSQL/Auth and storage volumes and have an isolated restoration check. Operator copies remain outside live deletion controls.

## Phase 3 journeys

`packages/contracts/src/journeys.ts` defines a strict version-1 declarative interaction format with stable locators, input references, ordered steps, checkpoint readiness, explicit action grants and named variations. `journeys` keeps the current version; append-only API version records preserve prior definitions. Each `journey_runs` row snapshots its definition, identity reference and variation under the existing tenant-owned `runs` record and durable outbox. Queue payloads contain no target secrets. Journey jobs have one attempt; crashed/stalled work is marked incomplete with reached evidence instead of replaying side effects. The worker rechecks the current definition version before/after actions and while running; edits invalidate queued/running snapshots and historical targeted replays, so old action grants cannot bypass a newer boundary.

The isolated Chromium runner uses the existing validated-IP proxy and stricter same-origin request routing. Writes need the exact current-step effect/request grant, or the separately authorized login POST. Rendered-control checks also stop recognizable consequential actions mislabeled UI. Fresh contexts, environment serialization and dedicated identities prevent ordinary state/session sharing. Boundaries cannot infer every application-specific GET side effect, so disposable test accounts/data remain required for state-changing assessment.

Checkpoint scans use the common scanner/finding pipeline and immutable provenance identifying parent journey/version/step. Their record and parent checkpoint reference commit together. Focus paths and explicit key histories remain separate observations/pattern guidance. Generic initial-page passes cannot substitute for an interactive checkpoint. Comparisons require matching journey/version/step provenance. Finding-specific retests replay the original snapshot and target the original element/rule at its checkpoint; incomplete parent journeys cannot establish automated resolution. Human review requirements remain intact.

`test_identities` isolates records by workspace/application/environment/role. Only the server can decrypt AES-256-GCM material with an authenticated identity/scope binding. The versioned local key ring is generated/preserved in owner-only `.env.local`; hosted KMS is deliberately unresolved. Identity lists expose metadata only; revocation erases live ciphertext and expiry blocks access immediately. Recipes support explicit username/password POST login; provisioning supports exact-host cookies and exact-origin local storage. No automatic extension-session export, SSO/MFA renewal or secret readback endpoint exists.

Extension recording runs in the isolated extension world only after a popup command. Trusted, bounded tab events yield schema-validated draft steps without typed values. Background writes serialize, navigation reattaches within the origin, and expiry/discard/disconnect removes drafts. The recorder's content message surface cannot invoke account/API/scan control actions. Draft import is separate from authorizing replay.

Raw journey traces/screenshots/DOM/network payload evidence are disabled because enforceable exclusion redaction is unavailable. Minimal action/focus evidence is supported. Branch discovery passively identifies reviewable suggestions and never explores unapproved actions. See the [Phase 3 guide](./PHASE_3_GUIDE.md) for the supported scope and open decisions.
