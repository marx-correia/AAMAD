# Product Requirements Document (PRD)
## Multi-Agent Customer Onboarding Crew

## Input Requirements

**Deep Research Report / MRD**: N/A — intentionally skipped. Internal-facing MVP for a course capstone; no commercial market case required. Market/pricing sections below are marked N/A with rationale per template guidance.
**System Description**: Not present as a separate `system-description.md` artifact; concept elicited directly from stakeholder and captured inline in Section 1 and in Sources.
**System Concept**: A crew of AI agents that acts as the customer's **first point of contact** after signup and stays with them through **first use of the app** — greeting and qualifying the customer, generating a personalized getting-started plan, answering product questions in-app with grounded citations, and escalating to a human with full context when it cannot help.
**Selected Runtime**: `crewai` (resolved from `aamad.config.example.yml` `runtime.target`; `AAMAD_TARGET_RUNTIME` env var not set — see Audit).

---

## 1. Executive Summary

**Problem Statement**

* New customers land in the product after signup with no guided path: they read scattered docs, guess at setup, and open support tickets for questions the docs already answer.
* Quantified impact (baseline assumed — see Assumptions): time-to-first-successful-use **14–21 days**; **~40%** of first-30-day support tickets are repeat onboarding questions; **~40%** of new signups never complete initial setup.
* Population scope: new customers of a B2B SaaS product — both the technical implementer and the business stakeholder who approved the purchase. External market sizing is **N/A** (MRD skipped).

**Solution Overview**

* A 5-agent crew covering the full arc: **welcome & qualify → sponsor brief → personalized plan → guided first use → escalate with context**.
* Differentiators vs alternatives: docs alone are passive; a single generic chatbot cannot switch between qualification, hands-on setup coaching and escalation triage; human onboarding does not scale to every signup.
* Expected outcomes: time-to-first-value **≤ 5 days**, setup completion **≥ 80%**, onboarding-related support tickets **−50%**.

**Strategic Rationale**

* Multi-agent is optimal because onboarding is a **sequence of distinct jobs with distinct context needs** (qualification vs planning vs troubleshooting vs escalation). Separate agents keep each prompt small and each responsibility auditable — the same single-responsibility principle AAMAD applies to its own Development Crew.
* Operational value: onboarding capacity becomes independent of headcount; support team shifts from repetitive Q&A to complex cases.
* Market positioning: **N/A** — internal capability, not a product sold separately.

---

## 2. Market Context & User Analysis

**Target Market / Users**

* **Persona A — Implementer (primary).** Technical or semi-technical; owns getting the product working. Learns by doing, wants a working example fast, impatient with theory.
* **Persona B — Sponsor (secondary).** Approved the purchase; needs to see progress and value quickly to justify the decision internally. Wants a summary, not a tutorial.
* Market size / geographic expansion: **N/A** (MRD skipped). MVP scope is English + PT-BR customers of the existing product.

**User Needs Analysis**

* Critical pain points: *"where do I start?"*, *"why isn't this working?"*, *"I have to re-explain everything to support."*
* Journey today: signup → silence → self-serve docs → stuck → ticket → 24h wait → context lost → slow adoption.
* Adoption barriers: information overload, one-size-fits-all onboarding, no proactive help, escalation queue latency.
* Success factors: guidance available immediately, personalized by role, and **context that persists** across agents and across sessions.

**Competitive Landscape** *(optional — MRD skipped)*

* Alternative workflows: static docs + help center; in-app product tours (Intercom/Appcues-style); human-led onboarding coordinator.
* Gap: none of these carry context from qualification through troubleshooting into escalation.
* Pricing benchmarks: **N/A**.

---

## 3. Technical Requirements & Architecture

**Runtime & Agent Specifications** (runtime: `crewai`)

