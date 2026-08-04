export const VNEXT_RUNTIME_REPO_URL = 'https://github.com/burgan-tech/vnext-runtime.git'
export const VNEXT_RUNTIME_DIR_NAME = '.vnext-runtime'

/**
 * Shared infrastructure facts, fixed by the runtime repo's compose file.
 *
 * Postgres is shared across every local domain and is not port-offset aware,
 * so these values are the same for every managed environment. A later task
 * builds the Workflow CLI's `domain add` arguments from them, which is why
 * they live here rather than being inlined at the call site.
 */
export const RUNTIME_POSTGRES = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  container: 'vnext-postgres',
} as const

/**
 * The `make` targets Forge is allowed to run, as declared by the runtime repo's
 * Makefile.
 *
 * Two families, and the distinction matters for `makeArgv`: the `*-vnext` and
 * `create-domain` / `db-create` targets act on one domain and need `DOMAIN=`,
 * while the `*-infra` targets and the two bulk stops act on the whole
 * environment and take no variables at all. `down-infra` / `down` reach the
 * shared `--profile infra` stack, which is a singleton — postgres is fixed at
 * 5432 for every domain and every workspace clone.
 */
export type MakeTarget =
  | 'setup'
  | 'up-infra'
  | 'down-infra'
  | 'restart-infra'
  | 'create-domain'
  | 'db-create'
  | 'up-vnext'
  | 'down-vnext'
  | 'restart-vnext'
  | 'down-all-vnext'
  | 'down'

export interface MakeVars {
  domain?: string
  portOffset?: number
}

/**
 * Every builder returns an argv array — never a shell string. The values that
 * flow through here (the domain from `vnext.config.json`, a user-entered port
 * offset) are passed to `spawn` with `shell: false`, so there is no shell to
 * re-parse them.
 */
export function makeArgv(target: MakeTarget, vars: MakeVars = {}): string[] {
  const argv: string[] = [target]
  if (vars.domain !== undefined) argv.push(`DOMAIN=${vars.domain}`)
  if (vars.portOffset !== undefined) argv.push(`PORT_OFFSET=${vars.portOffset}`)
  return argv
}

export function cloneArgv(): string[] {
  return ['clone', '--depth', '1', VNEXT_RUNTIME_REPO_URL, VNEXT_RUNTIME_DIR_NAME]
}

export function gitPullArgv(): string[] {
  return ['pull', '--ff-only']
}

/**
 * `--all` so a stopped container is still listed — "absent" and "stopped" have
 * to be distinguishable. The name filter is a regex, so it is anchored: an
 * unanchored `name=vnext-app-core` would also match `vnext-app-core2`.
 */
export function containerPsArgv(containerName: string): string[] {
  return ['ps', '--all', '--filter', `name=^${containerName}$`, '--format', '{{.Status}}']
}

export function containerInfoArgv(): string[] {
  return ['info', '--format', '{{.ServerVersion}}']
}

export function orchestrationContainerName(domain: string): string {
  return `vnext-app-${domain}`
}
