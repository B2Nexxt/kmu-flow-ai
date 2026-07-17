export const LAENDER_OPTIONS = [
  { code: "DE", label: "Deutschland", flag: "🇩🇪", dialCode: "+49" },
  { code: "AT", label: "Österreich", flag: "🇦🇹", dialCode: "+43" },
  { code: "CH", label: "Schweiz", flag: "🇨🇭", dialCode: "+41" },
  { code: "LU", label: "Luxemburg", flag: "🇱🇺", dialCode: "+352" },
  { code: "BE", label: "Belgien", flag: "🇧🇪", dialCode: "+32" },
  { code: "NL", label: "Niederlande", flag: "🇳🇱", dialCode: "+31" },
  { code: "FR", label: "Frankreich", flag: "🇫🇷", dialCode: "+33" },
] as const;

export type LandCode = (typeof LAENDER_OPTIONS)[number]["code"];

export function getLandLabel(code: string) {
  const land = LAENDER_OPTIONS.find((option) => option.code === code);
  return land ? `${land.flag} ${land.label}` : code;
}

export function getDialCodeByLand(code: string) {
  return (
    LAENDER_OPTIONS.find((option) => option.code === code)?.dialCode ?? "+49"
  );
}
