export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function calculateCheckDigit(digits: string, weights: number[]): number {
  const sum = digits
    .split("")
    .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Validates CNPJ check digits (module 11), per SPEC.md's "validar dígitos" requirement. */
export function isValidCnpj(rawValue: string): boolean {
  const cnpj = onlyDigits(rawValue);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const firstDigit = calculateCheckDigit(cnpj.slice(0, 12), firstWeights);
  if (firstDigit !== Number(cnpj[12])) return false;

  const secondDigit = calculateCheckDigit(cnpj.slice(0, 13), secondWeights);
  if (secondDigit !== Number(cnpj[13])) return false;

  return true;
}

export function formatCnpj(rawValue: string): string {
  const cnpj = onlyDigits(rawValue).padEnd(14, "_");
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}
