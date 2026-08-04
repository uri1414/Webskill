# Patterns — the reusable code behind the platform

Copy/adapt these. Full foundation files are in `../templates/`.

## 1. Shared loader (one per role)
Every section of a portal reads the SAME loader, so the whole thing shows one truth. Put it in `lib/<role>-data.ts`.
```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loadClient() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
  // ...fetch this role's entities (appointments, documents, invoices), scoped by RLS
  const { data: appointments } = await supabase.from("appointments").select("*").eq("client_id", user.id).order("starts_at");
  return { supabase, user, profile, appointments: appointments ?? [] };
}

// Pure helper for computed status/labels — keep UI logic out of the pages.
export function derive(appointments) { /* counts, next appt, unpaid total, etc. */ }
```

## 2. Role router + Shell
`dashboard/layout.tsx` reads `profile.role` and renders the matching sidebar Shell (light for clients, dark for staff). `dashboard/page.tsx` just redirects to the role home. Full file: `../templates/dashboard-layout.tsx`. Nav uses `PortalNav`/`MobileNav`/`PortalTitle` from `../templates/components/portalnav.tsx`.

## 3. Add an entity directly (service role + temp password)
Let staff create a client/partner account on the spot and hand off a login — no magic link, no SMTP. Server action:
```ts
"use server";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addClient(_prev, formData) {
  // 1) verify caller is staff/admin via their session
  const session = createClient();
  const { data: { user } } = await session.auth.getUser();
  const { data: me } = await session.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "staff" && me?.role !== "admin") return { error: "Staff only." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const admin = createAdminClient(); // service role — bypasses RLS

  // 2) find-or-create the account
  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  let userId, tempPassword = null;
  if (existing?.id) userId = existing.id;
  else {
    tempPassword = `welcome-${randomBytes(4).toString("hex")}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { full_name: String(formData.get("full_name") || ""), role: "client" },
    });
    if (error) return { error: error.message };
    userId = created.user.id;
  }
  await admin.from("profiles").upsert({ id: userId, email, role: "client" });
  // 3) create their domain rows (e.g. an appointment / account) ...

  const h = headers();
  const loginUrl = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}/login`;
  return { ok: true, email, tempPassword, loginUrl }; // show these on the success screen
}
```
UI: a client form with `useFormState(addClient, {})` + a `SubmitButton`; on `ok`, show copy-able **login link + email + temp password**. (See gotchas on why NOT to use magic links.)

## 4. Delete an entity (cascade + storage cleanup)
```ts
const admin = createAdminClient();
// remove their storage files first (DB rows cascade with the parent)
const { data: files } = await admin.from("documents").select("file_path").eq("client_id", id);
const paths = (files ?? []).map(f => f.file_path).filter(Boolean);
if (paths.length) await admin.storage.from("uploads").remove(paths);
await admin.from("appointments").delete().eq("client_id", id);
await admin.from("profiles").delete().eq("id", id);
await admin.auth.admin.deleteUser(id);
```
Guard: block deleting yourself or another admin; put a `window.confirm` on the button.

## 5. Private uploads + signed-URL downloads
Client uploads (browser Supabase client) to a private bucket under `/{userId}/...`:
```ts
const path = `${userId}/${category}/${Date.now()}-${safeName}`;
await supabase.storage.from("uploads").upload(path, file);
await supabase.from("documents").insert({ client_id: userId, category, file_path: path, file_name: file.name });
```
Staff downloads via a short-lived signed URL (server):
```ts
const { data } = await supabase.storage.from("uploads").createSignedUrl(file.file_path, 3600);
// render <a href={data.signedUrl} target="_blank">Download</a>
```
**Mobile file inputs:** trigger uploads with a native `<label>`-wrapped `<input type="file" class="sr-only">` — a programmatic `.click()` on a hidden input is blocked by iOS Safari.

## 6. Loading feedback
Every `<form action={serverAction}>` uses `SubmitButton` (`../templates/components/submitbutton.tsx`): `<SubmitButton className={btnPrimary} pendingText="Signing in…">Sign in</SubmitButton>`.

## 7. Link previews (root metadata)
```ts
// app/layout.tsx
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://<app>.netlify.app";
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "<Client> Portal", template: "%s · <Client>" },
  description: "...",
  openGraph: { type: "website", siteName: "<Client>", url: siteUrl },
  twitter: { card: "summary_large_image" },
  robots: { index: false },
};
```
Drop `app/opengraph-image.png`, `app/twitter-image.png`, `app/icon.png` in — Next auto-wires them. Generate the card by screenshotting a 1200×630 HTML template (see the OG approach in `scripts/`).

## 8. Preview harness (temporary — for screenshots only)
Three edits, all removed before commit:
1. Loader: `if (process.env.PORTAL_PREVIEW === "1") return { ...mockData };`
2. `dashboard/layout.tsx`: `if (process.env.PORTAL_PREVIEW === "1") return <Shell .../>;`
3. `lib/supabase/middleware.ts`: `const isPublic = true || path === "/" || ...;`
Build with `PORTAL_PREVIEW=1`, `next start`, screenshot, then revert all three and rebuild. `grep -rn PORTAL_PREVIEW app lib` must be empty before you commit.

## Migration templates
See `../templates/supabase/`: `001_schema.sql` (profiles + role + trigger + example entities), `002_rls.sql` (enable + `is_staff()` + policies), `003_grants.sql` (the grants people forget), `004_storage.sql` (private bucket + policies).
