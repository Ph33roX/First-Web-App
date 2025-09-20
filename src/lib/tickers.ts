const EXCEPTION_MAP = new Map<string, string>([
  ["BRK.B", "BRK-B"],
  ["BRK-B", "BRK-B"],
  ["BF.B", "BF-B"],
  ["BF-B", "BF-B"],
  ["GOOG", "GOOG"],
  ["GOOGL", "GOOGL"],
  ["GOOGLE", "GOOGL"]
]);

const VALID_SYMBOL = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/;

export function normalizeToYahoo(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Ticker cannot be empty");
  }

  const upper = trimmed.toUpperCase();
  const compact = upper.replace(/\s+/g, "");

  if (!VALID_SYMBOL.test(compact)) {
    throw new Error("Ticker must contain only letters, numbers, dots, or hyphens");
  }

  const exception = EXCEPTION_MAP.get(compact);
  if (exception) {
    return exception;
  }

  const dotted = compact.replace(/\./g, "-").replace(/-+/g, "-");
  return EXCEPTION_MAP.get(dotted) ?? dotted;
}
