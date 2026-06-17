export function normalizeOperationalPhoneDigits(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed) || /\+(?=.)/.test(trimmed.slice(1))) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return null;
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits[1] ?? "")) {
    return digits;
  }

  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  return null;
}
