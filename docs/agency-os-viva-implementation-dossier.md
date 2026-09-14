# Agency OS audit and Viva implementation dossier

Captured: 2026-09-14
Purpose: preserve product and workflow learnings before Blueprint access ends, then translate the useful patterns into an original Viva implementation plan.

## Executive conclusion

The research is complete enough to begin implementation. The remaining unknowns are operational edge cases, not missing concepts.

Agency OS is a multi-tenant agency operating system organized around one lifecycle:

`lead -> qualification -> proposal -> won -> client -> project/sprints -> delivery -> reporting -> renewal/churn`

Its strongest idea is not any individual screen. It is the shared data graph connecting sales, delivery, reporting, finance, and an AI tool layer. A stage change can create a client; a plan can schedule work; assignments flow to the Today view; published content and live links flow to reporting; and Claude can read or mutate the same records through MCP.

Viva already has a stronger foundation for local lead generation, Local Falcon orchestration, technical SEO, outbound report engagement, SMS, Stripe, internal chat, and existing MCP infrastructure. The best strategy is therefore not to clone Agency OS. It is to add the missing delivery graph and a provider-neutral tool layer to Viva's existing CRM and SEO systems.

Recommended product direction:

1. Build one provider-neutral Viva API and remote MCP server.
2. Ship Codex-oriented skills/workflows first for internal builders and operators.
3. Expose the same safe tool contracts to ChatGPT or other MCP-capable clients for the broader team.
4. Keep deterministic business logic in Viva; let the model orchestrate, summarize, and draft.

## Evidence and scope

This dossier synthesizes:

