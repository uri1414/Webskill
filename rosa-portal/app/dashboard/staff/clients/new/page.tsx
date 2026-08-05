// Staff: create a client directly (walk-in / known client), optionally with
// their business in the same step. Guarded to clients.write.
import Link from "next/link";
import { requireCapability } from "@/lib/authz";
import { createClientAction } from "../actions";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export default async function NewClientPage({ searchParams }: { searchParams?: { error?: string } }) {
  await requireCapability("clients.write");
  const error = searchParams?.error;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard/staff/clients" className="text-sm text-brand-600">← All clients</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">New client</h1>
      <p className="mt-1 text-sm text-muted">Add someone Rosa works with. You can add their business here too.</p>

      {error === "empty" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Enter at least a name, email, or business.</p>}
      {error === "failed" && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn&apos;t create the client — please try again.</p>}

      <form action={createClientAction} className="mt-6 space-y-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Client</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-muted">First name</label><input name="first_name" className={field} /></div>
            <div><label className="block text-xs font-semibold text-muted">Last name</label><input name="last_name" className={field} /></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-muted">Email</label><input name="email" type="email" className={field} /></div>
            <div><label className="block text-xs font-semibold text-muted">Phone</label><input name="phone" className={field} /></div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Business <span className="font-normal text-muted">(optional)</span></p>
          <p className="mt-0.5 text-xs text-muted">If they own a business, add it — it&apos;s created and linked to this client.</p>
          <div className="mt-2"><label className="block text-xs font-semibold text-muted">Business name</label><input name="business_name" className={field} /></div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-muted">Business email</label><input name="business_email" type="email" className={field} /></div>
            <div><label className="block text-xs font-semibold text-muted">Business phone</label><input name="business_phone" className={field} /></div>
          </div>
        </div>

        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          Create client
        </button>
      </form>
    </div>
  );
}
