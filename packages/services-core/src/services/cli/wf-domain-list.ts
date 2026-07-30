import { stripAnsi } from '../../lib/ansi.js'

/**
 * A single entry from `wf domain list` output.
 *
 * Producer: vnext-workflow-cli/src/commands/domain.js, listDomains().
 * The `wf` CLI never returns a non-zero exit code - `domain add` / `use` /
 * `remove` swallow their own errors - so `wf domain list` is the only
 * reliable way to learn what domains are registered and which one is
 * active.
 */
export interface WfDomainEntry {
  name: string
  apiBaseUrl: string | null
  dbName: string | null
  active: boolean
}

const HEADER_LINE = '🌐 Domains:'

// e.g. "    API: http://localhost:4201  DB: vnext_core"
const DETAIL_LINE_PATTERN = /^\s*API:\s*(\S+)?\s+DB:\s*(\S+)?\s*$/

/**
 * Parse the (possibly still ANSI-coloured) output of `wf domain list` into a
 * structured list of domain entries. Returns `[]` for empty or unrecognised
 * input rather than throwing - callers (e.g. a tree view) must degrade
 * gracefully instead of crashing on unexpected CLI output.
 */
export function parseWfDomainList(output: string): WfDomainEntry[] {
  if (!output) return []

  const lines = stripAnsi(output).split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => line.trim() === HEADER_LINE)
  if (headerIndex === -1) return []

  const entries: WfDomainEntry[] = []
  let i = headerIndex + 1

  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed === '') {
      i += 1
      continue
    }

    let name = trimmed
    let active = false

    if (name.startsWith('▸')) {
      active = true
      name = name.slice(1).trim()
    }

    const activeSuffix = name.match(/^(.*)\s\(active\)$/)
    if (activeSuffix) {
      active = true
      name = activeSuffix[1]
    }

    if (!name) {
      i += 1
      continue
    }

    let apiBaseUrl: string | null = null
    let dbName: string | null = null
    let consumed = 1

    const detailMatch = lines[i + 1]?.match(DETAIL_LINE_PATTERN)
    if (detailMatch) {
      apiBaseUrl = detailMatch[1] ?? null
      dbName = detailMatch[2] ?? null
      consumed = 2
    }

    entries.push({ name, apiBaseUrl, dbName, active })
    i += consumed
  }

  return entries
}

/**
 * Find a domain entry by exact name match. Domain names are used verbatim
 * as `wf` CLI arguments, so matching must be case-sensitive - "Core" and
 * "core" are different domains.
 */
export function findWfDomain(
  entries: readonly WfDomainEntry[],
  name: string,
): WfDomainEntry | null {
  return entries.find((entry) => entry.name === name) ?? null
}
