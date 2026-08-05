import Link from "next/link";
import { login } from "./actions";

export const metadata = { title: "Sign in" };

const field =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-soft px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-7 shadow-card">
        <h1 className="font-display text-xl font-bold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Rosa &amp; Co. CPA client portal.</p>

        {searchParams.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        {searchParams.message && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.message}</p>
        )}

        <form action={login} className="mt-5 space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-ink">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={field} />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-ink">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          New here? <Link href="/signup" className="font-semibold text-brand">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
