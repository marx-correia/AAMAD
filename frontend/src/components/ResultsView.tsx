// Results — renders GroundedSupportAnswer and OnboardingPlan (SAD ADR-015).
// Surfaces the refused-XOR-citations invariant explicitly.

import type {
  GroundedSupportAnswer,
  OnboardingPlan,
} from "../types/contracts";

interface Props {
  plan: OnboardingPlan | null;
  supportAnswer: GroundedSupportAnswer | null;
  ticketId: string | null;
  onTalkToHuman: () => void;
  onReset: () => void;
  escalated: boolean;
}

export function ResultsView({
  plan,
  supportAnswer,
  ticketId,
  onTalkToHuman,
  onReset,
  escalated,
}: Props) {
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-header">
        <h2 id="results-title">Onboarding results</h2>
        {/* Controls: Reset only. Talk-to-a-human remains reachable per PRD §6
            (SAD "always-visible" affordance) but is not a top-level control
            surface — pause / cancel / retry-diff have been removed per the
            operator review pass. Retry lives on the inline error banner only. */}
        <div className="results-actions">
          <button
            type="button"
            className="secondary"
            onClick={onTalkToHuman}
            disabled={escalated}
            aria-label="Talk to a human"
          >
            {escalated ? "Escalated" : "Talk to a human"}
          </button>
          <button type="button" className="ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {escalated && ticketId ? (
        <div className="escalation-banner" role="status" aria-live="polite">
          <strong>Handed off to a human.</strong> Stub ticket id:{" "}
          <code>{ticketId}</code>. Real backend will emit this via SSE{" "}
          <code>event: state</code> with <code>phase=escalate</code> (SAD §4).
        </div>
      ) : null}

      {plan ? <PlanCard plan={plan} /> : null}
      {supportAnswer ? <SupportAnswerCard answer={supportAnswer} /> : null}

      {/* Deferred surfaces per Sprint 1 scope — visibly stubbed, not hidden. */}
      <DeferredStubs />
    </section>
  );
}

function PlanCard({ plan }: { plan: OnboardingPlan }) {
  return (
    <article className="card plan-card" aria-labelledby="plan-title">
      <header>
        <h3 id="plan-title">Personalized onboarding plan</h3>
        <small className="mono">session {plan.session_id}</small>
      </header>
      <ol className="milestones">
        {plan.milestones.map((m) => (
          <li key={m.id}>
            <div className="milestone-head">
              <strong>
                {m.order}. {m.title}
              </strong>
              <span className="pill">{m.estimated_hours}h</span>
            </div>
            <a href={m.doc_url} target="_blank" rel="noreferrer">
              {m.doc_url}
            </a>
          </li>
        ))}
      </ol>
      <details>
        <summary>Plan JSON (ADR-015 OnboardingPlan)</summary>
        <pre className="json-dump">{JSON.stringify(plan, null, 2)}</pre>
      </details>
    </article>
  );
}

function SupportAnswerCard({ answer }: { answer: GroundedSupportAnswer }) {
  // Invariant per SAD ADR-015 / ADR-009:
  //   refused=True XOR citations.length > 0.
  // We surface this in the UI so a broken backend response is caught by eye
  // during smoke, not silently rendered.
  const invariantHolds =
    answer.refused === (answer.citations.length === 0);

  return (
    <article className="card support-card" aria-labelledby="support-title">
      <header>
        <h3 id="support-title">Grounded support answer</h3>
        {!invariantHolds ? (
          <span className="badge badge-danger" role="alert">
            INVARIANT VIOLATED: refused XOR citations
          </span>
        ) : null}
      </header>

      {answer.refused ? (
        <div className="refusal" role="status">
          <strong>The agent declined to answer.</strong>
          <p>{answer.refusal_reason ?? "No grounding source met the threshold."}</p>
          <p className="hint">
            This is the deterministic fallback (ADR-009 / PRD F3 AC3): refuse
            and offer escalation rather than fabricate.
          </p>
        </div>
      ) : (
        <>
          {/* Sprint 1 renders answer markdown as plain text; a proper markdown
              renderer is a Post-Sprint-1 enhancement (see Deferred stubs). */}
          <p className="answer-body">{answer.answer_markdown}</p>
          <ul className="citations" aria-label="Citations">
            {answer.citations.map((c) => (
              <li key={c.chunk_id}>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.source_id}
                </a>{" "}
                <span className="mono">score {c.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function DeferredStubs() {
  return (
    <aside className="deferred" aria-label="Deferred surfaces">
      <h4>Deferred — Post-Sprint-1</h4>
      <ul>
        <li>
          <button type="button" disabled>
            Sponsor brief
          </button>{" "}
          <span className="tag">Deferred — Post-Sprint-1</span>
          {/* TODO(post-sprint-1): wire to SponsorBrief contract (ADR-015). */}
        </li>
        <li>
          <button type="button" disabled>
            Ambiguity calibration UI
          </button>{" "}
          <span className="tag">Deferred — Post-Sprint-1</span>
          {/* TODO(post-sprint-1): render AmbiguityFlag[] and clarification attempts (ADR-011). */}
        </li>
        <li>
          <button type="button" disabled>
            Live SSE token stream
          </button>{" "}
          <span className="tag">Deferred — Integration epic</span>
          {/* TODO(integration): swap fake services in src/services/run.ts for a real EventSource
              consumer honoring SAD §4 envelope (token | tool | cite | state | error | done). */}
        </li>
      </ul>
    </aside>
  );
}
