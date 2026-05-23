/** Devanagari (Marathi/Hindi) ०-९ */
const DEVANAGARI_DIGIT = /[\u0966-\u096F]/g;
/** Arabic-Indic ٠-٩ — some keyboards emit these */
const ARABIC_INDIC_DIGIT = /[\u0660-\u0669]/g;

function mapIndicDigit(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x0966 && code <= 0x096f) return String(code - 0x0966);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  return char;
}

/** Converts Marathi/Devanagari (and Arabic-Indic) numerals to ASCII 0-9. */
export function normalizeIndicDigitsToAscii(input: string): string {
  return input
    .replace(DEVANAGARI_DIGIT, mapIndicDigit)
    .replace(ARABIC_INDIC_DIGIT, mapIndicDigit);
}

/** Mobile input: indic → ASCII digits, strip non-digits, cap length. */
export function normalizeMobileNumberInput(input: string, maxLength = 10): string {
  return normalizeIndicDigitsToAscii(input).replace(/\D/g, '').slice(0, maxLength);
}

/** OTP / numeric codes — same indic normalization, variable length. */
export function normalizeDigitInput(input: string, maxLength: number): string {
  return normalizeIndicDigitsToAscii(input).replace(/\D/g, '').slice(0, maxLength);
}
