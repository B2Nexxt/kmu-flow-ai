export const MANDANT_STATUS = {
  INTERESSENT: "interessent",
  AKTIVER_MANDANT: "aktiver_mandant",
  INAKTIV: "inaktiv",
} as const;

export type MandantStatusCode =
  (typeof MANDANT_STATUS)[keyof typeof MANDANT_STATUS];

export const MANDANT_STATUS_OPTIONS = [
  { code: MANDANT_STATUS.INTERESSENT, label: "Interessent" },
  { code: MANDANT_STATUS.AKTIVER_MANDANT, label: "Aktiver Mandant" },
  { code: MANDANT_STATUS.INAKTIV, label: "Inaktiv" },
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

export function getMandantStatusBadgeClassName(status: string) {
  if (status === MANDANT_STATUS.INTERESSENT) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }

  if (status === MANDANT_STATUS.AKTIVER_MANDANT) {
    return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  }

  if (status === MANDANT_STATUS.INAKTIV) {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }

  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export function isValidMandantStatus(value: string): value is MandantStatusCode {
  return (
    value === MANDANT_STATUS.INTERESSENT ||
    value === MANDANT_STATUS.AKTIVER_MANDANT ||
    value === MANDANT_STATUS.INAKTIV
  );
}

export function parseMandantStatus(value: string): MandantStatusCode | null {
  return isValidMandantStatus(value) ? value : null;
}

export type MandantListStatusFilter = "all" | MandantStatusCode;

export function parseMandantListStatusFilter(
  value: string | undefined,
): MandantListStatusFilter {
  if (value === MANDANT_STATUS.AKTIVER_MANDANT) {
    return MANDANT_STATUS.AKTIVER_MANDANT;
  }

  if (value === MANDANT_STATUS.INTERESSENT) {
    return MANDANT_STATUS.INTERESSENT;
  }

  if (value === MANDANT_STATUS.INAKTIV) {
    return MANDANT_STATUS.INAKTIV;
  }

  return "all";
}

export function isMandantStatusCode(
  value: MandantListStatusFilter,
): value is MandantStatusCode {
  return value !== "all";
}
