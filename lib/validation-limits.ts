export const VALIDATION_LIMITS = {
  adminUserNameMax: 120,
  debugIssueTitleMax: 140,
  debugIssueDescriptionMax: 4000,
  pageUrlMax: 500,
  importFileMaxBytes: 10 * 1024 * 1024,
  aiInputMaxFields: 60,
  aiInputValueMaxChars: 4000
} as const;

export function isFileWithinLimit(file: File, maxBytes = VALIDATION_LIMITS.importFileMaxBytes) {
  return file.size <= maxBytes;
}
