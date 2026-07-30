import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_PORT_OFFSET, findFreePortOffset } from '../../src/services/local-runtime/port-allocator.js'

const allFree = () => true

describe('findFreePortOffset', () => {
  it('returns 0 when nothing is used', async () => {
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree: allFree })).toBe(0)
  })

  it('skips offsets already recorded in the runtime clone', async () => {
    expect(await findFreePortOffset({ usedOffsets: [0, 10], isPortFree: allFree })).toBe(20)
  })

  it('rejects an offset when any single one of its five ports is taken', async () => {
    // 4203 is offset 0's inbox port — one busy port disqualifies the offset,
    // even though the other four are free.
    const isPortFree = async (port: number) => port !== 4203
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(10)
  })

  it('treats a busy init port as disqualifying too', async () => {
    const isPortFree = async (port: number) => port !== 3005
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(10)
  })

  it('combines recorded offsets and live port probing', async () => {
    // offset 0 recorded; offset 10 free on paper but its app port is bound by
    // another workspace's clone.
    const isPortFree = async (port: number) => port !== 4211
    expect(await findFreePortOffset({ usedOffsets: [0], isPortFree })).toBe(20)
  })

  it('returns null when no offset is free below maxOffset', async () => {
    const isPortFree = async () => false
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree, maxOffset: 20 })).toBeNull()
  })

  it('exhausts the default cap without needing an explicit maxOffset', async () => {
    // Pin the constant itself: without this, raising DEFAULT_MAX_PORT_OFFSET
    // later would go undetected below, since the stub's first qualifying
    // offset (200) would still short-circuit the search either way.
    expect(DEFAULT_MAX_PORT_OFFSET).toBe(200)

    // The init port (base 3005) is the slowest of the five to cross any given
    // threshold — it only reaches 3205 at offset 200, while the other four
    // (base 4201-4204) are already well past it. Threshold 3205 makes offset
    // 200 the first offset where all five ports are simultaneously free.
    const isPortFree = async (port: number) => port >= 3205 // first free offset is 200
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(200)
  })
})
