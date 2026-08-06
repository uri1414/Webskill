import Link from "next/link";
import { signup } from "../login/actions";

export const metadata = { title: "Create account" };

const field =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.10),transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-display text-lg font-bold text-white shadow-brand">R</span>
          <p className="mt-3 font-display text-sm font-bold text-ink">Rosa &amp; Co. <span className="font-semibold text-muted">CPA</span></p>
        </div>

        <div className="w-full rounded-2xl border border-line bg-white p-7 shadow-md">
          <h1 className="font-display text-xl font-bold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Rosa &amp; Co. CPA client portal.</p>
          <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-xs text-body">
            Portal access is by invitation. Sign up with the <span className="font-semibold text-ink">email your accountant has on file</span> so your account links to your records.
          </p>

          {searchParams.error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
          )}

          <form action={signup} className="mt-5 space-y-3">
            <div>
              <label htmlFor="full_name" className="block text-sm font-semibold text-ink">Full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" className={field} />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={field} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink">Password</label>
              <input id="password" name="password" type="password" required autoComplete="new-password" minLength={6} className={field} />
            </div>
            <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
              Create account
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Have an account? <Link href="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
