import { redirect } from "next/navigation";

import { readActiveMandantCookie } from "@/lib/operative-auth/active-mandant-cookie";
import { loadActiveMemberships } from "@/lib/operative-auth/load-active-memberships";
import { resolveMandantSelectionPageMode } from "@/lib/operative-auth/mandant-selection-messages";
import {
  getOperativeRoleLabel,
  getOrganizationDisplayName,
} from "@/lib/operative-auth/operative-role-labels";
import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

import MandantAuswahl from "./mandant-auswahl";

type MandantWaehlenPageProps = {
  searchParams: Promise<{ fehler?: string }>;
};

export default async function MandantWaehlenPage({ searchParams }: MandantWaehlenPageProps) {
  const params = await searchParams;
  const showInvalidHint = params.fehler === "ungueltig";

  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { memberships, loadError } = await loadActiveMemberships(supabase, user.id);
  const pageMode = resolveMandantSelectionPageMode(memberships.length);

  if (pageMode === "no_membership") {
    redirect("/kein-zugang");
  }

  if (pageMode === "auto_select") {
    redirect(
      `/api/operative-auth/init-mandant?returnTo=${encodeURIComponent("/dashboard")}`,
    );
  }

  const currentMandantId = await readActiveMandantCookie();

  const displayMemberships = [...memberships]
    .sort((a, b) =>
      getOrganizationDisplayName(a.organizationName).localeCompare(
        getOrganizationDisplayName(b.organizationName),
        "de",
      ),
    )
    .map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: getOrganizationDisplayName(membership.organizationName),
      roleLabel: getOperativeRoleLabel(membership.role),
      isCurrent: currentMandantId === membership.organizationId,
    }));

  return (
    <MandantAuswahl
      memberships={displayMemberships}
      showInvalidHint={showInvalidHint}
      loadError={loadError}
    />
  );
}
