// Client "reschedule or cancel" box on an appointment. States the 48-hour
// policy up front (free outside the window, fee may apply inside it), then lets
// the client send a change request to staff. Submitting routes through the
// request engine (server action) which notifies staff.
"use client";

import { useState } from "react";
import { requestRescheduleAction } from "@/app/dashboard/client/appointments/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { TimePicker } from "@/components/TimePicker";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";

export function RescheduleBox({ appointmentId, freeWindow, hasTime }: { appointmentId: string; freeWindow: boolean; hasTime: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"reschedule" | "cancel">("reschedule");

  return (
    <div className="mt-5 rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-semibold text-ink">Need to reschedule or cancel?</p>

      {/* Policy — free outside 48h, fee possible inside it. */}
      {freeWindow ? (
        <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          You&apos;re more than <strong>48 hours</strong> out — you can reschedule or cancel free of charge.
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Heads up: you&apos;re <strong>within 48 hours</strong> of your appointment. A late-change or no-show fee may apply.
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft"
        >
          Request a change
        </button>
      ) : (
        <form action={requestRescheduleAction} className="mt-3 space-y-3">
          <input type="hidden" name="appointmentId" value={appointmentId} />

          <div className="flex gap-2">
            {(["reschedule", "cancel"] as const).map((m) => (
              <label
                key={m}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold capitalize transition ${
                  mode === m ? "border-brand bg-brand-soft text-brand-600" : "border-line text-ink hover:border-line-strong"
                }`}
              >
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                {m}
              </label>
            ))}
          </div>

          {mode === "reschedule" && (
            <TimePicker mode="preferred" defaultDate="" defaultTime="09:00" preferredNote="pick a preferred new time" />
          )}

          <div>
            <label htmlFor="rq_reason" className="block text-xs font-semibold text-muted">Reason <span className="font-normal">(optional)</span></label>
            <textarea id="rq_reason" name="reason" rows={2} placeholder="Anything we should know?" className={field} />
          </div>

          {!hasTime && mode === "reschedule" && (
            <p className="text-xs text-muted">This appointment doesn&apos;t have a set time yet — we&apos;ll confirm one with you.</p>
          )}

          <div className="flex gap-2">
            <SubmitButton pendingText="Sending…" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
              Send request
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
