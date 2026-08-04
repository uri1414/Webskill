---
name: client-platform
description: Build a branded, multi-role client platform (a customer/client portal plus a staff/admin portal) on Next.js 14 + Supabase — the blueprint, exact build process, reusable patterns, and copyable code skeleton behind the Baseline Studio platform. Use when standing up an app where a business's own clients log in to do things (book, pay, upload, track status) and the business's staff manage them, i.e. a real product/SaaS, not a marketing site. Examples: a CPA practice portal, a clinic, a law firm, an agency client portal.
---

# Client Platform — blueprint + skeleton

This skill turns "build a whole client platform from scratch" into "copy a proven skeleton and edit it down." It captures how the Baseline Studio platform was built (auth, three role-based portals, Supabase data, file uploads, admin CRUD, payments-ready patterns) so a new client platform starts at ~60% done.

## When to use
- A client needs software where **their** customers log in — booking, payments, document upload, status tracking — **and** the client's staff manage those customers (a front-desk / admin side).
- You're productizing: the same shape recurs across clients (CPA, clinic, salon, law firm, contractor). Build once, template it, edit per client.

**Not for:** a marketing website (use the web-design skills), or a single static dashboard with no auth/data.

## The shape (what you're building)
One Next.js app with **role-based portals** behind Supabase auth:
- **Client portal** — the business's customer signs in: book/see appointments, pay, upload files, see their status/history.
- **Staff/Admin portal** — the business's team: a directory of customers, a day view (who's coming in), per-customer tasks/prep, mark statuses, collect payment, manage everything.
- (Optional third role — e.g. **partner/referrer** — same pattern.)

Each role gets its own **shell** (sidebar nav + top bar) and its own set of section routes. A single `role` on the user's profile decides which shell + routes they land in.

## Stack & repo layout
- **Next.js 14 App Router** (server components + server actions), **TypeScript**, **Tailwind** (custom brand tokens), **Supabase** (Postgres + Auth + Storage), deployed on **Netlify**.
- Layout:
```
app/
  layout.tsx                # root metadata (title, OG image, favicon) — see link-previews below
  globals.css
  (auth)  login/ signup/ get-started/ forgot-password/ reset-password/ auth/confirm/ auth/signout/
  dashboard/
    layout.tsx              # role router + the shared Shell (sidebar/topbar) — see templates/
    page.tsx                # /dashboard → redirect to the right role home
    <role>/                 # one folder per role (e.g. customer/, staff/, admin/)
      page.tsx              # role home (dashboard section)
      <section>/page.tsx    # each sidebar section is a route
      actions.ts            # server actions for that role's writes
  opengraph-image.png icon.png twitter-image.png   # link-preview card + favicon
components/  ui.tsx  submitbutton.tsx  portalnav.tsx  <shell>...
lib/
  supabase/ server.ts client.ts admin.ts middleware.ts
  <domain>-data.ts        # ONE loader per role (see "shared loader" pattern)
supabase/                 # SQL migrations (schema, RLS, storage, grants)
middleware.ts             # calls lib/supabase/middleware.updateSession
tailwind.config.ts  postcss.config.js  next.config.mjs
```

## The build process (the loop that worked)
Do this per portal. It's the exact rhythm used for Baseline's customer/admin/partner portals.
1. **Intake the design.** If you get a UX bundle, decode it → `scripts/decode-ux.mjs <file>` (designer bundles are JSON-encoded HTML; screens are tagged `data-screen-label`). Read the screens + the JS data models at the bottom.
2. **Map data → real vs placeholder.** For each screen, decide what's backed by the DB today and what's a polished placeholder. Tell the client which is which. (Every Baseline portal had 2–3 "coming soon" sections built to design.)
3. **Scaffold from `templates/`.** Copy the foundation (design tokens, `ui`, `SubmitButton`, `PortalNav`, the Shell layout, the four `lib/supabase/*` clients, migrations). Swap the brand tokens + nav items.
4. **Write ONE shared loader** per role (`lib/<role>-data.ts`) — see the loader pattern. Every section imports it so the whole portal shows one consistent truth.
5. **Build the sidebar + routes.** Nav items become real hrefs (`PortalNav` highlights the active one; `MobileNav` covers phones). One route per section.
6. **Build each section** as a server component reading the loader; wire writes as server actions. Use `SubmitButton` on every form so clicks show a pending state.
7. **Preview + screenshot before shipping.** You can't log in as every role locally, so use the temporary preview harness (`references/patterns.md` → "Preview harness") + `scripts/preview-screenshot.mjs`. Screenshot every section, review, then **remove the harness** before commit.
8. **PR → review → merge.** One portal per PR. Keep the harness out of the diff.

## Reusable patterns (full code in `references/patterns.md`)
- **Shared loader** — `loadX()` returns `{ user, profile, ...entities }` + a `derive()` for computed status; every section reads it.
- **Role router + Shell** — `dashboard/layout.tsx` reads `profile.role` and renders the matching sidebar shell; `dashboard/page.tsx` redirects to the role home.
- **Service-role "add / delete entity"** — admin creates a customer/partner directly via the service-role client, hands off a **temporary password** (NOT a magic link — see gotchas), and deletes with cascade + storage cleanup.
- **Private file uploads** — client uploads to a private Storage bucket under `/{userId}/...`; admin reads via **short-lived signed URLs**.
- **Loading feedback** — `SubmitButton` (`useFormStatus`) on every server-action form.
- **Link previews** — `app/opengraph-image.png` + `app/icon.png` + root `metadata` so shared login links render a card, not a blank spinner.

## Per-client customization checklist
When you copy the skeleton, edit these and (mostly) nothing else:
1. **Brand tokens** — `tailwind.config.ts` colors + fonts; the logo mark in `components/ui.tsx` and the Shell.
2. **Roles + nav** — the role list and each role's `NavItem[]` in `dashboard/layout.tsx`.
3. **Data model** — the `supabase/` migrations: your entities (e.g. `appointments`, `invoices`, `documents`, `tasks`) + RLS + grants. See `references/patterns.md` → "Migration templates."
4. **Loaders** — one `lib/<role>-data.ts` per role querying your tables.
5. **Sections** — the per-role section pages (the business logic; this is the real work).
6. **Metadata** — title/description + regenerate the OG card + favicon.

## Deploy + required config (do NOT skip)
- **Netlify** site, `@netlify/plugin-nextjs`. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret — enables admin create/delete), `NEXT_PUBLIC_SITE_URL`.
- **Supabase**: run the migrations. The three things people forget (all in gotchas): the **storage bucket + its policies**, the **table GRANTs to `authenticated`** (RLS ≠ grants), and using **temp passwords** instead of magic links when there's no SMTP.

## What's in this skill
- `templates/` — copyable foundation files (design tokens, components, supabase clients, shell layout, migrations, env example, deps).
- `references/runbook.md` — "stand up a new client platform" step by step.
- `references/patterns.md` — annotated reusable code + migration SQL templates.
- `references/gotchas.md` — every trap we hit and the fix.
- `scripts/decode-ux.mjs` — decode a designer UX bundle to HTML.
- `scripts/preview-screenshot.mjs` — screenshot auth-gated pages via a temporary preview harness.
