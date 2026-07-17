export const ANGEBOT_STATUS = {
  ENTWURF: "entwurf",
  FREIGEGEBEN: "freigegeben",
  VERSENDET: "versendet",
  ANGENOMMEN: "angenommen",
  ABGELEHNT: "abgelehnt",
  ABGELAUFEN: "abgelaufen",
} as const;

export type AngebotStatusCode =
  (typeof ANGEBOT_STATUS)[keyof typeof ANGEBOT_STATUS];

const ANGEBOT_STATUS_LABELS: Record<AngebotStatusCode, string> = {
  entwurf: "Entwurf",
  freigegeben: "Freigegeben",
  versendet: "Versendet",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  abgelaufen: "Abgelaufen",
};

export function getAngebotStatusLabel(status: string) {
  if (status in ANGEBOT_STATUS_LABELS) {
    return ANGEBOT_STATUS_LABELS[status as AngebotStatusCode];
  }

  return status;
}

export function getAngebotStatusBadgeClassName(status: string) {
  switch (status) {
    case ANGEBOT_STATUS.ENTWURF:
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case ANGEBOT_STATUS.FREIGEGEBEN:
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case ANGEBOT_STATUS.VERSENDET:
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
    case ANGEBOT_STATUS.ANGENOMMEN:
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case ANGEBOT_STATUS.ABGELEHNT:
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case ANGEBOT_STATUS.ABGELAUFEN:
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function isAngebotEntwurfEditable(status: string) {
  return status === ANGEBOT_STATUS.ENTWURF;
}
