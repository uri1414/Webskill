// Reusable date + 30-minute time bubbles (and optional expected-length bubbles).
// Two modes decide the hidden fields it posts:
//   schedule  → startsAt ("YYYY-MM-DDTHH:MM") + lengthMin (when showLength)
//   preferred → preferred_date + preferred_time (a "HH:MM" hint for staff)
"use client";

import { useState } from "react";

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
const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";

export function TimePicker({
  mode,
  defaultDate = "",
  defaultTime = "09:00",
  showLength = false,
  defaultLength = 60,
  dateRequired = false,
  preferredNote,
}: {
  mode: "schedule" | "preferred";
  defaultDate?: string;
  defaultTime?: string;
  showLength?: boolean;
  defaultLength?: number;
  dateRequired?: boolean;
  preferredNote?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [len, setLen] = useState(defaultLength);
  const startsAt = date ? `${date}T${time}` : "";

  return (
    <div className="space-y-3">
      {/* Hidden fields the form actually submits */}
      {mode === "schedule" ? (
        <>
          <input type="hidden" name="startsAt" value={startsAt} />
          {showLength && <input type="hidden" name="lengthMin" value={len} />}
        </>
      ) : (
        <>
          <input type="hidden" name="preferred_date" value={date} />
          <input type="hidden" name="preferred_time" value={date ? time : ""} />
        </>
      )}

      <div>
        <label htmlFor="tp-date" className="block text-xs font-semibold text-muted">
          Date {preferredNote && <span className="font-normal">— {preferredNote}</span>}
        </label>
        <input id="tp-date" type="date" required={dateRequired} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </div>

      <div>
        <span className="block text-xs font-semibold text-muted">Time</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SLOTS.map((s) => (
            <button type="button" key={s.value} onClick={() => setTime(s.value)} className={pill(time === s.value)}>{s.label}</button>
          ))}
        </div>
      </div>

      {showLength && (
        <div>
          <span className="block text-xs font-semibold text-muted">Expected length</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LENGTHS.map((l) => (
              <button type="button" key={l.min} onClick={() => setLen(l.min)} className={pill(len === l.min)}>{l.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
