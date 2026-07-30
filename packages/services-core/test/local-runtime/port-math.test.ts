import { describe, expect, it } from 'vitest'

import { computeDomainPorts, PORT_OFFSET_STEP } from '../../src/services/local-runtime/port-math.js'

describe('computeDomainPorts', () => {
  // Locked against vnext/docker/create-domain.sh:
  //   4201/4202/4203/4204/3005 + offset
  it('matches create-domain.sh for offset 0', () => {
    expect(computeDomainPorts(0)).toEqual({
      app: 4201,
      execution: 4202,
      inbox: 4203,
      outbox: 4204,
      init: 3005,
    })
  })

  it('matches create-domain.sh for offset 10', () => {
    expect(computeDomainPorts(10)).toEqual({
      app: 4211,
      execution: 4212,
      inbox: 4213,
      outbox: 4214,
      init: 3015,
    })
  })

  it('matches create-domain.sh for offset 20', () => {
    expect(computeDomainPorts(20)).toEqual({
      app: 4221,
      execution: 4222,
      inbox: 4223,
      outbox: 4224,
      init: 3025,
    })
  })

  it('exposes the 10-port step the offset must be a multiple of', () => {
    // Offset 1 would put this domain's app port (4202) on top of offset 0's
    // execution port, so offsets must advance in steps of 10.
    expect(PORT_OFFSET_STEP).toBe(10)
  })
})
