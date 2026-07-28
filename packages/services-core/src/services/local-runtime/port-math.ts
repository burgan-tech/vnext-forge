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
 * Mirror of `vnext/docker/create-domain.sh` in the vnext-runtime repo — logic
 * owned by that repository, hand-copied here.
 *
 * The table test in `test/local-runtime/port-math.test.ts` only guards against
 * local transcription errors (e.g. a typo, or inbox/outbox transposed) in this
 * file: it asserts against the same `BASE_*` constants defined below, so it
 * cannot detect upstream drift. If `create-domain.sh` ever changes its base
 * ports or offset formula, this function will keep returning the old values
 * and the test will keep passing. There is no CI link to the other repo;
 * keeping this correct requires manually re-reading `create-domain.sh` by hand
 * whenever the runtime repo's Docker port layout changes.
 *
 * Last verified against burgan-tech/vnext-runtime commit `d6ff18a`
 * (`vnext/docker/create-domain.sh`, lines 21-28).
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
