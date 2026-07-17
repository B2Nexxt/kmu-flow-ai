export const MANDANT_STATUS = {
  INTERESSENT: "interessent",
  AKTIVER_MANDANT: "aktiver_mandant",
} as const;

export type MandantStatusCode =
  (typeof MANDANT_STATUS)[keyof typeof MANDANT_STATUS];

export const MANDANT_STATUS_OPTIONS = [
  { code: MANDANT_STATUS.INTERESSENT, label: "Interessent" },
  { code: MANDANT_STATUS.AKTIVER_MANDANT, label: "Aktiver Mandant" },
] as const;

/** Später erweiterbar um: Qualifiziert, Angebot erstellt, Angebot angenommen, Pausiert, Gekündigt, Archiviert */
export const FUTURE_MANDANT_STATUS_CODES = [
  "qualifiziert",
  "angebot_erstellt",
  "angebot_angenommen",
  "pausiert",
  "gekuendigt",
  "archiviert",
] as const;

export function getMandantStatusLabel(status: string) {
  const option = MANDANT_STATUS_OPTIONS.find((entry) => entry.code === status);
  return option?.label ?? status;
}
