import { describe, expect, it } from 'vitest'

import { evaluatePreflight } from '../../src/services/local-runtime/preflight.js'
import type { ContainerRuntimeDetection } from '../../src/services/local-runtime/types.js'

const dockerOk: ContainerRuntimeDetection = {
  ok: true,
  info: {
    containerCli: { bin: 'docker', path: '/usr/local/bin/docker' },
    composeArgv: ['docker', 'compose'],
    flavor: 'orbstack',
  },
}

const podmanOk: ContainerRuntimeDetection = {
  ok: true,
  info: {
    containerCli: { bin: 'podman', path: '/usr/local/bin/podman' },
    composeArgv: ['podman-compose'],
    flavor: 'podman',
  },
}

describe('evaluatePreflight', () => {
  it('passes when git, make and a reachable runtime are present', () => {
    expect(
      evaluatePreflight({
        git: '/usr/bin/git',
        make: '/usr/bin/make',
        runtime: dockerOk,
        daemonReachable: true,
      }),
    ).toEqual({ ok: true, issues: [] })
  })

  it('reports git and make as missing', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: dockerOk,
      daemonReachable: true,
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map((i) => [i.tool, i.problem])).toEqual([
      ['git', 'missing'],
      ['make', 'missing'],
    ])
  })

  it('distinguishes an installed-but-stopped daemon from a missing one', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: dockerOk,
      daemonReachable: false,
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.problem).toBe('not-running')
    // The label follows the detected flavor so the message can say OrbStack.
    expect(result.issues[0]?.tool).toBe('OrbStack')
  })

  it('points a stopped podman daemon at podman docs, not OrbStack', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: podmanOk,
      daemonReachable: false,
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      tool: 'Podman',
      problem: 'not-running',
      helpUrl: 'https://podman.io/docs/installation',
    })
  })

  it('reports a missing container CLI', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({ tool: 'Docker or Podman', problem: 'missing' })
  })

  it('reports a missing compose command for docker', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: { ok: false, reason: 'no-compose', cli: 'docker' },
      daemonReachable: null,
    })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({ tool: 'Docker Compose', problem: 'missing' })
  })

  it('reports a missing compose command for podman as podman-compose, not Docker Compose', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: { ok: false, reason: 'no-compose', cli: 'podman' },
      daemonReachable: null,
    })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({
      tool: 'podman-compose',
      problem: 'missing',
      helpUrl: 'https://podman.io/docs/installation',
    })
  })

  it('accumulates every problem in one result', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    expect(result.issues).toHaveLength(3)
  })

  it('gives every issue a help URL', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    for (const issue of result.issues) {
      expect(issue.helpUrl).toMatch(/^https:\/\//)
    }
  })
})
