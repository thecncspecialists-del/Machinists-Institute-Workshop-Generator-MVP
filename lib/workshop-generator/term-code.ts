const TERM_CODE_REGEX = /^(SP|SU|FA|WI)\d{4}$/;

export const TERM_SEQUENCE = ["SP", "SU", "FA", "WI"] as const;

export function normalizeTermCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidTermCode(value: string) {
  return TERM_CODE_REGEX.test(normalizeTermCode(value));
}

export function termCodeHelperText() {
  return "Use SP, SU, FA, or WI plus year (example: SP2026).";
}
