// ============================================================================
// notifications.ts — the delivery seam.
//
// notify() records a notification row (the durable log) and hands it to a
// channel adapter for delivery. v1 ships the in-app adapter (the row IS the
// delivery). Add email/sms adapters to the registry later — callers never
// change, and the engine never imports a vendor SDK directly.
//
// Sensitive detail stays OUT of `body`: a notification says THAT something
// happened and links into the authenticated portal.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export type Channel = "in_app" | "email" | "sms";

export interface NotificationInput {
  orgId: string;
  recipientId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  channel?: Channel;
  entityType?: string;
  entityId?: string;
}

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

// One adapter per channel. Implement `send`; the seam does the rest.
export interface DeliveryAdapter {
  channel: Channel;
  send(input: NotificationInput): Promise<DeliveryResult>;
}

// in-app: nothing to transmit — the stored row is the notification.
export const inAppAdapter: DeliveryAdapter = {
  channel: "in_app",
  async send() {
    return { ok: true };
  },
};

// Registry. Add email/sms adapters here later; no caller changes. Until an
// adapter exists for a channel, the row is logged and delivery is deferred.
const ADAPTERS: Partial<Record<Channel, DeliveryAdapter>> = {
  in_app: inAppAdapter,
};

export async function notify(
  input: NotificationInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createClient();
  const channel = input.channel ?? "in_app";

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      org_id: input.orgId,
      recipient_id: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      channel,
      status: channel === "in_app" ? "sent" : "pending",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  const adapter = ADAPTERS[channel];
  if (!adapter) return { ok: true, id: data.id as string }; // logged; delivery deferred

  const res = await adapter.send(input);
  await supabase
    .from("notifications")
    .update({ status: res.ok ? "sent" : "failed", sent_at: res.ok ? nowIso() : null })
    .eq("id", data.id);

  return { ok: res.ok, id: data.id as string, error: res.error };
}

function nowIso(): string {
  return new Date().toISOString();
}