- The authenticated Agency OS web application.
- A temporary personal-token connection to the live MCP endpoint.
- A synthetic lead-to-client lifecycle and populated client workspace.
- The default and applied Onboarding/SEO plans.
- The Agency OS Tour, CRM, Project Management, Reporting, Claude/MCP setup, and Proposal Agent lessons in Skool.
- The existing Google Doc, [Local SEO Ranking Action Plan — Blueprint Training Synthesis](https://docs.google.com/document/d/1LE71WDL9F5aQb9oc1V3NniM9-cfMxhiQEnbaLAec3v4/edit), which already covers the Local SEO/GEO, content-production, link-acquisition, KPI, and safeguard curriculum.
- A read-only review of Viva's current schema and feature modules on `main`.

The complete captured MCP interface is stored separately in [agency-os-mcp-tools-2026-09-14.json](./research/agency-os-mcp-tools-2026-09-14.json). It contains tool names, descriptions, input JSON Schemas, protocol version, and server metadata, but no token or customer secrets.

This is an original implementation analysis. It does not reproduce proprietary course videos, prompts, templates, or source bundles wholesale.

## What Agency OS contains

### Product areas

| Area | What it does | Important behavior |
|---|---|---|
| Today | Personal notifications, assigned work, follow-ups, and a private to-do list | Assignments and mentions route back to the exact lead, task, or content item |
| Pipeline | Agency-specific lead/deal Kanban and monthly metrics | Fixed canonical stages with editable display labels; Won creates a client |
| Clients | Client roster and per-client workspace | Status, services, reporting trends, Drive folder, overdue work, and channel metrics |
| Tasks | List, board, and table views of delivery work | Dates, owners, subtasks, dependencies, recurrence, time, attachments, comments |
| Content | Configurable production Kanban | SEO fields, publishing URLs, subtasks, attachments, comments, and BCC-to-item ingestion |
| Links | Client and master link-placement trackers | Outreach state, cost, target URL, source URL, anchor, and live date |
| Performance | Organic, Paid Search/LSA, and Paid Social reports | Live/cached provider data, configurable report sections, Claude analysis and email drafting |
| Overview | Editable client operating facts and running notes | User-defined fields can be reordered or removed |
| Data | Per-client provider identifiers and crawl upload | 19 account slots; IDs select provider accounts but do not authorize them |
| Analyses | WQA, Local SEO, and Proposal analysis workflows | Coverage/quality gates, observations, findings, strategist approval, artifacts, plan import |
| Admin | Revenue, deal velocity, churn, payroll, capacity, utilization, and P&L | Access is role-gated |
| Library | Prompt recipes for import and automation | CRM import, PM import, lead sync, call sync, proposal generation |
| Settings | Agency, team, plans, pipeline labels, integrations, and MCP | White-label controls, roles, encrypted provider credentials, connector setup |

### Canonical pipeline state machine

The MCP contract accepts these eight active terminal/display states, while the UI also shows a live/inactive client split and a Spam column:

- `awaiting_discovery`
- `awaiting_analysis_proposal`
- `proposal_sent_awaiting_decision`
- `won`
- `stuck_nurturing`
- `lost_followup`
- `lost_closed`
- `not_qualified`
- `spam`

The product documentation calls these nine canonical stages. The board renders ten columns because Won is presented as both live-client and inactive-client views. Display labels can be renamed, reordered, or hidden, but the underlying state identifiers remain fixed.

### Lead record

A lead carries company/contact details, source, expected value, services, discovery date, last-contact date, assigned follow-ups, proposals, email history, recorded calls with summaries, notes, and threaded comments. The synthetic test verified that a lead can move through discovery, analysis/proposal, proposal sent, and Won; Won created an active client automatically and preserved the source lead relationship.

### Client delivery workspace

The synthetic client exposed six visible work areas:

- Tasks
- Content
- Links
- Performance
- Overview
- Data

“Deliverables” is a shareable client-portal section and an MCP/domain entity, but it is presented as work inside Tasks rather than a separate internal top-level tab in the tested UI. Analyses live at dedicated `/analyses/:id` review URLs rather than in the client tab strip.

### Content model

Default UI stages were:

1. Topics
2. Approved - Ready For Creation
3. Creation In Progress
4. Editing In Progress
5. Ready For Review
6. Ready For Publishing
7. Published

Stages are editable and new columns can be added. A content item supports title, owner, due date, content type, platform, new/rewrite flag, main keyword, keyword volume, existing/draft/final URLs, publish date, custom fields, Markdown description, subtasks, attachments, comments, and a unique BCC address.

### Link model

The link tracker supports:

- Status
- Live date
- Placement type
- Domain
- Cost
- Source/article URL
- Target page
- Anchor text

The tested status vocabulary was Reply Pending, Pitched Topic, Offered Price, Need Draft, Requested Draft, Sent Draft, Publish Scheduled, Live, Article Rejected, and Dead.

### Reporting and data

The Data tab has identifiers for GA4, Search Console, an Ahrefs/SEMrush target domain, GBP locations, Local Falcon places, CallRail, Google Ads, Microsoft Ads, LSA accounts, Meta Ads, TikTok Ads, YouTube Ads, and six organic social accounts. It also accepts a Screaming Frog crawl CSV.

Windsor is the aggregation layer for most analytics and advertising sources. Ahrefs/SEMrush, Local Falcon, and DataForSEO can also be used directly. Performance views are Organic, Paid Search/LSA, and Paid Social. A missing provider connection produces an explicit error instead of an empty-looking report.

The reporting lesson confirms these important rules:

- Data can take up to a minute to refresh.
- Sections can be hidden per client.
- Local Falcon scans must already exist; Agency OS does not run them.
- Published content and live links can flow into reports.
- Share links can expose only selected sections and may use a label and passcode.
- Cached shared reports refresh on the same schedule as the internal report.

### Analysis workflow

The remote MCP analysis system is more substantial than the public product pages imply:

`analysis -> provider observations -> coverage/quality checks -> deterministic findings -> strategist review -> artifact -> engagement plan`

Analysis types are `wqa`, `local`, and `proposal`. Findings begin as `proposed` and can become `approved`, `edited`, `deferred`, or `rejected`. Artifacts may be workbooks, reports, or decks in xlsx/html/csv/pdf formats. Approved findings can be imported into a six-sprint, 12-month plan.

The synthetic Local analysis correctly reported missing required `grid_point`, `gbp_profile`, and `review` observations, while treating citations and metric history as optional. Its report rendered even while the analysis was pending and the finding remained proposed. Viva should require an explicit “draft” watermark and approval state on such artifacts.

## MCP contract findings

The remote server returned:

- Name: `agency-os`
- Version: `2.0.0`
- MCP protocol: `2025-03-26`
- Endpoint: `https://app.theblueprint.training/mcp`
- 78 tools

Tool families include:

- Analysis, coverage, quality, observations, findings, artifacts, and plan import/export.
- CRM leads, transitions, follow-ups, and pipeline summaries.
- Clients, reports, onboarding, and target keywords.
- Projects, sprints, and deliverables.
- Content and links.
- Team, utilization, agency profile, and finance.
- Integrations and provider verification.
- Workspace import, jobs, data catalog, and read-only SQL-style queries.
- Google Drive export, folder creation, Sheets publishing, and client-visible artifact publishing.
- Asana/ClickUp-style PM board discovery, preview, and import.

### Contract design strengths

- Tools are grouped around domain actions rather than screens.
- Stage transitions are validated instead of accepting arbitrary status writes.
- Finding approval has a legal lifecycle.
- Dependency updates are validated.
- Destructive client deletion documents the full cascade and asks the model to confirm.
- Client-visible Drive publication is explicitly described as human-confirmed.
- Analysis generation separates deterministic evidence processing from model review.

### Contract weaknesses and live inconsistencies

1. Several update tools expose only `{ id }` in JSON Schema while their descriptions promise arbitrary mutable fields. This is poor discoverability and weak validation for an AI client.
2. A personal token created by the only member could call client, project, analysis, and team tools, but `leads_create` and `pipeline_summary` returned “pipeline access requires the sales or admin tier.” The team API and UI both reported that member as Admin.
3. The same personal token received “organization admin required” from `/api/export`, even though the organization switcher displayed Admin.
4. The public list of 18 tools materially understates the live 78-tool surface.
5. Destructive `leads_delete`, `clients_delete`, and integration-deletion tools are exposed in the same broad token surface as reads.
6. `query_run(sql)` is powerful and should be isolated behind read-only views, strict row/tenant guards, budgets, and separate scopes.
7. The web app's applied-plan behavior is not a transparent reflection of `plan_templates_list`.

For Viva, every update schema should enumerate allowed fields, every tool should declare required scopes, and destructive/publishing actions should require a confirmation token or approval record.

## Project-plan templates

### Default Onboarding contract

The template API reported one 0.5-hour human parent item, “Onboard client,” containing five subtasks:

- Send invoice to client
- Send onboarding email
- Schedule kickoff call
- Get access to client platforms (GA4, GSC, GBP, Ads)
- Set up client in Agency OS

### Applied Onboarding behavior

The live applied plan instead created six flat deliverables on a 14-day onboarding sprint:

| Offset | Task | Executor | Dependency |
|---:|---|---|---|
| 0 | Set the client website | Human | None |
| 2 | Send invoice to client | Human | None |
| 2 | Send onboarding email | Claude | None |
| 7 | Schedule kickoff call | Human | None |
| 10 | Get access to client platforms | Human | None |
| 12 | Connect accounts in Windsor.ai | Human | Waits for platform access |

This is a meaningful contract/application mismatch. The applied version is operationally better because it makes the website/domain prerequisite and Windsor dependency explicit.

### SEO template

Applying SEO added a second active sprint to the existing onboarding project rather than creating a second project. The original project retained its onboarding name and type.

| Work item | Start -> due offset | Hours | Executor | Recurrence |
|---|---:|---:|---|---|
| Analytics & reporting setup | 3 -> 10 | 7 | Claude | — |
| Foundational Sprint | 5 -> 30 | 12 | Claude | — |
| Send monthly report | 25 -> 30 | 2 | Claude | Monthly |
| Local SEO setup | 30 -> 60 | 13.5 | Claude | — |
| Local SEO directories & aggregators | 35 -> 60 | 8 | Human | — |
| Content production | 60 -> 90 | 10 | Claude | Monthly |
| Link building | 70 -> 90 | 4 | Claude | Monthly |
| Local SEO ongoing | 30 -> 60 | 2.75 | Human | Monthly |

Recorded subtasks and checklists:

- Analytics: GA4/GTM audit; implementation/fixes; Local Falcon tracking baseline; connect data sources.
- Foundational: WQA; campaign target-pages file; foundational review call. WQA checklist covers Core Web Vitals/speed, multilingual review, architecture/core pages, finding review, content audit, and keyword gap.
- Local setup: NAP sheet; Local Falcon/competitor/citation audit; approved-finding review; GBP optimization document; client approval; implementation; review-generation setup.
- Directories: data aggregators; core directory audit; citation fixes/build; pending-verification notice.
- Content: monthly topic ideation; content plan/calendar with service, location, and blog work.
- Links: plan/budget; authority links; PR/earned media; manual industry links.
- Ongoing: weekly GBP post/review/positive responses/negative-review notice; monthly NAP consistency and Local Falcon/BrightLocal rank tracking.

The MCP stores executor, start date, recurrence, and nested subtasks in `custom_fields`; top-level recurrence and executor fields came back null on applied deliverables. Viva should promote these to first-class typed columns.

## Training synthesis

### Agency OS lessons

The Tour, CRM, Project Management, and Reporting lessons mostly document the behavior verified in the app. Their additional strategic points were:

- Use the Today board as the team's operating queue and the Team view for review meetings.
- Keep client portal exposure opt-in; most agencies share only Performance.
- Multiple task/subtask owners should create personal work notifications.
- Published content and client-tagged links should automatically become report inputs.
- Empty reports should be diagnosed first by authorization and account selection.
- Use hidden report sections to match scope rather than presenting empty or unfavorable charts.

### Claude/MCP architecture lessons

Blueprint's training describes an older downloadable “Agency OS” stack:

- Install a `.mcpb` extension in Claude Desktop to register tools.
- Use Cowork against a workspace folder for day-to-day execution.
- Use skills and `CLAUDE.md`-style instructions for repeatable workflows.
- Use Git for code/versioned assets and Google Drive for client-facing/shared files.
- Current training references a 1.5.6 bundle and a separate source download.

This is distinct from the launched web product's remote MCP server v2.0.0. The reusable lesson is the layered architecture—stable tools plus workflow skills—not the Claude-only packaging.

### Proposal Agent lesson

The accessible Sales lesson positions proposal generation as a data-driven workflow, not a static template:

1. Gather prospect and analysis data first.
2. Derive a small number of defensible sales angles from the evidence.
3. Build a complete first draft.
4. Require human review, re-prompting, positioning, pricing, and brand customization.
5. Attach the reviewed proposal to the CRM and drive follow-up from the same record.

The separate “Proposal Agent Masterclass” course tile was marked private, but the full-member Sales module exposed the equivalent Proposal Agent lesson, timestamps, setup dependency, and resources. No proprietary proposal or source bundle was copied into this repository.

### Local SEO curriculum

The existing Drive synthesis is authoritative for the already-completed Local SEO/GEO review. Its operating model should feed Viva's templates:

- Establish canonical NAP/access and a geo-grid baseline.
- Fix GBP category and entity relevance first.
- Align service/location architecture and internal links.
- Build a steady, policy-compliant review system.
- Acquire citations, SERP-directory profiles, and genuine local/industry links.
- Choose monthly work from evidence: one relevance action, one content/conversion action, and one prominence action.
- Report work, movement, leads, and revenue separately.

## Proposed Viva domain model

| Aggregate | Core entities | Required behavior |
|---|---|---|
| Workspace | Workspace, Brand, Member, Role, CapabilityGrant | Tenant isolation, white-labeling, explicit tool scopes |
| Sales | Lead, Opportunity, Stage, Qualification, Activity, FollowUp, Call, Proposal | Validated transitions, dedupe, assignment, Won conversion |
| Client | Client, Contact, ServiceEngagement, ClientFact, ClientNote | Status/history, per-service scope, source-lead lineage |
| Delivery | Project, Sprint, Deliverable, Subtask, Dependency, RecurrenceRule, TimeEntry | Graph validation, templating, workload, completion history |
| Content | ContentItem, ContentStage, ContentType, Platform, Attachment | Custom workflow, SEO metadata, publishing lifecycle |
| Authority | LinkOpportunity, LinkPlacement, OutreachTouch | Pipeline states, cost, target page, live validation |
| Analysis | Analysis, Observation, CoverageRule, QualityCheck, Finding, Approval, Artifact | Provenance, deterministic analyzers, human approval |
| Data | ProviderConnection, ClientDataBinding, PullJob, DataSnapshot | Secrets vault, binding vs authorization, freshness and health |
| Reporting | ReportDefinition, ReportSection, ReportSnapshot, Narrative, ShareGrant | Cached snapshots, per-section visibility, passcode/revocation |
| Finance | Contract, RecurringRevenue, ChurnEvent, PayrollRate, Capacity | Monthly cohort metrics, margins, utilization |
| Governance | AuditEvent, IdempotencyKey, ConfirmationGrant | Every mutation traceable and retry-safe |

### Recommended events

- `lead.created`
- `lead.stage_changed`
- `lead.followup_due`
- `lead.proposal_sent`
- `lead.won`
- `client.created`
- `engagement.created`
- `plan.applied`
- `deliverable.assigned`
- `deliverable.blocked`
- `deliverable.completed`
- `content.published`
- `link.became_live`
- `analysis.ready_for_review`
- `finding.approved`
- `report.refreshed`
- `share.created`
- `share.revoked`

Events should update projections such as Today, pipeline metrics, client health, reporting, and finance. They should not be implemented as model-authored side effects.

## Proposed Viva AI/tool architecture

### Layers

1. **Domain services:** authoritative validation, authorization, transactions, and events.
2. **REST/typed API:** used by Viva's web UI and automations.
3. **Remote MCP facade:** small tools that delegate to the same domain services.
4. **Workflow skills:** Codex/ChatGPT instructions for onboarding, proposals, audits, reporting, and account reviews.
5. **Approval UI:** visible queue for destructive, financial, client-visible, and bulk actions.

### Initial tool surface

Prefer a smaller composable surface than Agency OS's 78 loosely scoped tools:

- `crm.search_leads`, `crm.get_lead`, `crm.create_lead`, `crm.update_lead`, `crm.transition_lead`
- `crm.create_followup`, `crm.complete_followup`, `crm.attach_call`, `crm.attach_proposal`
- `clients.search`, `clients.get`, `clients.update`, `clients.convert_from_lead`
- `delivery.list_work`, `delivery.apply_template`, `delivery.create_task`, `delivery.update_task`, `delivery.complete_task`
- `content.list`, `content.create`, `content.transition`, `content.publish`
- `links.list`, `links.create`, `links.transition`
- `analysis.create`, `analysis.gather`, `analysis.get_coverage`, `analysis.generate_findings`
- `analysis.review_finding`, `analysis.build_artifact`, `analysis.import_plan`
- `reports.get`, `reports.refresh`, `reports.generate_narrative`, `reports.create_share`
- `team.list`, `team.workload`, `finance.summary`

Every mutation should accept `idempotency_key`, `reason`, and an expected record version. Bulk, destructive, integration, invitation, and client-visible publication tools should return a preview and require a short-lived approval ID before execution.

### Codex versus ChatGPT

Do not make the backend specific to either client. Implement standards-based remote MCP plus OAuth/scoped personal tokens.

Prioritize Codex packaging first when the initial users are builders and internal operators working beside the Viva repository, terminals, exports, and implementation artifacts. Add ChatGPT-facing workflows when sales, account management, and nontechnical teammates become the larger daily audience. Both should call the same domain contracts, so this sequencing does not create a migration.

## Viva gap assessment

### Existing strengths to preserve

- Leads, contacts, companies, opportunities, clients, stages, activities, follow-up tasks, and notifications.
- Won-to-client/onboarding behavior.
- CSV import/export and stage-triggered task automations.
- Role infrastructure and audit/history patterns.
- SMS/Quo, Stripe, internal chat, analytics, reporting, and business dashboards.
- Local visibility and Local Falcon orchestration.
- Technical SEO analysis and report generation.
- Report outreach and engagement tracking.
- Existing Better Auth/MCP foundations and the specialized SAB MCP server.

### Highest-value gaps

| Gap | Why it matters | Priority |
|---|---|---:|
| Generic scoped MCP over CRM/delivery | Lets any supported model operate the same system safely | P0 |
| First-class project/sprint/deliverable graph | Connects sold work to scheduled delivery | P0 |
| Subtasks, dependencies, recurrence, estimates/time | Makes templates executable rather than checklist-only | P0 |
| Complete Kanban parity | Board should expose next action, follow-up, probability, and drag/drop | P0 |
| Structured qualification, calls, and proposals | Preserves sales context through handoff | P1 |
| Content production board | Needed for SEO production, approvals, and report linkage | P1 |
| Link acquisition pipeline | Needed for prospecting, cost, target-page, and live-link reporting | P1 |
| Per-client multi-channel data bindings/report sections | Supports client-ready reporting and expansion opportunities | P1 |
| Share grants/client portal | Reduces manual reporting while keeping scope explicit | P2 |
| Team workload/capacity/utilization | Important when the planned team grows | P2 |
| Contract revenue/payroll/margin views | Useful after delivery and staffing data are reliable | P3 |
| PM importers and prompt library | Helpful accelerators, not core architecture | P3 |

Current schema evidence confirms that Viva already stores opportunity `nextActionDate`, `followUpDate`, and `probability`. The list view renders next action and probability, while the Kanban/storage comments still identify missing card rendering. Complete that existing feature before redesigning stages.

## Phased roadmap

### Phase 0 — contract and governance foundation

- Define tenant-scoped domain services and event envelopes.
- Add record versions and idempotency to every connector mutation.
- Define capability scopes such as `crm:read`, `crm:write`, `delivery:write`, `report:share`, and `admin:read`.
- Add connector audit events with actor, client, tool, reason, input hash, result, and linked records.
- Add approval records for bulk, destructive, external-publication, and financial actions.
- Publish MCP contract tests and eval fixtures.

Exit criteria: the same use case succeeds through UI and MCP with identical authorization and validation.

### Phase 1 — CRM lifecycle completion

- Add board drag/drop and render next action, follow-up, and probability.
- Add structured qualification, call summaries, proposals, email activity, and assigned follow-ups to the opportunity detail.
- Formalize legal stage transitions and display-label mappings.
- Make Won conversion transactional and idempotent.
- Add synthetic-data flags and merge/dedupe previews.

Exit criteria: a synthetic lead can be created, qualified, followed up, proposed, won, and converted with no duplicate client on retry.

### Phase 2 — delivery graph and templates

- Add Project, Sprint, Deliverable, Subtask, Dependency, RecurrenceRule, and TimeEntry.
- Support list, table, and board projections from the same records.
- Implement validated dependencies and recurring-instance generation.
- Add Onboarding and Local SEO templates derived from Viva's own SOPs and the existing SEO synthesis.
- Route assignment and mentions into Today/notifications.

Exit criteria: applying a versioned plan produces deterministic dated work, preserves template version, and prevents dependency cycles.

### Phase 3 — content, links, and artifacts

- Add customizable content stages and typed SEO/publishing fields.
- Add the link opportunity/placement pipeline and live-link verification.
- Link published content and live placements to reports.
- Add client folder/artifact references without requiring Drive as the database.

Exit criteria: content and link items have accountable owners, approvals, evidence, live URLs, and report lineage.

### Phase 4 — analysis and reporting

- Reuse Viva's technical SEO and Local Falcon systems as observation providers.
- Add coverage rules, data-quality checks, findings, approval, and artifacts.
- Build per-client report definitions with hide/show sections and cached snapshots.
- Add draft narratives and client-visible share grants with expiry/passcode/revocation.

Exit criteria: every finding links to observations, every published artifact is approved, and every report states freshness/coverage.

### Phase 5 — team and finance

- Add weekly capacity, estimates, actual time, workload projections, and utilization.
- Add service engagements, recurring revenue, churn events, payroll rates, and margin views.
- Keep finance read-only until sales and delivery events are demonstrably complete.

Exit criteria: revenue, workload, and margin reconcile to source records for two consecutive monthly closes.

## Acceptance and safety rules

- Tenant ID comes from verified auth context, never from model input.
- Tool schemas enumerate mutable fields; no undocumented passthrough updates.
- Access checks are shared by UI, REST, background jobs, and MCP.
- All list tools paginate and cap results.
- All bulk writes begin with a preview.
- Delete, integration removal, invites, Drive publication, and public shares require explicit confirmation.
- “Won” conversion, template application, and imports are idempotent.
- Templates are versioned; applied work retains the version and expanded schedule.
- Recurrence is a typed rule, not a string hidden in custom JSON.
- Dependencies are validated for tenant, project, and acyclicity.
- Provider bindings are separate from provider authorization.
- Reports show coverage, freshness, and source provenance.
- AI-generated artifacts remain draft until approved.
- Secrets never appear in tool results, prompts, logs, exports, or Git.

## Audit artifacts and cleanup

Local, non-repository downloads:

- `/Users/matt/Downloads/Blueprint-client-onboarding-template.xlsx`
- `/Users/matt/Downloads/Agency-OS-workspace-equivalent-export-2026-09-14.json`

The second file is a structured equivalent assembled from authenticated MCP reads because the official `/api/export` download was blocked by the browser automation policy and rejected the personal token with an organization-admin error. The official export endpoint is `/api/export`; the Help Center states that it remains available from the paused screen and includes clients, leads, projects/tasks, and content, but not live Windsor performance data.

Synthetic records intentionally left in Agency OS for audit traceability:

- Lead/client: `Viva UI Audit Test — Delete After Review`
- Content: `Synthetic local SEO landing page — delete after review`
- Link: synthetic example.com placement
- Analysis: `Synthetic Local SEO Audit — Delete After Review`
- Finding: `Synthetic finding — verify primary category`

No external provider integration or Google Drive connection was created during the audit.

## Final recommendation before cancellation

The high-value evidence has been captured: exact tool contracts, actual lifecycle behavior, applied delivery records, content/link/report/data schemas, analysis approval flow, complete default SEO template details, the onboarding mismatch, relevant training notes, and an implementation roadmap grounded in Viva's current system.

Before canceling, perform only two manual checks:

1. While signed in, visit `https://app.theblueprint.training/api/export` directly or use the paused-screen export link and save the official archive.
2. Confirm the synthetic records may remain for later deletion, then cancel the membership through the billing source used for Blueprint/Skool.

Further course scraping or wholesale template collection is unlikely to change the architecture and would add little value relative to implementation.
