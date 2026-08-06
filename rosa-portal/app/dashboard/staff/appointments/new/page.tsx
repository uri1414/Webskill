// Staff: create an appointment directly for a client — the path for walk-in /
// phone clients who have no portal login (and can't submit a request). Born
// confirmed; an optional service fee can be attached in the same step.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { SERVICES } from "@/lib/services";
import { createAppointmentAction } from "../actions";
import { TimePicker } from "@/components/TimePicker";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

type C = { id: string; first_name: string | null; last_name: string | null; business_name: string | null; email: string | null };
function name(c: C): string {
  return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Client";
}

export default async function NewAppointmentPage({ searchParams }: { searchParams?: { client?: string; error?: string } }) {
  await requireCapability("appointments.write");
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email")
    .order("created_at", { ascending: false });
  const rows = (clients ?? []) as C[];
  const preClient = searchParams?.client ?? "";
  const error = searchParams?.error;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard/staff/appointments" className="text-sm text-brand-600">← All appointments</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">New appointment</h1>
      <p className="mt-1 text-sm text-muted">Book directly for a client — useful for walk-ins and phone bookings.</p>

      {error === "client" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Please choose a client.</p>}
      {error === "failed" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn&apos;t create the appointment — please try again.</p>}

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-white px-4 py-8 text-center text-sm text-muted">
          No clients yet. <Link href="/dashboard/staff/clients/new" className="font-semibold text-brand-600">Add a client</Link> first.
        </p>
      ) : (
        <form action={createAppointmentAction} className="mt-6 space-y-4 rounded-xl border border-line bg-white p-4">
          <div>
            <label htmlFor="clientId" className="block text-xs font-semibold text-muted">Client</label>
            <select id="clientId" name="clientId" required defaultValue={preClient} className={field}>
              <option value="" disabled>Choose a client…</option>
              {rows.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="service" className="block text-xs font-semibold text-muted">Service</label>
            <select id="service" name="service" defaultValue="" className={field}>
              <option value="">— none —</option>
              {SERVICES.filter((s) => s.key !== "other").map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="title" className="block text-xs font-semibold text-muted">Title <span className="font-normal">(optional — defaults to the service)</span></label>
            <input id="title" name="title" className={field} />
          </div>
          <TimePicker mode="schedule" defaultDate={today} defaultTime="09:00" showLength />
          <div>
            <label htmlFor="fee" className="block text-xs font-semibold text-muted">Service fee <span className="font-normal">(optional)</span></label>
            <div className="mt-1 flex items-center rounded-lg border border-line pl-3 focus-within:border-brand">
              <span className="text-sm text-muted">$</span>
              <input id="fee" name="fee" type="number" min="0" step="0.01" inputMode="decimal" placeholder="150.00"
                className="w-full rounded-lg px-2 py-2 text-sm text-ink outline-none" />
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            Create appointment
          </button>
        </form>
      )}
    </div>
  );
}
