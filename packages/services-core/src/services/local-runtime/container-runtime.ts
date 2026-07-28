import type { ContainerRuntimeDetection, ToolLookup } from './types.js'

/** True when `<argv>` is a working subcommand, e.g. ['docker','compose']. */
export type ComposeSubcommandProbe = (argv: string[]) => boolean

/**
 * Resolve which container tooling this host has.
 *
 * OrbStack is **not** a third runtime: it ships a Docker-compatible daemon
 * plus the `docker` CLI, and `orb` is only its management binary. Docker
 * Desktop, Colima and Rancher Desktop are the same story. So the real axis is
 * docker-CLI vs podman-CLI, and `flavor` is a label for user-facing wording.
 *
 * The ordering mirrors the vnext-runtime Makefile so Forge and `make` never
 * disagree — with one deliberate divergence: the Makefile maps `orb` to docker
 * unconditionally, which prints success and then fails when OrbStack's CLI
 * helpers are not linked. Here `orb` only sets the label; the `docker` binary
 * still has to resolve.
 */
export function detectContainerRuntime(
  lookup: ToolLookup,
  hasComposeSubcommand: ComposeSubcommandProbe,
): ContainerRuntimeDetection {
  const dockerPath = lookup('docker')
  const podmanPath = lookup('podman')

  if (dockerPath !== null) {
    const flavor = lookup('orb') !== null ? 'orbstack' : 'docker'
    const composeArgv = hasComposeSubcommand(['docker', 'compose'])
      ? ['docker', 'compose']
      : lookup('docker-compose') !== null
        ? ['docker-compose']
        : null
    if (composeArgv === null) return { ok: false, reason: 'no-compose' }
    return {
      ok: true,
      info: { containerCli: { bin: 'docker', path: dockerPath }, composeArgv, flavor },
    }
  }

  if (podmanPath !== null) {
    const composeArgv = lookup('podman-compose') !== null
      ? ['podman-compose']
      : hasComposeSubcommand(['podman', 'compose'])
        ? ['podman', 'compose']
        : null
    if (composeArgv === null) return { ok: false, reason: 'no-compose' }
    return {
      ok: true,
      info: { containerCli: { bin: 'podman', path: podmanPath }, composeArgv, flavor: 'podman' },
    }
  }

  return { ok: false, reason: 'no-container-cli' }
}
