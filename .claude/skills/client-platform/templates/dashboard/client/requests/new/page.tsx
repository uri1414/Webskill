// app/dashboard/client/requests/new/page.tsx — Screen 1: Client Request Form.
// A plain form that posts to the server action. No client-side state, no logic.
import { submitAppointmentRequestAction } from "../actions";

export default function NewRequestPage({ searchParams }: { searchParams?: { error?: string } }) {
  const error = searchParams?.error;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">Request an appointment</h1>
      <p className="mt-1 text-sm text-muted">Tell us what you need and we&apos;ll confirm a time.</p>

      {error === "subject" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please add a subject.</p>
      )}

      <form action={submitAppointmentRequestAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-semibold text-ink">Subject</label>
          <input
            id="subject" name="subject" required
            placeholder="e.g. 2025 tax return"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label htmlFor="body" className="block text-sm font-semibold text-ink">Details <span className="font-normal text-muted">(optional)</span></label>
          <textarea
            id="body" name="body" rows={4}
            placeholder="Anything we should know before your appointment?"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-600"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Submit request
        </button>
      </form>
    </div>
  );
}
