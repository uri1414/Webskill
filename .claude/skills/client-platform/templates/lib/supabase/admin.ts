// ============================================================================
// admin.ts — service-role Supabase client for TRUSTED server-side SYSTEM steps
// only (automation, routing, notifications to other recipients). It BYPASSES
// RLS, so:
//   - NEVER import this into a client component or expose it to the browser.
//   - Only call it for system actions with server-validated inputs.
// The request-scoped server client (lib/supabase/server) remains the default;
// reach for this solely where a step is the platform acting as itself, not the
// user — e.g. routing a freshly submitted request (a client cannot update
// requests). See lib/requests.ts and lib/notifications.ts.
// ============================================================================
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabase(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
