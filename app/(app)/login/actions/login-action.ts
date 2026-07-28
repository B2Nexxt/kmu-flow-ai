"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import { LOGIN_TECHNICAL_ERROR_MESSAGE } from "@/lib/operative-auth/login-messages";
import {
  mapLoginAuthError,
  validateLoginInput,
  type LoginFieldErrors,
} from "@/lib/operative-auth/validate-login-input";

export type LoginActionState = {
  formError?: string;
  fieldErrors?: LoginFieldErrors;
};

function logAuthErrorInDevelopment(context: string, message: string) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[loginAction] ${context}:`, message);
  }
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    return { fieldErrors: validation.fieldErrors };
  }

  try {
    const supabase = await createSupabaseServerAuthClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: validation.email,
      password: validation.password,
    });

    if (error) {
      logAuthErrorInDevelopment("signInWithPassword", error.message);
      return { formError: mapLoginAuthError(error.message) };
    }
  } catch (error) {
    if (error instanceof Error) {
      logAuthErrorInDevelopment("unexpected", error.message);
    }
    return { formError: LOGIN_TECHNICAL_ERROR_MESSAGE };
  }

  redirect("/dashboard");
}
