# Interactive journeys, locally

Phase 3 adds named, versioned journeys to the completed scan/remedy/verification workflow. Run `pnpm local:setup`, then `pnpm dev`; open [Journeys](http://127.0.0.1:3000/journeys). Docker, local Supabase and Redis are required. No hosted account, external API key or deployment is needed. Source/AI work and team/monitoring/integration features remain Phases 4–5.

## Define and replay a public journey

1. Add an application/environment with permitted origin `http://127.0.0.1:4174`.
2. Open Journeys, enter a name, task goal, preconditions, expected task outcome, intended role and application version. Use `http://127.0.0.1:4174/journey/good` as the start address; choose public access.
3. Add ordered steps. Supported actions are navigation, activation, runtime input, runtime selection, a restricted keyboard command, readiness assertions, assessment checkpoints, focus observations and explicit unsupported checks. Use unique stable IDs/test IDs, exact role/name or form-label locators. There are no arbitrary scripts or unrestricted selector/code execution steps.
4. Add checkpoints with a visible readiness target and state description. Add assertions for the outcomes you need to establish. A task description alone is not a machine-verifiable assertion. Checkpoints can assess open menus, disclosures, selected tabs, dialogs, validation errors and recovery states.
5. Save and review the saved version, then select Replay saved journey. Leaving the page does not lose a run. Follow progress in Assessments; each checkpoint links to its original checks/findings and the parent journey.

For a simple pointer sequence, activate `dialog-open`, assess `address-dialog`, activate `cancel-dialog`, observe focus on `dialog-open`, and assess `journey-ready`. Buttons in these fixtures have stable IDs. For a keyboard sequence, the good fixture starts focused on `menu-toggle`; Enter opens its menu, Enter closes it, and Tab moves to `section-toggle`. Define each subsequent key explicitly and observe focus at entry, movement, exit and restoration. `tests/journey-data.ts` contains the complete controlled sequence used by the automated acceptance tests.

Runtime input and selection steps contain an **input reference**, never its value. Provision named values through a dedicated test identity, including for public forms. For example, an `invalidPostal` reference can supply disposable invalid data. Fill/select uses programmatic input; it is not evidence of keyboard typing. Focus observations record only structural active-element paths and the explicitly executed key sequence. They do not inspect screen-reader output or prove focus visibility, meaningful order or task usability. Pattern guidance is labeled separately from established axe rule failures.

## Safe actions and isolated accounts

UI/navigation actions are read-only by default. Declare submissions, purchases, messages, deletions, settings changes and account creation separately. To allow such a step, choose disposable test data/account isolation, authorize **that exact step and effect**, explain why, and list each exact `METHOD /path` request it may issue. An empty request list cannot authorize a POST. User-supplied page instructions cannot expand these boundaries.

The runner checks rendered controls, form semantics, known consequential wording/paths and all outgoing network requests. Writes are denied outside the current authorized step. Authentication has its own exact login POST boundary. Cross-origin requests, redirects to another origin, private/reserved destinations other than the exact configured local fixture, WebSockets, service workers, downloads, popups and native browser dialogs cannot silently become coverage. Blocked requests make the result incomplete. Additional private applications remain extension-only; the fixture origin is not a general network bypass.

Arbitrary application side effects cannot be inferred completely, including actions implemented behind ordinary GET requests or ambiguous labels. Definitions and grants are explicit owner authorization, not a sandbox for live purchases or production data. Use authorized disposable test data. Journeys are serialized within an environment and a configured identity cannot be used concurrently. Separate environments/accounts are needed where test data could interfere.

A stopped or crashed journey never automatically repeats actions or resumes from a checkpoint. Review the reached evidence and test-data state, then explicitly start a new run. Targeted retests are also explicit new replays. The restore tool marks interrupted journey work incomplete instead of resubmitting possible side effects.

## Protected journey setup

The extension's current target session is never transferred automatically. Provision a dedicated test identity for the exact application, environment and intended role, with an expiry within 30 days. The owner confirms authorization and dedicated test data.

Supported provisioning:

- A username/password login recipe, using reviewed stable locators, runtime username/password references, and an exact POST path on the permitted origin.
- An explicit Playwright storage-state document containing cookies scoped to the exact environment host (`Path=/`) and local storage for its exact origin. Domain-wide cookies and other origins are rejected.
- Runtime inputs only, for public journeys that need disposable data.

For the controlled fixture, use login URL `/login`, username ID `login-email`, password ID `login-password`, submit button ID `login-submit` and POST path `/login`. Any **test** username/password works. Start the protected journey at `/journey/protected/good`, role `customer`, and require ID `identity` with exact text `Signed in as customer.`. The role marker must be reached before assessing protected content and after actions. This is an explicit configured application assertion, not independent identity-provider attestation.

An expired/invalid/revoked session, wrong role, sign-in redirect, MFA/SSO/CAPTCHA challenge or unsupported unattended renewal yields a visible incomplete result. The login recipe does not support arbitrary scripts, provider SSO, sessionStorage or IndexedDB provisioning. No target credential value appears in normal identity listings, definitions, run histories, findings, reports or worker logs.

Secrets use AES-256-GCM with fresh nonces, an authenticated tenant/application/environment/role/identity binding, and a versioned server key ring. Local setup generates the key ring into owner-only `.env.local` and preserves it across setup runs. Retain keys with protected backups. Expired material becomes unusable immediately and the worker clears its ciphertext during periodic cleanup. Revoke deletes live encrypted material and blocks later steps. Offline backups need separate deletion. Hosted KMS/provider, residency and commercial retention guarantees remain open; no hosted security validation is claimed.

## Recording a reviewable draft

Connect the extension, open the authorized tab, expand Record a journey draft, and explicitly start recording. Closing the popup does not stop capture. Only trusted supported interactions in that tab/origin are recorded. Same-origin document and SPA URL navigation reattaches the packaged recorder; leaving the origin or losing the ability to validate it stops capture. Query/fragment-dependent navigation becomes an explicit unsupported draft step with its values omitted, so sanitization cannot silently claim a faithful replay. Reopening the popup allows stopping and inspecting the draft.

Recording omits typed values, passwords, page text, cookies and browser profiles. Inputs become named references; unsupported controls become explicit draft gaps. Keyboard-generated click duplicates are suppressed. Controls need stable IDs/test IDs for this limited recorder; you can manually author role/label locators in the web app. Capture is bounded to 55 steps/30 minutes, and the draft is deleted on expiry/discard/disconnect. Navigation attachment failures remain explicit; real Chrome permission/lifecycle acceptance is still required.

Copy the reviewed steps into the web journey import field. Add readiness assertions, checkpoints, task outcomes, role checks, input references and separately reviewed grants. Importing a draft never authorizes or runs its consequential actions. Recording does not observe a complete task or establish accessibility.

## Outcomes, branches and verification

The result separates execution completion from check outcomes. It shows the exact stopped step, bounded error code, recovery action, assessed checkpoint runs, focus matches/differences, original action order, exclusions, unsupported areas and unassessed steps. Valid earlier findings survive later failure. A clean initial checkpoint cannot close a dialog/error-state finding.

Define variations with a name and ordered step IDs. Select one explicitly when replaying. Other variations remain not assessed, even when some steps overlap a main run. Bounded passive branch discovery suggests invalid input/recovery, cancellation and alternate widget states for review. Suggestions are unreviewed, never executed or counted as exhaustive coverage. There is no autonomous crawling or scope expansion.

Finding details link the triggering journey and focus evidence. A finding-specific retest replays the original saved sequence, role, boundaries, identity and selected variation, using the recorded remedy version, while that journey version remains current. A changed saved version stops queued/running work and original-snapshot retests as incomplete before further actions; stale grants are never reused. Review the current definition and use an appropriate contextual human verification for historical findings when necessary. Only the original checkpoint performs the targeted rule/element assessment. If it is not reached, the retest is inconclusive. Automated resolution also requires the journey to complete; changing the journey version does not silently establish comparability. Existing contextual confirmations, human review, capability preservation, adjacent-review and recurrence rules still apply. Replaying by itself never closes findings.

Screenshots and raw Playwright traces are deliberately disabled for journey runs: DOM snapshots, input values, cookies and network bodies cannot be reliably redacted with the current exclusion model. Minimized action/focus evidence is the supported diagnostic path. An explicit unsupported requested check yields an incomplete result. Optional raw traces can be reconsidered only with enforceable exclusions, private access and retention.

Human assistive-technology review, real Chrome toolbar/activeTab acceptance, customer pilot efficacy and hosted browser/KMS deployment remain unverified. Selected automated checks and fixture success do not establish full WCAG conformance or production readiness.
