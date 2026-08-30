# Critical Onboarding Workflow — Frontend Functional Spec

Scope: the Sprint 1 vertical slice defined in `project-context/1.define/sad.md` §1 "Sprint 1 Scope (Vertical Slice)". This spec is the FE-side contract that keeps the running code (`frontend/`) in lockstep with the SAD/PRD. It is intentionally narrow — deferred surfaces are called out but not detailed here.

Traceability anchors:
- PRD §4 F1 (welcome/qualify), F2 (plan), F3 (grounded first-use support), F4 (escalate with context).
- SAD ADR-013 (Sprint 1 = vertical slice), ADR-014 (stub-first tools), ADR-015 (Pydantic output contracts), ADR-016 (orchestrator pattern), ADR-011 (ambiguity), ADR-009 (grounding guardrail).
- SAD §4 SSE envelope (`event: token | tool | cite | state | error | done`) — preserved verbatim, not weakened. Per this review pass, SSE wiring is DEFERRED (stubs only); the envelope contract remains the target.

## User-visible status vocabulary

The banner, button labels, inline messages, and history entries reuse EXACTLY four tokens in user-visible copy: `idle`, `running`, `done`, and `error`. Synonyms ("in progress", "complete", "failed", "success") are banned. The internal FSM (`src/machines/runMachine.ts`) still tracks `error` and `escalated` as terminal branches; the user-visible copy collapses `escalated` to `done` in the banner and history so the operator only sees three status words, plus `error` as a banner state (not a fourth status word).

## Status banner (first-class UI)

A pinned `<CrewStatusBanner>` (`src/components/RunStatusBadge.tsx`, exported as `CrewStatusBanner` with a `RunStatusBadge` back-compat alias) lives in `<header class="app-header">` and shows three things:

| Element | Content | Notes |
|---|---|---|
| Label | `Crew: idle` / `Crew: running` / `Crew: done` / `Crew: error` | Same four tokens as the vocabulary above. |
| Indicator pill | Colored dot immediately before the label. | gray = idle, blue = running, green = done, red = error. |
| Last updated | `Last updated: <local time>` next to the label. | Updated on every FSM transition and every stub resolution so the operator can tell the stubs are alive and the UI is reactive. |

The banner is `role="status"` with `aria-live="polite"` and `aria-atomic="true"` so screen readers announce every transition.

## Inputs

The Inputs form collects the fields that will populate `CustomerProfile` (SAD ADR-015). Sprint 1 exposes only the fields the operator can enter directly; `session_id`, `tenant_id`, `ambiguity_flags`, `confidence`, `next_track`, and `created_at` are backend-owned and NOT rendered in the form.

| UI field | Type | Validation | Maps to (Pydantic contract field) |
|---|---|---|---|
| Role | `select` (`implementer` \| `sponsor` \| `unknown`) | Required. Enum. | `CustomerProfile.role` |
| Primary use case | `text` (single-line) | Required, non-empty, `<= 200` chars. | `CustomerProfile.primary_use_case` |
| Target timeline | `text` (single-line) | Required, non-empty, `<= 80` chars. | `CustomerProfile.timeline` |
| Locale | `select` (`en` \| `pt-BR`) | Required. Enum. Defaults to `en` (SAD §3 i18n default). | `CustomerProfile.locale` |

The Sprint 1 stub packs these fields into `CustomerProfileInput` (see `frontend/src/types/contracts.ts`). Backend-owned fields are filled by `fakeProfileFromInput` in `frontend/src/services/run.ts`; on integration, they will come from the `POST /v1/sessions` response (SAD §4) and the emitted `state` events on the SSE stream.

Deferred inputs (not rendered in Sprint 1):
- SSO/tenant login — deferred per SAD "Deferred — Post-Sprint-1" (OAuth SSO polish). Sprint 1 runs as an anonymous/dev session; `tenant_id` is hardcoded to `"dev-tenant"` in the stub.
- Ambiguity clarification composer — deferred with the ADR-011 full calibration. When it lands, it will render the last `AmbiguityFlag` in `CustomerProfile.ambiguity_flags[]` and let the user pick one of up to 3 options plus "none of these" (PRD F6 AC1), capped at `N=2` (ADR-011).

## Run

`startRun` is invoked from `OnboardingForm.onSubmit` in `frontend/src/App.tsx` (via the `executeRun` helper) and dispatches the FSM `START` event before any async work. The FSM lives in `frontend/src/machines/runMachine.ts` as a handwritten reducer (no XState) — the operator brief scoped this to a minimal handwritten machine.

