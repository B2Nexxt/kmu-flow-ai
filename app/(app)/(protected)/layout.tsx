import { redirect } from "next/navigation";

import { evaluateOperativeAppAccess } from "@/lib/operative-auth/evaluate-operative-app-access";

export default async function ProtectedOperativeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await evaluateOperativeAppAccess();

  switch (access.status) {
    case "unauthenticated":
      redirect("/login");
    case "no_membership":
    case "inactive_membership":
      redirect("/kein-zugang");
    case "mandant_selection_required":
      redirect("/mandant-waehlen");
    case "invalid_mandant_context":
      redirect("/mandant-waehlen?fehler=ungueltig");
    case "init_cookie":
      redirect(
        `/api/operative-auth/init-mandant?returnTo=${encodeURIComponent("/dashboard")}`,
      );
    case "ok":
      return children;
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
}
