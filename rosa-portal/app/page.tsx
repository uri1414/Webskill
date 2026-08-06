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
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.10),transparent_70%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-md">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-white shadow-brand">R</span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Rosa &amp; Co. CPA</h1>
        <p className="mt-2 text-sm text-muted">
          Your client portal — request an appointment, see what to bring, and track everything in one place.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/login" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
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
