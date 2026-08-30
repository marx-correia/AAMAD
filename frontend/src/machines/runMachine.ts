// Handwritten FSM for the Sprint 1 vertical slice: idle -> running -> done
// with terminal branches for error and escalated.
//
// Traceability:
//   - Matches SAD §1 "Sprint 1 Scope" vertical: welcome -> plan -> support -> escalate.
//   - `escalated` is a terminal branch reached via SAD §4 `event: state` with
//     phase=escalate (or an explicit "Talk to a human" click in Sprint 1 stub).
//   - `error` is a terminal branch reached via SAD §4 `event: error` (retryable=false)
//     or a network/stream failure.
//
// Kept intentionally tiny — no XState, no external dep. If the state machine
// grows past ~6 states, revisit and consider @xstate/fsm.

import type { RunStatusName } from "../types/contracts";

export type RunEvent =
  | { type: "START" }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_ERROR"; code: string; message: string }
  | { type: "ESCALATE" } // user clicked "Talk to a human" OR backend state=escalate
  | { type: "RESET" };

export interface RunState {
  status: RunStatusName;
  errorCode: string | null;
  errorMessage: string | null;
}

export const initialRunState: RunState = {
  status: "idle",
  errorCode: null,
  errorMessage: null,
};

// Deterministic reducer. All transitions are exhaustive; unknown transitions
// are no-ops (idempotent) so the UI can safely re-dispatch on rerender.
export function runMachineReducer(state: RunState, event: RunEvent): RunState {
  switch (state.status) {
    case "idle":
      if (event.type === "START") {
        return { status: "running", errorCode: null, errorMessage: null };
      }
      return state;

    case "running":
      if (event.type === "STREAM_DONE") {
        return { ...state, status: "done" };
      }
      if (event.type === "STREAM_ERROR") {
        return {
          status: "error",
          errorCode: event.code,
          errorMessage: event.message,
        };
      }
      if (event.type === "ESCALATE") {
        return { ...state, status: "escalated" };
      }
      return state;

    case "done":
    case "error":
    case "escalated":
      if (event.type === "RESET") {
        return initialRunState;
      }
      // Terminal states; also allow ESCALATE from `done` (user clicks Talk to a human
      // after seeing the plan/support answer). This preserves PRD §6: "talk to a human"
      // affordance is always visible.
      if (state.status === "done" && event.type === "ESCALATE") {
        return { ...state, status: "escalated" };
      }
      return state;

    default: {
      // exhaustiveness guard
      const _exhaustive: never = state.status;
      return _exhaustive;
    }
  }
}

// Convenience derived flags for the UI. Keep additions here small — components
// should read `status` directly whenever possible.
export function isTerminal(status: RunStatusName): boolean {
  return status === "done" || status === "error" || status === "escalated";
}
