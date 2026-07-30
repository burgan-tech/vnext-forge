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

/** Pull the `Database=<name>` segment out of a single connection string. */
function extractDatabaseSegment(connectionString: string): string | null {
  const match = /Database=([^;"'\s]+)/.exec(connectionString)
  const name = match?.[1]?.trim()
  return name !== undefined && name.length > 0 ? name : null
}

/**
 * Read the database name out of a generated
 * `domains/<domain>/appsettings.Development.json`.
 *
 * The file contains more than one `Database=` segment — the real Postgres
 * connection string under `ConnectionStrings.Default`, and at least one more
 * under an unrelated block (e.g. `ClickHouse.ConnectionString`, used for
 * analytics). Only `ConnectionStrings.Default` names the domain's own
 * database, so this parses the file as JSON and reads that field specifically
 * rather than scanning the whole content for the first `Database=` match,
 * which could silently pick up the wrong connection string.
 *
 * Falls back to scanning the raw content only when the input is not valid
 * JSON, or is valid JSON without a usable `ConnectionStrings.Default` string
 * (this also covers a bare JSON string value, e.g. `'"Host=...;Database=..."'`,
 * which `JSON.parse` accepts but which is not an object).
 */
export function extractDbNameFromAppSettings(content: string): string | null {
  try {
    const parsed: unknown = JSON.parse(content)

    if (typeof parsed === 'string') {
      return extractDatabaseSegment(parsed)
    }

    if (parsed !== null && typeof parsed === 'object') {
      const connectionStrings = (parsed as Record<string, unknown>).ConnectionStrings
      if (connectionStrings !== null && typeof connectionStrings === 'object') {
        const defaultConnection = (connectionStrings as Record<string, unknown>).Default
        if (typeof defaultConnection === 'string') {
          const fromDefault = extractDatabaseSegment(defaultConnection)
          if (fromDefault !== null) return fromDefault
        }
      }
    }
  } catch {
    // Not valid JSON — fall through to the whole-content scan below.
  }

  return extractDatabaseSegment(content)
}
