# Customer Onboarding Crew — Frontend (Sprint 1)

Vite + React 19 + TypeScript 6 scaffold for the Sprint 1 vertical slice of the
Customer Onboarding Crew. This build is **stub-only** — no backend endpoints
are wired. See `project-context/2.build/frontend-functional-spec.md` for the
full FE contract, and `project-context/1.define/sad.md` §1 for the Sprint 1
scope.

## Run locally

```bash
npm install
npm run dev
```

Dev server: <http://localhost:5173> (Vite default).

Other scripts:

- `npm run build` — type-check (`tsc -b`) then produce the Vite production bundle in `dist/`.
- `npm run lint` — Oxlint.
- `npm run preview` — serve the production bundle for a smoke check.
- `npx tsc --noEmit -p tsconfig.app.json` — type-check without emitting.

## What this build does

- Renders the Inputs form (Role / Primary use case / Timeline / Locale) mapped
  to `CustomerProfile` (SAD ADR-015).
- Dispatches the FSM `START` on submit and drives `idle → running → done`.
- Calls the stub service chain in `src/services/run.ts`, which returns
  **FIXED** happy-path mock payloads for `startRun` and `getRunStatus`
  (no streaming, no tool-call details, no cost fields — deferred).
- Renders the plan card and grounded support answer card from ADR-015 fixtures.
- Exposes a "Talk to a human" affordance that transitions `done → escalated`.
- Persists a per-session history to `sessionStorage` (`aamad.onboarding.history.v1`).

## Controls surface

- **Run** — submit button on the Inputs form.
- **Reset** — returns any terminal state (`done`, `error`, `escalated`) to `idle`.
- **Retry** — appears **only** on the inline error banner. Replays `startRun`
  with the same input payload (no diff view). Pause / cancel / retry-diff
  are intentionally NOT in this build.

## User-visible status vocabulary

Three words plus an error banner state, reused verbatim across the banner,
buttons, inline messages, and history entries:

- `idle`, `running`, `done`, `error`

Synonyms like "in progress", "complete", "failed" are banned in user-visible
copy. The internal FSM (see `src/machines/runMachine.ts`) still tracks
`error` and `escalated` as terminal branches — the operator-facing copy just
collapses `escalated` to `done` in the banner and history.

## Where CrewAI integration will connect next

- **Runtime target:** `crewai` (see `.claude/rules/adapter-crewai.md` and
  `aamad.config.example.yml`).
- **SSE envelope contract:** SAD §4 `event: token | tool | cite | state |
  error | done`. The FE-side `SseEvent` union in
  `src/types/contracts.ts` mirrors it verbatim. The Integration epic will
  swap `src/services/run.ts` for a real `EventSource`/`fetch`-stream consumer
  without touching component code.
- **Output contracts:** ADR-015 Pydantic models (`CustomerProfile`,
  `OnboardingPlan`, `GroundedSupportAnswer`, `EscalationTicketPayload`,
  `AmbiguityReport`). Component prop names and stub return shapes already
  match these, so integration is a rename, not a redesign.
- **Endpoints:** `POST /v1/sessions`, `POST /v1/sessions/{id}/messages`,
  `POST /v1/sessions/{id}/escalate` (SAD §4). Sprint 1 stubs stand in for
  all three.

## What is NOT in this build (deferred)

- Live SSE token stream, per-turn `tool` status, `cite` chip streaming, and
  `state` phase indicators — deferred to the Integration epic.
- Sponsor brief surface and ambiguity clarification composer — deferred to
  Post-Sprint-1 (ADR-011 full calibration lands with the composer).
- Auth, routing library, state-management library (Redux/Zustand/XState).
  Sprint 1 uses `useReducer` for the FSM and `useState` for view state.
- Full ARIA-pattern audit, focus trapping, `prefers-reduced-motion`,
  high-contrast theming — Observability Phase work.

## Screenshots / Loom

This pass does not produce a Loom or annotated screenshots. Those are
**operator deliverables** for the sprint review — capture them after
`npm run dev` from this directory. A short walkthrough covering
`Run → done → Retry (via a simulated error) → Reset` is enough to demonstrate
the reactivity of the banner and the reactivity of `Last updated`.

## Key files

- `src/App.tsx` — top-level composition and FSM driver.
- `src/machines/runMachine.ts` — handwritten reducer (`idle → running → done`, terminal `error`, terminal `escalated`).
- `src/services/run.ts` — stub services (FIXED mock payloads) and `sessionStorage` history.
- `src/types/contracts.ts` — ADR-015 mirrors + `SseEvent` union (SAD §4).
- `src/components/RunStatusBadge.tsx` — exports `CrewStatusBanner` (label + pill + last-updated).
- `src/components/OnboardingForm.tsx` — Inputs.
- `src/components/ResultsView.tsx` — Plan card, support answer card, deferred stubs.
- `src/components/HistoryPanel.tsx` — per-session history sidebar.
- `src/App.css` — minimal responsive styles (no Tailwind; deferred).
