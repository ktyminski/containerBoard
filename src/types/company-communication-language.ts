export const COMPANY_COMMUNICATION_LANGUAGES = [
  "polish",
  "english",
  "german",
  "french",
  "spanish",
  "ukrainian",
  "russian",
  "italian",
  "chinese",
] as const;

export type CompanyCommunicationLanguage =
  (typeof COMPANY_COMMUNICATION_LANGUAGES)[number];

export function normalizeCompanyCommunicationLanguages(
  values: string[] | undefined | null,
): CompanyCommunicationLanguage[] {
  if (!values || values.length === 0) {
    return [];
  }

  const allowed = new Set<string>(COMPANY_COMMUNICATION_LANGUAGES);
  return Array.from(
    new Set(
      values.filter(
        (value): value is CompanyCommunicationLanguage => allowed.has(value),
      ),
    ),
  );
}
