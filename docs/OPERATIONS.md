# Local operations

## Services and configuration

| Service | Default local address |
| --- | --- |
| Accessly | `http://127.0.0.1:3000` |
| Controlled fixtures | `http://127.0.0.1:4174` |
| Supabase API/Auth/Storage | `http://127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |
| Mail viewer | `http://127.0.0.1:54324` |
| Redis | `127.0.0.1:6379` |

`pnpm local:setup` obtains actual local keys from Supabase CLI without printing them, configures `.env.local`, applies versioned migrations, creates private storage, and packages the extension. It will not overwrite configuration pointed at a different Supabase service. Never place the service-role key, database password, or administrative URL in a `NEXT_PUBLIC_` variable or extension build.

If a port is occupied, stop the conflicting service or configure all references consistently. The supplied setup and fixtures intentionally use fixed ports for repeatable tests. Do not set `WORKER_FIXTURE_ORIGIN` to an arbitrary private origin in a shared or deployed environment.

## Diagnostics and recovery

The UI shows failed, cancelled, partial, queued, and running states separately from rule results. Public-run retries create new historical run records. Worker logs contain event codes and run IDs, not source HTML, credentials, query strings, or page text. API errors are intentionally bounded; inspect service health and structured diagnostics before retrying.

- **Docker unavailable:** start Docker, then rerun `pnpm local:setup`.
- **Account unavailable:** confirm the local Auth stack is running. Use the recovery flow and local mail viewer if needed.
- **Extension connection rejected:** ensure the unpacked build's ID matches `EXTENSION_ID`, and that its compiled API origin matches `WEB_ORIGIN`. Rebuild with `pnpm extension:package` and reload it in Chrome.
- **Upload interruption:** accepted scans use stable IDs and are not duplicated by retries. Approved pending data retries on alarm and popup reopening. Retry manually or discard it before the 30-minute expiry. Expired or deliberately discarded evidence is removed locally.
- **Worker offline/queue unavailable:** database runs remain durable. Restart Redis and worker; the dispatch reconciliation repairs missing queue dispatch and missing jobs. Redis uses AOF persistence. Cancel outstanding work from the result page if no longer wanted.
- **Scan failure or login redirect:** restore the intended application state, permissions, or readiness and try again. A failed run does not close existing findings.
- **Screenshot rejected:** page changes, mismatched dimensions, invalid data, oversized images, or unavailable capture permissions can prevent evidence. Results remain usable without screenshots.
- **Evidence removed:** findings retain their original conclusion and show that supporting evidence was deleted. Any separately downloaded copy is outside Accessly's deletion controls.

Supabase and Redis volumes survive ordinary stops. Settings default to manual screenshot deletion and permit explicit 1–365 day expiry. The running worker checks every minute; outages delay expiry. Object deletion keeps a tombstone, findings, and verification history. Signed links last up to 60 seconds and separately downloaded or backed-up copies need separate deletion. There is no off-machine backup, managed disaster-recovery SLA, or provider backup-deletion guarantee.

## Offline backup and recovery

Stop all web/worker/fixture processes first. Backups briefly stop this workspace’s Supabase containers for a consistent database/storage filesystem snapshot, then restart them. Local Docker Unix sockets and the default local project are supported. The operator is responsible for choosing the frequency and off-machine destination.

```sh
pnpm local:backup
pnpm local:backup:verify artifacts/backups/<timestamp>
```

The printed private directory contains PostgreSQL/Auth/Storage volume archives, `.env.local` as `env.local`, the database container configuration, checksums, counts, and a manifest. Directory/file permissions are 700/600. **These contain account hashes, credentials, and private screenshots.** They are not automatically encrypted or uploaded. Keep them on an access-controlled encrypted disk, restrict copies, and remove obsolete backups separately from live evidence. Never commit them. Only verify/restore trusted operator-created archives; a checksum detects corruption, not a malicious archive.

Verification checks archive hashes and starts a restored database in a temporary volume with no network or published port. It compares Auth-user, finding, verification, and evidence-metadata counts, then removes the temporary resources. Storage archive hashes are checked; an actual recovery still needs signed-image download checks. This is not an off-machine disaster-recovery test.

To recover deliberately, first create a safety backup of current data. Keep all app/worker processes stopped. The following explicit flag replaces this workspace’s local database/Auth and evidence volumes with the selected backup; other Docker projects are rejected:

```sh
pnpm local:restore artifacts/backups/<timestamp> --replace-local-data
pnpm local:setup
pnpm dev
```

