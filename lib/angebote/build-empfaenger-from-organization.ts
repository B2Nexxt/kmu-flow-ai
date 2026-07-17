import type { AngebotEmpfaengerInput } from "@/lib/angebote/create-angebot-input";
import type { OrganizationSelectOption } from "@/lib/angebote/get-organization-select-options";

function formatTelefon(
  vorwahl: string | null,
  nummer: string | null,
): string | undefined {
  const prefix = vorwahl?.trim() ?? "";
  const number = nummer?.trim() ?? "";

  if (!prefix && !number) {
    return undefined;
  }

  if (!number) {
    return prefix;
  }

  if (!prefix) {
    return number;
  }

  return `${prefix} ${number}`;
}

export function buildEmpfaengerFromOrganization(
  organization: OrganizationSelectOption,
): AngebotEmpfaengerInput {
  return {
    firmenname: organization.firmenname,
    rechtsform: organization.rechtsform ?? undefined,
    strasse: organization.strasse ?? undefined,
    hausnummer: organization.hausnummer ?? undefined,
    plz: organization.plz ?? undefined,
    ort: organization.ort ?? undefined,
    land: organization.land ?? undefined,
    ansprechpartner: organization.hauptansprechpartnerName ?? undefined,
    email: organization.email ?? undefined,
    telefon: formatTelefon(
      organization.telefonVorwahl,
      organization.telefonNummer,
    ),
    umsatzsteuerId: organization.umsatzsteuerId ?? undefined,
  };
}