Happy path (user-visible): `idle → running → done`. Error is surfaced as an inline banner during the `running → error` transition, NOT as a fourth status word in the header banner. `escalated` remains an internal terminal branch for the "Talk to a human" affordance; the user-visible copy collapses it to `done`.

FSM (authoritative — see `runMachineReducer`):

- `idle` → `START` → `running`
- `running` → `STREAM_DONE` → `done`
- `running` → `STREAM_ERROR { code, message }` → `error` (internal terminal; UI shows the inline error banner with `Retry` + `Reset`)
- `running` → `ESCALATE` → `escalated` (internal terminal; UI still reads `Crew: done`)
- `done` → `ESCALATE` → `escalated` (user clicks "Talk to a human" after seeing the plan/support answer — PRD §6 keeps the affordance visible on terminal success)
- any terminal → `RESET` → `idle`

All other transitions are no-ops (idempotent). `isTerminal(status)` is exported for the UI.

### Error handling via inline Retry (same inputs)

- On `STREAM_ERROR`, the app renders an `.error-banner` (`role="alert"`) with the error message plus two buttons: `Retry` (primary) and `Reset` (ghost).
- `Retry` replays `startRun` with the **same** input payload — no diff view, no edit surface. Achieved by retaining `lastInput` in `App` state and passing it back to `executeRun`.
- `Reset` returns the FSM to `idle` and clears `lastInput`.
- The header banner collapses `error` back to "Crew: error" with the red pill; when Retry fires, the banner immediately re-reads `Crew: running` (blue pill) and the `Last updated` timestamp advances.

## Controls

The controls surface after this review pass is deliberately narrow:

| Control | Where | What it does |
|---|---|---|
| `Run` | Submit button on `<OnboardingForm>`. | Dispatches `START`; calls the stub chain. Disabled while `status === "running"`. |
| `Reset` | Ghost button on `<ResultsView>` header AND on the error banner. | Dispatches `RESET`; clears results, profile, `lastInput`, and `activeRunId`. |
| `Retry` | Primary button on the error banner ONLY. | Replays `startRun` with `lastInput`. Not exposed on the results view or in the form. |
| `Talk to a human` | Secondary button on `<ResultsView>` header. | Dispatches `ESCALATE`; PRD §6 keeps this affordance always reachable from the results view. |

Pause, cancel, and retry-diff surfaces are NOT present in Sprint 1. If they show up in later builds they will be added via a follow-up spec change, not silently.

SSE event handling (SAD §4 envelope — preserved verbatim; wiring DEFERRED this pass):

| SSE event | FE behavior in Sprint 1 (stub) | Post-Sprint-1 (integration) |
|---|---|---|
| `token` | Not exercised — stubs return whole objects; no streaming. | Append `text` to the current assistant bubble; keep an `aria-live="polite"` region for the token stream (SAD §3 accessibility). |
| `tool` | Not exercised — tool-call details are DEFERRED. | Optional inline status ("searching KB..."). |
| `cite` | Not exercised — citations arrive inside the fixture `GroundedSupportAnswer.citations`. | Attach citation chip to the current assistant bubble; source_id + url + score. |
| `state` | Not exercised — `getRunStatus` returns a fixed `done` payload; there is no phase-by-phase state indicator this pass. | Dispatch FSM transitions: `phase=escalate` → `ESCALATE`; other phases update a phase indicator only. |
| `error` | Simulated by `catch` around the stub chain → dispatches `STREAM_ERROR`. UI shows the inline error banner with `Retry` + `Reset`. | Dispatch `STREAM_ERROR { code, message }`; render `.error-banner`; if `retryable=true`, the same `Retry` affordance replays `startRun` with the last input. |
| `done` | Dispatched after the last stub completes → `STREAM_DONE`. | Dispatch `STREAM_DONE`; freeze the bubble; unblock the composer. |

Cost fields (from a hypothetical SSE `done.data.usage`) are NOT surfaced this pass — deferred.

Token streaming (post-Sprint-1): the consumer subscribes via `EventSource` (or `fetch` + reader) to `POST /v1/sessions/{id}/messages` and reduces `token` events into the current message bubble. First-token latency budget (SAD §7 / PRD §5): `<= 500ms p95`. Sprint 1 does NOT measure this — the Week-3 spike gate is a backend concern.

Cite events: appended to the current bubble as a `<Citation>` chip. The chip shows `source_id` and `score`; hover reveals `url`. On Sprint 1 the chips are rendered from `GroundedSupportAnswer.citations` (not from live `cite` events).