* Process mode: **sequential** for MVP reproducibility, per `adapter-crewai` rules. Hierarchical mode is not used and would require SAD justification.
* Collaboration pattern: sequential crew with a triage branch. `welcome_agent` runs first and its output routes the rest via explicit `Task.context` chaining; `escalation_agent` is invoked from the support task on failure/exhaustion, not by ad-hoc delegation.
* Delegation boundaries: `allow_delegation=false` by default for all agents. Only `welcome_agent` and `first_use_support_agent` have `allow_delegation=true` because their scope legitimately branches; the SAD must confirm delegation targets before Build.
* Shared context: a customer profile object (role, goal, use case, timeline) produced by `welcome_agent` and passed as `Task.context` to every downstream agent — no re-asking, no shared mutable state.
* Externalization: all agent and task definitions **must** live in `config/agents.yaml` and `config/tasks.yaml` per `adapter-crewai` rules; `crew.py` wires them. Tool bindings validated at kickoff.
* Memory posture: **`memory=false` at crew level for MVP** (reproducibility default). Per-agent memory flags in the table below are conditional on the SAD justifying an exception and will be re-evaluated by `@system.arch`; if enabled, `CREWAI_STORAGE_DIR` must be project-scoped and scope/retention recorded in Audit.

**Core Agent Definitions**

| agent | role | goal | tools | runtime notes (crewai) |
|---|---|---|---|---|
| `welcome_agent` | Onboarding Greeter & Qualifier | Identify who the customer is and what they need, and route them to the right track | `crm_lookup`, `profile_writer` | `max_iter: 3`, `max_retry_limit: 2`, `allow_delegation: true` (routes to `sponsor_brief_agent` or `onboarding_plan_agent`), `memory: false` (MVP default) |
| `sponsor_brief_agent` | Business Sponsor Liaison | Give the sponsor a short value/ROI summary and expected timeline | `case_study_search`, `doc_generator` | `max_iter: 2`, `max_retry_limit: 2`, `allow_delegation: false`, `memory: false` |
| `onboarding_plan_agent` | Onboarding Planner | Produce a personalized first-week plan with concrete daily milestones | `template_library`, `docs_search`, `plan_writer` | `max_iter: 4`, `max_retry_limit: 2`, `allow_delegation: false`, `memory: false` |
| `first_use_support_agent` | First-Use Guide | Answer product questions in-app during first use and unblock setup | `docs_search`, `kb_vector_search`, `config_validator` | `max_iter: 5`, `max_retry_limit: 2`, `allow_delegation: true` (hands off to `escalation_agent`), `memory: false` |
| `escalation_agent` | Escalation Coordinator | Decide when a human is needed and hand off with complete context | `ticket_api`, `context_packager` | `max_iter: 2`, `max_retry_limit: 2`, `allow_delegation: false`, `memory: false` |

Crew-level controls (MVP baseline, adapter-compliant): `process=sequential`, `memory=false`, `max_rpm` set at crew level for budget stability, `max_execution_time` tuned per task. `max_iter` values above stay within the `<= 12` MVP baseline.

**Integration Requirements**

* APIs: customer/CRM read API, knowledge-base search, ticketing API (create ticket + attach context payload), LLM provider API.
* Storage (MVP): Postgres for customer profile, session and message history; managed vector store for KB retrieval. Deferred: analytics warehouse, behavioral event store.
* Auth/security: SSO (OAuth2) for the customer-facing surface; service tokens for internal APIs loaded from env vars (never hardcoded); strict tenant isolation enforced at query time on every read.
* Tool binding: JSON-serializable configs, secrets injected via env vars, tools validated before kickoff to avoid runtime binding errors.
* Performance targets: see §5.

**Infrastructure Specifications**

* MVP hosting: single-region managed container service + managed Postgres + managed vector store.
* Compute: 2 small app instances behind a load balancer; LLM inference is external (provider API), so local compute stays modest.
* Network/security: TLS everywhere, secrets in a managed secret store, PII redacted from Prompt Trace and Trace Log per `adapter-crewai` logging rules.
* Monitoring: structured logs per agent turn (agent id, tokens, latency, outcome) persisted under `project-context/2.build/logs`; error tracking; dashboard for escalation rate, grounded-answer rate, and resolution rate.

---

## 4. Functional Requirements

**Core Features (P0 — MVP)**

