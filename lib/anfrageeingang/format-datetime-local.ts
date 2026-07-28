export function formatDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseEmpfangenAmInput(
  value: string,
): { ok: true; iso: string | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, iso: null };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false };
  }

  const year = parsed.getFullYear();
  if (year < 2000 || year > 9999) {
    return { ok: false };
  }

  return { ok: true, iso: parsed.toISOString() };
}
