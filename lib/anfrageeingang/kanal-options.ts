import type { AnfrageeingangKanal } from "./types";

export const ANFRAGEEINGANG_KANAL_VALUES: readonly AnfrageeingangKanal[] = [
  "telefon",
  "email",
  "kontaktformular",
  "whatsapp",
  "sms",
  "persoenlich",
  "empfehlung",
  "sonstiges",
] as const;

export function isAnfrageeingangKanal(value: string): value is AnfrageeingangKanal {
  return (ANFRAGEEINGANG_KANAL_VALUES as readonly string[]).includes(value);
}
