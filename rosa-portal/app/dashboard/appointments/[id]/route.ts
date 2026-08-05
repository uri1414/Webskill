// GET /dashboard/appointments/[id] — download the appointment as an .ics file.
//
// Shared by staff and client. The cookie-scoped Supabase client means RLS does
// the authorization: staff read any appointment in their org, a client only
// their own (appointments_own_read) — request someone else's id and the row
// simply isn't returned, so this 404s. No time set → nothing to add to a
// calendar → 404. The browser's Content-Disposition makes it a download; on
// iOS/Safari tapping it opens the native "Add to Calendar" sheet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status")
    .eq("id", params.id)
    .single();
  if (!appt || !appt.starts_at) return new NextResponse("Not found", { status: 404 });

  const ics = buildIcs({
    id: appt.id as string,
    title: (appt.title as string) || "Appointment with Rosa & Co. CPA",
    description: "Appointment with Rosa & Co. CPA — see details in your portal.",
    startsAt: appt.starts_at as string,
    endsAt: (appt.ends_at as string | null) ?? undefined,
    cancelled: appt.status === "cancelled",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment-${appt.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
