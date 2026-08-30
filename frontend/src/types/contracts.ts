// TypeScript mirrors of the Pydantic contracts defined in SAD ADR-015.
// These types are the FE-side contract. Field names MUST match the Pydantic
// models exactly so the OpenAPI-generated client (post-Sprint-1) drops in.
// Do NOT invent fields not in SAD §2 "Pydantic Output Contracts (ADR-015)".

export type Role = "implementer" | "sponsor" | "unknown";
export type Locale = "en" | "pt-BR";
export type NextTrack = "plan" | "sponsor_brief" | "clarify" | "escalate";
export type AmbiguityType = "a" | "b" | "c" | "d" | "e";
export type FallbackApplied = "none" | "template_default" | "escalation";
export type EscalationTrigger =
  | "two_failed_resolutions"
  | "user_requested"
  | "ambiguity"
  | "guardrail_failure";
export type EscalationTarget = "human_queue" | "specialist_queue";
export type SessionPhase =
  | "welcome"
  | "plan"
  | "sponsor_brief"
  | "support"
  | "escalate"
  | "done";

// ADR-011 / SAD §2 "Ambiguity Contracts"
export interface AmbiguityFlag {
  session_id: string;
  instance_id: string;
  ambiguity_type: AmbiguityType;
  affected_slot_or_intent: string;
  confidence: number;
  clarification_attempts: number;
  resolved: boolean;
  fallback_applied: FallbackApplied;
  template_default_id: string | null;
  detected_by_agent: string;
  created_at: string; // ISO-8601
}

// ADR-015: CustomerProfile — bound to welcome_task.
// This is also the shape of the form Inputs collected in the UI (see frontend-functional-spec.md §Inputs).
export interface CustomerProfile {
  session_id: string;
  tenant_id: string;
  role: Role;
  primary_use_case: string | null;
  timeline: string | null;
  locale: Locale;
  ambiguity_flags: AmbiguityFlag[];
  confidence: number;
  next_track: NextTrack;
  created_at: string; // ISO-8601
}

// Sub-shape of what the UI form collects before session_id/tenant_id are assigned.
// Everything the user types goes here; the backend fills the rest.
export interface CustomerProfileInput {
  role: Role;
  primary_use_case: string;
  timeline: string;
  locale: Locale;
}

// ADR-015: OnboardingPlan — bound to plan_task.
export interface Milestone {
  id: string;
  title: string;
  estimated_hours: number; // <= 2h per PRD F2/AC2
  doc_url: string;
  template_id: string | null;
  order: number;
}

export interface OnboardingPlan {
  session_id: string;
  milestones: Milestone[]; // 3-5 items per PRD F2/AC2
  generated_from_profile_hash: string;
  ambiguity_flags: AmbiguityFlag[];
  created_at: string;
}

// ADR-015: GroundedSupportAnswer — bound to first_use_support_task.
// Invariant: refused=True XOR citations.length > 0 (enforced by ADR-009 guardrail).
export interface Citation {
  source_id: string;
  url: string;
  score: number;
  chunk_id: string;
}

export interface GroundedSupportAnswer {
  session_id: string;
  answer_markdown: string;
  citations: Citation[];
  retrieval_top_score: number;
  retrieval_delta: number;
  confidence: number;
  refused: boolean;
  refusal_reason: string | null;
  ambiguity_flags: AmbiguityFlag[];
}

// ADR-015: EscalationTicketPayload — bound to escalation_task.
export interface TranscriptTurn {
  role: "user" | "assistant";
  agent: string | null;
  text: string;
  timestamp: string;
}

export interface AmbiguityReport {
  session_id: string;
  instance_id: string;
  ambiguity_type: AmbiguityType;
  affected_slot_or_intent: string;
  confidence: number;
  missing_signals: string[];
  clarification_attempts: Array<{
    attempt_no: number;
    question: string;
    options_offered: string[];
    user_response: string;
    confidence_after: number;
    timestamp: string;
  }>;
  fallback_applied: FallbackApplied;
  template_default_id: string | null;
  escalation_target: EscalationTarget;
  next_agent: string;
  trace_ref: string;
}

export interface EscalationTicketPayload {
  session_id: string;
  tenant_id: string;
  ticket_id: string;
  customer_profile: CustomerProfile;
  transcript_window: TranscriptTurn[];
  what_was_tried: string[];
  trigger: EscalationTrigger;
  ambiguity_report: AmbiguityReport | null;
  escalation_target: EscalationTarget;
  created_at: string;
}

// SSE envelope (SAD §4). Preserved verbatim — do NOT weaken.
// Kept here so the FE consumer typing lines up with the backend contract when integration ships.
export type SseEvent =
  | { event: "token"; data: { text: string; agent: string } }
  | {
      event: "tool";
      data: { name: string; status: "start" | "end"; meta: Record<string, unknown> };
    }
  | { event: "cite"; data: { sourceId: string; url: string; score: number } }
  | {
      event: "state";
      data: { phase: SessionPhase; sessionState: Record<string, unknown> };
    }
  | { event: "error"; data: { code: string; message: string; retryable: boolean } }
  | {
      event: "done";
      data: { usage: Record<string, unknown>; latencyMs: number };
    };

// Local FE-only shape for the History panel (see frontend-functional-spec.md §History).
export type RunStatusName =
  | "idle"
  | "running"
  | "done"
  | "error"
  | "escalated";

export interface RunRecord {
  runId: string;
  createdAt: string; // ISO-8601
  input: CustomerProfileInput;
  status: RunStatusName;
  // Sprint 1 results snapshot; refs so the FE can re-render the results panel
  // when the user clicks a run in the History sidebar.
  plan: OnboardingPlan | null;
  supportAnswer: GroundedSupportAnswer | null;
  ticketId: string | null;
}