The restore requires the same PostgreSQL image, validates checksums and matching local volumes, restores local environment configuration, and rebuilds the Accessly assessment queue from durable database work. Other Redis queues are not cleared. Public-page interrupted assessments can resume; restored queued/running journeys are marked incomplete because side effects may have occurred after the snapshot. Review test data and explicitly start a new journey. Terminal failures remain historical. If recovery stops on error, keep Accessly stopped, retain the backup, and inspect container health before continuing. Full replacement of live user data was not performed during implementation; the isolated PostgreSQL restoration was exercised instead.

After recovery, sign in, open a historical finding and verification, obtain a private screenshot download, and request a new public scan. Reconnect extension sessions if needed. Evidence previously deleted after the chosen backup date can reappear from that backup; reapply required deletions and dispose of obsolete backups before reopening access.

## Local service isolation

`pnpm local:setup` and `pnpm local:ports` inspect only Supabase containers labelled for this project and exact workspace, preserve named volumes and gateway configuration, and recreate published endpoints with explicit `127.0.0.1` bindings. Health failures restore the previous container configuration. Docker Desktop global settings are not changed. Verify actual addresses with `docker ps` after Docker/CLI upgrades. Setup also checks that Auth reconnects to PostgreSQL after database recreation.

## Support and limits

There is no staffed support SLA configured. For local issues, keep bounded error codes, run IDs, status, and versions; omit page HTML, secrets, connection tokens, private screenshots, and raw traces from shared reports. Follow the diagnostic cases above. The MVP bounds worker concurrency per workspace at five queued/running jobs, scan/retest creation at 20 per minute per actor, ordinary API requests at 180 per minute, saved views at 30, and individual evidence at 5 MB. These are local operating bounds, not commercial quotas.


## Optional containers and hosting

`infra/Dockerfile` has independent `web` and `worker` targets, with a pinned Node major, package-manager version, lockfile, and Playwright package/browser install. Builds never copy `.env.local` into the image. Web public Supabase values must be supplied as build arguments because Next.js inlines public values at build time. Secret values belong in runtime configuration. The worker runs as a nonroot user and requests Chromium's Linux sandbox; select a host that supports it rather than disabling it for untrusted workloads.

These targets have not been deployed. Host selection, browser isolation, resource quotas, network policy at the infrastructure layer, TLS, secret rotation, and hosted Supabase configuration remain deployment decisions. Local setup deliberately uses documented local-only credentials; it is not a production provisioning script. All core MVP development and testing works without deployment.

Official implementation references: [local Supabase](https://supabase.com/docs/guides/local-development), [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity), [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Playwright extension testing](https://playwright.dev/docs/chrome-extensions), and [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

Backup design reference: [Supabase database backups and separate Storage objects](https://supabase.com/docs/guides/platform/backups). Local binding reference: [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).

## Phase 3 authentication and recovery

Local setup generates and preserves `JOURNEY_SECRET_KEY_ID` and `JOURNEY_SECRET_KEYS` in owner-only `.env.local`. The latter is a JSON object mapping key IDs to base64-encoded 32-byte AES keys. They are server-only: never prefix them `NEXT_PUBLIC_`, bundle them in the extension, print them, or commit them. Missing keys prevent provisioning/decryption with a bounded configuration error. To rotate, add a new random key version and make it active; keep old versions until existing identities are revoked/reprovisioned. Backups include both encrypted identity records and the key ring, so protect backup copies independently. Live revocation does not erase an offline copy. Hosted managed-key custody/provider remains an optional-deployment decision.

Identity expiry blocks new steps immediately; the worker clears expired ciphertext during its minute cleanup while running. Revoke through Journeys erases live encrypted material. Login recipes require dedicated authorized test accounts and an exact same-origin POST endpoint; session provisioning is limited to exact-host cookies and exact-origin local storage. MFA/SSO/CAPTCHA, IndexedDB/sessionStorage and unattended renewal are unsupported. A missing/wrong role assertion, challenge, expired session or revoked key/identity produces incomplete scope.

Journeys use a 120-second overall deadline, 0.5–15-second configurable step deadlines, at most 60 explicit steps, and 15 named variations. At most one journey runs per environment. Jobs do not automatically repeat side effects after failure, worker restart, queue recovery or restoration. Editing a journey version invalidates queued/running snapshots and original-version targeted retests before further actions; `JOURNEY_VERSION_CHANGED` requires reviewing the current boundaries or appropriate human verification of historical findings. Earlier checkpoint findings survive. Cancel from the run view; review existing evidence/test-data state before a new run. Generic public-page retry is disabled for journey checkpoints; targeted finding retests replay their original saved context.

Minimized action/focus histories are the supported journey diagnostics. Raw traces/screenshots/DOM/network-body artifacts are disabled because their exclusions cannot be enforced. Passive branch suggestions are unreviewed and do not establish coverage. Extension recordings contain only bounded reviewed draft metadata, expire after 30 minutes, and are deleted on discard/disconnect. See [Phase 3 guide](./PHASE_3_GUIDE.md).
