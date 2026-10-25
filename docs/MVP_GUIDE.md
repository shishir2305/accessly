# Accessly MVP guide

The MVP is the Phase 1 assessment experience plus Phase 2 remediation and verification. Everything runs locally. No AI, hosted API key, hosted database, paid service, or deployment is required.

## Complete a scoped repair

1. Set up an application and environment, connect the extension, sign into your target application normally, and reach the relevant state. Scan and approve the upload. For public pages, a background assessment is also available.
2. On a run, expand a finding and choose **Track remedy and verification**. The finding workspace retains the original run, context, minimized observation, rule guidance, and links to supporting evidence.
3. Record user-provided reproduction steps, safe input descriptions, and the expected accessible outcome. Record each reproduced, not-reproduced, blocked, or inconclusive attempt separately. Accessly does not replay these steps.
4. Apply the remedy in your application. Record the actual remedy and the application/environment version containing it, then mark it ready for verification. A remedy note or status change never resolves a finding.
5. Choose **Request targeted retest**. A public-worker finding queues its original page and exclusions. For an extension finding, reopen the same application, environment, state, and role; open the extension and select the **Finding-specific retest** request. Review the context, scan, and approve the upload. Record actual differences honestly.
6. Refresh the finding. A retest records evidence; a separate verification decision is still required. Enter method, conditions, expected/actual behavior, limitations, and confirmation of context, element continuity, and preserved capability. Required adjacent behavior must be checked or left pending.
7. A comparable targeted pass can support resolution for supported deterministic checks. Incomplete outcomes and contextual or unknown rule types require a recorded human review. Human review requires actual context/version, a named technique, and explicit completion; do not claim an assistive-technology evaluation unless it happened.
8. A verified resolution preserves its method, actor, dates, remedy, conditions, scope, outstanding limits, and previous evidence. Later comparable automated failures reopen it and link the recurrence to that verification. A new failure with incompatible context enters review instead.

The structural target must be present, visible, unique, and actually checked. A missing/hidden/replaced element, login redirect, changed role/state/viewport/profile/engine, incomplete run, or ordinary clean rescan cannot silently prove a fix. Replaced elements require contextual human review. A changed application version is disclosed as the intended remedy version; it does not itself prove the remedy worked.

False positives, retired functionality, and non-applicable concerns require an attributed reason and use **closed after review**, counted separately from verified resolutions. These are scoped review decisions, not suppressions of all future similar findings.

## Find and compare work

**Findings** has open, awaiting-verification, resolved, reviewed-closure, and all-work views; filter by application, lifecycle, rule, or state label, and save filters. The current MVP displays up to 200 matches explicitly. Run history shows up to 100 recent assessments.

On a run, select a previous run of the same application. Comparisons show persistent and newly observed concerns, explicitly reassessed target passes, and items not assessed. Context differences remain visible. “Newly observed” does not establish introduction time, and a selected check pass does not automatically resolve a concern.

## Safe local exercise

Use permitted origin `http://127.0.0.1:4174`. After signing into the controlled fixture, visit `/mvp/protected/my-first-repair`. Scan the unnamed save control, then use **Apply accessible name** in its authorized development controls. Record remedy version `v2`, retest through the extension, confirm that **Save profile** still works, and record a scoped verification. **Reintroduce missing name** provides a recurrence exercise; retirement and hiding demonstrate why disappearance is not a repair.

These fixtures are authorized local test applications. Automated fixture exercises are not a real-customer pilot, human screen-reader acceptance, or efficacy evidence. The finding feedback form records the user's own reproduction usefulness and optional active effort; leave effort unknown when it was not measured.

## Install and update

`pnpm extension:package` produces `artifacts/accessly-extension-0.2.0.zip`. Extract it and load its folder with Chrome Developer mode, or load `apps/extension/dist` directly. This is the local development distribution route. Reload the existing extension after rebuilding; its stable public identity key keeps the same ID. Finish or discard pending scans before updating, reconnect if necessary, and establish a fresh baseline after scanner/profile changes. No remote executable code is downloaded.

Before external onboarding, choose a controlled pilot distribution channel or complete Chrome Web Store submission. Store approval, pricing, hosting, support commitments, and human acceptance are open; the local ZIP does not imply store publication.