Escalate CTA: `<ResultsView>` always renders a "Talk to a human" button (PRD §6 "always visible"). Clicking calls `fakeEscalate` (Sprint 1) or `POST /v1/sessions/{id}/escalate` (integration), then dispatches `ESCALATE`. On `escalated` we render the escalation banner with the stub ticket id and disable the CTA.

Error/escalated branches:
- `error` → `.error-banner` `role="alert"`, surface `runState.errorMessage`, expose `Retry` (primary) and `Reset` (ghost). `Retry` replays `startRun` with the retained `lastInput` — no diff view. This behaves the same whether the error was simulated locally (thrown stub) or (post-integration) came from an SSE `event: error` with `retryable=true`.
- `escalated` → `.escalation-banner` `role="status"`, surface `ticketId`. User-visible banner label collapses to `Crew: done` (the escalation is a variant of a successful terminal, per PRD §6). Note the invariant: any escalation reached via ADR-011 ambiguity must be accompanied by an `AmbiguityReport` — Sprint 1 does not render it (deferred), but the FE will read `EscalationTicketPayload.ambiguity_report` when it lands.

## Results

Two result surfaces are rendered by `<ResultsView>` in `frontend/src/components/ResultsView.tsx`:

1. **Plan card (`<PlanCard>`)** — renders `OnboardingPlan.milestones[]` (SAD ADR-015). Per PRD F2/AC2, 3–5 milestones each `<= 2h`. Each milestone shows `order`, `title`, `estimated_hours` (rendered as a pill), and `doc_url` (external link). The raw JSON is available via `<details>` for smoke-testing and for the QA persona to eyeball the contract.
2. **Support answer card (`<SupportAnswerCard>`)** — renders `GroundedSupportAnswer` (SAD ADR-015 + ADR-009). Behavior:
   - If `refused=false`: render `answer_markdown` (as plain text in Sprint 1 — a markdown renderer is deferred) and the citations list (`source_id` link + `score`).
   - If `refused=true`: render the refusal block (`refusal_reason`) and a hint pointing to the deterministic fallback (ADR-009 / PRD F3 AC3).
   - **Refused-XOR-citations invariant** (SAD ADR-015): `refused === (citations.length === 0)`. The UI surfaces a `role="alert"` badge "INVARIANT VIOLATED: refused XOR citations" when the contract is broken. This is intentionally loud — a violation means the backend broke ADR-009 and QA must catch it visibly, not silently.

Deferred results surfaces (visibly stubbed via `<DeferredStubs>`):
- Sponsor brief (SAD `SponsorBrief` model, DEFERRED per Sprint 1 scope) — disabled button + "Deferred — Post-Sprint-1" tag.
- Ambiguity calibration UI — disabled button + tag. When enabled, will render `AmbiguityFlag[]` (last-attempt-first) and expose the clarification composer per PRD F6.
- Live SSE token stream — disabled button + "Deferred — Integration epic" tag.

## History

The History panel (`<HistoryPanel>`) shows prior runs in the current browser session. Sprint 1 persists to `sessionStorage` under key `aamad.onboarding.history.v1`, capped at 20 records. Selecting a history item rehydrates the results view read-only (no re-run in Sprint 1).

Run record shape (`RunRecord`, from `frontend/src/types/contracts.ts`):

- `runId: string` — opaque id returned by `startRun`.
- `createdAt: string` — ISO-8601 timestamp.
- `input: CustomerProfileInput` — the exact form submission (role, primary_use_case, timeline, locale).
- `status: "idle" | "running" | "done" | "error" | "escalated"` — mirrors the FSM `RunStatusName` (types/contracts.ts).
- `plan: OnboardingPlan | null` — snapshot of the plan result.
- `supportAnswer: GroundedSupportAnswer | null` — snapshot of the support answer.
- `ticketId: string | null` — set on `escalated`.

Post-Sprint-1: this list will fetch from `GET /v1/sessions/{id}` (or a paginated `GET /v1/sessions`) instead of `sessionStorage`; the record shape stays the same so the panel's render code does not change.

## Accessibility

Minimum bar this pass (all must hold before merge):

- **Keyboard navigation:** every interactive element is tabbable in logical order — form inputs, `Run`, `Reset`, `Retry`, `Talk to a human`, and the history entries. Visible focus rings are provided globally in `src/App.css` via `button:focus-visible / a:focus-visible` (2px accent outline, 2px offset).
- **Semantic headings:** a single `<h1>` for the workflow ("Customer Onboarding Crew") in `App.tsx`. Section boundaries use `<h2>`: "Start onboarding" (inputs), "Onboarding results" (results). Sub-sections in cards use `<h3>` / `<h4>`.
- **Live regions:** the status banner is `role="status"` with `aria-live="polite"` and `aria-atomic="true"` so screen readers announce every Crew status transition and the `Last updated` refresh. The error banner is `role="alert"` so it interrupts and is announced immediately.

