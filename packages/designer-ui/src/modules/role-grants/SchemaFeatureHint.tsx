/** Minimum vnext-schema release for the runtime 0.0.99 constructs. */
export const SCHEMA_0_0_55 = '0.0.55';

/**
 * Explains why a control is disabled: the project's pinned vnext-schema
 * predates the construct.
 */
export function SchemaFeatureHint({
  feature,
  schemaVersion,
  minimum = SCHEMA_0_0_55,
}: {
  feature: string;
  schemaVersion: string | undefined;
  minimum?: string;
}) {
  return (
    <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
      {feature} needs vnext-schema {minimum} or later; this project uses{' '}
      {schemaVersion ?? 'an older version'}. Raise <code>schemaVersion</code> in <code>vnext.config.json</code> to
      enable it.
    </p>
  );
}
