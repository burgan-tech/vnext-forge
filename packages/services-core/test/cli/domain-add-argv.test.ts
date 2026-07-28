import { describe, expect, it } from 'vitest'

import { buildDomainAddArgv } from '../../src/services/cli/cli.service.js'

describe('buildDomainAddArgv', () => {
  it('emits only the three required flags when nothing optional is provided', () => {
    const argv = buildDomainAddArgv({
      domainName: 'core',
      apiBaseUrl: 'http://localhost:4201',
      dbName: 'vNext_Core',
    })

    expect(argv).toEqual([
      'domain', 'add', 'core',
      '--API_BASE_URL', 'http://localhost:4201',
      '--DB_NAME', 'vNext_Core',
    ])

    // Assert the absence explicitly, not just the length.
    expect(argv).not.toContain('--DB_HOST')
    expect(argv).not.toContain('--DB_PORT')
    expect(argv).not.toContain('--DB_USER')
    expect(argv).not.toContain('--DB_PASSWORD')
    expect(argv).not.toContain('--USE_DOCKER')
    expect(argv).not.toContain('--DOCKER_POSTGRES_CONTAINER')
  })

  it('forwards all six optional flags, including useDocker: false', () => {
    const argv = buildDomainAddArgv({
      domainName: 'core',
      apiBaseUrl: 'http://localhost:4201',
      dbName: 'vNext_Core',
      dbHost: 'localhost',
      dbPort: 5432,
      dbUser: 'postgres',
      dbPassword: 'postgres',
      // A truthiness check (`if (params.useDocker)`) would drop this flag
      // entirely instead of forwarding `'false'` — that is exactly the bug
      // this test pins down.
      useDocker: false,
      dockerPostgresContainer: 'vnext-postgres',
    })

    expect(argv).toEqual([
      'domain', 'add', 'core',
      '--API_BASE_URL', 'http://localhost:4201',
      '--DB_NAME', 'vNext_Core',
      '--DB_HOST', 'localhost',
      '--DB_PORT', '5432',
      '--DB_USER', 'postgres',
      '--DB_PASSWORD', 'postgres',
      '--USE_DOCKER', 'false',
      '--DOCKER_POSTGRES_CONTAINER', 'vnext-postgres',
    ])

    const useDockerIndex = argv.indexOf('--USE_DOCKER')
    expect(useDockerIndex).toBeGreaterThanOrEqual(0)
    expect(argv[useDockerIndex + 1]).toBe('false')
  })

  it('forwards dbPort at the boundary value 1', () => {
    // A truthiness guard (`if (params.dbPort)`) would drop this numeric edge
    // value since `1` is truthy but `0` would not be — the real risk is a
    // guard that checks `!!params.dbPort` and silently drops falsy-but-valid
    // ports; pin the smallest valid port explicitly.
    const argv = buildDomainAddArgv({
      domainName: 'core',
      apiBaseUrl: 'http://localhost:4201',
      dbName: 'vNext_Core',
      dbPort: 1,
    })

    const dbPortIndex = argv.indexOf('--DB_PORT')
    expect(dbPortIndex).toBeGreaterThanOrEqual(0)
    expect(argv[dbPortIndex + 1]).toBe('1')
  })

  it('keeps the three required flags first, in the existing order, before any optional ones', () => {
    const argv = buildDomainAddArgv({
      domainName: 'core',
      apiBaseUrl: 'http://localhost:4201',
      dbName: 'vNext_Core',
      dbHost: 'localhost',
      dbPort: 5432,
      dbUser: 'postgres',
      dbPassword: 'postgres',
      useDocker: true,
      dockerPostgresContainer: 'vnext-postgres',
    })

    expect(argv.slice(0, 7)).toEqual([
      'domain', 'add', 'core',
      '--API_BASE_URL', 'http://localhost:4201',
      '--DB_NAME', 'vNext_Core',
    ])
  })
})
