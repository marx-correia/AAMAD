// CrewStatusBanner — pinned status banner for the Sprint 1 vertical slice.
//
// Operator review pass: the banner is a first-class UI element with a
// three-word user-visible vocabulary (idle | running | done) plus an
// error banner state (Crew: error). Internal FSM states `error` and
// `escalated` still exist (see machines/runMachine.ts) but the banner
// collapses them to the operator-facing copy the brief requires.
//
// Consistent phrasing rule: the words `idle`, `running`, `done`, `error`
// are reused verbatim by the banner, button labels, inline messages, and
// history entries. No synonyms in user-visible copy.

import type { RunStatusName } from "../types/contracts";

// Banner-visible tokens. Internal `escalated` collapses to `done` for the
// user-visible copy (the escalation banner surfaces the ticket id separately).
type BannerToken = "idle" | "running" | "done" | "error";

function toBannerToken(status: RunStatusName): BannerToken {
  if (status === "escalated") return "done";
  return status;
}

// Pill color mapping — gray/blue/green/red per operator brief.
const PILL_CLASS: Record<BannerToken, string> = {
  idle: "pill-dot pill-dot-idle",
  running: "pill-dot pill-dot-running",
  done: "pill-dot pill-dot-done",
  error: "pill-dot pill-dot-error",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

interface Props {
  status: RunStatusName;
  lastUpdated: string | null; // ISO-8601 or null when never updated
}

export function CrewStatusBanner({ status, lastUpdated }: Props) {
  const token = toBannerToken(status);
  return (
    <div
      className={`crew-status-banner crew-status-${token}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="crew-status-label">
        <span className={PILL_CLASS[token]} aria-hidden="true" />
        Crew: {token}
      </span>
      <span className="crew-status-updated">
        Last updated: {formatTimestamp(lastUpdated)}
      </span>
    </div>
  );
}

// Back-compat re-export so any existing import name keeps working after this
// review pass. Prefer <CrewStatusBanner> for new code.
export const RunStatusBadge = CrewStatusBanner;
