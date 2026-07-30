/** Host ports a single vNext domain occupies. Mirrors create-domain.sh. */
export interface DomainPorts {
  app: number
  execution: number
  inbox: number
  outbox: number
  init: number
}

/** Which container tooling the host has, and how to label it in the UI. */
export interface ContainerRuntimeInfo {
  containerCli: { bin: 'docker' | 'podman'; path: string }
  /** e.g. ['docker','compose'] or ['podman-compose']. Informational: Forge
   *  never passes this to make — the Makefile does its own detection. */
  composeArgv: string[]
  flavor: 'orbstack' | 'docker' | 'podman'
}

export type ContainerRuntimeDetection =
  | { ok: true; info: ContainerRuntimeInfo }
  | { ok: false; reason: 'no-container-cli' }
  // `cli` records which CLI *was* found, so the preflight layer can point the
  // user at the compose tooling for the runtime they actually have (docker ->
  // Docker Compose, podman -> podman-compose) instead of guessing.
  | { ok: false; reason: 'no-compose'; cli: 'docker' | 'podman' }

export type PreflightProblem = 'missing' | 'not-running'

export interface PreflightIssue {
  tool: string
  problem: PreflightProblem
  helpUrl: string
}

export interface PreflightResult {
  ok: boolean
  /** Contract: order is always git -> make -> runtime. The UI joins these
   *  into a single sentence, so reordering here is a user-visible change. */
  issues: PreflightIssue[]
}

/** Resolves an executable name to an absolute path, or null when absent. */
export type ToolLookup = (bin: string) => string | null
