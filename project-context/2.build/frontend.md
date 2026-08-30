# Frontend Build Log

Persona: `@frontend.eng`.
Runtime: `crewai` (resolved from `aamad.config.example.yml`; `AAMAD_TARGET_RUNTIME` env var not set).
Sprint: Sprint 1 vertical slice per SAD §1 "Sprint 1 Scope (Vertical Slice)".

## Scaffold

- **Location:** `frontend/` at the repo root (Vite + React + TypeScript, strict mode).
- **Single route:** `/` renders `<App>`. No routing library is used — the composition switches between `<OnboardingForm>` (Inputs) and `<ResultsView>` (Results) based on FSM state. History is a persistent sidebar on the same route.
- **Styling:** plain CSS in `frontend/src/App.css` (minimal, responsive, WCAG-forward, dark-mode ready via `prefers-color-scheme`). Tailwind is deferred — see Open Questions.
- **Build check:** `npx tsc --noEmit -p tsconfig.app.json` passes clean; `npm run build` produces `dist/` without errors (Vite 8.2.2, 23 modules).

## FSM

- **Location:** `frontend/src/machines/runMachine.ts`.
- **Shape:** handwritten reducer (no XState). States: `idle | running | done | error | escalated`. Transitions:
  - `idle` → `START` → `running`
  - `running` → `STREAM_DONE` → `done`
  - `running` → `STREAM_ERROR` → `error`
  - `running` → `ESCALATE` → `escalated`
  - `done` → `ESCALATE` → `escalated` (PRD §6 always-visible affordance)
  - any terminal → `RESET` → `idle`
- **Design choice:** kept handwritten because Sprint 1 has 5 states and 5 events; @xstate/fsm becomes worthwhile only past ~6 states. Documented in `frontend-functional-spec.md` Assumptions.

## Stub Services

- **Location:** `frontend/src/services/run.ts`.
- **Surface (all Promise-returning, ~200ms fake latency):**
  - `startRun(input: CustomerProfileInput): Promise<{ runId: string }>`
  - `getRunStatus(runId: string): Promise<RunStatus>` (cycles `running/welcome` → `running/plan` → `running/support` → `done`)
  - `fakeProfileFromInput(input): Promise<CustomerProfile>` — fills backend-owned fields (session_id, tenant_id, ambiguity_flags, confidence, next_track, created_at).
  - `fakePlanForProfile(profile): Promise<OnboardingPlan>` — 3 fixture milestones matching PRD F2/AC2.
  - `fakeGroundedSupportAnswer(profile): Promise<GroundedSupportAnswer>` — Path A fixture (grounded hit + 1 citation).
  - `fakeEscalate(profile): Promise<{ ticket_id }>` — stub ticket.
  - `readHistory / appendHistory / updateHistoryStatus` — `sessionStorage`-backed history layer.
- **No backend wiring.** Per persona rule "Do not connect to backend endpoints; that's for integration." The stub signatures were chosen to match SAD ADR-015 Pydantic shapes so integration is a rename, not a re-type.

## Contract Types

- **Location:** `frontend/src/types/contracts.ts`.
- Mirrors ADR-015: `CustomerProfile`, `OnboardingPlan`, `GroundedSupportAnswer`, `EscalationTicketPayload`, `AmbiguityReport`, plus `AmbiguityFlag`, `Milestone`, `Citation`, `TranscriptTurn`.
- Includes the SAD §4 SSE envelope as a discriminated union `SseEvent` (`token | tool | cite | state | error | done`). Not weakened, not extended.
- Adds `CustomerProfileInput` (FE-only) for the form and `RunRecord` (FE-only) for History.

## Components

