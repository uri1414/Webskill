import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-surface-soft px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-bold text-ink">Rosa &amp; Co. CPA</h1>
        <p className="mt-2 text-sm text-muted">
          Client portal — request an appointment and track its status in one place.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/login" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-soft">
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