Deferred to Observability Phase (explicitly out of scope this pass):

- Full ARIA-pattern audit against WAI-ARIA Authoring Practices (dialog / listbox / combobox patterns are not used yet).
- Focus trapping (no modals in Sprint 1).
- `prefers-reduced-motion` handling.
- High-contrast theme.
- Screen-reader QA on live SSE token streams (SSE not wired this pass).

## Spec Sync Checklist

Tick every item after each commit that touches this spec or the code it describes. If an item does not hold, either fix the code or update this spec — never leave them drifted.

Format: `item name` — `status (done / in-progress / deferred)` — one-line note.

- [x] **User-visible status vocabulary** — done — Banner/buttons/history reuse `idle | running | done | error` verbatim; `escalated` collapses to `done` in copy.
- [x] **Status banner (label + pill + last-updated)** — done — `<CrewStatusBanner>` in `src/components/RunStatusBadge.tsx`; gray/blue/green/red pill; `lastUpdated` refreshed on every FSM transition and stub resolution in `App.tsx`.
- [x] **FSM `idle → running → done` with inline error retry** — done — `runMachineReducer` unchanged (internal `error` / `escalated` preserved); `App.executeRun` retains `lastInput` and the error banner exposes `Retry`.
- [x] **Controls surface = Run + Reset (+ Retry on error banner only)** — done — `OnboardingForm` submit relabeled to `Run`; `ResultsView` header shows `Reset`; error banner shows `Retry` + `Reset`; pause/cancel/retry-diff removed.
- [x] **Stub services return FIXED mock payloads** — done — `startRun` returns `FIXED_RUN_ID`; `getRunStatus` returns `{ status: "done" }`; profile/plan use fixed session/milestone ids (`FIXED_SESSION_ID`, `ms_stub_0001..0003`).
- [x] **Accessibility minimum bar** — done — Single `<h1>`, `<h2>` section boundaries, `aria-live="polite"` on the status banner, visible focus rings globally; deeper ARIA audit deferred.
- [x] **FSM states match reducer transitions** — done — Types `RunStatusName = idle | running | done | error | escalated` unchanged in `types/contracts.ts`; transitions unchanged in `machines/runMachine.ts`.
- [x] **Input fields match `CustomerProfileInput` / `CustomerProfile`** — done — `role`, `primary_use_case`, `timeline`, `locale` unchanged, mapped to ADR-015.
- [x] **SSE event names match SAD §4 envelope** — done — `SseEvent` union in `types/contracts.ts` unchanged; wiring deferred per this pass.
- [x] **Stub service signatures** — done — `startRun`, `getRunStatus`, `fakeProfileFromInput`, `fakePlanForProfile`, `fakeGroundedSupportAnswer`, `fakeEscalate` names and shapes unchanged.
- [x] **History record shape (`RunRecord`) matches storage layer** — done — `readHistory`, `appendHistory`, `updateHistoryStatus` unchanged; `HistoryPanel` updated to use lowercase labels.
- [x] **Refused-XOR-citations invariant enforced** — done — `SupportAnswerCard` in `ResultsView.tsx` still surfaces the `role="alert"` badge on violation.
- [x] **Deferred surfaces visibly stubbed** — done — Sponsor brief, ambiguity UI, live SSE token stream still rendered by `<DeferredStubs>` with tags.
- [x] **`Talk to a human` reachable while results are mounted** — done — Still exposed as a secondary button on `<ResultsView>`; PRD §6 unchanged.
- [x] **Frontend README updated** — done — `frontend/README.md` documents run/build, controls, vocabulary, integration pointers (SAD §4 SSE + ADR-015), and Loom-as-operator-deliverable.
- [ ] **Loom / screenshot walkthrough** — deferred — Operator deliverable; not produced by this build pass.
- [ ] **Live SSE wiring** — deferred — Integration epic; the `SseEvent` union is ready to consume.

## Sources

