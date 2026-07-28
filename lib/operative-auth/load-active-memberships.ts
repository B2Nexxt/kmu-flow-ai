import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActiveMembership } from "./types";
import { isOperativeRole } from "./types";

type MembershipRow = {
  organization_id: string;
  role: string;
  organizations: { name: string } | { name: string }[] | null;
};

function organizationNameFromRow(
  organizations: MembershipRow["organizations"],
): string | undefined {
  if (!organizations) return undefined;
  if (Array.isArray(organizations)) {
    return organizations[0]?.name;
  }
  return organizations.name;
}

/**
 * Lädt aktive Mitgliedschaften über den authentifizierten Client (Self-Read-RLS).
 * Inaktive Mitgliedschaften sind durch Policy nicht sichtbar.
 */
export async function loadActiveMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ memberships: ActiveMembership[]; loadError: boolean }> {
  const withJoin = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId);

  if (!withJoin.error && withJoin.data) {
    return {
      memberships: mapMembershipRows(withJoin.data as MembershipRow[]),
      loadError: false,
    };
  }

  const fallback = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (fallback.error || !fallback.data) {
    return { memberships: [], loadError: true };
  }

  return {
    memberships: mapMembershipRows(fallback.data as MembershipRow[]),
    loadError: false,
  };
}

function mapMembershipRows(rows: MembershipRow[]): ActiveMembership[] {
  const memberships: ActiveMembership[] = [];

  for (const row of rows) {
    if (!isOperativeRole(row.role)) {
      continue;
    }
    memberships.push({
      organizationId: row.organization_id,
      role: row.role,
      organizationName: organizationNameFromRow(row.organizations),
    });
  }

  return memberships;
}
