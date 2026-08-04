import { describe, expect, it } from 'vitest'

import {
  cloneArgv,
  containerInfoArgv,
  containerPsArgv,
  gitPullArgv,
  makeArgv,
  orchestrationContainerName,
  RUNTIME_POSTGRES,
  VNEXT_RUNTIME_DIR_NAME,
  VNEXT_RUNTIME_REPO_URL,
} from '../../src/services/local-runtime/commands.js'

describe('argv builders', () => {
  it('builds a shallow clone into .vnext-runtime', () => {
    expect(cloneArgv()).toEqual([
      'clone',
      '--depth',
      '1',
      VNEXT_RUNTIME_REPO_URL,
      VNEXT_RUNTIME_DIR_NAME,
    ])
  })

  it('builds a fast-forward-only pull', () => {
    expect(gitPullArgv()).toEqual(['pull', '--ff-only'])
  })

  it('builds a bare make target', () => {
    expect(makeArgv('setup')).toEqual(['setup'])
  })

  it.each(['up-infra', 'down-infra', 'restart-infra', 'down-all-vnext', 'down'] as const)(
    'builds %s with no variables',
    (target) => {
      // The environment-wide targets take no DOMAIN. Appending one would be
      // worse than useless: `make down DOMAIN=core` reads as domain-scoped
      // while still stopping every domain and the shared infra.
      expect(makeArgv(target)).toEqual([target])
    },
  )

  it('passes DOMAIN as a make variable', () => {
    expect(makeArgv('up-vnext', { domain: 'core' })).toEqual(['up-vnext', 'DOMAIN=core'])
  })

  it('passes DOMAIN and PORT_OFFSET for create-domain', () => {
    expect(makeArgv('create-domain', { domain: 'core', portOffset: 10 })).toEqual([
      'create-domain',
      'DOMAIN=core',
      'PORT_OFFSET=10',
    ])
  })

  it('includes PORT_OFFSET when it is zero', () => {
    // Guards against a truthiness check dropping the default offset.
    expect(makeArgv('create-domain', { domain: 'core', portOffset: 0 })).toEqual([
      'create-domain',
      'DOMAIN=core',
      'PORT_OFFSET=0',
    ])
  })

  it('anchors the container name filter so core does not match core2', () => {
    expect(containerPsArgv('vnext-app-core')).toEqual([
      'ps',
      '--all',
      '--filter',
      'name=^vnext-app-core$',
      '--format',
      '{{.Status}}',
    ])
  })

  it('builds the daemon reachability probe', () => {
    expect(containerInfoArgv()).toEqual(['info', '--format', '{{.ServerVersion}}'])
  })

  it('names the orchestration container per domain', () => {
    expect(orchestrationContainerName('core')).toBe('vnext-app-core')
  })

  it('exposes the shared postgres facts the CLI registration needs', () => {
    expect(RUNTIME_POSTGRES).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      container: 'vnext-postgres',
    })
  })

  it('keeps every argument a separate argv entry, never a shell string', () => {
    // Regression lock: a domain name is user-influenced, so it must never be
    // concatenated into something a shell would re-parse.
    const argv = makeArgv('up-vnext', { domain: 'core; rm -rf /' })
    expect(argv).toEqual(['up-vnext', 'DOMAIN=core; rm -rf /'])
  })
})
