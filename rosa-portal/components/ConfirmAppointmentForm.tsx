// Staff "confirm this appointment" form. Date is a picker; the time is chosen
// from 30-minute bubbles (8:00 AM–6:00 PM) and the expected length from its own
// bubbles. The chosen date+time and length post as hidden fields; the action
// derives the end time. Booking + fee logic stays server-side.
"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";

// 30-minute slots across the working day.
function timeSlots(startH = 8, endH = 18): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = startH * 60; m <= endH * 60; m += 30) {
    const h = Math.floor(m / 60), mm = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = ((h + 11) % 12) + 1;
    out.push({ value, label: `${h12}:${String(mm).padStart(2, "0")} ${ampm}` });
  }
  return out;
}
const SLOTS = timeSlots();
const LENGTHS = [
  { min: 30, label: "30 min" },
  { min: 60, label: "1 hr" },
  { min: 90, label: "1 hr 30 min" },
  { min: 120, label: "2 hr" },
];

function pill(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active ? "bg-brand text-white shadow-brand" : "border border-line text-ink hover:border-line-strong"
  }`;
}

export function ConfirmAppointmentForm({
  action, requestId, clientId, categoryKey, defaultTitle, defaultDate, defaultTime, preferred,
}: {
  action: (formData: FormData) => void | Promise<void>;
  requestId: string;
  clientId: string;
  categoryKey: string;
  defaultTitle: string;
  defaultDate: string;
  defaultTime: string;
  preferred?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [len, setLen] = useState(60);
  const startsAt = date ? `${date}T${time}` : "";

  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-semibold text-ink">Confirm this appointment</p>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="categoryKey" value={categoryKey} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="lengthMin" value={len} />

      <div>
        <label htmlFor="title" className="block text-xs font-semibold text-muted">Title</label>
        <input id="title" name="title" defaultValue={defaultTitle} className={field} />
      </div>

      <div>
        <label htmlFor="date" className="block text-xs font-semibold text-muted">
          Date {preferred && <span className="font-normal">— client prefers {preferred}</span>}
        </label>
        <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </div>

      <div>
        <span className="block text-xs font-semibold text-muted">Time</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SLOTS.map((s) => (
            <button type="button" key={s.value} onClick={() => setTime(s.value)} className={pill(time === s.value)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-muted">Expected length</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LENGTHS.map((l) => (
            <button type="button" key={l.min} onClick={() => setLen(l.min)} className={pill(len === l.min)}>{l.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fee" className="block text-xs font-semibold text-muted">
          Service fee <span className="font-normal">(optional — leave blank if free)</span>
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-line pl-3 focus-within:border-brand">
          <span className="text-sm text-muted">$</span>
          <input id="fee" name="fee" type="number" min="0" step="0.01" inputMode="decimal" placeholder="150.00"
            className="w-full rounded-lg px-2 py-2 text-sm text-ink outline-none" />
        </div>
      </div>

      <SubmitButton pendingText="Confirming…" className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
        Confirm appointment
      </SubmitButton>
      <p className="text-xs text-muted">Books it and notifies the client. If you set a fee, they&apos;ll see a balance due.</p>
    </form>
  );
}
