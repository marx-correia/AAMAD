// History — per-session view of prior runs. Sprint 1 uses sessionStorage;
// the record shape is RunRecord in types/contracts.ts. If that shape changes,
// tick the corresponding item in the Spec Sync Checklist.

import type { RunRecord } from "../types/contracts";

interface Props {
  history: RunRecord[];
  onSelect: (record: RunRecord) => void;
  selectedRunId: string | null;
}

// Consistent phrasing rule: history entries reuse the same words the banner
// and inline messages use. Internal `escalated` collapses to `done` in the
// user-visible label so the vocabulary stays three-word + `error`.
const STATUS_LABEL: Record<RunRecord["status"], string> = {
  idle: "idle",
  running: "running",
  done: "done",
  error: "error",
  escalated: "done",
};

export function HistoryPanel({ history, onSelect, selectedRunId }: Props) {
  return (
    <aside className="history-panel" aria-label="Run history">
      <h3>History (this session)</h3>
      {history.length === 0 ? (
        <p className="hint">No runs yet. Submit the form to start one.</p>
      ) : (
        <ol className="history-list">
          {history.map((r) => (
            <li key={r.runId}>
              <button
                type="button"
                className={`history-item ${
                  r.runId === selectedRunId ? "selected" : ""
                }`}
                onClick={() => onSelect(r)}
                aria-current={r.runId === selectedRunId ? "true" : undefined}
              >
                <div className="row">
                  <span className={`status-dot status-${r.status}`} aria-hidden />
                  <strong>{r.input.role}</strong>
                  <span className="mono">{shortId(r.runId)}</span>
                </div>
                <div className="row muted">
                  <span>{r.input.primary_use_case}</span>
                </div>
                <div className="row muted">
                  <span className="tag">{STATUS_LABEL[r.status]}</span>
                  <span>{formatTime(r.createdAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function shortId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) + "..." : id;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
