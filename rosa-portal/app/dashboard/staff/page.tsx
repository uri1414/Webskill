import { redirect } from "next/navigation";

// Staff landing → the request queue (the one v1 surface).
export default function StaffIndex() {
  redirect("/dashboard/staff/requests");
}
