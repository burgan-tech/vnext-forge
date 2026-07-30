import { computeDomainPorts } from './port-math.js'
import type { DomainPorts } from './types.js'

export interface DomainEnvInfo {
  portOffset: number
  ports: DomainPorts
}

/** Parse `KEY=VALUE` lines, skipping comments and blanks. */
function readEnvPairs(content: string): Map<string, string> {
  const pairs = new Map<string, string>()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    pairs.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim())
  }
  return pairs
}

function readPort(pairs: Map<string, string>, key: string, fallback: number): number {
  const raw = pairs.get(key)
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Read an already-generated `domains/<domain>/.env` back.
 *
 * Provisioning is idempotent: when a domain directory already exists we must
 * use the ports it actually declares rather than recomputing them, so re-adding
 * a domain never shifts its ports. Individual port lines fall back to the
 * offset-derived value so a hand-edited file still yields a complete set.
 *
 * Returns null when the file carries no usable `PORT_OFFSET` — the caller then
 * treats the domain as unprovisioned.
 */
export function parseDomainEnv(content: string): DomainEnvInfo | null {
  const pairs = readEnvPairs(content)
  const rawOffset = pairs.get('PORT_OFFSET')
  if (rawOffset === undefined) return null

  const portOffset = Number.parseInt(rawOffset, 10)
  if (!Number.isFinite(portOffset) || portOffset < 0) return null

  const derived = computeDomainPorts(portOffset)
  return {
    portOffset,
    ports: {
      app: readPort(pairs, 'VNEXT_APP_PORT', derived.app),
      execution: readPort(pairs, 'VNEXT_EXECUTION_PORT', derived.execution),
      inbox: readPort(pairs, 'VNEXT_INBOX_PORT', derived.inbox),
      outbox: readPort(pairs, 'VNEXT_OUTBOX_PORT', derived.outbox),
      init: readPort(pairs, 'VNEXT_INIT_PORT', derived.init),
    },
  }
}
