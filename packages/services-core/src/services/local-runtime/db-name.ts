/**
 * Mirror of the normalisation in `create-domain.sh`: non-alphanumeric
 * characters become underscores, then the first character is upper-cased.
 *
 * Prefer {@link extractDbNameFromAppSettings} whenever the generated files are
 * on disk. The runtime repo applies three *different* awk normalisations
 * across create-domain.sh, `make db-create` and `make change-domain`, so the
 * file the runtime actually uses is the only trustworthy source; this function
 * is the fallback for when it cannot be read.
 */
export function normalizeDbName(domain: string): string | null {
  const trimmed = domain.trim()
  if (trimmed.length === 0) return null
  const underscored = trimmed.replace(/[^a-zA-Z0-9]/g, '_')
  const normalized = underscored.charAt(0).toUpperCase() + underscored.slice(1)
  return `vNext_${normalized}`
}

/**
 * Read the database name out of a generated
 * `domains/<domain>/appsettings.Development.json` by matching the
 * `Database=<name>` segment of its connection string.
 */
export function extractDbNameFromAppSettings(content: string): string | null {
  const match = /Database=([^;"'\s]+)/.exec(content)
  const name = match?.[1]?.trim()
  return name !== undefined && name.length > 0 ? name : null
}