- `frontend/src/components/OnboardingForm.tsx` — Inputs. Each field is `aria-describedby` a small label that documents its ADR-015 mapping. Submit button labelled `Run` (was `Start onboarding run`).
- `frontend/src/components/ResultsView.tsx` — Results. Includes `<PlanCard>`, `<SupportAnswerCard>` (with the refused-XOR-citations invariant check surfaced as a `role="alert"` badge on violation), and `<DeferredStubs>` for the disabled sponsor brief / ambiguity UI / live SSE buttons. Header controls trimmed to `Talk to a human` + `Reset` (was `Start a new run`).
- `frontend/src/components/HistoryPanel.tsx` — History sidebar reading `readHistory()`; selecting a run rehydrates the results view (read-only, no re-run in Sprint 1). Status labels normalized to lowercase (`idle | running | done | error`); internal `escalated` collapses to `done` in copy.
- `frontend/src/components/RunStatusBadge.tsx` — exports `<CrewStatusBanner>` (label + pill + last-updated timestamp) with a `RunStatusBadge` alias for back-compat. `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Pill colors: gray = idle, blue = running, green = done, red = error.

## Review-and-Adjust Pass (this iteration)

Surgical edits applied to align the Sprint 1 build with the operator review notes. No rewrite from scratch — the FSM, contracts, and stub signatures are preserved; the changes are copy, controls, banner, and stub determinism.

- **Status vocabulary trimmed** to `idle | running | done | error`; banned synonyms ("in progress", "complete", "failed") removed from user-visible copy. Internal FSM states `error` and `escalated` remain (types + reducer unchanged); `escalated` collapses to `done` in user-visible copy.
- **`<CrewStatusBanner>` introduced** in `src/components/RunStatusBadge.tsx` (replacing the small pill). Shows `Crew: <token>` label, colored pill dot (gray/blue/green/red), and `Last updated: <local time>`. `RunStatusBadge` re-exported as an alias so imports remain valid.
- **`lastUpdated` timestamp** managed in `App.tsx`. Refreshed on every FSM transition (via `useEffect` on `runState.status`) and after every stub resolution (profile → plan → support). Confirms the stubs are alive and the UI is reactive during smoke.
- **Controls trimmed** to `Run` (form) and `Reset` (results view + error banner). `Talk to a human` remains on the results view per PRD §6. `Retry` is scoped **only** to the inline error banner and replays `startRun` with the retained `lastInput` — no diff view. Pause / cancel / retry-diff surfaces are absent (none existed in the prior build).
- **Stubs deterministic**: `startRun` returns a FIXED `runId` (`run_stub_0001`); `getRunStatus` returns a FIXED `{ status: "done" }` payload; `fakeProfileFromInput` uses `FIXED_SESSION_ID`; milestone ids are `ms_stub_0001..0003`. Streaming, tool-call details, and cost fields are DEFERRED — Post-Sprint-1. The `makeId` helper was removed after becoming unused.
- **Accessibility minimum bar codified**: single `<h1>` on the workflow, `<h2>` on section boundaries, `aria-live="polite"` on the status banner, `role="alert"` on the error banner, visible focus rings globally in `App.css` (`button:focus-visible` etc.). Full ARIA audit / focus trapping / `prefers-reduced-motion` / high-contrast theming explicitly deferred to Observability Phase.
- **Frontend README rewritten** with local-run instructions, controls surface, user-visible vocabulary, and where CrewAI/SSE integration will connect next (SAD §4 + ADR-015). Loom/screenshot walkthrough declared an operator deliverable.
- **Build validation**: `npx tsc --noEmit -p tsconfig.app.json` = clean; `npm run build` = 23 modules transformed, no errors, 405ms.

## Traceability Notes (per persona workflow)

- **SAD ADR-002 (Next.js) vs this Vite scaffold.** The operator brief scoped Sprint 1 to Vite + React + TypeScript. The SAD Next.js decision remains authoritative for the eventual production surface; the Vite scaffold exercises the same ADR-015 contracts so migration is a routing/RSC change, not a contract change. Recorded as Open Question in `frontend-functional-spec.md` and here.
- **SAD §4 SSE envelope preserved.** The FE-side `SseEvent` union in `contracts.ts` mirrors the envelope verbatim. Sprint 1 does not consume the wire; when integration ships, the FE will `dispatch(STREAM_ERROR)` on `event: error`, `dispatch(ESCALATE)` on `event: state` with `phase=escalate`, and `dispatch(STREAM_DONE)` on `event: done`. No new events are needed at the FE for Sprint 1.
- **ADR-011 ambiguity flow preserved.** The FE does not render clarification composers in Sprint 1 (deferred with the full ADR-011 calibration), but `CustomerProfile.ambiguity_flags[]` is fully typed and the History record carries the last snapshot so the composer can slot in without a data-model change.
- **Runtime-visible constraint from CrewAI adapter.** Sprint 1 stubs simulate a request-response cycle (no token streaming). The SAD §7 first-token `<= 500ms p95` target is a backend spike-gate concern, not exercised in this scaffold. When integration wires SSE, the FE composer must show a typing indicator within one animation frame of the first `token` event; this is deferred but noted.

## Pointer to Functional Spec

- Detailed Inputs / Run / Results / History / Spec Sync Checklist: `project-context/2.build/frontend-functional-spec.md`.

## Sources

- `project-context/1.define/prd.md` §4 F1–F6, §5, §6.
- `project-context/1.define/sad.md` §1 (ADR-013/014/015/016), §3 Frontend Architecture, §4 SSE envelope, §7 performance.
- `.claude/rules/adapter-crewai.md`, `.claude/rules/aamad-core.md`, `.claude/rules/development-workflow.md`, `.claude/rules/adapter-registry.md`.
- `aamad.config.example.yml`.

## Assumptions

- Runtime resolved to `crewai` (source: `aamad.config.example.yml`; `AAMAD_TARGET_RUNTIME` unset).
- Vite + React + TypeScript scaffold overrides SAD ADR-002 (Next.js) FOR SPRINT 1 ONLY, per operator brief. Contracts remain ADR-015-aligned so the migration is non-breaking at the contract layer.
- Plain CSS is used in place of Tailwind for Sprint 1 (operator brief scoped this to minimal MVP).
- No backend endpoints are called; integration is a downstream epic.

## Open Questions

1. Migrate to Next.js App Router in Sprint 2 (per SAD ADR-002) before or after wiring SSE? (→ `@system.arch` + `@frontend.eng`)
2. Introduce Tailwind post-Sprint-1 (persona `*style-ui`) or keep plain CSS? (→ operator + `@frontend.eng`)
3. Phase step indicator UI once SSE `event: state` is wired — inline chat bubble or a top-bar breadcrumb? (→ UX)
4. Ambiguity clarification composer — inline in the assistant bubble or a modal? (→ UX, ADR-011 calibration)

## Audit

- Timestamp: 2026-08-30
- Persona id: `@frontend.eng`
- Action: `develop-fe` (review-and-adjust pass)
- Resolved `AAMAD_TARGET_RUNTIME`: `crewai` — source: `aamad.config.example.yml` (`runtime.target`); env var not set.
- Adapter rules applied: `.claude/rules/adapter-crewai.md`, `.claude/rules/aamad-core.md`, `.claude/rules/development-workflow.md`, `.claude/rules/adapter-registry.md`.
- Artifact path: `project-context/2.build/frontend.md`.
- Companion artifacts: `project-context/2.build/frontend-functional-spec.md`, `frontend/` scaffold, `frontend/README.md`.
- Files touched this pass: `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/services/run.ts`, `frontend/src/components/RunStatusBadge.tsx`, `frontend/src/components/OnboardingForm.tsx`, `frontend/src/components/ResultsView.tsx`, `frontend/src/components/HistoryPanel.tsx`, `frontend/README.md`, `project-context/2.build/frontend-functional-spec.md`, `project-context/2.build/frontend.md`. FSM (`frontend/src/machines/runMachine.ts`) and contracts (`frontend/src/types/contracts.ts`) intentionally UNCHANGED.
- Build validation: `npx tsc --noEmit -p tsconfig.app.json` = clean; `npm run build` = 23 modules transformed, no errors, 405ms.
- Browser smoke check: not performed (no in-browser access from this session); the Vite production build passing is the strongest local signal. Operator should run `npm run dev` from `frontend/` to visually confirm the banner transitions, pill color changes, and `Last updated` refreshes.
- Prompt Trace: omitted at Build FE stage — deterministic template-driven authoring; Prompt Trace reserved for production-facing artifacts per `aamad-core` policy.
