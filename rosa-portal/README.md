# Rosa & Co. CPA — Client Portal (Appointment Request MVP)

A minimal, deployable Next.js 14 + Supabase app. It delivers exactly the
appointment-request loop:

**Client** signs in → submits an appointment request → sees its status and the
confirmed appointment. **Staff** sees the request queue → claims a request →
converts it into an appointment (the client is notified in-portal).

Every mutation runs through the engine (`lib/requests.ts`) behind a permission
gate; every read is org-scoped by Row-Level Security. No business logic in the UI.

## Deploy

**1. Supabase** — create a project, then in the SQL Editor run the migrations in
order (they live in the repo tarball under `supabase/001` … `010`, or paste the
combined file). Auth → Providers → Email: turn **off** "Confirm email" for the
smoothest demo.

**2. Staff allowlist** — `010` seeds one staff email. Add more:
```sql
insert into public.staff_emails (org_id, email)
values ('a0000000-0000-4000-8000-000000000001', 'rosa@herpractice.com');
```
Anyone not on the list who signs up becomes a **client** automatically.

**3. Env** — three vars (locally in `.env.local`, in prod on Netlify):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

**4. Run / deploy**
- Local: `npm install && npm run dev` → http://localhost:3000
- Netlify: Import from Git, **Base directory `rosa-portal`**, build `npm run build`,
  publish `.next` (the `@netlify/plugin-nextjs` in `netlify.toml` handles it). Set
  the three env vars, point `NEXT_PUBLIC_SITE_URL` at the deployed URL, and add
  that URL to Supabase → Auth → URL Configuration → Redirect URLs.

## Try the flow
1. Sign up with a **staff** email (allowlisted) → the request queue.
2. Sign up (incognito) with any other email → client → **Request an appointment**.
3. As staff: open the request → **Claim** → **Create appointment & confirm**.
4. As the client: the request shows **Confirmed** with the appointment.

## Scope (MVP)
No Gmail/email sync, AI, payments, documents, config screens, extra request
types. Single practice (one seeded org); the schema stays org-scoped so
multi-tenant is a later switch, not a rewrite.