* **F1 — Welcome & Qualification.** *As a new customer, I want to be greeted and asked a few questions so the system understands my role and goal.*
  AC1: first response ≤ 3s after session start. AC2: captures role, primary use case, target timeline. AC3: writes a customer profile persisted for all later agents. AC4: ends with an explicit next step the customer accepts. AC5: completes in ≤ 5 turns. AC6 (ambiguity): if the customer's role or use case cannot be resolved with confidence ≥ 0.7 after the initial turn, `welcome_agent` MUST ask a targeted clarification question rather than guess; after **N=2** clarification attempts on the same slot without resolution, the slot is marked `ambiguous=true` in the profile and the session escalates via `escalation_agent` with the partial profile attached.

* **F2 — Personalized Onboarding Plan.** *As an implementer, I want a first-week plan with milestones so I know exactly what to do next.*
  AC1: plan generated from the profile written by F1 via `Task.context` — no re-asking. AC2: 3–5 milestones, each estimated ≤ 2h. AC3: each milestone links to a real doc or template. AC4: plan is persisted and retrievable in a later session.

* **F3 — First-Use In-App Support.** *As a customer using the app for the first time, I want to ask questions in context and get grounded answers.*
  AC1: answers cite the KB source used. AC2: answers respect the customer's stated use case. AC3: when the KB has no grounded answer, the agent says so and offers escalation rather than guessing. AC4: ≤ 500ms to first token (p95). AC5 (ambiguity): when the user's intent is unclear (multiple plausible KB matches with retrieval scores within a 0.1 delta, or grounding/model confidence < 0.6), `first_use_support_agent` MUST issue a single disambiguation question offering up to 3 concrete options plus "none of these"; after **N=2** unsuccessful clarification attempts on the same intent, the agent MUST refuse to answer, log the ambiguity, and offer escalation. AC6 (fallback): the agent MUST never fabricate a citation — if no source meets the grounding threshold, the deterministic fallback is refuse-and-escalate, not synthesize.

* **F4 — Escalation with Context.** *As a stuck customer, I want to reach a human without repeating my story.*
  AC1: escalation offered automatically after 2 failed resolution attempts on the same question. AC2: ticket created with profile + transcript + what was already tried. AC3: handoff completes ≤ 30s. AC4: human never has to re-ask information already captured — verified by handoff survey. AC5 (ambiguity payload): when the trigger for escalation is ambiguity, the ticket payload produced by `context_packager` MUST include a structured `ambiguity_report` field listing: the unresolved slot or intent, each clarification attempt (verbatim question, user response, confidence score), the candidate options that were considered, and the reason the agent could not decide. AC6: conflicting signals between phases (e.g., qualify phase captured "sponsor" role but user behavior in guided first use matches "implementer") MUST be flagged as ambiguity and either re-qualified (max 1 attempt) or escalated with both signals attached — never silently overwritten.

* **F5 — Sponsor Brief.** *As the sponsor, I want a short summary of value and timeline.*
  AC1: ≤ 1 page. AC2: includes expected time-to-value and the implementer's current plan status. AC3: generated on request, not pushed. AC4 (ambiguity): if key inputs from the qualify phase are missing or marked `ambiguous=true`, `sponsor_brief_agent` MUST use documented sponsor-brief defaults (from the template library) and clearly label those sections as "based on standard assumptions — pending confirmation" rather than inventing sponsor-specific numbers.

