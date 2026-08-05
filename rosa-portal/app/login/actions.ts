"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "";

export async function login(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: String(formData.get("full_name") || "").trim() },
      emailRedirectTo: `${site()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  // "Confirm email" OFF -> a session exists -> straight in. ON -> ask them to confirm.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  redirect(`/login?message=${encodeURIComponent("Check your email to confirm, then sign in.")}`);
}
