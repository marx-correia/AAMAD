# Multi-Agent Customer Onboarding Crew

> An AI agent crew that greets new B2B SaaS customers after signup, personalizes their first-week plan, guides them through first use in-app, and escalates to a human with full context when it cannot help.

[![Status: Phase 1 Define complete](https://img.shields.io/badge/status-Phase%201%20Define%20complete-blue)]()
[![Runtime: crewai](https://img.shields.io/badge/runtime-crewai-orange)]()
[![Type: Internal capstone MVP](https://img.shields.io/badge/type-internal%20capstone-lightgrey)]()

---

## Table of Contents

- [Project overview](#project-overview)
- [Problem statement and value proposition](#problem-statement-and-value-proposition)
- [Key features](#key-features)
- [Application architecture overview](#application-architecture-overview)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Next steps for contributors](#next-steps-for-contributors)
- [Open questions](#open-questions)
- [Sources](#sources)
- [Assumptions](#assumptions)
- [Audit](#audit)

---

## Project overview

- **Project name:** Multi-Agent Customer Onboarding Crew
- **Tagline:** From signup to first successful use — an AI crew that never loses context.
- **Status:** Phase 1 **Define complete** (PRD authored). Phase 2 **Build not started** — SAD (`@system.arch`), Setup (`@project.mgr`), Frontend (`@frontend.eng`), Backend (`@backend.eng`), Integration (`@integration.eng`), QA (`@qa.eng`), and Security (`@security.eng`) artifacts are pending. No application code exists yet.
- **Target runtime:** `crewai` (resolved from `aamad.config.example.yml` `runtime.target`; `AAMAD_TARGET_RUNTIME` environment variable not set — see [Assumptions](#assumptions)).
- **Nature:** Internal-facing capstone MVP built with the **AAMAD** (AI-Assisted Multi-Agent Application Development) framework. No commercial market case; MRD intentionally skipped (see PRD Input Requirements).

---

## Problem statement and value proposition

Summarized from PRD §1 (Executive Summary). All quantitative baselines below are **assumed placeholders** pending real product analytics — see PRD Assumptions.

**Problem (baseline assumed)**

- New B2B SaaS customers land in the product after signup with no guided path; they read scattered docs, guess at setup, and open support tickets for questions the docs already answer.
- Time-to-first-successful-use: **14–21 days**.
- ~**40%** of first-30-day support tickets are repeat onboarding questions.
- ~**40%** of new signups never complete initial setup.

**Value proposition**

- A 5-agent crew covering the full onboarding arc — **welcome & qualify → sponsor brief → personalized plan → guided first use → escalate with context** — keeps every job auditable and every prompt small (PRD §1).
- Expected outcomes (PRD §1 / §7): time-to-first-value **≤ 5 days**, setup completion **≥ 80%**, onboarding-related support tickets **−50%**.
- Onboarding capacity becomes independent of headcount; support shifts from repetitive Q&A to complex cases (PRD §1).

Market sizing and go-to-market are marked N/A in the PRD (internal capability, controlled beta).

---

## Key features

MVP scope (P0) from PRD §4 Functional Requirements. One line per feature.

- **F1 — Welcome & Qualification.** Greets the customer, captures role, primary use case, and target timeline into a persisted customer profile; asks targeted clarifications (N=2 max) when confidence is low. *(PRD §4 F1)*
- **F2 — Personalized Onboarding Plan.** Generates a first-week plan with 3–5 milestones (each ≤ 2h) from the qualified profile via `Task.context` — no re-asking. *(PRD §4 F2)*
- **F3 — First-Use In-App Support.** Answers in-context product questions with grounded KB citations; refuses and escalates when no source clears the grounding threshold — never fabricates. *(PRD §4 F3)*
- **F4 — Escalation with Context.** Hands off to a human after two failed attempts with a full context package (profile + transcript + what was tried), including a structured `ambiguity_report` when relevant. *(PRD §4 F4)*
- **F5 — Sponsor Brief.** On-request one-page value/ROI summary for the business sponsor; uses documented defaults labeled "based on standard assumptions" when qualify inputs are missing. *(PRD §4 F5)*
- **F6 — Error Handling for Ambiguous Work Requirements (cross-cutting).** Contract for ambiguity: ask targeted clarifications with up to 3 concrete options, cap at N=2 attempts, take a deterministic fallback (documented defaults or escalation with full `ambiguity_report`), never fabricate, enforce via CrewAI `Task.guardrail`, and log every ambiguity event as structured JSON. *(PRD §4 F6)*

Enhanced (P1) and Future (P2) items — proactive confusion detection, guided setup wizard, multilingual beyond EN/PT-BR, churn-risk prediction, dedicated intent classifier, active learning — are documented in PRD §4 as deferred.

---

## Application architecture overview

The crew is a **sequential CrewAI process** with a triage branch, where `welcome_agent` runs first and routes downstream via explicit `Task.context` chaining. `escalation_agent` is invoked from the support task on failure/exhaustion (PRD §3).

The 5 agents and their roles (PRD §3, Core Agent Definitions table):

| # | Agent | Role | Goal |
|---|-------|------|------|
| 1 | `welcome_agent` | Onboarding Greeter & Qualifier | Identify who the customer is and route them to the right track |
| 2 | `sponsor_brief_agent` | Business Sponsor Liaison | Give the sponsor a short value/ROI summary and expected timeline |
| 3 | `onboarding_plan_agent` | Onboarding Planner | Produce a personalized first-week plan with concrete daily milestones |
| 4 | `first_use_support_agent` | First-Use Guide | Answer product questions in-app during first use and unblock setup |
| 5 | `escalation_agent` | Escalation Coordinator | Decide when a human is needed and hand off with complete context |

**Shared context:** a customer profile object (role, goal, use case, timeline, `ambiguity_flags[]`) produced by `welcome_agent` and passed as `Task.context` to every downstream agent — no re-asking, no shared mutable state (PRD §3, §4 F6/AC8).

**Runtime posture (MVP, per `adapter-crewai` rules):**

- `process=sequential`, `memory=false` at crew level for reproducibility.
- Agent/task definitions externalized to `config/agents.yaml` and `config/tasks.yaml`; wired by `crew.py`.
- `allow_delegation=false` by default; only `welcome_agent` and `first_use_support_agent` currently declare `allow_delegation=true` (pending SAD confirmation).
- `max_iter` per agent within the ≤ 12 MVP baseline; `max_retry_limit=2`; `max_rpm` set at crew level.

> **Important:** The complete solution architecture — component diagram, data model, deployment topology, tool contracts, memory decisions, and delegation boundaries — will be authored by **`@system.arch`** in `project-context/1.define/sad.md`. That artifact does **not yet exist**. Details in this section reflect PRD intent only and are subject to SAD confirmation.

---

## Getting started

> **Honest placeholder.** The target runtime is `crewai`, but **no application code has been written yet**. This section describes the *expected* setup based on PRD §3 and `.claude/rules/adapter-crewai.md`. Concrete commands, dependency pins, and entrypoints will be provided by **`@backend.eng`** during Phase 2 Build (`project-context/2.build/setup.md` and `backend.md`).

### Expected prerequisites (per adapter-crewai)

- **Python** (LTS version to be pinned by `@backend.eng` in `setup.md`).
- **CrewAI** (`pip install crewai` — exact version to be pinned during Build).
- LLM provider credentials — the specific provider is an [open question](#open-questions) (see PRD Open Question #1). At minimum, expect an API key such as `ANTHROPIC_API_KEY` or the equivalent for the resolved provider, plus any gateway/base URL settings your organization uses.
- Access to the integration surfaces named in PRD §3: a customer/CRM read API, a KB search endpoint, a ticketing API, and a managed vector store. Endpoints and credentials **TBD by `@integration.eng`**.

### Expected environment variables

To be finalized in `.env.example` published by `@backend.eng` / `@integration.eng`. At minimum (per PRD §5 Security and `adapter-crewai` rules), secrets must be loaded from env vars and never embedded in artifacts:

- `<LLM_PROVIDER_API_KEY>` — e.g. `ANTHROPIC_API_KEY` (pending Open Question #1).
- `CRM_API_TOKEN` — service token for CRM reads.
- `KB_SEARCH_API_KEY` — KB / vector store credentials.
- `TICKETING_API_TOKEN` — ticket creation credentials.
- `DATABASE_URL` — managed Postgres for customer profile, session, and message history.
- `CREWAI_STORAGE_DIR` — only if memory is enabled per SAD justification; must be project-scoped.

### Expected runtime layout (per adapter-crewai)

```
<generated-app>/
├── config/
│   ├── agents.yaml      # 5-agent definitions (welcome, sponsor_brief, plan, first_use, escalation)
│   └── tasks.yaml       # sequential task graph with Task.context chaining
├── crew.py              # runtime entrypoint that wires YAML into a Crew and calls kickoff()
├── tools/               # tool bindings (crm_lookup, docs_search, kb_vector_search, ticket_api, ...)
└── .env.example         # required env var names (no values)
```

### Expected run command

**Not yet defined.** The concrete kickoff command (e.g. `python -m <package>.crew` or `crewai run`) will be documented by `@backend.eng` in `project-context/2.build/backend.md` and by `@project.mgr` in `setup.md`.

Until then, no runnable entrypoint exists in this repository.

---

## Project structure

Actual layout of this repository (verified via `Glob` on 2026-08-23). Items marked *planned* do not exist yet and will be authored by the persona listed in [Next steps](#next-steps-for-contributors).

```
myproject/
├── .claude/
│   ├── CLAUDE.md                 # Rules summary + cross-references
│   ├── agents/                   # Persona definitions (product-mgr, system-arch, backend-eng, ...)
│   ├── commands/                 # Slash commands (phase-1-define, sync-docs)
│   ├── rules/                    # AAMAD core + workflow + adapter rules
│   └── settings.json             # Permissions, AAMAD_TARGET_RUNTIME env (if set)
├── .cursor/
│   └── templates/                # PRD, SAD, SFS, MRD, user-guide, system-description, user-story templates
├── project-context/
│   ├── 1.define/
│   │   ├── prd.md                # EXISTS — Product Requirements Document (PRD)
│   │   └── sad.md                # PLANNED — Solution Architecture Document (@system.arch)
│   ├── 2.build/
│   │   ├── setup.md              # PLANNED — Environment scaffolding (@project.mgr)
│   │   ├── frontend.md           # PLANNED — Chat surface (@frontend.eng)
│   │   ├── backend.md            # PLANNED — Crew + tools (@backend.eng)
│   │   ├── integration.md        # PLANNED — CRM/KB/ticket wiring (@integration.eng)
│   │   ├── qa.md                 # PLANNED — Unit + integration + smoke (@qa.eng)
│   │   └── security.md           # PLANNED — Pre-deliver review (@security.eng)
│   └── 3.deliver/
│       ├── deploy.md             # PLANNED — Deploy config + runbook (@devops.eng)
│       └── user-guide.md         # PLANNED — User documentation (@devops.eng)
├── aamad.config.example.yml      # Runtime target, security/testing/docs preferences
├── AGENTS.md                     # IDE-agnostic bridge file
├── CHECKLIST.md                  # Define → Build → Deliver checklist
└── README.md                     # This file
```

No application code (`config/agents.yaml`, `crew.py`, tools, tests) exists yet. The `project-context/2.build/` and `project-context/3.deliver/` directories currently contain only `.gitkeep` placeholders.

---

## Next steps for contributors

Follows the AAMAD workflow defined in [`.claude/rules/epics-index.md`](.claude/rules/epics-index.md) and [`.claude/rules/development-workflow.md`](.claude/rules/development-workflow.md). Each persona works in a **fresh context**, reads its declared inputs (PRD/SAD/prior artifacts), and writes only its declared output.

| Order | Persona | Invocation | Output artifact | Status |
|-------|---------|------------|-----------------|--------|
| 1 | `@system.arch` | `*create-sad` | `project-context/1.define/sad.md` | Next up |
| 2 | `@project.mgr` | `*setup-project` | `project-context/2.build/setup.md` | Pending SAD |
| 3 | `@backend.eng` | `*develop-be` | `project-context/2.build/backend.md` | Pending SAD + setup |
| 4 | `@frontend.eng` | `*develop-fe` | `project-context/2.build/frontend.md` | Pending SAD + setup |
| 5 | `@integration.eng` | `*integrate-api` | `project-context/2.build/integration.md` | Pending backend + frontend |
| 6 | `@qa.eng` | `*qa` | `project-context/2.build/qa.md` | Pending integration |
| 7 | `@security.eng` | `*assess-security` | `project-context/2.build/security.md` | Pending QA (required — `security.require_security_assessment: true`) |
| 8 | `@devops.eng` | `*prepare-release` / `*document-deploy` / `*document-user-guide` | `project-context/3.deliver/deploy.md`, `user-guide.md` | Pending security |

**Immediate next action:** invoke `@system.arch` with `*create-sad` to produce the Solution Architecture Document. The SAD must resolve PRD Open Questions #1 (LLM provider/model tier), #6 (context window strategy), #8 (memory posture), #9 (delegation boundaries), and #10 (ambiguity confidence signal) — see [Open questions](#open-questions).

---

## Open questions

Carried over from PRD Open Questions (§Open Questions). Contributors should not fabricate answers; each must be resolved by the persona or stakeholder indicated.

1. LLM provider and model tier — cost vs latency vs grounding quality? *(→ `@system.arch`)*
2. Accepted cost ceiling per onboarding session? *(→ stakeholder)*
3. Real baselines for time-to-value, setup completion, and ticket mix? *(→ stakeholder / analytics)*
4. Escalation coverage — 24/5 or 24/7, and SLA? *(→ Customer Success)*
5. Does the sponsor brief require human review before reaching the customer? *(→ stakeholder)*
6. Session context window per agent turn — full transcript or rolling? *(→ `@system.arch`)*
7. Is proactive confusion detection (P1) in or out for the first release? *(→ PM)*
8. Should any agent memory be enabled at MVP? *(→ `@system.arch`)*
9. Are `welcome_agent` and `first_use_support_agent` the only agents needing `allow_delegation=true`? *(→ `@system.arch`)*
10. Which confidence signal backs the ambiguity thresholds (logprobs, self-critique, retrieval delta, hybrid)? *(→ `@system.arch`)*
11. N=2 clarification cap — global per instance or per agent? *(→ `@system.arch` / stakeholder)*
12. Where does the curated `template_library` of ambiguity fallback defaults live, and who owns it? *(→ stakeholder)*
13. Review workflow / SLA for tickets escalated with `ambiguity_report`? *(→ Customer Success)*
14. Conflicting-signal cases — is the conflict surfaced to the customer or only in the ticket payload? *(→ UX / stakeholder)*

Additional README-specific TBDs pending Build-phase authorship:

- Concrete Python version, CrewAI version, and dependency pins *(→ `@backend.eng` in `setup.md` / `backend.md`)*.
- Concrete `.env.example` file contents *(→ `@backend.eng` / `@integration.eng`)*.
- Runnable kickoff command and local dev workflow *(→ `@backend.eng` in `backend.md`)*.
- Hosting target, ports, and health-check endpoints *(→ `@devops.eng` in `deploy.md`)*.

---

## Sources

- `project-context/1.define/prd.md` — Product Requirements Document (§1 Executive Summary, §3 Technical Requirements, §4 Functional Requirements F1–F6, §5 Non-Functional Requirements, §7 Success Metrics, §8 Implementation Strategy, Assumptions, Open Questions, Audit).
- `aamad.config.example.yml` — resolved runtime target (`crewai`) and security assessment requirement.
- `.claude/rules/aamad-core.md` — persona contract, artifact rules, security policy.
- `.claude/rules/adapter-crewai.md` — CrewAI runtime setup, mapping, execution, tools, logging, quality gates.
- `.claude/rules/epics-index.md` — persona → epic → artifact mapping used in [Next steps](#next-steps-for-contributors).
- `.claude/rules/development-workflow.md` — modular Build workflow guidance.
- Repository file listing via `Glob` on 2026-08-23 (verifies [Project structure](#project-structure)).

---

## Assumptions

- **Runtime resolution:** `AAMAD_TARGET_RUNTIME` env var is unset at authoring time; runtime resolved from `aamad.config.example.yml` `runtime.target: crewai`. Operator override takes precedence per `adapter-registry` rules.
- **Baseline metrics** in [Problem statement](#problem-statement-and-value-proposition) are illustrative placeholders inherited from the PRD, pending real product analytics (PRD Assumptions).
- **No application code exists yet.** All runtime instructions in [Getting started](#getting-started) are honest placeholders that will be replaced by Phase 2 Build artifacts.
- **MRD skipped** deliberately (internal capstone MVP, no commercial market case).
- **Architecture details** in [Application architecture overview](#application-architecture-overview) reflect PRD intent only and are subject to confirmation in `sad.md` by `@system.arch`.
- **Ambiguity thresholds** (N=2 clarifications, confidence < 0.7 for qualify, < 0.6 for grounding, retrieval delta ≤ 0.1) are MVP defaults per PRD Assumptions — tunable, not contractual.

---

## Audit

- **Timestamp:** 2026-08-23
- **Persona id:** `product-mgr`
- **Action:** `*create-readme`
- **Resolved AAMAD_TARGET_RUNTIME:** crewai — source: aamad.config.example.yml (runtime.target); env var not set; no aamad.config.yml present
- **Adapter rules applied:** `.claude/rules/adapter-crewai.md`, `.claude/rules/aamad-core.md`, `.claude/rules/epics-index.md`, `.claude/rules/development-workflow.md`
- **Inputs read:** `project-context/1.define/prd.md`, `aamad.config.example.yml`, prior `README.md`, repository file listing via `Glob`
- **Output written:** `README.md` (project-level, replaces prior framework-level README)
- **Prompt Trace:** omitted — deterministic template-driven authoring off the existing PRD as source-of-truth; low-risk Define-adjacent artifact per `aamad-core` policy. Prompt Trace will be captured for production-facing Build/Deliver artifacts.
