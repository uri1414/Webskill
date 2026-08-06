// Screen 1: Client Request Form. Client component: services are multi-select
// (one visit can cover several things), "Other" reveals a required clarification
// field, and submitting first opens a confirmation step that spells out the
// no-show / service-fee policy. The form posts to the server action; all
// lifecycle logic lives server-side / in the engine.
"use client";

import { useState } from "react";
import { SERVICES } from "@/lib/services";
import { submitAppointmentRequestAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const field =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export default function NewRequestPage({ searchParams }: { searchParams?: { error?: string; service?: string } }) {
  const preselected = SERVICES.some((s) => s.key === searchParams?.service) ? [searchParams!.service as string] : [];
  const [selected, setSelected] = useState<string[]>(preselected);
  const [confirming, setConfirming] = useState(false);
  const error = searchParams?.error;
  const isOther = selected.includes("other");

  function toggle(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">Request an appointment</h1>
      <p className="mt-1 text-sm text-muted">Choose everything you need — you can pick more than one — and we&apos;ll confirm a time.</p>

      {error === "service" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please choose at least one service.</p>}
      {error === "other" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please add a short description for “Other”.</p>}
      {error === "submit" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Something went wrong — please try again.</p>}

      <form action={submitAppointmentRequestAction} className="mt-6 space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">What do you need help with?</legend>
          <p className="text-xs text-muted">Select all that apply.</p>
          <div className="mt-2 space-y-2">
            {SERVICES.map((s) => {
              const checked = selected.includes(s.key);
              return (
                <label
                  key={s.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    checked ? "border-brand bg-brand-soft text-ink" : "border-line text-ink hover:border-line-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="services"
                    value={s.key}
                    checked={checked}
                    onChange={() => toggle(s.key)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="font-medium">{s.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {isOther && (
          <div>
            <label htmlFor="other_detail" className="block text-sm font-semibold text-ink">Please tell us more</label>
            <input id="other_detail" name="other_detail" required placeholder="Briefly describe what you need" className={field} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="preferred_date" className="block text-sm font-semibold text-ink">Preferred date <span className="font-normal text-muted">(optional)</span></label>
            <input id="preferred_date" name="preferred_date" type="date" className={field} />
          </div>
          <div>
            <label htmlFor="preferred_time" className="block text-sm font-semibold text-ink">Preferred time <span className="font-normal text-muted">(optional)</span></label>
            <select id="preferred_time" name="preferred_time" className={field} defaultValue="">
              <option value="">No preference</option>
              <option value="Morning">Morning</option>
              <option value="Midday">Midday</option>
              <option value="Afternoon">Afternoon</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-semibold text-ink">Anything else? <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="body" name="body" rows={3} placeholder="A short note for our team" className={field} />
        </div>

        {/* "Continue" opens the policy acknowledgment; the actual submit lives
            inside the modal so a request can't go through without it. */}
        <button
          type="button"
          onClick={() => selected.length > 0 && setConfirming(true)}
          disabled={selected.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>

        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" aria-label="Close" onClick={() => setConfirming(false)} className="animate-fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
            <div className="animate-pop relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-md" style={{ ["--pop-origin" as string]: "center" }}>
              <h2 className="font-display text-lg font-bold text-ink">Before you book</h2>
              <p className="mt-2 text-sm text-muted">Please review and agree so we can hold your time.</p>

              <ul className="mt-4 space-y-3 text-sm text-ink">
                <li className="flex gap-3 rounded-lg bg-surface-soft px-3 py-3">
                  <span aria-hidden className="text-lg leading-none">💳</span>
                  <span>Most appointments are <strong>service-based</strong>, so a fee applies for the work done. Payment is due at (or before) your appointment.</span>
                </li>
                <li className="flex gap-3 rounded-lg bg-surface-soft px-3 py-3">
                  <span aria-hidden className="text-lg leading-none">⏱️</span>
                  <span>A <strong>no-show or missed-appointment fee may apply</strong> if you don&apos;t show or cancel too late.</span>
                </li>
              </ul>

              <p className="mt-4 text-xs text-muted">We&apos;ll confirm the exact fee with you before any work begins.</p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
                  Go back
                </button>
                <SubmitButton pendingText="Submitting…" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
                  I understand — submit request
                </SubmitButton>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