* **F6 — Error Handling for Ambiguous Work Requirements (cross-cutting).** *As a stakeholder, I want the crew to behave predictably when a user's request is ambiguous, so the system never silently guesses and every ambiguity is either resolved with the user or handed to a human with full context.*
  - **Definition of ambiguous work requirement (this system).** Any of the following situations detected by an agent during a task:
    (a) unclear user intent during welcome/qualify or guided first use (e.g., role, goal, timeline, or the specific product action requested cannot be inferred);
    (b) conflicting signals across phases (qualify output vs. observed behavior/questions during first use);
    (c) insufficient grounding for `first_use_support_agent` to produce a cited answer — no KB source clears the grounding threshold, or multiple plausible sources tie within the retrieval-score delta;
    (d) missing or contradictory fields in the customer profile object required by a downstream `Task.context`;
    (e) uncertainty about whether to escalate — signals from the session partially match the escalation policy without meeting all criteria.
  - **Expected agent behavior when ambiguity is detected.**
    AC1 (ask, don't guess): the affected agent MUST ask a single, targeted clarification question. Broad open-ended prompts are prohibited; agents must present concrete options (up to 3) plus "none of these / other".
    AC2 (bounded retries): the maximum number of clarification attempts per ambiguity instance is **N=2** across the session. After the Nth failed attempt, the agent MUST stop asking and trigger the deterministic fallback (below).
    AC3 (deterministic fallback): the fallback is selected in this order — (i) if a documented default exists for the missing slot in `template_library` (e.g., sponsor brief defaults, generic first-week plan skeleton), use it and label the output as "based on standard defaults"; (ii) otherwise, escalate to `escalation_agent` with a complete `ambiguity_report`. Agents MUST NOT synthesize customer-specific facts.
    AC4 (no fabrication / grounding): under ambiguity, `first_use_support_agent` MUST NOT emit an answer without a KB citation that meets the grounding threshold. Refusal + escalation is the required behavior (aligned with §5 grounded-answer NFR).
    AC5 (structured log): every ambiguity event MUST be written to a structured log record with fields `{session_id, agent_id, ambiguity_type (a|b|c|d|e), affected_slot_or_intent, attempts[], resolved (bool), fallback_taken, next_agent, timestamp}`. Logs persist under `project-context/2.build/logs` per `adapter-crewai` logging rules and are redacted of PII per §5 security.
    AC6 (guardrail enforcement): the "no fabrication + max-N clarifications + fallback path" contract MUST be enforced via CrewAI `Task.guardrail` on the affected tasks (welcome, first-use support, plan generation), not left to prompt discipline alone.
    AC7 (user transparency): when a clarification is requested, the agent states why it is asking; when the fallback is taken, the agent tells the user what defaults were applied or that a human is being brought in — never silent.
    AC8 (traceability): the resulting customer profile object exposes an `ambiguity_flags[]` array so downstream agents receive the ambiguity context via `Task.context` — no re-detection required.

**Enhanced Features (P1 — deferred)**

* Proactive confusion detection from in-app behavior signals (idle time, repeated clicks).
* Guided setup wizard with configuration validation and sandbox preview.
* Multilingual support beyond EN/PT-BR.

**Future Features (P2 — Future Work)**

* Continuous learning path / power-user certification after week 1.
* Churn-risk prediction during onboarding.
* Native mobile onboarding surface.
* Feedback loop that turns resolved escalations into new KB entries automatically.
* Dedicated intent-classification model (separate from the coordinating LLM) to score ambiguity earlier and more cheaply.
* Active learning: use human resolution of escalated ambiguity tickets to tune thresholds (`N`, confidence cutoffs, retrieval-score delta) and expand the disambiguation options library.
* Multi-turn negotiation policies beyond N=2 attempts, gated on evidence that additional turns improve resolution rate without hurting time-to-value.

---

## 5. Non-Functional Requirements

**Performance**

* First token ≤ 500ms (p95); full agent turn ≤ 3s (p95); escalation handoff ≤ 30s.
* Concurrency (MVP): 100 simultaneous onboarding sessions.
* Availability target: 99.5% for MVP (business hours critical), degrading gracefully to "contact support" on outage.
* Clarification prompt latency: an ambiguity-triggered clarification question MUST be delivered within the same turn budget as any other agent turn (first token ≤ 500ms p95, full turn ≤ 3s p95). No additional latency budget is granted for ambiguity handling.
* Deterministic-fallback path (documented defaults or escalation): end-to-end from ambiguity detection to fallback delivered ≤ 5s (p95).

**Observability for Ambiguity**

* Ambiguity events MUST be emitted as structured log records (schema in F6/AC5) to `project-context/2.build/logs` with PII redacted (aligned with `adapter-crewai` logging rules).
* Required KPIs derived from these logs: ambiguity rate (events per session), ambiguity resolution rate (resolved by clarification vs. fallback), fabrication rate (target 0), and average clarification attempts per event.
* Log format: newline-delimited JSON with the fields defined in F6/AC5; consumed by monitoring dashboard alongside escalation rate and grounded-answer rate.

**Security & Compliance**

* Customer data encrypted at rest and in transit; PII masked in logs and excluded from prompt telemetry / Prompt Trace.
* Access control: SSO for customers, role-based access for internal reviewers; per-tenant isolation enforced at query level.
* Compliance: LGPD/GDPR — data retention 90 days for transcripts, deletion on request.
* Secrets: never embedded in artifacts or committed config; all injected via env vars with `.env.example` published (per `aamad-core` security policy).
* A Security Assessment (`security.md` from `@security.eng`) is required before Deliver — `aamad.config.example.yml` sets `security.require_security_assessment: true`.

**Scalability & Reliability**

* MVP scaling: manual horizontal scale-out; auto-scaling deferred (documented, not built).
* Fault tolerance: LLM/provider failure → circuit breaker → escalate to human queue with a clear message. Tool failure → retry `max_retry_limit=2` then escalate. No silent failures.
* Recovery: nightly backups; RPO 24h, RTO 4h for MVP.

---

## 6. User Experience Design

**Interface Requirements**

* Surfaces: chat panel embedded in the web app (MVP) + email fallback for the sponsor brief. Mobile-responsive; native mobile deferred.
* Interaction pattern: conversational, short turns, always ending with a concrete suggested next action.
* Accessibility: WCAG 2.1 AA — keyboard navigable, ARIA-labelled, 4.5:1 contrast minimum.

**Agent Interaction Design**

* Communication: the agent introduces itself as AI on first contact; tone is warm and direct; steps are numbered when procedural.
* Error handling: when uncertain, the agent states the limit and offers escalation instead of guessing; validation errors explain the expected format. For **ambiguous work requirements** specifically (see F6), the agent asks a targeted clarification with up to 3 concrete options plus "none of these", caps clarifications at N=2 per ambiguity instance, and then takes the deterministic fallback (documented defaults or escalation with a full `ambiguity_report`). Agents never fabricate a customer-specific answer, and never silently overwrite an earlier signal — conflicts are surfaced.
* Transparency: answers cite their KB source; when routing or escalating, the agent explains why; when a clarification is asked, the agent states why it needs to ask; when a documented default is applied under ambiguity, the output is explicitly labeled "based on standard defaults — pending confirmation"; a "talk to a human" affordance is always visible.

---

## 7. Success Metrics & KPIs

**Business / Operational**

* Time-to-first-successful-use: ≤ 5 days (from 14–21 baseline assumption).
* Setup completion rate: ≥ 80% (from ~60% baseline assumption).
* Onboarding-related support tickets: −50%.

**Technical**

* Routing accuracy (correct track chosen by `welcome_agent`): ≥ 90%.
* Escalation rate: ≤ 15% of sessions at MVP (target ≤ 5% after tuning).
* Grounded-answer rate (answer cites a real KB source): ≥ 95%; hallucination reports ≈ 0.
* Cost per onboarding session: within agreed budget (value TBD — see Open Questions).
* Ambiguity handling: fabrication rate under ambiguity = 0; ambiguity resolution rate (resolved by clarification within N=2 attempts) ≥ 60% at MVP; deterministic fallback taken (defaults or escalation) on 100% of unresolved ambiguity events.

**User Experience**

* Onboarding CSAT ≥ 4.5/5.
* Plan-completion rate (milestones finished in week 1): ≥ 70%.
* Zero re-explanation on escalation, verified by human-agent handoff survey.

---

## 8. Implementation Strategy

**Development Phases**

* **Phase 1 — Define:** MRD (skipped, N/A) → system concept elicited inline → **this PRD** → `sad.md` by `@system.arch`.
* **Phase 2 — Build:** `@project.mgr` scaffolds (`setup.md`) → `@frontend.eng` chat surface (`frontend.md`) → `@backend.eng` crew + tools per `adapter-crewai` (`backend.md`) → `@integration.eng` CRM/KB/ticket wiring (`integration.md`) → `@qa.eng` unit + integration + smoke (`qa.md`) → `@security.eng` pre-deliver review (`security.md`).
* **Phase 3 — Deliver:** `@devops.eng` deploy config, env matrix, rollback (`deploy.md`); `user-guide.md` (config requires user documentation).

**Resource Requirements (MVP)**

* ~4 people × 5–6 weeks: 1 PM, 1 backend, 1 frontend, 0.5 QA, 0.25 DevOps.
* External cost: LLM provider usage + managed Postgres/vector store.

**Risk Mitigation**

| Risk | Impact | Mitigation |
|---|---|---|
| Ungrounded/hallucinated answers | High | Retrieval-grounded answers only; refuse-and-escalate when no source found; QA suite of adversarial questions; `Task.guardrail` for grounding checks |
| Context lost between agents | High | Single persisted profile object passed via `Task.context`; integration tests assert profile completeness at each handoff |
| Escalation queue overloaded at launch | Medium | Beta cohort only; cap concurrent sessions; monitor escalation rate daily |
| LLM cost per session exceeds budget | Medium | Cap `max_iter` per agent; trim context passed per turn; set `max_rpm` at crew level; track cost per session from day 1 |
| Customers reject AI-first onboarding | Medium | Always-visible "talk to a human" affordance; measure opt-out rate |
| Runtime binding errors from YAML | Low | Validate tools before kickoff per `adapter-crewai`; halt with Diagnostic on unresolved bindings |
| Ambiguous work requirements cause silent guessing or looping clarifications | High | F6 contract: N=2 clarification cap, deterministic fallback (defaults or escalation), `Task.guardrail` enforcement, structured ambiguity log; monitor ambiguity rate and fabrication rate per §5 Observability |

---

## 9. Launch & Go-to-Market Strategy

**N/A** for MVP — internal capability, launched to a controlled beta cohort of new signups rather than sold or marketed. Rollout: internal dogfood → 20-customer beta with human coordinator on standby → general enablement once escalation rate and CSAT thresholds in §7 are met. See Assumptions.

---

## Quality Assurance Checklist

- [x] Requirements traceable to system concept and recorded Assumptions (MRD skipped)
- [x] Technical specifications feasible with the `crewai` adapter (roles/goals/tools/`max_iter`/`allow_delegation`/`memory` posture expressed in adapter terms; YAML externalization required)
- [x] Success metrics aligned with the stated problem (time-to-value, completion, ticket deflection)
- [x] MVP (P0) vs Enhanced (P1) vs Future Work (P2) boundaries explicit
- [x] Market sections marked N/A where MRD was intentionally skipped

## Sources

* Stakeholder input: capstone use case selection combining "initial point of contact" and "first-use support" (verbatim quote captured in project brief).
* Reference draft: `project-context/1.define/prd_teste.md` — earlier user-authored draft that this canonical PRD builds on and reconciles with adapter-crewai rules.
* AAMAD v0.7.5 framework rules: `.claude/rules/aamad-core.md`, `.claude/rules/adapter-crewai.md`, `.claude/rules/adapter-registry.md`, `.claude/rules/epics-index.md`.
* Project configuration: `aamad.config.example.yml` (runtime target, security assessment requirement, documentation requirement, testing requirement).
* Template: `.cursor/templates/prd-template.md`.

## Assumptions

* **MRD skipped** deliberately: internal MVP for a course capstone, no commercial market case required. All market sizing/pricing marked N/A.
* Baseline figures (14–21 day time-to-value, ~40% ticket share, ~60% setup completion) are **illustrative placeholders** pending real product analytics — every metric in §7 must be re-baselined before Build sign-off.
* An existing knowledge base with reasonable coverage is available for retrieval; without it, F3 grounding is not achievable.
* Human support capacity exists to absorb escalations during business hours.
* `AAMAD_TARGET_RUNTIME` env var is unset; runtime resolved from `aamad.config.example.yml` `runtime.target: crewai`. Operator override would take precedence per `adapter-registry` rules.
* Go-to-market is N/A; rollout is a controlled internal beta.
* Memory posture set to `false` at MVP for reproducibility; `@system.arch` may justify enabling per-agent memory in SAD, in which case scope and retention must be documented.
* Ambiguity thresholds are illustrative MVP defaults: qualify confidence < 0.7, support grounding/model confidence < 0.6, retrieval-score delta ≤ 0.1 between top KB matches, N=2 clarification attempts per ambiguity instance. Final values MUST be validated by `@system.arch` against the chosen model/provider and by `@qa.eng` against adversarial test suites; treat these as tunable, not contractual.
* A `template_library` of documented defaults exists (or will be curated during Build) for sponsor briefs and generic first-week plans, enabling the F6 deterministic fallback without fabrication.
* PII redaction hooks are available for the structured ambiguity log so raw user utterances captured during clarification attempts can be persisted safely under `project-context/2.build/logs`.

## Open Questions

1. Which LLM provider and model tier — cost vs latency vs grounding quality? (→ `@system.arch`)
2. What is the accepted **cost ceiling per onboarding session**? (→ stakeholder)
3. Real baselines for time-to-value, setup completion and ticket mix — where does the data come from? (→ stakeholder/analytics)
4. Is escalation coverage 24/5 or 24/7, and what SLA do we commit to? (→ Customer Success)
5. Does the sponsor brief require human review before it reaches the customer? (→ stakeholder)
6. How much session context is passed per agent turn — full transcript or rolling window? (→ `@system.arch`)
7. Is proactive confusion detection (P1) in or out for the first release, given it needs a behavioral event pipeline? (→ PM)
8. Should any agent memory be enabled at MVP (currently `memory=false` for reproducibility), and if so, what retention window? (→ `@system.arch`)
9. Are `welcome_agent` and `first_use_support_agent` the only agents that require `allow_delegation=true`, or does the SAD tighten this further? (→ `@system.arch`)
10. Which confidence signal does the crew rely on for the ambiguity thresholds — model-reported logprobs, a self-critique score, retrieval-score delta, or a combination — and how is it calibrated per agent? (→ `@system.arch`)
11. Should the N=2 clarification cap be global per ambiguity instance or per agent (i.e., does a re-attempt by a downstream agent reset the counter)? Current default: global per instance. (→ `@system.arch` / stakeholder)
12. Where does the curated `template_library` of ambiguity fallback defaults live and who owns curation (Customer Success vs. PM)? (→ stakeholder)
13. What is the review workflow for tickets escalated with an `ambiguity_report` — do they route to a specific queue, and is there an SLA distinct from normal escalations? (→ Customer Success)
14. For conflicting-signal cases (e.g., role changed between qualify and first use), does the customer see the conflict surfaced explicitly, or is it only reflected in the ticket payload? (→ UX / stakeholder)

## Audit

* **Timestamp:** 2026-08-18
* **Persona id:** `product-mgr`
* **Action:** `create-prd`
* **Resolved AAMAD_TARGET_RUNTIME:** crewai — source: aamad.config.example.yml (runtime.target); env var not set; no aamad.config.yml present
* **Adapter rules applied:** `.claude/rules/adapter-crewai.md`
* **Artifact path:** `project-context/1.define/prd.md`
* **Next artifact:** `project-context/1.define/sad.md` by `@system.arch`
* **Prompt Trace:** omitted at PRD stage — deterministic template-driven authoring off a user-provided reference draft (`prd_teste.md`); low-risk Define artifact. Prompt Trace will be captured for production-facing Build/Deliver artifacts per `aamad-core` policy.

---

* **Timestamp:** 2026-08-23
* **Persona id:** `product-mgr`
* **Action:** `update-prd-ambiguity-handling`
* **Resolved AAMAD_TARGET_RUNTIME:** crewai — source: aamad.config.example.yml (runtime.target); env var not set; no aamad.config.yml present
* **Adapter rules applied:** `.claude/rules/adapter-crewai.md` (guardrails, structured logging, deterministic fallback)
* **Changes:** added ambiguity-handling ACs to F1, F3, F4, F5; added cross-cutting **F6 — Error Handling for Ambiguous Work Requirements** with definition, expected agent behavior (ask, bounded retries N=2, deterministic fallback, no fabrication, structured log, guardrail enforcement, transparency, traceability); extended §5 Performance and added §5 Observability for Ambiguity; extended §6 Error Handling and Transparency; added Risk row for ambiguity; added technical KPI targets (fabrication rate = 0; ambiguity resolution rate ≥ 60%); added P2 Future Work items (intent classification, active learning, multi-turn negotiation); added Assumptions on thresholds, template library, and PII redaction; added Open Questions #10–#14.
* **Artifact path:** `project-context/1.define/prd.md`
* **Prompt Trace:** omitted — deterministic edit within existing Define artifact per `aamad-core` policy (low-risk Define update; Prompt Trace reserved for production-facing Build/Deliver artifacts).
