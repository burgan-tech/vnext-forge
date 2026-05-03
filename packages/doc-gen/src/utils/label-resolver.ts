interface LabelEntry {
  language: string;
  label: string;
}

export function resolveLabel(
  entries: LabelEntry[] | undefined | null,
  preferredLang = 'en-US',
): string | null {
  if (!entries?.length) return null;
  const preferred = entries.find((e) => e.language === preferredLang);
  return preferred?.label ?? entries[0]?.label ?? null;
}

export function resolveLabelOrKey(
  entries: LabelEntry[] | undefined | null,
  key: string,
  preferredLang = 'en-US',
): string {
  return resolveLabel(entries, preferredLang) ?? key;
}
