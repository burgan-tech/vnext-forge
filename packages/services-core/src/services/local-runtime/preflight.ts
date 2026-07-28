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
  container: 'https://orbstack.dev',
  compose: 'https://docs.docker.com/compose/install/',
} as const

const FLAVOR_LABELS = {
  orbstack: 'OrbStack',
  docker: 'Docker',
  podman: 'Podman',
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
      issues.push({ tool: 'Docker Compose', problem: 'missing', helpUrl: HELP_URLS.compose })
    }
  } else if (input.daemonReachable === false) {
    issues.push({
      tool: FLAVOR_LABELS[input.runtime.info.flavor],
      problem: 'not-running',
      helpUrl: HELP_URLS.container,
    })
  }

  return { ok: issues.length === 0, issues }
}
