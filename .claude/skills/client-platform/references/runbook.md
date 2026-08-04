# Runbook — stand up a new client platform

A checklist to go from zero to a working, deployed multi-role platform for a new client. Assumes the `client-platform` skill's `templates/` are your starting point.

## 0. Scope (before code)
- List the **roles** (usually: the client's customers + the client's staff; sometimes a third like referrer).
- For each role, list the **sections** (sidebar items).
- List the **entities** (tables) and which sections are **real data** vs **polished placeholder** for v1.
- Decide payments: **track manually** for v1, or wire **Stripe** now (deposits at booking kill no-shows).

## 1. Project + stack
1. New Next.js 14 app (App Router, TS, Tailwind). Copy from `templates/`: `tailwind.config.ts`, `globals.css`, `postcss`, `next.config`, `middleware.ts`, `package.json` deps.
2. Copy `lib/supabase/{server,client,admin,middleware}.ts`, `components/{ui,submitbutton,portalnav}.tsx`, and the Shell in `dashboard/layout.tsx`.
3. `npm i` and confirm `npx next build` is green (with placeholder env vars).

## 2. Supabase
1. New Supabase project (isolate each client's data). Grab the URL + anon + service_role keys.
2. Run migrations (see `references/patterns.md` → Migration templates), in order:
   - `001` core schema: `profiles` (with a `role` column) + a profile-on-signup trigger; your entities.
   - `002` RLS: enable + policies (customers see their own rows; staff/admin see all via an `is_staff()`/`is_admin()` helper).
   - `003` **table GRANTs** to `authenticated` (RLS is not a grant — forgetting this = `permission denied for table`).
   - `004` storage: private bucket + upload/read/delete policies scoped to `/{auth.uid()}/...`.

## 3. Auth
1. Copy the auth flow: `login`, `signup`/`get-started`, `forgot-password`, `reset-password`, `auth/confirm`, `auth/signout` + their `actions.ts`.
2. Put `SubmitButton` on every form (pending feedback).
3. Role routing: `dashboard/layout.tsx` reads `profile.role` → renders that role's Shell; `dashboard/page.tsx` redirects to the role home.

## 4. Build each portal (repeat the SKILL build loop)
- One `lib/<role>-data.ts` loader.
- Sidebar `NavItem[]` → routes. One section per route.
- Server components read the loader; writes are server actions.
- Preview harness → screenshot every section → remove harness → PR.

## 5. Admin conveniences (copy from patterns)
- **Add customer/partner directly** (service-role + temp password hand-off).
- **Delete customer** (cascade + storage cleanup, with a confirm).
- **Signed-URL downloads** for staff to grab client uploads.

## 6. Ship
- Netlify site + the 4 env vars. Set `SUPABASE_SERVICE_ROLE_KEY` or admin create/delete won't work.
- Regenerate the OG card + favicon (`app/opengraph-image.png`, `app/icon.png`) and root `metadata`.
- Hand the client: their login URL, and for each staff member an email + temp password.

## 7. Definition of done for v1
- Client can: sign in, do the one core action (book/upload/pay), see status.
- Staff can: see the directory + day view, prep/tasks, change status, add a customer.
- `next build` green; every section screenshot-checked; env + Supabase config verified live.
