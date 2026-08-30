// Stub services for the Sprint 1 vertical slice.
//
// NO backend wiring here — per @frontend.eng persona rules and per the
// operator brief. The real SSE consumer will land in the Integration epic
// (see project-context/2.build/integration.md, TBD).
//
// Signatures match SAD §2 (ADR-015 Pydantic contracts) so the drop-in swap
// to a real client is a rename of the implementation, not a type change.

import type {
  CustomerProfile,
  CustomerProfileInput,
  GroundedSupportAnswer,
  OnboardingPlan,
  RunRecord,
  RunStatusName,
} from "../types/contracts";

const FAKE_LATENCY_MS = 200;

// Fixed mock identifiers so this stub is deterministic and re-runs are
// reproducible during smoke checks. Per operator review pass: startRun and
// getRunStatus return FIXED mock payloads for the happy path. Streaming,
// tool-call details, and cost fields are intentionally NOT surfaced.
const FIXED_RUN_ID = "run_stub_0001";
const FIXED_SESSION_ID = "sess_stub_0001";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

// startRun — FIXED mock payload for the happy path.
// Real signature will match POST /v1/sessions + POST /v1/sessions/{id}/messages
// (see SAD §4). Sprint 1: returns a deterministic runId after ~200ms so the
// FSM transitions idle -> running without a backend.
// Streaming, tool-call details, and cost fields are DEFERRED — Post-Sprint-1.
export async function startRun(
  _input: CustomerProfileInput
): Promise<{ runId: string }> {
  await sleep(FAKE_LATENCY_MS);
  return { runId: FIXED_RUN_ID };
}

// getRunStatus — returns a FIXED "done" payload. Kept as a stable shape so
// the Integration epic can swap this for a real SSE consumer without touching
// callers. This is NOT the SSE consumer. When the real SSE stream lands
// (Integration epic), replace with a subscribeToRun() that yields SseEvent
// objects per SAD §4 envelope (event: token | tool | cite | state | error | done).

export type RunStatus =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done" }
  | { status: "escalated"; ticketId: string }
  | { status: "error"; code: string; message: string };

export async function getRunStatus(_runId: string): Promise<RunStatus> {
  await sleep(FAKE_LATENCY_MS / 2);
  return { status: "done" };
}

// Sprint 1 fixture responses. These mirror ADR-015 shapes exactly so the
// results view exercises the same rendering path the live backend will hit.

export async function fakeProfileFromInput(
  input: CustomerProfileInput
): Promise<CustomerProfile> {
  await sleep(FAKE_LATENCY_MS);
  // Fixed session id to keep the happy-path fixture deterministic across the
  // profile/plan/support/escalate chain. Runtime-owned fields (session_id,
  // tenant_id, ambiguity_flags, confidence, next_track, created_at) are
  // stubbed here; on integration they come from POST /v1/sessions + SSE
  // `state` events (SAD §4).
  return {
    session_id: FIXED_SESSION_ID,
    tenant_id: "dev-tenant",
    role: input.role,
    primary_use_case: input.primary_use_case || null,
    timeline: input.timeline || null,
    locale: input.locale,
    ambiguity_flags: [],
    confidence: 0.85,
    next_track: input.role === "sponsor" ? "sponsor_brief" : "plan",
    created_at: nowIso(),
  };
}

export async function fakePlanForProfile(
  profile: CustomerProfile
): Promise<OnboardingPlan> {
  await sleep(FAKE_LATENCY_MS);
  return {
    session_id: profile.session_id,
    milestones: [
      {
        id: "ms_stub_0001",
        title: "Connect your first data source",
        estimated_hours: 1.5,
        doc_url: "https://docs.example.com/connect-source",
        template_id: "first_week_plan_skeleton.v1",
        order: 1,
      },
      {
        id: "ms_stub_0002",
        title: "Configure your workspace defaults",
        estimated_hours: 1.0,
        doc_url: "https://docs.example.com/workspace-defaults",
        template_id: "first_week_plan_skeleton.v1",
        order: 2,
      },
      {
        id: "ms_stub_0003",
        title: "Run your first successful pipeline",
        estimated_hours: 2.0,
        doc_url: "https://docs.example.com/first-pipeline",
        template_id: "first_week_plan_skeleton.v1",
        order: 3,
      },
    ],
    generated_from_profile_hash: `sha256:stub:${profile.session_id}`,
    ambiguity_flags: [],
    created_at: nowIso(),
  };
}

// Fixture Path A: grounded hit — one citation, refused=false.
// Mirrors SAD §2 fixture KB Path A used by Sprint 1 smoke.
export async function fakeGroundedSupportAnswer(
  profile: CustomerProfile
): Promise<GroundedSupportAnswer> {
  await sleep(FAKE_LATENCY_MS);
  return {
    session_id: profile.session_id,
    answer_markdown:
      "To connect your data source, open **Settings > Integrations**, choose your provider, and paste the API key from the provider console. The connection is verified inline; on success, the source appears in your workspace within a few seconds.",
    citations: [
      {
        source_id: "kb-connect-source-01",
        url: "https://docs.example.com/connect-source",
        score: 0.82,
        chunk_id: "chunk_0001",
      },
    ],
    retrieval_top_score: 0.82,
    retrieval_delta: 0.24,
    confidence: 0.78,
    refused: false,
    refusal_reason: null,
    ambiguity_flags: [],
  };
}

// Fixture escalation. Real path emits SSE `event: state` with phase=escalate + ticketId.
export async function fakeEscalate(
  profile: CustomerProfile
): Promise<{ ticket_id: string }> {
  await sleep(FAKE_LATENCY_MS);
  return { ticket_id: `stub-ticket-${profile.session_id.slice(-6)}` };
}

// Local-only history persistence (Sprint 1: sessionStorage, per-session view).
// The record shape lives in types/contracts.ts (RunRecord). If we change the
// record shape, the Spec Sync Checklist in frontend-functional-spec.md flips.
const HISTORY_KEY = "aamad.onboarding.history.v1";

export function readHistory(): RunRecord[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RunRecord[];
  } catch {
    return [];
  }
}

export function appendHistory(record: RunRecord): RunRecord[] {
  const current = readHistory();
  const next = [record, ...current].slice(0, 20); // cap at 20 for Sprint 1
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be unavailable (SSR / privacy mode); silently degrade.
  }
  return next;
}

export function updateHistoryStatus(
  runId: string,
  patch: Partial<Pick<RunRecord, "status" | "plan" | "supportAnswer" | "ticketId">>
): RunRecord[] {
  const current = readHistory();
  const next = current.map((r) => (r.runId === runId ? { ...r, ...patch } : r));
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
  return next;
}

// Re-export for callers that just want the status literal.
export type { RunStatusName };
