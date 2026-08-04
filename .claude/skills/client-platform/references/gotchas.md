# Gotchas — every trap we hit, and the fix

These cost real time on the Baseline build. Check them proactively.

## Supabase
- **RLS ≠ table grants.** Policies decide *which rows*; GRANTs decide whether `authenticated` can touch the table at all. Symptom: `permission denied for table X` even with correct policies. Fix: `grant select, insert, update, delete on public.X to authenticated;` in the migration.
- **Storage bucket + policies are separate from tables.** Uploads fail (`Bucket not found` / RLS) until you create the private bucket **and** add `storage.objects` policies scoped to `(storage.foldername(name))[1] = auth.uid()::text`. Upload files under `/{userId}/...` so the policy matches.
- **`system_role`/`role` must be set on the profile.** A signup trigger should create `profiles`; set the role (default customer). The `dashboard/layout.tsx` router keys off it.

## Auth / onboarding
- **Magic / invite links are fragile.** They depend on the project's Site URL + redirect allowlist and often dump the user on the wrong page (or a blank spinner). For admin-created accounts, use the **service-role client to create the user with a temporary password** (`email_confirm: true`) and hand off email + temp password. No SMTP, no redirect config. (See patterns → "Add entity".)
- **No transactional email by default.** Supabase's built-in SMTP is rate-limited (a few/hour). Fine for testing; for production wire a sender (Resend). Until then, prefer temp-password hand-offs over emailed links.
- **`NEXT_PUBLIC_SITE_URL`** should be set so password-reset / confirm redirects point at the right host.

## Deploy / config
- **`SUPABASE_SERVICE_ROLE_KEY`** must be set on the host (Netlify) or admin create/delete throws. It's a secret — server-only, never `NEXT_PUBLIC_`.
- Env-var changes need a **redeploy** (clear cache + deploy) to take effect.

## Link previews
- A shared login link shows a **blank spinner** in iMessage/social until the app has `app/opengraph-image.png` + `app/icon.png` + root `metadata` with `metadataBase`. Messaging apps also **cache** previews — resend in a fresh thread to see the new card.

## UX / forms
- **Every server-action form needs `SubmitButton`** (`useFormStatus`), or users think their click didn't register during the delay and double-submit.
- **Wide tables must live in `overflow-x-auto`** with a `min-w-[...]` inner, or the whole page scrolls sideways on mobile.

## The preview harness (for screenshots)
- Auth-gated pages can't be screenshot without a session. Temporarily: (1) branch a `PORTAL_PREVIEW` check into the loader that returns mock data, (2) branch it into `dashboard/layout.tsx` to render the target role's shell, (3) hardcode `isPublic = true` in `lib/supabase/middleware.ts`. Build with `PORTAL_PREVIEW=1`, `next start`, screenshot with Playwright, then **remove all three** and rebuild before committing. Grep for `PORTAL_PREVIEW` to be sure it's gone.
- Kill stray `next-server` processes between runs (`pkill -9 -f next-server`) or you'll hit `EADDRINUSE` / stale builds.
