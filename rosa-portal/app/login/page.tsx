import Link from "next/link";
import { login } from "./actions";

export const metadata = { title: "Sign in" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      {/* Soft brand glow behind the card — depth without noise. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.10),transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-display text-lg font-bold text-white shadow-brand">R</span>
          <p className="mt-3 font-display text-sm font-bold text-ink">Rosa &amp; Co. <span className="font-semibold text-muted">CPA</span></p>
        </div>

        <div className="w-full rounded-2xl border border-line bg-white p-7 shadow-md">
          <h1 className="font-display text-xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your client portal.</p>

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
            <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            New here? <Link href="/signup" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
