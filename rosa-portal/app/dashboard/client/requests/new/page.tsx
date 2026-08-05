// Screen 1: Client Request Form. Client component so choosing "Other" reveals a
// required clarification field. The form still posts to the server action; all
// logic lives server-side / in the engine.
"use client";

import { useState } from "react";
import { SERVICES } from "@/lib/services";
import { submitAppointmentRequestAction } from "../actions";

const field =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export default function NewRequestPage({ searchParams }: { searchParams?: { error?: string; service?: string } }) {
  const preselected = SERVICES.some((s) => s.key === searchParams?.service) ? (searchParams!.service as string) : "";
  const [service, setService] = useState(preselected);
  const isOther = service === "other";
  const error = searchParams?.error;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">Request an appointment</h1>
      <p className="mt-1 text-sm text-muted">Tell us what you need and we&apos;ll confirm a time.</p>

      {error === "service" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please choose what you need help with.</p>}
      {error === "other" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please add a short description for “Other”.</p>}
      {error === "submit" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Something went wrong — please try again.</p>}

      <form action={submitAppointmentRequestAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="service" className="block text-sm font-semibold text-ink">What do you need help with?</label>
          <select id="service" name="service" required value={service} onChange={(e) => setService(e.target.value)} className={field}>
            <option value="" disabled>Choose a service…</option>
            {SERVICES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

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

        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          Submit request
        </button>
      </form>
    </div>
  );
}