- `project-context/1.define/prd.md` §4 F1–F6, §5 Performance/Observability, §6 UX.
- `project-context/1.define/sad.md` §1 "Sprint 1 Scope (Vertical Slice)" (ADR-013), ADR-011 (ambiguity), ADR-014 (stub-first tools), ADR-015 (Pydantic output contracts), ADR-016 (orchestrator pattern), §3 Frontend Architecture Specification, §4 SSE envelope, §7 performance targets.
- `.claude/rules/aamad-core.md`, `.claude/rules/development-workflow.md`, `.claude/rules/adapter-crewai.md`, `.claude/rules/adapter-registry.md`.
- `aamad.config.example.yml` (runtime target `crewai`, `ui.visual_style: minimal`).
- Frontend scaffold: `frontend/src/App.tsx`, `frontend/src/machines/runMachine.ts`, `frontend/src/services/run.ts`, `frontend/src/types/contracts.ts`, `frontend/src/components/*.tsx`.

## Assumptions

- Runtime resolved to `crewai` from `aamad.config.example.yml` (`runtime.target`); `AAMAD_TARGET_RUNTIME` env var not set on this run. Recorded in Audit below.
- The operator brief for this task overrides SAD ADR-002 (Next.js) for Sprint 1: this scaffold is Vite + React + TypeScript, not Next.js App Router. The SAD Next.js decision remains the eventual production surface; the Vite scaffold exercises the same contracts (ADR-015) so a swap to Next.js later is a routing change, not a contract change. Recorded as Open Question #1.
- Tailwind is NOT used in this scaffold. The persona command `*style-ui` prescribes Tailwind, but the operator brief scopes Sprint 1 to "minimal, no state management library, no routing library beyond one route". Plain CSS in `src/App.css` covers WCAG contrast and responsive layout for MVP. Recorded as Open Question #2.
- History persists to `sessionStorage` for Sprint 1. Cross-tab / cross-session persistence is a backend concern (`GET /v1/sessions/{id}`) and is deferred.
- The Sprint 1 stub does NOT exercise `token`, `tool`, `cite`, or `state` SSE events over the wire. Their FE handling is specified here so integration is a "wire and typecheck" step, not a design step.
- The refused-XOR-citations invariant is enforced client-side as a defensive check; the authoritative enforcement is server-side via `Task.guardrail` (ADR-009). If integration finds the two disagree, the server is authoritative and the FE badge is a bug indicator, not truth.

## Open Questions

1. Should Sprint 2 migrate this scaffold to Next.js App Router (SAD ADR-002) before adding SSE, or wire SSE against the current Vite scaffold first and migrate later? (→ `@system.arch` + `@frontend.eng`)
2. Should Sprint 2 introduce Tailwind (persona command `*style-ui`) or keep plain CSS through post-Sprint-1? (→ `@frontend.eng` + operator)
3. When the SSE stream lands, does the FE display raw `phase` transitions (welcome → plan → support → escalate) as a step indicator, or only the terminal outcome? (→ UX / stakeholder)
4. Ambiguity clarification composer UX: 3 options + "none of these" per PRD F6 AC1 — does the FE surface the composer inline in the assistant bubble or as a modal? (→ UX)
5. Should the History panel display the ambiguity summary (last `AmbiguityFlag`) inline once ADR-011 calibration lands? (→ UX + `@qa.eng`)

## Audit

- Timestamp: 2026-08-30
- Persona id: `@frontend.eng`
- Action: `develop-fe` (review-and-adjust pass)
- Resolved `AAMAD_TARGET_RUNTIME`: `crewai` — source: `aamad.config.example.yml` (`runtime.target`); env var not set; no `aamad.config.yml` present.
- Adapter rules applied: `.claude/rules/adapter-crewai.md` (FE contracts consumed downstream by CrewAI tasks per SAD ADR-015).
- Artifact path: `project-context/2.build/frontend-functional-spec.md`.
- Companion artifacts: `project-context/2.build/frontend.md` (build log), `frontend/` (Vite + React 19 + TS 6 scaffold), `frontend/README.md`.
- Changes this pass: user-visible status vocabulary reduced to `idle | running | done` (+ `error` banner state); introduced `<CrewStatusBanner>` (label + pill + last-updated); controls simplified to `Run` and `Reset` with `Retry` scoped to the error banner (replays same inputs); stubs now return FIXED mock payloads; accessibility minimum bar codified; Spec Sync Checklist restructured to item/status/note format; README rewritten.
- Build validation: `npx tsc --noEmit -p tsconfig.app.json` = clean; `npm run build` = 23 modules transformed, no errors, 405ms.
- Prompt Trace: omitted at Build FE-spec stage — deterministic template-driven authoring bound to SAD ADR-013/014/015/016 and §4. Prompt Trace will be captured for production-facing artifacts per `aamad-core` policy (integration + deliver stages).
