import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. BYPASSES Row Level Security — server-side ONLY, never
// import into a Client Component. For privileged writes (create/delete users).
// Requires SUPABASE_SERVICE_ROLE_KEY; never exposed to the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
