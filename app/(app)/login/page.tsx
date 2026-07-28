import { redirect } from "next/navigation";

import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
