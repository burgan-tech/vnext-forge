import type {
  ContainerRuntimeDetection,
  PreflightIssue,
  PreflightResult,
} from './types.js'

export interface PreflightInput {
  /** Absolute path, or null when the binary could not be resolved. */
  git: string | null
  make: string | null
  runtime: ContainerRuntimeDetection
  /** Whether the container daemon answered. Null when no CLI was found. */
  daemonReachable: boolean | null
}

const HELP_URLS = {
  git: 'https://git-scm.com/downloads',
  make: 'https://www.gnu.org/software/make/',
  // Used only for `no-container-cli`, where nothing is installed and we have
  // no basis to prefer docker over podman.
  container: 'https://orbstack.dev',
} as const

const FLAVOR_LABELS = {
  orbstack: 'OrbStack',
  docker: 'Docker',
  podman: 'Podman',
} as const

/** Where to send the user when their (running-but-unreachable) daemon needs
 *  attention, keyed by the detected flavor so podman/docker users aren't
 *  pointed at OrbStack's site. */
const NOT_RUNNING_HELP_URLS = {
  orbstack: 'https://orbstack.dev',
  docker: 'https://docs.docker.com/desktop/',
  podman: 'https://podman.io/docs/installation',
} as const

/** Compose tooling label + docs URL, keyed by which container CLI was found —
 *  a podman user is never told to install "Docker Compose". */
const COMPOSE_BY_CLI = {
  docker: { tool: 'Docker Compose', helpUrl: 'https://docs.docker.com/compose/install/' },
  podman: { tool: 'podman-compose', helpUrl: 'https://podman.io/docs/installation' },
} as const

/**
 * Turn resolved tool paths into a user-facing verdict.
 *
 * "Installed but not running" is deliberately its own state: a stopped
 * OrbStack / Docker Desktop is the most common first-run failure, and telling
 * the user it is "not found" sends them off to reinstall something they
 * already have.
 */
export function evaluatePreflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = []

  if (input.git === null) {
    issues.push({ tool: 'git', problem: 'missing', helpUrl: HELP_URLS.git })
  }
  if (input.make === null) {
    issues.push({ tool: 'make', problem: 'missing', helpUrl: HELP_URLS.make })
  }

  if (!input.runtime.ok) {
    if (input.runtime.reason === 'no-container-cli') {
      issues.push({
        tool: 'Docker or Podman',
        problem: 'missing',
        helpUrl: HELP_URLS.container,
      })
    } else {
      const compose = COMPOSE_BY_CLI[input.runtime.cli]
      issues.push({ tool: compose.tool, problem: 'missing', helpUrl: compose.helpUrl })
    }
  } else if (input.daemonReachable === false) {
    const flavor = input.runtime.info.flavor
    issues.push({
      tool: FLAVOR_LABELS[flavor],
      problem: 'not-running',
      helpUrl: NOT_RUNNING_HELP_URLS[flavor],
    })
  }

  return { ok: issues.length === 0, issues }
}
