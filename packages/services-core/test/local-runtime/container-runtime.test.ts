import { describe, expect, it } from 'vitest'

import { detectContainerRuntime } from '../../src/services/local-runtime/container-runtime.js'
import type { ToolLookup } from '../../src/services/local-runtime/types.js'

/** Fake lookup: every listed binary resolves to /usr/local/bin/<name>. */
function lookupFor(...present: string[]): ToolLookup {
  const set = new Set(present)
  return (bin) => (set.has(bin) ? `/usr/local/bin/${bin}` : null)
}

/** Fake compose-subcommand probe: `docker compose` / `podman compose`. */
function composeFor(...present: string[]) {
  const set = new Set(present)
  return (argv: string[]) => set.has(argv.join(' '))
}

const noComposeSubcommand = () => false

describe('detectContainerRuntime', () => {
  it('reports OrbStack when orb and docker are both present', () => {
    const result = detectContainerRuntime(
      lookupFor('orb', 'docker'),
      composeFor('docker compose'),
    )
    expect(result).toEqual({
      ok: true,
      info: {
        containerCli: { bin: 'docker', path: '/usr/local/bin/docker' },
        composeArgv: ['docker', 'compose'],
        flavor: 'orbstack',
      },
    })
  })

  it('reports plain docker when orb is absent', () => {
    const result = detectContainerRuntime(lookupFor('docker'), composeFor('docker compose'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.flavor).toBe('docker')
    expect(result.info.containerCli.bin).toBe('docker')
  })

  it('does NOT claim docker when orb exists but the docker CLI does not', () => {
    // Deliberate divergence from the runtime repo's Makefile, which maps
    // `orb` -> docker unconditionally and then fails on the next command.
    const result = detectContainerRuntime(lookupFor('orb'), noComposeSubcommand)
    expect(result).toEqual({ ok: false, reason: 'no-container-cli' })
  })

  it('falls back to the standalone docker-compose binary', () => {
    const result = detectContainerRuntime(
      lookupFor('docker', 'docker-compose'),
      noComposeSubcommand,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.composeArgv).toEqual(['docker-compose'])
  })

  it('prefers docker over podman when both CLIs are present', () => {
    const result = detectContainerRuntime(
      lookupFor('docker', 'podman', 'podman-compose'),
      composeFor('docker compose'),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.containerCli.bin).toBe('docker')
  })

  it('detects podman with podman-compose', () => {
    const result = detectContainerRuntime(
      lookupFor('podman', 'podman-compose'),
      noComposeSubcommand,
    )
    expect(result).toEqual({
      ok: true,
      info: {
        containerCli: { bin: 'podman', path: '/usr/local/bin/podman' },
        composeArgv: ['podman-compose'],
        flavor: 'podman',
      },
    })
  })

  it('detects podman with the podman compose subcommand', () => {
    const result = detectContainerRuntime(lookupFor('podman'), composeFor('podman compose'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.composeArgv).toEqual(['podman', 'compose'])
  })

  it('reports no-compose when docker exists without any compose', () => {
    expect(detectContainerRuntime(lookupFor('docker'), noComposeSubcommand)).toEqual({
      ok: false,
      reason: 'no-compose',
      cli: 'docker',
    })
  })

  it('reports no-compose with cli: podman when podman exists without any compose', () => {
    expect(detectContainerRuntime(lookupFor('podman'), noComposeSubcommand)).toEqual({
      ok: false,
      reason: 'no-compose',
      cli: 'podman',
    })
  })

  it('reports no-container-cli when nothing is installed', () => {
    expect(detectContainerRuntime(lookupFor(), noComposeSubcommand)).toEqual({
      ok: false,
      reason: 'no-container-cli',
    })
  })
})
