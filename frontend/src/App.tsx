// Sprint 1 vertical slice — single-route composition.
//
// Traces to SAD §1 "Sprint 1 Scope (Vertical Slice)":
//   anonymous/dev session -> welcome qualify (stub CRM) -> plan JSON in chat
//   -> one grounded support turn with citation (fixture KB)
//   -> escalate with context pack (stub ticket).
//
// FSM: idle -> running -> done, with internal terminal branches error and
// escalated. See src/machines/runMachine.ts.
//
// Operator review pass:
//   - User-visible status vocabulary is exactly `idle | running | done`;
//     `error` appears only as an inline banner state, not a fourth status word.
//   - Controls surface reduced to Run and Reset. Retry is scoped to the
//     inline error banner and replays startRun with the same input payload.
//   - Streaming, tool-call details, and cost fields are deferred.

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { OnboardingForm } from "./components/OnboardingForm";
import { ResultsView } from "./components/ResultsView";
import { HistoryPanel } from "./components/HistoryPanel";
import { CrewStatusBanner } from "./components/RunStatusBadge";
import {
  initialRunState,
  runMachineReducer,
} from "./machines/runMachine";
import {
  appendHistory,
  fakeEscalate,
  fakeGroundedSupportAnswer,
  fakePlanForProfile,
  fakeProfileFromInput,
  readHistory,
  startRun,
  updateHistoryStatus,
} from "./services/run";
import type {
  CustomerProfile,
  CustomerProfileInput,
  GroundedSupportAnswer,
  OnboardingPlan,
  RunRecord,
} from "./types/contracts";
import "./App.css";

function App() {
  const [runState, dispatch] = useReducer(runMachineReducer, initialRunState);
  const [history, setHistory] = useState<RunRecord[]>(() => readHistory());
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [supportAnswer, setSupportAnswer] =
    useState<GroundedSupportAnswer | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  // Retained input payload — enables the inline "Retry" affordance to replay
  // startRun with the SAME inputs (no diff view). Cleared on Reset.
  const [lastInput, setLastInput] = useState<CustomerProfileInput | null>(null);
  // Timestamp of the last FSM transition or stub resolution. Surfaced in the
  // status banner so the operator can see the stubs are alive and reactive.
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Refresh `lastUpdated` on every FSM transition so the banner reflects
  // reactivity even when a stub returns synchronously.
  useEffect(() => {
    setLastUpdated(new Date().toISOString());
  }, [runState.status]);

  const showResults = useMemo(
    () => runState.status !== "idle",
    [runState.status]
  );

  const executeRun = useCallback(
    async (input: CustomerProfileInput) => {
      dispatch({ type: "START" });
      setPlan(null);
      setSupportAnswer(null);
      setTicketId(null);
      setLastInput(input);

      try {
        const { runId } = await startRun(input);
        setActiveRunId(runId);
        const record: RunRecord = {
          runId,
          createdAt: new Date().toISOString(),
          input,
          status: "running",
          plan: null,
          supportAnswer: null,
          ticketId: null,
        };
        setHistory(appendHistory(record));
        setLastUpdated(new Date().toISOString());

        // Sprint 1: run the vertical slice against the stub services.
        // Order mirrors the SAD ADR-016 phase router: welcome -> plan -> support.
        const prof = await fakeProfileFromInput(input);
        setProfile(prof);
        setLastUpdated(new Date().toISOString());

        const planOut = await fakePlanForProfile(prof);
        setPlan(planOut);
        setLastUpdated(new Date().toISOString());

        const answer = await fakeGroundedSupportAnswer(prof);
        setSupportAnswer(answer);
        setLastUpdated(new Date().toISOString());

        setHistory(
          updateHistoryStatus(runId, {
            status: "done",
            plan: planOut,
            supportAnswer: answer,
          })
        );
        dispatch({ type: "STREAM_DONE" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown stream error";
        dispatch({
          type: "STREAM_ERROR",
          code: "STUB_FAILURE",
          message,
        });
      }
    },
    []
  );

  const handleSubmit = useCallback(
    (input: CustomerProfileInput) => {
      void executeRun(input);
    },
    [executeRun]
  );

  // Retry is scoped to the inline error banner only (operator brief).
  // It replays startRun with the same input payload — no diff view.
  const handleRetry = useCallback(() => {
    if (!lastInput) return;
    void executeRun(lastInput);
  }, [executeRun, lastInput]);

  const handleTalkToHuman = useCallback(async () => {
    if (!profile) {
      dispatch({ type: "ESCALATE" });
      return;
    }
    const { ticket_id } = await fakeEscalate(profile);
    setTicketId(ticket_id);
    dispatch({ type: "ESCALATE" });
    if (activeRunId) {
      setHistory(
        updateHistoryStatus(activeRunId, {
          status: "escalated",
          ticketId: ticket_id,
        })
      );
    }
  }, [profile, activeRunId]);

  // Reset — returns any terminal (or error) state to idle. Clears the
  // last-input replay buffer as well so the next Run starts clean.
  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
    setPlan(null);
    setSupportAnswer(null);
    setTicketId(null);
    setProfile(null);
    setActiveRunId(null);
    setLastInput(null);
  }, []);

  const handleSelectHistory = useCallback((record: RunRecord) => {
    // Read-only rehydration of a prior run's result view.
    // Sprint 1 does NOT re-run — the FSM stays where it is; the UI just shows
    // the stored snapshot.
    setActiveRunId(record.runId);
    setPlan(record.plan);
    setSupportAnswer(record.supportAnswer);
    setTicketId(record.ticketId);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-titles">
          <h1>Customer Onboarding Crew</h1>
          <p className="subtitle">
            Sprint 1 vertical slice - welcome, plan, one grounded support turn,
            escalate.
          </p>
        </div>
        <CrewStatusBanner status={runState.status} lastUpdated={lastUpdated} />
      </header>

      <main className="app-main">
        <section className="primary-column">
          {!showResults ? (
            <OnboardingForm
              disabled={runState.status === "running"}
              onSubmit={handleSubmit}
            />
          ) : (
            <ResultsView
              plan={plan}
              supportAnswer={supportAnswer}
              ticketId={ticketId}
              onTalkToHuman={handleTalkToHuman}
              onReset={handleReset}
              escalated={runState.status === "escalated"}
            />
          )}

          {runState.status === "error" ? (
            <div className="error-banner" role="alert">
              <strong>Crew: error.</strong>{" "}
              <span>{runState.errorMessage}</span>{" "}
              <button
                type="button"
                className="primary"
                onClick={handleRetry}
                disabled={!lastInput}
              >
                Retry
              </button>{" "}
              <button
                type="button"
                className="ghost"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          ) : null}
        </section>

        <HistoryPanel
          history={history}
          onSelect={handleSelectHistory}
          selectedRunId={activeRunId}
        />
      </main>

      <footer className="app-footer">
        <small>
          Contracts: <code>CustomerProfile</code>, <code>OnboardingPlan</code>,{" "}
          <code>GroundedSupportAnswer</code> - SAD ADR-015. SSE envelope - SAD
          Section 4 (integration deferred). See{" "}
          <code>project-context/2.build/frontend-functional-spec.md</code>.
        </small>
      </footer>
    </div>
  );
}

export default App;
