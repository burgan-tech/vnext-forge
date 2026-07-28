import { domainPortList, PORT_OFFSET_STEP } from './port-math.js'

export interface FindFreePortOffsetParams {
  /** Offsets already recorded under the runtime clone's `domains/` directory. */
  usedOffsets: readonly number[]
  /** True when nothing is listening on `port` on the host. */
  isPortFree: (port: number) => boolean | Promise<boolean>
  /** Highest offset to consider. Default 200 → 21 candidate domains. */
  maxOffset?: number
}

export const DEFAULT_MAX_PORT_OFFSET = 200

/**
 * First offset whose five host ports are all free.
 *
 * Probing real host ports matters because the runtime clone lives inside the
 * workspace: another workspace's clone can already own an offset that this
 * clone's `domains/` directory knows nothing about.
 *
 * Returns null when every candidate up to `maxOffset` is taken; the caller
 * then asks the user for an offset instead of guessing.
 */
export async function findFreePortOffset(
  params: FindFreePortOffsetParams,
): Promise<number | null> {
  const maxOffset = params.maxOffset ?? DEFAULT_MAX_PORT_OFFSET
  const used = new Set(params.usedOffsets)

  for (let offset = 0; offset <= maxOffset; offset += PORT_OFFSET_STEP) {
    if (used.has(offset)) continue

    let allFree = true
    for (const port of domainPortList(offset)) {
      if (!(await params.isPortFree(port))) {
        allFree = false
        break
      }
    }
    if (allFree) return offset
  }

  return null
}
