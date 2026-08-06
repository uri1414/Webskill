// Staff "confirm this appointment" form. Title, then a TimePicker (date +
// 30-minute time bubbles + expected-length bubbles), then the fee. The picker
// posts startsAt + lengthMin; the action derives the end time. Booking + fee
// logic stays server-side.
"use client";

import { SubmitButton } from "@/components/SubmitButton";
import { TimePicker } from "@/components/TimePicker";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";

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
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-semibold text-ink">Confirm this appointment</p>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="categoryKey" value={categoryKey} />

      <div>
        <label htmlFor="title" className="block text-xs font-semibold text-muted">Title</label>
        <input id="title" name="title" defaultValue={defaultTitle} className={field} />
      </div>

      <TimePicker
        mode="schedule"
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        showLength
        dateRequired
        preferredNote={preferred ? `client prefers ${preferred}` : undefined}
      />

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
