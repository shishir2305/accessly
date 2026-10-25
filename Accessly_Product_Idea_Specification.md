# Accessly Product Idea Specification

**Version:** 1.0  
**Date:** October 24, 2026  
**Purpose:** A complete product context document for people and AI agents working on Accessly.  
**Product status:** Proposed product concept. Requirements describe intended behavior, not capabilities of an existing Accessly product.  
**Research basis:** Public primary sources reviewed during the product research and checked again on the document date. Competitor features are documented claims, not independently benchmarked performance.

Accessly is an intelligent accessibility testing and remediation platform for teams building web applications. It helps them find barriers, understand their impact, reproduce the conditions that reveal them, locate their likely source, review actionable recommendations, verify improvements, and prevent the same failures from returning.

This document defines the product idea, user needs, intended experiences, feature behavior, operating rules, competitive context, and measures of success. It does not prescribe architecture, programming languages, technical components, code, implementation tasks, delivery phases, or schedules.

## Contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Vision and product promise](#2-vision-and-product-promise)
3. [Problem and consequences](#3-problem-and-consequences)
4. [Research findings and evidence boundaries](#4-research-findings-and-evidence-boundaries)
5. [Competitive landscape and positioning](#5-competitive-landscape-and-positioning)
6. [Customers and users](#6-customers-and-users)
7. [Jobs to be done and desired outcomes](#7-jobs-to-be-done-and-desired-outcomes)
8. [Product principles](#8-product-principles)
9. [Scope and boundaries](#9-scope-and-boundaries)
10. [Product concepts and vocabulary](#10-product-concepts-and-vocabulary)
11. [End to end customer journeys](#11-end-to-end-customer-journeys)
12. [Detailed feature requirements](#12-detailed-feature-requirements)
13. [Product spaces and information experience](#13-product-spaces-and-information-experience)
14. [Finding lifecycle and verification rules](#14-finding-lifecycle-and-verification-rules)
15. [Coverage and comparison rules](#15-coverage-and-comparison-rules)
16. [Severity and prioritization](#16-severity-and-prioritization)
17. [AI behavior and trust requirements](#17-ai-behavior-and-trust-requirements)
18. [Collaboration and permission model](#18-collaboration-and-permission-model)
19. [Privacy and responsible operation](#19-privacy-and-responsible-operation)
20. [Standards and accessibility claims](#20-standards-and-accessibility-claims)
21. [Product quality expectations](#21-product-quality-expectations)
22. [Commercial concept and adoption](#22-commercial-concept-and-adoption)
23. [Success measures](#23-success-measures)
24. [Illustrative product scenarios](#24-illustrative-product-scenarios)
25. [Product acceptance scenarios](#25-product-acceptance-scenarios)
26. [Assumptions and open decisions](#26-assumptions-and-open-decisions)
27. [Research references](#27-research-references)
28. [Essential context for an AI agent](#28-essential-context-for-an-ai-agent)

## 1 How to use this document

### 1.1 Intended readers

The primary readers are product collaborators and AI agents that need to understand what Accessly is meant to achieve. Designers, accessibility specialists, quality teams, and business stakeholders should also be able to use it without interpreting technical instructions.

Read the vision, problem, principles, and boundaries before interpreting individual features. A feature should serve a user outcome and respect the evidence and verification rules described here.

### 1.2 Meaning of requirement language

- **Must** identifies a required product behavior or trust boundary within this proposed specification.
- **Should** identifies a strong product expectation that may need contextual judgment.
- **May** identifies an optional behavior or configurable choice.
- **Hypothesis** identifies an assumption requiring customer or product validation.
- **Open decision** identifies an unresolved product choice. An AI agent must not silently turn it into an approved commitment.

Feature identifiers such as F01 are reference labels. They do not represent delivery order, implementation tasks, or separate products.

### 1.3 Evidence and decision hierarchy

The founder supplied the original problem, vision, and ultimate goal. The detailed requirements in this document expand that direction into a coherent proposed product. They should be treated as recommended product decisions until the product owner approves or changes them.

Research facts, competitor capabilities, and proposed Accessly behavior are distinct. A competitor feature does not establish that Accessly already offers it. A proposed Accessly feature does not establish competitive uniqueness. No interviews, purchasing experiments, or comparative product benchmarks were conducted as part of this research.

When information is missing, preserve the vision and trust boundaries, identify the assumption, and avoid inventing customer evidence, product results, legal guarantees, or unsupported coverage claims.

## 2 Vision and product promise

### 2.1 Vision

Make web accessibility testing, debugging, and remediation a routine part of delivering web applications, so teams can build inclusive experiences without every contributor needing deep accessibility expertise.

### 2.2 Mission

Give teams enough context and evidence to move from discovering an accessibility barrier to resolving it confidently and preserving the improved behavior over time.

### 2.3 Product definition

Accessly is a developer-first platform that evaluates web experiences across pages and interactive states, explains discovered barriers in practical terms, connects findings to their likely origin, and supports remediation through verification and regression prevention.

Developer-first means the product respects the user's existing work, gives precise and actionable evidence, and minimizes investigation overhead. It does not mean the product is usable only by developers. QA professionals, designers, accessibility specialists, and managers need appropriate ways to understand and act on the same information.

### 2.4 Core promise

For each actionable finding, Accessly aims to answer:

1. What happened?
2. Who may be affected, and what task becomes difficult or impossible?
3. Under which page, state, journey, and environment did it happen?
4. How can someone reproduce it?
5. Where is the likely responsible source or owning team?
6. What change is recommended, and what assumptions does it depend on?
7. What evidence shows that the affected behavior was retested?
8. What protection will detect the same problem if it returns?

These answers may have different levels of certainty. The product must make those differences visible.

### 2.5 Long term outcome

Teams spend less time interpreting reports and repeatedly investigating known patterns. Users with disabilities encounter fewer barriers in important tasks. Accessibility improvements survive ordinary product changes because the relevant behavior remains visible and monitored.

## 3 Problem and consequences

### 3.1 The central problem

Developers can detect many accessibility issues, but connecting a failure in a particular UI state to its origin, reproducing it reliably, and validating a durable fix can require substantial investigation.

A report may identify an element and a rule without explaining the sequence that revealed the issue, whether the problem blocks a user task, which shared component is responsible, or what evidence is needed to consider the problem resolved.

### 3.2 Why ordinary page scanning leaves work for the team

Web applications reveal different content and behavior after user actions. A dialog may appear only after selecting an item. A validation error may appear only after an invalid submission. A menu may behave differently with a keyboard. A signed-in user may see controls that are absent from the public page.

The same address can therefore contain many meaningful states. Checking its initial appearance does not establish that all those states were evaluated. Testing a state also does not automatically establish that the transition into or out of it works accessibly.

### 3.3 Problems throughout the remediation journey

| Stage | User difficulty | Consequence |
| --- | --- | --- |
| Decide what to test | Important routes, roles, and states are unclear | Coverage is accidental or incomplete |
| Interpret a finding | The rule description lacks task context | Teams misunderstand impact or urgency |
| Reproduce the barrier | Preconditions and interaction steps are missing | Findings bounce between people |
| Identify responsibility | The visible element has an unclear origin | Work is assigned to the wrong person |
| Choose a remedy | Generic guidance leaves contextual decisions unresolved | Superficial changes or new problems appear |
| Verify the result | A clean rescan is mistaken for complete validation | Broken behavior is declared fixed |
| Maintain improvements | Repeated patterns are not protected | The same failures return |
| Report progress | Issue totals change with scope and counting | Leadership receives misleading signals |

These are product problem hypotheses informed by the research and original vision. Their frequency and relative importance require direct customer observation.

### 3.4 Effects on people using the application

Accessibility barriers can prevent people from completing tasks such as applying for a service, buying a product, managing an account, or contacting support. A control without a meaningful name can be difficult to identify with assistive technology. Lost focus can make a workflow confusing. Information conveyed only visually may be unavailable to some users.

Accessly should express impact through the task and observed behavior rather than reducing disability to a checklist. Different people and assistive technologies may experience the same application differently.

### 3.5 Effects on product teams

The proposed product addresses investigation time, repeated handoffs, unclear ownership, backlog growth, inconsistent reviews, and uncertainty around release decisions. Its value depends on helping teams complete correct remediation, not simply producing more findings.

### 3.6 Limitations of the existing evidence

The research establishes widespread detectable accessibility problems and substantial competition in testing tools. It does not establish how many teams experience each workflow problem, how much time they lose, what they will pay, or whether Accessly will outperform their present workflow.

## 4 Research findings and evidence boundaries

### 4.1 Accessibility problems remain widespread

WebAIM's February 2026 study evaluated one million home pages and reported detectable WCAG failures on 95.9% of them, with an average of 56.1 detected errors per page. It found that 96% of detected errors fell into six recurring categories: contrast, missing image alternatives, missing form labels, empty links, empty buttons, and missing document language. The study concerns automatically detectable problems on home pages; it does not measure complete application accessibility or developer productivity. [WebAIM Million 2026](https://webaim.org/projects/million/)

**Product implication:** Accessly should handle common problems clearly while helping teams understand the limits of a scan. High prevalence alone does not prove willingness to buy another product.

### 4.2 Automated evaluation has unavoidable limits

W3C explains that evaluation tools assist accessibility assessment, that human judgment remains necessary, and that tools can produce misleading results. [W3C tool selection guidance](https://www.w3.org/WAI/test-evaluate/tools/selecting/)

**Product implication:** Accessly must represent uncertainty and manual review needs explicitly. It must never interpret an absence of automated findings as a complete accessibility assessment.

### 4.3 Interactive testing is established practice

Playwright documents checks against the current page state after interactions. Evinced documents continuous observation of page changes and navigation during a test flow. [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), [Evinced web testing documentation](https://developer.evinced.com/sdks-for-web-apps/playwright-js-sdk/)

**Product implication:** Accessly needs to demonstrate a better experience or outcome for state coverage and investigation; interaction support by itself is insufficient differentiation.

### 4.4 AI remediation is already commercial and under research

Deque documents AI remediation guidance through Axe MCP. BrowserStack documents proposed source changes and a rescan after changes are applied. Separately, the AccessGuru paper reports promising results from combining established evaluation tools and language models on its benchmark. These sources demonstrate activity in the area, not universally reliable autonomous remediation. [Axe MCP](https://docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server/), [BrowserStack remediation](https://www.browserstack.com/docs/test-companion/web-testing/test-lifecycle/fix-accessibility-violations), [AccessGuru paper](https://arxiv.org/abs/2507.19549)

**Product implication:** AI-generated recommendations require evidence, contextual judgment, and independent verification of the result.

### 4.5 Evidence rich debugging already has useful foundations

Playwright's trace viewer documents recorded action timelines and page snapshots for investigation. [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)

**Product implication:** Accessly should be judged on how well it makes accessibility evidence understandable and actionable, rather than treating screenshots or action histories as inherently unique.

### 4.6 Regulation creates urgency in specific markets

EU guidance describes accessibility requirements for covered products and services from June 28, 2025, with scope limits and exemptions. In the United States, current DOJ guidance states April 26, 2027 and April 26, 2028 compliance dates for different categories of state and local public entities under the Title II web rule, following a 2026 extension. These are jurisdiction-specific demand signals and must not be generalized to every business. [EU business guidance](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm), [DOJ Title II fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/)

**Product implication:** Support appropriate evidence and standards settings, while keeping legal applicability separate from the result of a product check.

### 4.7 Research conclusion for the concept

Accessly enters an existing and advancing category. The defensible opportunity is a hypothesis about reducing the total effort required to deliver a correct and durable fix. Potential advantages include source attribution accuracy, reproducibility, evidence quality, shared-cause identification, and a more coherent experience across detection and prevention.

## 5 Competitive landscape and positioning

### 5.1 Deque Axe

Deque's Developer Hub documents integration with automated tests, deduplicated results, identification of new issues, and pull-request blocking. Axe MCP documents remediation guidance with concrete fixes that coding assistants can apply. [Developer Hub](https://www.deque.com/axe/developer-hub/), [Axe MCP](https://docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server/)

**Implication:** Developer workflows, AI assistance, and regression checks are competitive expectations. Accessly must earn adoption through measurable workflow quality.

### 5.2 Evinced

Evinced documents analysis throughout dynamic page flows. Its Web MCP product describes contextual remediation guidance and use from AI-assisted workflows. [Web testing documentation](https://developer.evinced.com/sdks-for-web-apps/playwright-js-sdk/), [Web MCP documentation](https://developer.evinced.com/mcp-servers/web-mcp-server/)

**Implication:** Accessly cannot claim unique support for dynamic applications or AI-assisted accessibility work. Any advantage must be demonstrated on comparable tasks.

### 5.3 BrowserStack

BrowserStack documents automated evaluation, assisted testing, and screen-reader testing. Test Companion describes finding rendered-page violations, proposing changes to source files, reviewing changes, and automatically rescanning afterward. [Accessibility overview](https://www.browserstack.com/docs/accessibility/overview/introduction), [Test Companion remediation](https://www.browserstack.com/docs/test-companion/web-testing/test-lifecycle/fix-accessibility-violations)

**Implication:** A complete detection-to-verification narrative already has direct competition. Accessly must establish why its results are easier to trust or faster to use.

### 5.4 AccessLint

AccessLint documents checks during development, inline pull-request review, and production journey monitoring. Its site lists connections to Playwright, Vitest, and Storybook and AI-powered browser guidance. [AccessLint](https://www.accesslint.com/)

**Implication:** Smaller developer-focused products also compete across the lifecycle. A large feature list will not independently establish a strong position.

### 5.5 Existing tools combined by the customer

Playwright with accessibility checks and Storybook's accessibility addon let teams evaluate pages or component states in their existing testing workflows. Storybook documents highlighted findings and configurable CI failures. [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), [Storybook accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing)

**Implication:** The alternative purchase decision includes keeping existing tools and improving team process. Accessly must create enough additional value to justify its adoption and cost.

### 5.6 Human evaluation and accessibility services

Manual review and inclusive user testing address needs that automation cannot fully resolve. They are complementary to Accessly and can also compete for the same budget. The product should make specialist judgment easier to apply and preserve, rather than imply it can replace every evaluation activity.

### 5.7 Proposed positioning

**Accessly helps teams reproduce accessibility failures in real user journeys, identify their likely source, review context-aware remedies, and preserve the tested behavior through regression checks.**

The product should compete on the following outcomes:

- Less time from a finding to a reproducible, correctly assigned task.
- More accurate attribution to the responsible source or shared component.
- Recommendations that account for the affected task and surrounding behavior.
- Verification evidence that clearly states what passed and what remains unknown.
- Fewer recurring barriers and fewer duplicate investigations.
- Honest, understandable coverage reporting.

These are intended advantages to validate, not established claims about competitors lacking those capabilities.

## 6 Customers and users

### 6.1 Primary customer hypothesis

The strongest initial customer hypothesis is a team maintaining an interactive web application, releasing changes frequently, and experiencing recurring accessibility remediation work. Existing testing practices and an identifiable owner for product quality may make adoption easier.

This is a segmentation hypothesis. Company size, industry, preferred workflow, and budget ownership require validation.

### 6.2 User roles

| Role | Main need | Successful experience |
| --- | --- | --- |
| Frontend developer | Understand, locate, and resolve a failure | Can reproduce the issue and assess the remedy without reconstructing the report |
| QA professional | Exercise important states and communicate reliable findings | Can show precisely where a journey fails and replay it later |
| Accessibility specialist | Apply judgment and evaluate complex barriers | Can review evidence, correct assumptions, and preserve decisions |
| Designer | Understand interaction and visual barriers | Can connect findings to design intent and shared patterns |
| Design system owner | Address repeated problems at their common source | Can see affected usages and verify representative contexts |
| Engineering or quality leader | Manage ownership, progress, and release risk | Can distinguish new barriers, old backlog, and coverage gaps |
| Product manager | Understand task impact and remediation tradeoffs | Can prioritize user-blocking work with evidence |
| Workspace administrator | Control membership, settings, access, and data handling | Can govern use without reviewing every finding |
| External reviewer | Evaluate an explicitly shared scope | Can inspect permitted evidence and record conclusions |

People with disabilities are essential beneficiaries and potential evaluators of the product. They are not assumed to be the purchasing customer, nor should their experience be represented entirely by automated simulations.

### 6.3 Buying and adoption roles

The everyday user may discover Accessly, while an engineering, quality, or accessibility leader approves adoption. Administration and procurement may involve different people. The product must communicate individual productivity benefits and team-level evidence without assuming one person fills all roles.

### 6.4 Secondary customer hypotheses

- Agencies responsible for multiple client applications.
- Accessibility teams coordinating remediation across product groups.
- Organizations maintaining shared component libraries.
- Product companies facing accessibility requirements in procurement or customer contracts.
- Public-service application teams with recurring assessment obligations.

An agency must be able to separate client access and evidence. A central accessibility team must be able to preserve project ownership while viewing organization-wide patterns.

## 7 Jobs to be done and desired outcomes

| Situation | Job the user needs to accomplish | Desired outcome |
| --- | --- | --- |
| A new feature changes a critical flow | Find barriers before people encounter them | Important states are evaluated before release |
| A report arrives from another person | Understand and reproduce the failure | A reliable starting point for remediation |
| Many findings look similar | Identify whether they share a cause | One well-scoped remedy can address repeated instances |
| The user lacks accessibility expertise | Understand the expected experience | A practical decision with visible assumptions |
| A proposed remedy is ready | Check the original failure and nearby behavior | Evidence supports a scoped resolution |
| An application already has a large backlog | Prevent additional harm while addressing existing work | New regressions remain visible without disguising the backlog |
| A leader asks whether accessibility improved | Explain progress and remaining exposure | Comparable evidence rather than an unexplained score |
| An evaluator finds a problem automation missed | Preserve it in the team's workflow | Human findings receive ownership, follow-up, and appropriate retesting |

The most important outcome is sustainable removal of barriers in meaningful tasks. Productivity improvements are valuable when they contribute to that outcome.

## 8 Product principles

### 8.1 Start with user impact

Explain the task a person is trying to complete and the observed barrier before presenting standards terminology. A technical rule name alone is not a sufficient explanation.

### 8.2 Every actionable claim needs evidence

Attach findings to the state, environment, and observation supporting them. Distinguish an observed fact from an inferred cause or suggested remedy.

### 8.3 Treat state and transition as part of the experience

Opening a menu, submitting a form, moving focus, and closing a dialog are meaningful behavior. Coverage must account for relevant interactions as well as visible content.

### 8.4 Preserve uncertainty

An unknown source location, incomplete journey, or inconclusive test is useful information. The product must show it directly instead of inventing certainty or silently omitting it.

### 8.5 Human judgment remains valuable

Provide expert review and inclusive evaluation paths. AI and automation should reduce repetitive effort and help users make informed decisions.

### 8.6 Fit existing work

Make findings and evidence usable where teams already investigate, review, assign, and release work. Connections should preserve context and ownership.

### 8.7 Measure outcomes honestly

Explain the scope of every comparison. Fewer findings may result from reduced coverage, hidden evidence, or changed checks; it does not necessarily mean improvement.

### 8.8 The product must be accessible

All essential Accessly workflows must be usable with keyboard navigation, assistive technology, and accessible alternatives to visual evidence.

## 9 Scope and boundaries

### 9.1 Included in the product concept

- Web pages and web applications in explicitly authorized environments.
- Public and authenticated experiences where access has been provided.
- Initial page states, supported interactive states, and defined user journeys.
- Automated findings, contextual candidates, manual observations, and assisted reviews.
- Evidence collection, reproduction, source attribution, remediation guidance, and verification.
- Ownership, collaboration, baselines, release checks, reporting, and regression monitoring.
- Component-level patterns and their behavior in application contexts.
- Privacy controls, access management, data handling, and transparent coverage reporting.

### 9.2 Outside the current product definition

- Native mobile application evaluation; mobile web remains within the web concept.
- Complete evaluation of downloadable documents, email, video production, or other non-web assets.
- Legal advice, legal certification, or guarantees against litigation.
- A claim that automation proves complete WCAG conformance.
- Automatic public statements or formal conformance reports presented as independently certified.
- Modifying a production application without the authorized user's review and applicable controls.
- General application security testing, performance testing, or functional quality management beyond checks needed to assess accessibility work.
- A general-purpose project management or design authoring platform.

Linked or embedded content outside the supported scope must be identified as a boundary where relevant. Being excluded does not mean it has no accessibility obligations.

### 9.3 Scope that requires explicit support declarations

Browser combinations, embedded third-party content, restricted areas, complex visual content, supported application environments, localization, and assistive-technology observations must have clear support statements. A feature may be part of the vision without being available in every context.

The product should maintain an understandable support and limitation reference. It must not silently imply universal support.

## 10 Product concepts and vocabulary

These are user-facing concepts, not a technical data model.

| Concept | Product meaning |
| --- | --- |
| Organization or workspace | A governed space for people, applications, policies, and evidence |
| Application or project | A web product being assessed and improved |
| Environment | A particular place or version of the application, such as a preview or live service |
| Test identity | An authorized user role or account context used during evaluation |
| Page | A location in the application; it may contain multiple meaningful states |
| UI state | A meaningful arrangement of content and interaction conditions |
| Transition | A user action or application event that changes state or behavior |
| Journey | A named task comprising steps, preconditions, and expected outcomes |
| Run | One evaluation attempt against a defined scope and context |
| Check | A particular automated or assisted evaluation activity |
| Finding | A tracked accessibility concern with evidence and review history |
| Occurrence | A specific observation of a finding in a page, state, or context |
| Related group | Findings or occurrences linked by a suspected or confirmed common cause |
| Evidence | Material supporting an observation or review conclusion |
| Recommendation | A proposed remedy with assumptions and validation needs |
| Verification | A scoped evaluation of whether the relevant failure is resolved |
| Baseline | A named comparison point for deciding what changed |
| Regression | A previously resolved or accepted protected behavior that fails again in comparable conditions |
| Review task | A human judgment or assistive-technology assessment still needed |
| Exception | A documented, bounded decision to defer or accept a known concern |
| Release policy | A team's rule for whether findings or missing evidence require attention before release |

A finding, its occurrences, and its suspected cause must remain distinguishable. A single cause may affect many places, and visually similar occurrences may have different causes.

## 11 End to end customer journeys

### 11.1 Establish an application and run the first assessment

**Trigger:** A team wants an initial view of accessibility barriers in an application.

The user identifies the application and environment, confirms authorization, chooses an initial scope, and provides any required access context. Accessly explains the proposed evaluation boundaries and lets the user identify important journeys. The user can begin with a page-level assessment while broader coverage remains visible as unconfigured or untested.

The run presents progress and access failures separately from accessibility results. The first report explains the assessed scope, the most important findings, the evidence available, and the next useful actions. A user can open a finding and move directly into reproduction or assignment.

**Successful outcome:** The user understands both a concrete barrier and the limits of the initial assessment.

### 11.2 Investigate and resolve an interactive failure

**Trigger:** A finding appears only after a particular interaction.

The user opens the finding, sees the affected journey and exact state, reviews the observed and expected behavior, and follows or replays the reproduction steps. Accessly shows likely ownership and source attribution when available, including uncertainty.

The user reviews recommendations, selects an approach, and records that a remedy is ready to evaluate. Verification checks the original failure and relevant adjacent behavior. If a required human review remains, the finding stays awaiting that review. A resolved finding retains its evidence and the protection needed to detect recurrence.

**Successful outcome:** Resolution is supported by an appropriate, clearly scoped verification record.

### 11.3 Address a shared pattern across the application

**Trigger:** Many occurrences appear to originate from the same component or interaction pattern.

The user opens a related group and reviews why the items were linked. The product shows affected contexts and separates confirmed shared responsibility from a hypothesis. An owner can coordinate one remedy, but verification must account for different usages and outcomes.

If representative coverage is used, Accessly states which contexts were checked and which remain unverified. Individual occurrences can remain unresolved when the shared change does not address them.

**Successful outcome:** The team avoids duplicate investigation without falsely closing every related occurrence.

### 11.4 Prevent new barriers while managing existing work

**Trigger:** A team adopts Accessly with an existing accessibility backlog.

The team establishes a named baseline, identifies high-priority journeys, and defines what requires attention before release. Existing findings remain visible and owned. Comparable new runs distinguish new barriers, recurring failures, persistent findings, and changes in assessed scope.

A release decision reports both the policy outcome and whether required evidence was collected. If evaluation could not finish, the result is inconclusive rather than silently passing. Any waiver records who made it, why, the affected scope, and when it expires.

**Successful outcome:** New harm is controlled while existing work remains transparent.

### 11.5 Add a human or assistive technology finding

**Trigger:** An evaluator discovers a barrier outside the current automated checks.

The evaluator records the task, observation, environment, reproduction conditions, and relevant evidence. The finding enters the same ownership and discussion workflow as automated concerns, while retaining its human origin.

Accessly can suggest related automated checks, but it does not downgrade the finding because a scanner passes. Closure requires the review method appropriate to the original barrier or a documented equivalent accepted by an authorized reviewer.

**Successful outcome:** Valuable human evidence becomes durable team knowledge.

### 11.6 Understand release readiness and communicate progress

**Trigger:** A leader needs to know whether a release introduces new barriers or whether a program is improving.

The leader sees critical journeys, new and reopened findings, outstanding reviews, exceptions, and coverage gaps. Comparisons indicate changes in scope and evaluation settings. An export preserves those qualifications and can be shared with authorized stakeholders.

**Successful outcome:** Decisions rest on comparable evidence and known limitations.

### 11.7 Monitor a protected live journey

**Trigger:** A team wants to detect a barrier that returns after deployment or through third-party changes.

The team selects an authorized journey, permitted actions, evaluation context, and notification rules. A meaningful change generates an alert with evidence. A failed login, unavailable page, or blocked step generates an operational attention item rather than a false claim that the journey is accessible.

**Successful outcome:** Monitoring detects relevant changes without repeatedly notifying users about unchanged conditions.

### 11.8 Transfer responsibility or leave the product

**Trigger:** A team member departs, a client engagement ends, or an organization stops using Accessly.

Owners can reassign findings and journeys, revoke access, and export permitted records with evidence context intact. Retention and deletion choices explain consequences. Historical actions remain attributable where permitted by the organization's data policy.

**Successful outcome:** The organization retains appropriate continuity and control over its information.

## 12 Detailed feature requirements

### F01 Workspace and application organization

**Purpose:** Keep application ownership, access, policies, and evidence understandable.

Users must be able to organize applications within a governed workspace, identify owners, distinguish environments, and navigate between projects without confusing results from different contexts. Agencies and multi-team organizations should be able to separate client or team access while allowing explicitly authorized aggregate views.

Users must be able to archive inactive projects without implying that their findings were resolved. Removing or archiving an application must explain the effect on evidence, monitoring, shared links, and retention.

**Successful experience:** A user can identify which application, environment, and team a result belongs to before acting on it.

### F02 Guided setup and evaluation scope

**Purpose:** Help a team begin with a meaningful and bounded assessment.

Accessly must guide users through application selection, authorized scope, environments, access needs, important journeys, and applicable evaluation goals. Defaults should make a useful first assessment possible without requiring expert configuration.

Users must see included and excluded areas. The product must distinguish a page-level assessment from a journey evaluation. Missing configuration should be explained in practical terms, including how it affects the interpretation of results.

**Successful experience:** The user can state what the upcoming assessment will attempt and what it will leave unknown.

### F03 Public and authenticated experience assessment

**Purpose:** Evaluate relevant experiences beyond public entry pages.

The product must support authorized evaluation of signed-out and signed-in experiences where supported access is available. Users should be able to associate journeys with the intended account role and environment without exposing credentials in normal reports.

Expired access, insufficient permissions, verification challenges, and unexpected sign-out must be visible. Results from different roles must remain distinguishable. A successful public-page scan must not imply coverage of an authenticated workflow.

**Successful experience:** An administrator journey and an ordinary customer journey cannot be confused in the report.

### F04 Automatic page accessibility checks

**Purpose:** Find supported, automatically detectable barriers efficiently.

Users must be able to assess selected pages and permitted groups of pages. Findings should include the observed state, affected elements, practical explanation, relevant standard where applicable, and evidence.

Examples of intended categories include accessible names, form labels, contrast, image alternatives, structure, and semantic consistency. These examples do not imply that every instance can be conclusively evaluated automatically. Results must distinguish detected problems, uncertain observations, and checks that could not be completed.

**Successful experience:** A user can understand why a result was reported and which assessment scope produced it.

### F05 Interactive state assessment

**Purpose:** Evaluate barriers revealed by meaningful interactions.

The product must associate findings with states such as open menus, expanded sections, active tabs, dialogs, validation errors, loading outcomes, and dynamically updated content where supported. It must distinguish checking the visible state from evaluating how the user reached or left it.

If a state changes too quickly, cannot be reached, or cannot be assessed reliably, the run must state the limitation. Similar-looking states with different access conditions or meaningful behavior must not be silently treated as equivalent.

**Successful experience:** A failure in an open dialog can be traced to that state and its triggering action.

### F06 Named user journeys

**Purpose:** Organize accessibility work around tasks people need to complete.

Users must be able to define and name journeys such as registration, account recovery, checkout, application submission, or account settings. A journey must describe its goal, preconditions, steps, important checkpoints, expected outcome, and authorized action boundaries.

Journeys should support meaningful variations such as invalid input, empty results, cancellation, and different user roles. The product must show which variations were evaluated and where an attempt stopped.

**Successful experience:** The team can answer whether a specific task was evaluated, under which conditions, and with what outcome.

### F07 Assisted state and journey discovery

**Purpose:** Help users notice meaningful assessment gaps.

Accessly should suggest unreviewed states or journey variations based on the authorized experience. Suggestions must be reviewable, and the product must explain why a candidate matters. Exploration must obey the scope and permitted action boundaries chosen by the user.

Discovery must not claim to enumerate every possible state. Unvisited roles, branches, localized experiences, or restricted content remain visible gaps. Consequential actions require the product controls described in the responsible operation rules.

**Successful experience:** A suggestion helps the team add a missing task or state without creating false confidence in exhaustive coverage.

### F08 Keyboard and focus behavior evaluation

**Purpose:** Identify barriers in supported keyboard interactions.

The product should evaluate meaningful behavior such as reaching controls, activating them, entering and leaving dialogs, moving within supported widgets, and maintaining understandable focus. It must attach the action sequence and observed focus behavior to findings.

Automated observations must be separated from contextual judgments about whether the overall interaction is understandable. A successful mouse-driven journey does not establish keyboard accessibility. Pattern guidance must be identified as guidance unless the evidence also establishes a particular standards failure.

**Successful experience:** The report explains where keyboard interaction stopped working or became confusing, rather than merely identifying a focusable element.

### F09 Contextual and visual review assistance

**Purpose:** Support checks that require more context than a simple rule.

Accessly should help users review matters such as meaningful alternatives, descriptive control names, visible information relationships, focus visibility, responsive presentation, and understandable feedback. The product must identify the basis of each result: deterministic observation, contextual inference, or human review.

An inferred issue must state why it is suspected and what would confirm or reject it. Presentation changes must be tied to the viewport, zoom, language, or other conditions actually assessed.

**Successful experience:** The user receives a useful review prompt without being told that an uncertain conclusion is proven.

### F10 Plain language finding explanations

**Purpose:** Make a finding actionable without requiring specialist knowledge.

Each finding must explain the observed behavior, expected accessible outcome, affected task, potentially affected interaction methods, and why the issue matters. Standards terminology should be available without overwhelming the main explanation.

The explanation must distinguish supporting evidence from inferred impact. Generic educational text may supplement a finding, but it must not substitute for the specific observation. Users should be able to move from a brief explanation to more detailed context.

**Successful experience:** A developer or QA professional can explain the barrier to a teammate in ordinary language.

### F11 Visual highlighting and evidence inspection

**Purpose:** Make the reported element and state easy to locate.

The product must associate findings with available screenshots, highlighted elements, state descriptions, action histories, and relevant observations. Evidence must indicate when it was captured and the application context it represents.

Every essential visual explanation must have a usable nonvisual counterpart. Evidence must be governed by privacy controls. When an element or page has changed since capture, the product must distinguish historical evidence from the current experience.

**Successful experience:** A user can identify the reported control without relying exclusively on a screenshot.

### F12 Reproduction steps and journey replay

**Purpose:** Reduce repeated investigation and ambiguous handoffs.

Findings must include the available starting conditions, user role, page or journey, actions, inputs described safely, expected result, and actual result. Users should be able to replay supported steps or follow clear manual instructions.

Replay outcomes must distinguish reproduced, not reproduced under stated conditions, blocked, and inconclusive. A non-reproduction must preserve the original evidence and explain differences in context where known. Sensitive values must not appear in ordinary instructions.

**Successful experience:** Another authorized teammate can attempt the same behavior and understand the result.

### F13 Likely source and ownership identification

**Purpose:** Help teams reach the place and person most likely responsible.

Where permitted context is available, Accessly should identify the likely source location, component, shared pattern, or responsible team. The product must distinguish an exact supported attribution from a likely association and from unavailable information.

Attribution should account for shared components and their usage where evidence permits. It must not invent a location when information is insufficient. Source attribution may be unavailable while the finding, evidence, and reproduction remain useful.

**Successful experience:** The user receives a credible investigation starting point with its limitations visible.

### F14 Duplicate and shared cause grouping

**Purpose:** Reduce repeated work while preserving scope and differences.

Accessly must help users group repeated occurrences and related findings. Groups must explain their basis and allow review, correction, separation, and reassignment. A suspected common cause must be labeled accordingly.

The product must show both grouped work and affected occurrences so counts remain understandable. Closing a group must not silently verify every related context. Different symptoms or causes must remain separable even when the affected controls look similar.

**Successful experience:** A shared issue can be coordinated once while each affected context retains a truthful outcome.

### F15 Impact and priority assistance

**Purpose:** Help teams address consequential barriers first.

Findings must show severity, evidence confidence, affected tasks, and relevant context as separate concepts. Priority recommendations should account for task importance, breadth of impact, repeat occurrence, and release context.

Users must be able to adjust business priority with a reason while preserving the observed accessibility impact. Effort estimates, if offered, must be identified as estimates. A frequent cosmetic concern must not automatically outrank a less frequent task blocker.

**Successful experience:** The team understands why an issue deserves attention and can explain any override.

### F16 AI assisted recommendations

**Purpose:** Reduce the research and interpretation effort required to choose a remedy.

Recommendations must describe the intended accessible outcome, the proposed change in product terms, assumptions, relevant evidence, and how to evaluate the result. Alternatives should be offered when several reasonable remedies exist.

AI must not fabricate missing intent or treat its own recommendation as verification. Users must be able to reject, revise, or request a more detailed explanation. The product must preserve ordinary finding and review workflows when AI assistance is disabled or unavailable.

**Successful experience:** The user can judge a recommendation and its tradeoffs before acting.

### F17 Review of proposed remedies

**Purpose:** Keep users informed and responsible for consequential changes.

The product must present the scope and expected effect of a proposed remedy before the user authorizes it through supported workflows. It should show affected contexts, known tradeoffs, and required review conditions.

Recommendations that change shared behavior, wording, branding, or business meaning need appropriate human review. Acceptance means the user approved a proposal; it does not mean the underlying finding is resolved. Rejected proposals should retain useful feedback without erasing the finding.

**Successful experience:** The user understands what they are accepting and what still needs verification.

### F18 Fix verification

**Purpose:** Establish evidence that the reported barrier has been addressed within a defined scope.

Verification must identify the original failure, selected evaluation method, environment, relevant journey and state, and outcome. The product should retest adjacent behavior when it is material to the remedy.

Results must distinguish passed checks, continuing failures, incomplete evaluation, and outstanding human review. Removal of the affected element must be assessed in context: removing a required capability is not automatically a valid fix. A successful rescan alone must not close a human finding that requires a different method.

**Successful experience:** Resolution communicates what was verified, by whom or by which method, and what remains outside the evidence.

### F19 Finding assignment and collaboration

**Purpose:** Give every meaningful issue a path to a decision.

Users must be able to assign owners, set priority, discuss findings, link related work, request review, and record decisions. Discussions must stay attached to the relevant finding, occurrence, or verification record.

Teams should be able to save views for their responsibilities and identify unowned or blocked work. Activity history must show meaningful changes, especially severity overrides, scope changes, exceptions, and resolution decisions.

**Successful experience:** A finding can move between QA, engineering, design, and accessibility review without losing its context.

### F20 Manual findings and assisted review

**Purpose:** Preserve human judgment within the same product workflow.

Users must be able to add findings, complete guided checks, record assistive-technology observations, and attach the conditions of the evaluation. The product should explain how to perform a review in approachable terms while acknowledging when specialist help is appropriate.

Automated checks may supplement manual findings, but must not overwrite the original conclusion without a recorded review. Accessibility-tree observations or simulated experiences must not be labeled as actual screen-reader testing.

**Successful experience:** A barrier discovered by a person remains visible, actionable, and verifiable on its own terms.

### F21 Baselines and comparable change detection

**Purpose:** Distinguish existing work from meaningful changes.

Teams must be able to choose and name comparison baselines. New results should distinguish new findings, persistent findings, reopened failures, verified resolutions, and findings that cannot be compared because their context was not evaluated.

The product must expose changes in scope, identities, environments, evaluation settings, and assessment methods that could affect the comparison. Establishing a baseline does not resolve its findings. Resetting one must preserve history and explain the effect on future comparisons.

**Successful experience:** The team understands what changed without losing sight of its existing backlog.

### F22 Regression protection and release checks

**Purpose:** Keep resolved behavior from silently deteriorating.

Teams must be able to protect named journeys or behaviors and define policies for new or recurring findings. Results should distinguish policy pass, attention required, and inconclusive evaluation. The policy outcome must be separate from a complete accessibility claim.

Required journeys that fail to run must remain visible. Waivers need accountable ownership, scope, reason, and review or expiry conditions. The system should avoid repeatedly interrupting users about unchanged acknowledged findings.

**Successful experience:** A release decision has an understandable reason and preserves evidence of any exception.

### F23 Scheduled monitoring and actionable notifications

**Purpose:** Detect meaningful changes after the initial assessment.

Users should be able to monitor approved pages and journeys, choose responsible recipients, and control notification preferences. Alerts must explain what changed, its impact, the affected context, and the useful next action.

Repeated unchanged findings should be grouped or suppressed according to user preferences. Monitoring interruption, expired access, and assessment failure are distinct from newly detected barriers. Consequential actions remain bounded even during unattended evaluations.

**Successful experience:** Notifications are timely, relevant, and attached to actionable evidence.

### F24 Coverage and limitation reporting

**Purpose:** Make the limits of evaluation visible alongside its results.

The product must show intended scope, reached scope, completed checks, human reviews, blocked steps, exclusions, and unsupported areas. Coverage should be expressed through known pages, states, journeys, roles, and conditions rather than an unexplained percentage of accessibility.

When a denominator is unknown, the product must say so. A completed run may still have incomplete coverage. Finding count and coverage must remain separately visible in dashboards, comparisons, exports, and release decisions.

**Successful experience:** The user can identify the next important unassessed area without interpreting silence as success.

### F25 Shared component and design pattern insights

**Purpose:** Help teams improve reusable experiences and understand their reach.

Where a shared pattern is identified, Accessly should show related occurrences, responsible ownership, affected journeys, and variations in usage. The product should help teams distinguish a problem in a shared component from a problem introduced by its surrounding context.

A component passing evaluation in isolation does not establish that all application usages are accessible. The product must preserve contextual findings and identify which usages have been verified after a shared remedy.

**Successful experience:** A design system team can coordinate broad improvements without obscuring local exceptions.

### F26 Reporting and progress tracking

**Purpose:** Communicate work completed, remaining barriers, and confidence in the evidence.

Reports must support views by application, owner, severity, journey, standard, lifecycle state, and time where appropriate. They must distinguish findings from occurrences, resolved items from accepted exceptions, and genuine improvement from scope changes.

Exports must retain dates, scope, evaluation methods, significant limitations, and relevant review history. Summary reports should be understandable to non-specialists and allow access to permitted supporting evidence.

**Successful experience:** A stakeholder can explain progress without relying on a misleading all-purpose score.

### F27 Workflow connections and evidence sharing

**Purpose:** Make accessibility work usable in existing review and coordination practices.

The product should connect findings to issue tracking, development review, release assessment, and authorized AI-assisted workflows. A handoff should preserve impact, reproduction, evidence, ownership, source confidence, and verification status.

Connections must show whether information is current and whether a transfer failed. Closing an external work item must not automatically imply verified resolution. Sharing must respect project access and evidence sensitivity, with revocable access where supported.

Specific providers and compatibility commitments remain open product decisions.

**Successful experience:** Teams can act on a finding outside Accessly without losing the meaning of its status.

### F28 Administration and product controls

**Purpose:** Let an organization govern use consistently.

Authorized administrators must be able to manage membership, application access, permitted connections, evaluation preferences, AI availability, retention choices, and organization-level policies. Sensitive actions and policy changes must be attributable.

Project-specific choices may refine organizational policy within permitted bounds. The product must explain which settings apply and why a user cannot change a controlled option. Removing a user's access must remove their ability to access protected evidence.

**Successful experience:** Governance is visible and predictable without burdening every ordinary investigation.

### F29 Search and knowledge reuse

**Purpose:** Help teams find existing evidence and avoid rediscovering decisions.

Users should be able to search findings, journeys, applications, component groups, and reviewed recommendations within their permissions. Filters must preserve the distinction between current results and historical records.

Resolved findings should be reusable as precedents, with their original context and current relevance visible. A past remedy should not be presented as universally appropriate for a superficially similar problem.

**Successful experience:** A user can locate a prior decision and understand when it applies.

### F30 Contextual education and help

**Purpose:** Build user understanding through the work they are already doing.

The product should provide short explanations of accessibility concepts, standard references, evaluation limitations, and recommended next steps in context. Users should be able to explore more detail without being required to complete training before acting on common findings.

Help must explain uncertainty and exceptions, including why a scanner can pass while an evaluator still identifies a barrier. Content should be written for the user's task and expertise level.

**Successful experience:** The user becomes more capable while resolving actual problems.

## 13 Product spaces and information experience

This section describes the information and decisions users need from the product. It does not prescribe a visual layout or navigation implementation.

### 13.1 Workspace overview

The overview should answer which applications need attention, where important journeys are failing or untested, which work lacks an owner, and whether meaningful conditions changed. It should prioritize actionable information over a large count of detected issues.

Users with responsibility for one application should not need to interpret organization-wide reporting to start work. Users with broader responsibility should be able to compare applications without combining incompatible scopes into a misleading ranking.

### 13.2 Application overview

The application view should show its environments, owners, most important journeys, recent runs, major open barriers, coverage gaps, and next useful actions. The date and scope of the latest meaningful assessment must be visible.

An application with no completed assessment should show an informative setup state. An application with no detected findings should show the assessed scope and remaining review needs. Neither state should use an unsupported claim that the application is fully accessible.

### 13.3 Run results

The run view should communicate the requested scope, progress or completion status, reached pages and states, findings, review tasks, blocked steps, exclusions, and changes from the selected comparison point.

Users must be able to tell whether evaluation completed but found barriers, partially completed, or failed before useful assessment. Errors must offer a practical next step such as restoring access, revising scope, or retrying a particular journey.

### 13.4 Finding workspace

The finding workspace should bring together impact, evidence, reproduction, attribution, ownership, discussion, recommendations, verification, and history. Users should not have to reconstruct the story from unrelated records.

The initial view should answer what the barrier is and why it matters. Detailed observations and expert references should remain available. Any stale evidence, low-confidence attribution, outstanding review, or active exception must be visible at the point of decision.

### 13.5 Journey workspace

The journey workspace should show the user's goal, authorized context, preconditions, steps, expected outcomes, variations, last evaluation, known barriers, and protection status. A user should be able to identify untested or blocked steps before running the journey again.

Changes to a journey should indicate whether historical comparisons remain meaningful. A renamed journey can preserve continuity; a changed task goal may require a different comparison interpretation.

### 13.6 Related groups and shared patterns

The grouping experience should show what items share, why they were grouped, whether the cause is confirmed, and which contexts differ. It must support representative review while preserving visibility of unverified usages.

### 13.7 Human review queue

Reviewers should see what requires judgment, why automation is insufficient, the skills or interaction methods relevant to the review, and the evidence already available. Each task should have a clear outcome that can be recorded without pretending that an uncertain result is a pass.

### 13.8 Progress and release reporting

This space should explain trends, outstanding task blockers, recurring failures, changes in coverage, exceptions, and release policy outcomes. Managers should be able to inspect the evidence behind a summary without needing access to unrelated sensitive content.

### 13.9 Settings and governance

Settings should make applicable policies, permissions, data choices, evaluation goals, notification preferences, and connection status understandable. Defaults, inherited policies, and project-specific overrides must be distinguishable.

### 13.10 Essential experience states

Across product spaces, Accessly must provide clear states for first use, active progress, completed work, partial results, access denial, unavailable connections, stale evidence, unsupported evaluation, empty searches, and recovery after interruption.

Each state should explain what is known, what the user can do next, and whether existing results are still useful.

## 14 Finding lifecycle and verification rules

### 14.1 Keep separate questions separate

A finding has several independent dimensions:

- **Origin:** How the observation was obtained, such as an automated check, AI-assisted review, or human evaluation.
- **Evidence assessment:** Whether the barrier is established, suspected, disputed, or inconclusive.
- **Work state:** What the team is doing about it.
- **Verification outcome:** What has been evaluated after a remedy.
- **Exception state:** Whether a bounded decision allows the concern to remain temporarily.
- **Current applicability:** Whether the affected experience is still within active scope.

These must not be compressed into one ambiguous label. A high-confidence automated finding may be deferred. A suspected contextual concern may be under investigation. A manually established barrier may still be unresolved after an automated check passes.

### 14.2 Work states

| Work state | Meaning | Necessary product behavior |
| --- | --- | --- |
| New | The finding has not been triaged | Show its origin, evidence, and proposed next action |
| Under review | Someone is validating or interpreting it | Preserve the original observation and record review decisions |
| Open | The team accepts that action or further evaluation is needed | Identify ownership or show that ownership is missing |
| In progress | Remediation is underway | Preserve linked work and discussion |
| Ready for verification | A remedy is available to assess | Identify the environment or version containing it |
| Verification in progress | Relevant checks or reviews are underway | Show scope and outstanding evaluation |
| Resolved | Appropriate evidence supports resolution of the scoped finding | Retain method, context, outcome, and any required human decision |
| Reopened | Comparable evidence shows a resolved barrier again | Link the recurrence to prior resolution and current evidence |
| Closed after review | An authorized review determined that remediation is not applicable | Record a specific reason such as false positive or retired functionality |

Closed after review and resolved must remain distinguishable in reporting. A retired feature may close a concern as no longer applicable without establishing that the former experience became accessible.

### 14.3 Review outcomes

A reviewer may establish that a concern is a barrier, request more evidence, identify a false positive, identify a duplicate, dispute a proposed interpretation, or determine that the context is outside the current scope.

Merging a duplicate must preserve its evidence and relation to the retained record. Classifying a concern as outside scope must keep the exclusion visible in coverage where relevant. An inconclusive review does not establish absence of a problem.

### 14.4 Resolution requirements

A finding may be marked resolved only when the recorded verification method is appropriate to its nature and the required verification is complete. The record must identify:

- The original barrier and the context to which resolution applies.
- The remedy or changed experience being evaluated.
- The evaluation conditions and date.
- Completed checks and their outcomes.
- Any required human or assistive-technology review.
- The actor or accepted process responsible for the conclusion.
- Remaining limitations and related work that was not covered.

For grouped findings, resolution applies only to occurrences supported by evidence. Representative sampling must identify its limits and must not silently imply that every usage was evaluated.

### 14.5 Exceptions and accepted risk

An exception is a separate decision allowing a known concern to remain for a defined purpose or period. It must record the accountable owner, reason, scope, authority, review conditions, and expiry or review date.

An exception may change how a release policy treats a concern. It must not change the underlying observation into a pass or increase the number of verified resolutions. Users must be able to find active and expired exceptions.

### 14.6 Suppression and dismissal

Users may hide repetitive notifications or narrow a view without changing the truth of the finding. A deliberate suppression must state its scope and reason and be reversible by an authorized user. Broad suppressions that would conceal many future findings require visible organizational governance.

A false-positive decision should be bounded to the conditions and reasoning supporting it. A later materially different observation must remain eligible for review.

### 14.7 Historical integrity

Changed recommendations, owners, priorities, standards settings, or source locations must not rewrite past evidence as though it were collected under today's conditions. Historical records should explain what was known at the time and what changed later.

## 15 Coverage and comparison rules

### 15.1 Coverage is multidimensional

Accessly must describe coverage through the relevant known dimensions: pages, journeys, states, transitions, user roles, environment, application version, language, viewport or presentation conditions, evaluation method, and applicable check set.

The product does not need to test every possible combination before showing value. It must state which combinations were actually evaluated and which were not.

### 15.2 Scope categories

| Scope status | Meaning |
| --- | --- |
| Known and selected | The area is part of the requested assessment |
| Reached | The evaluation accessed the relevant area or state |
| Assessed | The specified checks or review were completed there |
| Partially assessed | Some relevant evaluation completed, with visible omissions |
| Blocked | An obstacle prevented evaluation |
| Excluded | The user or policy deliberately omitted it |
| Unsupported | The product cannot perform the requested evaluation in this context |
| Not assessed | No relevant assessment evidence exists |

An area can contain a mixture of these statuses across methods. For example, a dialog may have completed automated checks while its assistive-technology review remains not assessed.

### 15.3 Coverage denominators

Percentages may be shown only when the denominator is explicit and meaningful. A statement such as '8 of 10 named journeys completed the selected checks' is acceptable. A statement such as '80 percent accessible' is not an equivalent conclusion.

The total number of all possible application states is often unknown. Accessly must not manufacture that denominator. Discovery progress must be tied to the known selected scope, with undiscovered areas acknowledged.

### 15.4 Valid comparisons

Comparisons must indicate whether scope, methods, environment, access role, and application conditions are sufficiently similar. Material differences should be disclosed before an improvement claim is presented.

A finding absent from a run can mean several things: it was resolved, the affected state was not reached, the check changed, the feature was retired, or the evidence is insufficient. The product must avoid choosing 'resolved' merely because an item was not observed again.

### 15.5 New findings versus new barriers

The first time Accessly detects a concern is not necessarily the time the barrier was introduced. A newly added check or expanded journey may expose older problems. Reports should distinguish newly observed findings from evidence of newly introduced regressions where that distinction can be supported.

### 15.6 Check and policy changes

Changes to evaluation methods, standards targets, thresholds, or grouping decisions may alter results. Such changes must be visible in comparisons and histories. Teams must be able to understand whether a report changed because the application changed or because assessment changed.

### 15.7 Partial runs

Useful partial findings should be retained with their context. A failed or interrupted run must not erase earlier valid observations, mark unreached areas as passed, or automatically resolve previously reported barriers.

## 16 Severity and prioritization

### 16.1 Severity describes impact

Accessly should use a consistent, plain-language severity scale supported by a rationale. The following is a proposed product scale, not a claim that WCAG defines severity this way.

| Severity | Proposed interpretation | Illustrative situation |
| --- | --- | --- |
| Critical | A supported interaction is prevented in a key task, with no practical accessible alternative identified in the assessed context | A required checkout step cannot be operated with a keyboard |
| High | A substantial barrier seriously disrupts or makes a task difficult | Error recovery is inaccessible and completion becomes unreliable |
| Medium | A material barrier creates friction or confusion while an effective path remains | Important relationships or descriptions require avoidable effort to understand |
| Low | A localized accessibility concern has limited observed task impact | A restricted issue affects clarity without blocking the assessed task |

These examples are illustrative. Actual classification requires evidence and context, and must not stereotype what all users can do.

### 16.2 Confidence is different from severity

A suspected critical barrier may need urgent investigation even when the evidence is incomplete. A clearly established low-impact concern may have high detection confidence. The product must show these dimensions separately.

Source-attribution confidence, recommendation confidence, and confidence that a barrier exists are also different. One confident statement does not make all associated inferences certain.

### 16.3 Priority accounts for team context

Priority recommendations should explain the role of task importance, impact breadth, repeated occurrences, current releases, recurrence, available workarounds, dependencies, and unresolved uncertainty. A protected low-traffic task may still be essential to the people relying on it.

Effort and commercial urgency may influence scheduling but must not alter the factual impact explanation. Teams should see when priority was changed manually and why.

### 16.4 Group priority

A shared pattern can increase the reach of a remedy. Group views should show the most consequential affected contexts and the breadth of verified impact, without multiplying urgency simply because one check generated many duplicate observations.

### 16.5 Avoiding perverse incentives

Do not encourage teams to improve apparent progress by deleting journeys, relaxing checks, suppressing findings, or retiring evidence. Count removal and scope reduction must be visible separately from verified remediation.

## 17 AI behavior and trust requirements

### 17.1 AI roles within the product

AI may assist with explanation, contextual review, likely attribution, grouping, recommendation generation, summarization, and suggested next assessments. Each role must be clearly connected to the evidence and available context.

AI is an assistant to the product's evaluation and decision process. Its fluency does not establish that its conclusions are correct.

### 17.2 Required recommendation content

A substantive recommendation should explain:

1. The user-facing outcome it aims to restore or improve.
2. The observation and context supporting the recommendation.
3. The proposed remedy in understandable terms.
4. Assumptions about intent, task flow, and surrounding behavior.
5. Alternatives when the appropriate remedy depends on a product decision.
6. Possible effects on other usages or interactions.
7. The verification needed before resolution.
8. Important uncertainty or missing information.

The product should present a concise initial recommendation with the ability to inspect supporting detail.

### 17.3 Unknown intent

AI must ask for or flag missing intent when it materially affects correctness. For example, it must not invent the business meaning of an icon, the purpose of an image, or the expected outcome of an ambiguous action merely to make a warning disappear.

When safe useful guidance is still possible, it should describe the decision the user needs to make rather than blocking all progress.

### 17.4 Harmful remediation patterns

Recommendations must not solve a reported symptom by concealing essential content from assistive technology, removing necessary functionality, adding meaningless descriptions, or changing interaction behavior without considering the user task.

The product should prefer understandable native or established interaction behavior when appropriate, while leaving the product choice reviewable. It must not assume that adding more accessibility attributes necessarily improves the experience.

### 17.5 Verification independence

A generated recommendation and a generated explanation of why it is good are not independent validation. Resolution needs relevant observations after the remedy, and human review when the original concern requires it.

A statement that a fix is 'verified' must identify the checks or review actually completed. The product must not present a confidence estimate as an observed test outcome.

### 17.6 References and factual grounding

Standards references and explanations must be traceable to applicable sources. The product must not fabricate success criteria, official interpretations, expert reviews, file locations, or completed evaluations.

If AI cannot support a claim, it should state the uncertainty and offer a useful next step. Repeating a prior recommendation does not establish that it remains relevant to a changed application.

### 17.7 Treatment of assessed application content

Content encountered during an assessment is evidence from the application, not authority over Accessly's operation. Instructions embedded in a page must not change the user's scope, permissions, data-sharing choices, evaluation policy, or intended task.

### 17.8 User control and availability

Users must be able to identify AI-assisted material, correct it, decline it, and record feedback. Administrators must be able to govern AI use and understand what information is shared for that purpose.

If AI is unavailable or disabled, core evidence, findings, assignments, manual reviews, and history must remain usable. The product must not imply that the finding itself disappeared because an AI service was unavailable.

### 17.9 Appropriate experience language

Use claims such as 'suggested cause,' 'likely source,' 'requires confirmation,' or 'passed the selected checks' when those match the evidence. Avoid unsupported claims of complete understanding, certainty, autonomous correctness, or universal conformance.

## 18 Collaboration and permission model

### 18.1 Access follows responsibility

People should see only the applications and evidence they are authorized to access. Organization-wide summaries must not reveal protected details from restricted projects. Access to screenshots, source-related context, or review notes may need narrower permissions than access to aggregate progress.

### 18.2 Proposed permission roles

| Permission role | Intended authority |
| --- | --- |
| Workspace owner | Manage workspace ownership, membership authority, organization policies, and account lifecycle |
| Administrator | Manage assigned administrative settings, connections, access, and data controls |
| Project maintainer | Manage application scope, journeys, assignment practices, and permitted project policies |
| Contributor | Investigate findings, propose remedies, discuss work, and request verification within assigned access |
| Reviewer | Record assessment and verification decisions within granted authority |
| Viewer | Read permitted results and reports without changing evaluation decisions |
| Guest reviewer | Review a specifically shared scope with bounded access |

These are product permission concepts. A person's professional role, such as designer or developer, does not automatically determine their permissions. Organizations should be able to combine appropriate responsibilities.

### 18.3 Sensitive decisions

Accessly must distinguish permission to suggest an action from permission to approve it. Scope expansion, high-impact exploration, broad suppression, exceptions, release overrides, external sharing, data deletion, and organization policy changes require appropriate authority.

Routine assessment within already authorized boundaries should not repeatedly interrupt users with unnecessary permission requests. Approval should correspond to a material decision, not every harmless step.

### 18.4 Review separation

Organizations may require a different reviewer for particular decisions, such as accepting a critical exception or closing a human-validated task blocker. The applicable requirement must be visible before the user attempts closure.

### 18.5 Accountability and continuity

Owners, decisions, and material changes must remain attributable. When a person leaves, their active responsibilities should be reassigned and their access revoked without losing appropriate historical context. Unowned work must remain discoverable.

## 19 Privacy and responsible operation

### 19.1 Information users should expect the product to handle

Depending on enabled features, evaluation can involve application addresses, screenshots, visible text, interaction histories, review notes, source-related context, and authentication context. Some of this material may contain personal, confidential, or commercially sensitive information.

Before evaluation or AI assistance, users must receive an understandable explanation of the relevant information handling. The product must not imply that evidence is harmless merely because it came from a test environment.

### 19.2 Data minimization and evidence controls

Accessly must collect only information needed for authorized product behavior. It should support excluding sensitive areas and redacting sensitive content from evidence where available. Credentials and secrets must not appear in normal findings, reproduction steps, reports, or notifications.

Redaction limits must be clear. If a requested evidence control cannot be honored for a given action, the product must not silently proceed as though the control applied.

### 19.3 Access and sharing

Evidence must respect workspace and project permissions. Shared access should be explicitly granted and revocable where supported. Notification previews and exports must avoid exposing details to people who cannot view the underlying finding.

The product must make clear when exporting creates a separate copy outside the product's ongoing access controls.

### 19.4 Retention and deletion

Organizations must have understandable controls for retaining and deleting evidence and project records, subject to their chosen plan and applicable commitments. Deletion actions must explain what is removed, what dependent records lose supporting evidence, and whether any records are retained for stated purposes.

Specific durations, backup treatment, residency options, and deletion commitments are open commercial and policy decisions. They must not be presented as existing guarantees until approved and supported.

### 19.5 AI information handling

The intended product policy is that customer content is not used to train general models by default. Any optional use beyond providing the requested service requires explicit, informed agreement. This is a proposed requirement, not a statement about an existing Accessly service.

Organizations must understand which context AI assistance uses and be able to restrict it. Disabled AI must not prevent access to existing authorized evidence.

### 19.6 Consequential actions during evaluation

Users must be able to define whether a journey may create accounts, submit forms, send messages, place orders, change settings, or delete information. Read-only exploration and harmless navigation should be easy within authorized scope.

Unattended evaluation must respect approved boundaries. A journey must stop or request appropriate authorization before exceeding them. A blocked consequential step must be reported as a coverage limitation rather than a successful task completion.

### 19.7 Ownership and connected accounts

The person or organization requesting assessment must have authority over the selected scope. Connected access must be revocable. Expired or removed authorization must not be bypassed through alternate credentials or contexts without new valid authority.

### 19.8 Sensitive customer segments

Teams handling health, financial, public-service, or other sensitive experiences may have additional requirements. Accessly must describe supported privacy and governance capabilities accurately rather than imply suitability for every regulated use case.

## 20 Standards and accessibility claims

### 20.1 Proposed standards orientation

The proposed default evaluation orientation is WCAG 2.2 at Levels A and AA, with support for clearly named alternative profiles where customers need them. This is a product choice to confirm, not a claim that a standard determines every applicable legal obligation.

Findings should identify the relevant standard and criterion when the mapping is justified. Best-practice observations should remain distinguishable from established standards failures. The product must not invent a one-to-one mapping where interpretation is contextual.

### 20.2 Conformance and task scope

WCAG's conformance requirements concern full pages and complete processes. A result about selected components or steps must therefore remain scoped to those checks and must not be presented as full-process conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### 20.3 Pattern guidance

Interaction pattern guidance can help explain expected behavior. For example, W3C's modal dialog pattern describes focus moving into the dialog, navigation remaining within it, and expected closing behavior. Pattern guidance and a formal standards failure are related but distinct judgments. [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

### 20.4 Reporting language

Acceptable report language includes:

- No automatically detectable failures were found in the assessed scope.
- The selected checks passed for the evaluated journey and conditions.
- Human review remains outstanding for the listed areas.
- The finding was verified as resolved using the recorded method.

Unsupported report language includes a blanket claim that a whole application is fully accessible, legally compliant, or certified solely because selected automated checks passed.

### 20.5 Formal assessment material

Accessly may organize evidence useful for formal assessment. If the product offers report preparation, it must distinguish evidence collection and drafting from independent certification or legal advice. Author identity, scope, review method, and approval status must remain clear.

## 21 Product quality expectations

### 21.1 Accessly must support accessible operation

All essential flows must support keyboard access, meaningful labels, clear focus, understandable errors, accessible status updates, sufficient readable contrast, and use with supported assistive technologies. Visual evidence must have alternatives. Color must not be the only way to communicate severity or outcome.

The product should account for zoom, reflow, motion preferences, and cognitive load. Its own accessibility must be evaluated with human participation as well as automated checks. The precise support reference should be published and kept current.

### 21.2 Predictable and efficient work

The product should reduce the number of separate places and repeated steps needed to understand a finding. Long-running assessments must communicate progress, known limits, and useful partial results. Users should be able to leave a run and return without losing context.

Specific numerical responsiveness or completion commitments require validation. They must not be invented in this idea document.

### 21.3 Reliable status and recovery

Work states must accurately represent current evidence. Interrupted assessments, failed connections, and unavailable context must have recoverable states. Retrying work must not create confusing duplicate findings or overwrite valid historical observations.

### 21.4 Freshness and reproducibility

Users must be able to identify the age and context of evidence. If a journey, application, or review setting changes, the product should explain whether prior evidence remains relevant. Reproduction attempts must record their own outcome rather than rewriting the original attempt.

### 21.5 Scale without obscuring meaning

Large workspaces need search, filtering, ownership views, grouping, and summaries. Aggregation must preserve important distinctions in scope, confidence, and verification. A simple page-level assessment should remain approachable even when organization-wide governance is available.

### 21.6 Consistent terminology

Use the same meaning for finding, occurrence, resolved, verified, exception, coverage, and regression across the product and exports. UI language must not turn a narrowly scoped result into a broader promise.

### 21.7 Explain limitations at the decision point

Important limitations belong alongside the relevant result or action. Users should not have to find a separate policy document to learn that a journey never reached its final step or that a proposed source location is uncertain.

## 22 Commercial concept and adoption

### 22.1 Value proposition by audience

- Individual contributors gain clearer reproduction, attribution, and guidance.
- QA teams gain repeatable journey evidence and better handoffs.
- Accessibility teams gain review visibility and preserved evaluation decisions.
- Design system owners gain insight into repeated patterns and affected usages.
- Leaders gain accountable progress, coverage visibility, and informed release decisions.

The commercial value proposition must be backed by measured outcomes rather than the number of features available.

### 22.2 Adoption concept

The product should let a user reach a useful first finding with clear scope, then invite the team to establish recurring journeys, ownership, and regression protection when that fits their needs. Existing test and review practices should be reusable where supported.

The product must avoid making its initial report appear more comprehensive than the scope warrants. Successful adoption is continued use to resolve and prevent barriers, not merely completion of a first scan.

### 22.3 Packaging hypotheses

Possible commercial packages include individual use, team collaboration, and organization governance. Potential value dimensions include assessed applications or journeys, evaluation usage, collaboration, and administrative capabilities.

Pricing amounts, billing units, free allowances, and plan boundaries remain open. Packaging must keep limitations visible and avoid hiding material risk simply because a user lacks a premium feature. Core evidence accuracy and honest results cannot depend on a higher subscription tier.

### 22.4 Customer alternatives

The buying decision may involve expanding an existing platform, combining existing tools, hiring specialist services, or changing team process. Accessly must demonstrate why its benefit exceeds switching costs, setup effort, recurring cost, and review overhead.

### 22.5 Distribution hypotheses

Likely discovery paths include developer and QA communities, accessibility practitioners, agencies, shared component teams, and existing workflow connections. These are hypotheses to investigate, not validated acquisition channels.

### 22.6 Claims that need customer validation

The product should validate which investigation steps are most painful, who owns the budget, whether users want a separate workspace or primarily connected experiences, which evidence earns trust, and whether the workflow helps enough to justify ongoing adoption.

No market-size estimate, revenue forecast, willingness-to-pay figure, or customer commitment has been established in the research.

## 23 Success measures

### 23.1 Primary outcome

The proposed primary measure is the share of confirmed barriers in selected important journeys that reach appropriate verified resolution and remain resolved in subsequent comparable assessments.

Report this with the number and nature of journeys assessed. The measure must not improve merely because the team removed coverage or reclassified findings as exceptions. Numeric targets require a real baseline and are intentionally unspecified.

### 23.2 Supporting measures

| Measure | Product question | Important qualification |
| --- | --- | --- |
| Time to first useful result | Can a new user reach an actionable understanding quickly? | A raw issue count is not sufficient |
| Reproduction success | Can another user recreate a reported barrier? | Compare relevant conditions and record blocked attempts |
| Time to correct ownership | Does attribution reduce handoffs? | Distinguish confident attribution from guesses |
| Attribution accuracy | Does the suggested source or owner prove useful? | Evaluate against reviewed outcomes |
| Time to verified resolution | Does the workflow reduce remediation effort? | Separate active effort, elapsed time, and waiting |
| Recommendation usefulness | Do reviewed suggestions help resolve the actual barrier? | Acceptance alone does not establish correctness |
| First verification success | Do proposed remedies pass appropriate checks? | State the scope and human reviews involved |
| Reopening and recurrence | Do improvements survive later changes? | Use comparable assessed behavior |
| Important journey coverage | Are selected essential tasks being evaluated? | Keep the selected scope and denominator explicit |
| Manual review completion | Are judgment-dependent concerns addressed? | Completing a checklist does not prove evaluation quality |
| Finding precision | How often are reported concerns valid under review? | Break down by origin and type |
| Known barrier detection | Does the product find established test cases? | A benchmark does not establish universal recall |
| Notification actionability | Do alerts lead to relevant action? | Avoid rewarding notification volume |
| Continuing team adoption | Do users return to resolve and prevent problems? | Distinguish useful work from passive dashboard visits |

### 23.3 Guardrails

Track false positives, missed known barriers, incorrectly closed findings, unresolved human review, coverage reductions, expired exceptions, privacy incidents, and inaccessible Accessly workflows. Productivity gains are not successful if they increase false assurance or harm the assessed experience.

### 23.4 Comparative evidence

Claims of superiority should come from comparable tasks using the same applications, known barriers, assessment scope, and evaluator expectations. Research should include correct experiences as well as broken ones so a product is not rewarded simply for reporting more concerns.

Experienced accessibility reviewers and people with disabilities should help judge whether apparent fixes improve actual task completion. Their observations should retain the conditions and limits of the evaluation.

### 23.5 Reporting integrity

Do not equate more detected issues with better quality, fewer issues with greater accessibility, accepted recommendations with correct remedies, or policy passes with complete conformance. Every success metric needs a definition that protects against these interpretations.

## 24 Illustrative product scenarios

The following scenarios are hypothetical examples of intended product behavior. They are not observed Accessly results.

### 24.1 Checkout dialog loses keyboard context

A shopper opens a shipping-address dialog. After several Tab presses, focus moves into the background page while the dialog remains active. Accessly records the opening action, subsequent focus movement, affected task, and observed state.

The finding explains the practical difficulty, provides reproducible steps, and identifies a likely shared dialog pattern if supported. It references the appropriate expected interaction behavior without automatically declaring every deviation a proven legal violation.

The proposed remedy is reviewed. Verification exercises entry, navigation, closing, and return to a meaningful place in the journey where relevant. Any outstanding assistive-technology review remains visible. The team protects the affected journey against recurrence.

### 24.2 A form passes its initial scan but fails error recovery

A registration form has ordinary labels and controls, but an invalid submission reveals error messages that a user does not reliably discover through their interaction method. The initial form state and the error state are recorded separately.

Accessly explains the actual recovery task and preserves any human observation required to establish impact. A clean assessment of the initial page cannot resolve the error-state finding. Verification must revisit invalid submission and recovery under relevant conditions.

### 24.3 A shared control produces many occurrences

Several pages contain controls with inadequate accessible names. Evidence suggests that some share a component, while others arise from different usage choices. Accessly proposes groups with clear reasons and allows an owner to correct the grouping.

After a shared remedy, the report distinguishes verified usages, remaining failures, and unassessed contexts. A single group closure cannot erase independent occurrences.

### 24.4 A clean report results from expired access

A protected account journey stops at sign-in because its authorized session expired. Accessly reports that the journey could not be assessed and preserves earlier findings as historical information.

It does not interpret the absence of current findings as improvement. A release check requiring that journey is inconclusive until the team restores access or records an authorized exception.

### 24.5 A human finding survives an automated pass

An evaluator using a screen reader identifies confusing dynamic feedback during a service application. The evaluator records their environment and the actual observation. Subsequent automated checks pass.

Accessly retains the open human finding and explains why those checks do not evaluate the original concern fully. Resolution requires an appropriate review of the changed behavior, with the review conditions recorded.

### 24.6 A contrast recommendation conflicts with design intent

Accessly identifies a contrast concern in a particular presentation state. A proposed remedy affects a shared visual choice. The recommendation explains the affected usages and asks for appropriate design review instead of assuming any visually passing change is acceptable.

Verification revisits the relevant states and checks that meaningful information and interaction remain usable. The decision and any remaining contextual concerns remain attached to the finding.

## 25 Product acceptance scenarios

These scenarios define observable product behavior. They are not a technical testing plan.

| ID | Situation | Expected product outcome |
| --- | --- | --- |
| A01 | A user assesses one public page | The report identifies that page and assessed state, without implying application-wide coverage |
| A02 | A concern appears only after a dialog opens | Evidence and reproduction identify the opening action and relevant dialog state |
| A03 | A user tests a journey only with pointer interaction | The product does not label keyboard behavior as evaluated without corresponding evidence |
| A04 | The likely source cannot be identified | The finding remains usable and source attribution is explicitly unavailable |
| A05 | Multiple possible sources are plausible | The product presents uncertainty and investigation context rather than an invented exact location |
| A06 | Several occurrences share a suspected cause | The group explains its basis and remains reviewable |
| A07 | A shared remedy passes in only some usages | Verified and unverified or failing occurrences remain distinct |
| A08 | AI lacks the intent needed for a correct alternative | It identifies the missing decision instead of inventing meaning |
| A09 | A user accepts a recommendation | The finding remains unresolved until appropriate verification completes |
| A10 | A scanner passes after a human-reported barrier | The human finding remains open unless an appropriate review supports resolution |
| A11 | A required journey stops because access expired | The result is incomplete or blocked, with a practical recovery action |
| A12 | A run never reaches a previously failing state | The old finding is not automatically marked resolved |
| A13 | A team creates a baseline containing existing findings | Those findings remain visible and are not counted as fixed |
| A14 | A previously verified behavior fails again | The recurrence links to prior evidence and is shown as reopened or regressed when comparison supports it |
| A15 | A newly added check reveals an older barrier | The product distinguishes newly observed work from a proven newly introduced regression |
| A16 | A team removes several journeys | Reporting exposes the reduction in scope rather than claiming equivalent improvement |
| A17 | A reviewer accepts a temporary exception | The concern remains visible with owner, reason, scope, and expiry or review conditions |
| A18 | An external task is closed | Accessly does not infer verification unless the necessary evidence is present |
| A19 | A user shares a report with a restricted reviewer | Only the authorized evidence is accessible, and sharing limits are clear |
| A20 | Evidence contains sensitive information | Applicable redaction or exclusion controls are honored and limitations are disclosed |
| A21 | AI assistance is disabled | Findings, evidence, ownership, manual review, and history remain usable |
| A22 | Exploration encounters an unapproved consequential action | It stops at the boundary and records the resulting coverage limitation |
| A23 | A user relies on a keyboard or screen reader in Accessly | Essential product workflows remain operable and visual findings have understandable alternatives |
| A24 | A report shows no detected failures | The result states scope and outstanding reviews and makes no blanket conformance claim |
| A25 | A member leaves the organization | Access can be revoked and active responsibilities reassigned while appropriate history remains |
| A26 | An evaluation method changes between runs | The comparison discloses the change and its possible effect on results |
| A27 | A feature is intentionally retired | Associated work can close as no longer applicable without being reported as a verified repair of the former feature |
| A28 | A monitor observes no meaningful change | It follows notification preferences without issuing repetitive non-actionable alerts |
| A29 | An exception expires while the barrier remains | The concern returns to the applicable review or policy attention state |
| A30 | A selected check is unsupported in the current context | The product reports unsupported scope rather than recording a pass |

## 26 Assumptions and open decisions

### 26.1 Established product direction

- Accessly focuses on web accessibility and developer effectiveness.
- The product covers static and interactive experiences.
- Reproduction, likely source identification, actionable AI assistance, and regression prevention are central.
- The intended outcome is more inclusive applications with less required specialist knowledge for routine work.
- The concept must preserve the role of human judgment where automation is insufficient.

### 26.2 Assumptions requiring validation

| Assumption | Evidence that would strengthen or challenge it |
| --- | --- |
| Investigation after detection is a major recurring pain | Observation of actual issue handling and time spent on each step |
| Teams value a coherent workflow enough to adopt another product | Continued use on real work and explicit purchasing intent |
| Likely source attribution meaningfully reduces effort | Reviewed accuracy and fewer reassignment or investigation steps |
| Reproduction quality is an important buying factor | Users completing handoffs more reliably than with their present tools |
| Teams trust scoped AI assistance with evidence | Reviewed recommendation usefulness and willingness to use it repeatedly |
| Shared-cause grouping reduces duplicate work | Correct grouping decisions and verified improvements across usages |
| Journey-based reporting is understandable to leaders | Better release and prioritization decisions in observed use |
| Frequent-release application teams are the best starting segment | Stronger recurring need and adoption than other candidate segments |

### 26.3 Product decisions still open

1. The primary customer segment, industries, and company characteristics.
2. The strongest daily user and the likely budget owner.
3. The application environments, browsers, and assistive-technology contexts explicitly supported.
4. Which journey discovery behaviors can be offered with reliable, understandable boundaries.
5. The level of source-attribution precision the product can responsibly promise.
6. Whether users primarily work in a separate Accessly workspace or through connected experiences.
7. Specific workflow providers and compatibility commitments.
8. Default standards profiles and customer-specific policy options.
9. Evidence retention, residency, deletion, and regulated-use commitments.
10. Optional organization requirements for independent review and sensitive decisions.
11. Pricing model, allowances, packages, and billing units.
12. Quantitative quality, responsiveness, and reliability targets after baseline measurement.
13. Which benchmark tasks fairly demonstrate improvement over existing workflows.
14. How organizations want to balance autonomous discovery with explicit task definition.
15. How broad shared-pattern claims should be communicated when only representative usages are reviewed.

### 26.4 Product research priorities

Observe how real teams move from reports to fixes. Compare the same barriers and tasks across current workflows. Include correct experiences as well as failures. Ask accessibility specialists and people with disabilities to assess whether remedies improve actual use. Establish recurring demand and purchasing intent before making broad market claims.

These are validation needs for the idea, not a delivery roadmap or implementation plan.

## 27 Research references

All links below were reviewed for this document on October 24, 2026. Live product pages may change. Vendor documentation establishes what is described publicly; it does not independently verify effectiveness, completeness, or superiority.

| Ref | Source | Role in this document |
| --- | --- | --- |
| R01 | [WebAIM Million 2026](https://webaim.org/projects/million/) | Prevalence of automatically detectable problems and study limitations |
| R02 | [W3C tool selection guidance](https://www.w3.org/WAI/test-evaluate/tools/selecting/) | Limits of automated evaluation and the role of judgment |
| R03 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Standards orientation and scope of conformance |
| R04 | [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Example expectations for dialog interaction |
| R05 | [Deque Developer Hub](https://www.deque.com/axe/developer-hub/) | Existing automated-workflow and regression capabilities |
| R06 | [Deque Axe MCP](https://docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server/) | Existing AI remediation guidance |
| R07 | [Evinced web testing documentation](https://developer.evinced.com/sdks-for-web-apps/playwright-js-sdk/) | Existing evaluation during dynamic flows |
| R08 | [Evinced Web MCP](https://developer.evinced.com/mcp-servers/web-mcp-server/) | Existing contextual guidance in AI-assisted workflows |
| R09 | [BrowserStack accessibility overview](https://www.browserstack.com/docs/accessibility/overview/introduction) | Automated, assisted, and screen-reader testing options |
| R10 | [BrowserStack Test Companion remediation](https://www.browserstack.com/docs/test-companion/web-testing/test-lifecycle/fix-accessibility-violations) | Existing source remedy review and rescan workflow |
| R11 | [AccessLint](https://www.accesslint.com/) | Existing developer checks, review, and journey monitoring |
| R12 | [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Customer alternative for assessing page states after interaction |
| R13 | [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) | Existing action and page-state investigation evidence |
| R14 | [Storybook accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) | Customer alternative for component evaluation and regression checks |
| R15 | [AccessGuru research paper](https://arxiv.org/abs/2507.19549) | Research into AI-assisted accessibility detection and correction |
| R16 | [EU accessibility business guidance](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm) | Jurisdiction-specific market context and applicability limits |
| R17 | [DOJ Title II web rule fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/) | Public-sector market context and updated compliance dates |

The competitive review is focused rather than exhaustive. Accessly must not infer that unlisted providers lack overlapping capabilities or that an unmentioned feature is absent from a listed provider.

## 28 Essential context for an AI agent

Accessly is a proposed developer-first accessibility testing and remediation platform for web applications. The central product outcome is helping teams remove barriers in meaningful user tasks and keep the improved behavior from regressing.

The original vision includes detection across static and interactive states, clear reproduction, likely source identification, actionable AI assistance, verification, and prevention. Treat these as a connected user experience. Individual features must contribute to moving a real finding toward an appropriately verified resolution.

The product must be understandable to developers and also support QA, design, accessibility review, and leadership. It must accommodate automated and human findings in the same accountable workflow without implying that their evidence or verification methods are interchangeable.

Preserve the following product truths in any later design or specification:

1. A page address is not equivalent to every state or journey available there.
2. A successful scan is scoped evidence, not proof of complete accessibility.
3. Detection, attribution, recommendation, and verification are different judgments.
4. A likely source location must remain labeled as likely unless evidence supports precision.
5. A recommendation being accepted does not mean a finding is resolved.
6. Resolution requires evidence appropriate to the original barrier.
7. Human and assistive-technology observations cannot be dismissed solely because automation passes.
8. Grouping repeated problems must preserve their individual contexts and verification limits.
9. Baselines and exceptions organize decisions; they do not turn known barriers into successes.
10. Missing coverage, failed access, unsupported checks, and incomplete runs must remain visible.
11. AI must use available evidence, expose uncertainty, and preserve user control.
12. Sensitive evidence and consequential journey actions require appropriate boundaries.
13. Accessly's own essential experiences must be accessible.
14. Competitors already offer substantial portions of this vision; any claimed advantage requires validation.
15. The detailed requirements in this document are proposed product decisions, and open choices remain open until approved.

When extending the concept, use the product promise, user impact, evidence integrity, and stated boundaries to resolve ordinary ambiguities. Record material assumptions explicitly. Do not add technical implementation choices, imply completed capabilities, or invent research results as part of understanding the product idea.

