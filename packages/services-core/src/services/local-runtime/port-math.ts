import type { DomainPorts } from './types.js'

/**
 * Offsets must advance in steps of 10.
 *
 * create-domain.sh lays the five service ports out one apart (4201..4204 plus
 * 3005) and derives the Dapr ports from `offset * 100`. An offset of 1 would
 * therefore put a new domain's app port (4202) on top of the previous
 * domain's execution port.
 */
export const PORT_OFFSET_STEP = 10

const BASE_APP_PORT = 4201
const BASE_EXECUTION_PORT = 4202
const BASE_INBOX_PORT = 4203
const BASE_OUTBOX_PORT = 4204
const BASE_INIT_PORT = 3005

/**
 * Mirror of `vnext/docker/create-domain.sh` in the vnext-runtime repo. Kept in
 * lockstep by a table test — if the runtime repo changes its port layout, that
 * test fails and this function must follow.
 */
export function computeDomainPorts(offset: number): DomainPorts {
  return {
    app: BASE_APP_PORT + offset,
    execution: BASE_EXECUTION_PORT + offset,
    inbox: BASE_INBOX_PORT + offset,
    outbox: BASE_OUTBOX_PORT + offset,
    init: BASE_INIT_PORT + offset,
  }
}

/** Every host port a domain at `offset` will bind. */
export function domainPortList(offset: number): number[] {
  const p = computeDomainPorts(offset)
  return [p.app, p.execution, p.inbox, p.outbox, p.init]
}
