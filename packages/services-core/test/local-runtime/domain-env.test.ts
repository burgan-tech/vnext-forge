import { describe, expect, it } from 'vitest'

import { parseDomainEnv } from '../../src/services/local-runtime/domain-env.js'

const REAL_ENV = `# VNext Domain Environment
DOMAIN_NAME=core
APP_DOMAIN=core
PORT_OFFSET=10

# Port Configuration
VNEXT_APP_PORT=4211
VNEXT_EXECUTION_PORT=4212
VNEXT_INBOX_PORT=4213
VNEXT_OUTBOX_PORT=4214
VNEXT_INIT_PORT=3015
`

describe('parseDomainEnv', () => {
  it('reads the offset and all five ports from a generated .env', () => {
    expect(parseDomainEnv(REAL_ENV)).toEqual({
      portOffset: 10,
      ports: { app: 4211, execution: 4212, inbox: 4213, outbox: 4214, init: 3015 },
    })
  })

  it('ignores comments, blank lines and surrounding whitespace', () => {
    const content = '  PORT_OFFSET = 20 \n#VNEXT_APP_PORT=9999\nVNEXT_APP_PORT=4221\n'
    const parsed = parseDomainEnv(content)
    expect(parsed?.portOffset).toBe(20)
    expect(parsed?.ports.app).toBe(4221)
  })

  it('derives missing ports from the offset', () => {
    // A hand-edited .env that kept PORT_OFFSET but lost a port line still
    // yields a complete, consistent port set.
    const parsed = parseDomainEnv('PORT_OFFSET=10\nVNEXT_APP_PORT=4211\n')
    expect(parsed?.ports).toEqual({
      app: 4211,
      execution: 4212,
      inbox: 4213,
      outbox: 4214,
      init: 3015,
    })
  })

  it('returns null when PORT_OFFSET is absent', () => {
    expect(parseDomainEnv('DOMAIN_NAME=core\n')).toBeNull()
  })

  it('returns null when PORT_OFFSET is not a number', () => {
    expect(parseDomainEnv('PORT_OFFSET=abc\n')).toBeNull()
  })

  it('returns null for empty content', () => {
    expect(parseDomainEnv('')).toBeNull()
  })
})
