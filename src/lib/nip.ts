const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export function normalizeNip(raw: string | undefined | null): string | undefined {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) {
    return undefined;
  }
  return digits;
}

export function isValidNip(raw: string | undefined | null): boolean {
  const digits = normalizeNip(raw);
  if (!digits) {
    return false;
  }
  if (!/^\d{10}$/.test(digits)) {
    return false;
  }

  const checksumBase = NIP_WEIGHTS.reduce((sum, weight, index) => {
    return sum + Number(digits[index]) * weight;
  }, 0);
  const checksum = checksumBase % 11;
  if (checksum === 10) {
    return false;
  }

  return checksum === Number(digits[9]);
}
