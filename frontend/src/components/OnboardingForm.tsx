// Inputs — the form that feeds the CustomerProfile schema (SAD ADR-015).
// Field <-> contract mapping is documented in frontend-functional-spec.md §Inputs.

import { useState } from "react";
import type { CustomerProfileInput, Locale, Role } from "../types/contracts";

interface Props {
  disabled: boolean;
  onSubmit: (input: CustomerProfileInput) => void;
}

const ROLES: { value: Role; label: string }[] = [
  { value: "implementer", label: "Implementer (I will set the product up)" },
  { value: "sponsor", label: "Sponsor (I approved the purchase)" },
  { value: "unknown", label: "Not sure yet" },
];

const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
];

export function OnboardingForm({ disabled, onSubmit }: Props) {
  const [role, setRole] = useState<Role>("implementer");
  const [primaryUseCase, setPrimaryUseCase] = useState("");
  const [timeline, setTimeline] = useState("");
  const [locale, setLocale] = useState<Locale>("en");

  const canSubmit =
    !disabled && primaryUseCase.trim().length > 0 && timeline.trim().length > 0;

  return (
    <form
      className="onboarding-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          role,
          primary_use_case: primaryUseCase.trim(),
          timeline: timeline.trim(),
          locale,
        });
      }}
      aria-labelledby="onboarding-form-title"
    >
      <h2 id="onboarding-form-title">Start onboarding</h2>
      <p className="hint">
        Tell us who you are and what you need. Fields map to the{" "}
        <code>CustomerProfile</code> contract (SAD ADR-015).
      </p>

      <label className="field">
        <span>Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={disabled}
          aria-describedby="role-desc"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <small id="role-desc">Maps to CustomerProfile.role</small>
      </label>

      <label className="field">
        <span>Primary use case</span>
        <input
          type="text"
          value={primaryUseCase}
          onChange={(e) => setPrimaryUseCase(e.target.value)}
          placeholder="e.g. ingest logs from three services"
          maxLength={200}
          disabled={disabled}
          required
          aria-describedby="use-case-desc"
        />
        <small id="use-case-desc">
          Maps to CustomerProfile.primary_use_case (max 200 chars)
        </small>
      </label>

      <label className="field">
        <span>Target timeline</span>
        <input
          type="text"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="e.g. live within 2 weeks"
          maxLength={80}
          disabled={disabled}
          required
          aria-describedby="timeline-desc"
        />
        <small id="timeline-desc">Maps to CustomerProfile.timeline</small>
      </label>

      <label className="field">
        <span>Locale</span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          disabled={disabled}
        >
          {LOCALES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <small>Maps to CustomerProfile.locale</small>
      </label>

      {/* Controls: Run only. Reset is exposed on the results view and on the
          inline error banner. Retry lives on the error banner only.
          Consistent phrasing: the label reuses `running` verbatim during the
          in-flight state so no synonyms appear in user-visible copy. */}
      <div className="actions">
        <button type="submit" disabled={!canSubmit} className="primary">
          {disabled ? "Running..." : "Run"}
        </button>
      </div>
    </form>
  );
}
