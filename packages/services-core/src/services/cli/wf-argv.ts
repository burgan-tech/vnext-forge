/**
 * Pure builders for `wf` (vnext-workflow-cli) invocations.
 *
 * Shared by the server shell (`cli/execute` → `execFile`) and the VS Code
 * extension (Forge terminal). No Node / vscode imports so the command shapes
 * are unit-tested once and both shells agree byte-for-byte.
 *
 * Multi-domain (CLI ≥ 1.0.13): workspace commands run once per solution file
 * in cwd; the global `--domain <name>` option restricts them to one solution.
 * Older CLIs know no such flag — the only way to target a domain there is the
 * legacy two-step `wf domain use <name> && wf <command>`, which also rewrites
 * the CLI's active profile (documented side effect).
 */
import { compareCoreSemver, extractCoreSemver } from './semver.js'

/** First CLI release with the global `--domain` option and per-solution runs. */
export const WF_DOMAIN_FLAG_MIN_VERSION = '1.0.13'

/**
 * A domain is interpolated into shell command lines and used as a database
 * name suffix, so anything outside this set is refused rather than quoted.
 */
export const WF_DOMAIN_NAME_PATTERN = /^[A-Za-z0-9._-]+$/

export type WfWorkspaceCommand = 'check' | 'update' | 'update --all' | 'csx --all' | 'sync' | 'reset'

export type WfCommandSpec =
  | { base: WfWorkspaceCommand }
  | { base: 'update -f'; filePath: string }

export interface WfShellCommandOptions {
  /** Restrict the run to one solution (its `domain` field / CLI profile name). */
  domain?: string
  /** Whether the installed CLI understands `--domain` (see `wfSupportsDomainFlag`). */
  cliSupportsDomainFlag: boolean
}

/** `true` when the version string carries a core semver ≥ 1.0.13; unknown → `false`. */
export function wfSupportsDomainFlag(version: string | null | undefined): boolean {
  if (!version) return false
  const core = extractCoreSemver(version)
  if (!core) return false
  return compareCoreSemver(core, WF_DOMAIN_FLAG_MIN_VERSION) >= 0
}

export function isValidWfDomainName(domain: string): boolean {
  return WF_DOMAIN_NAME_PATTERN.test(domain)
}

function baseArgv(spec: WfCommandSpec): string[] {
  switch (spec.base) {
    case 'check':
      return ['check']
    case 'update':
      return ['update']
    case 'update --all':
      return ['update', '--all']
    case 'update -f': {
      const filePath = spec.filePath.trim()
      if (!filePath) throw new Error('filePath is required for update -f.')
      return ['update', '-f', filePath]
    }
    case 'csx --all':
      return ['csx', '--all']
    case 'sync':
      return ['sync']
    case 'reset':
      return ['reset']
    default: {
      const never: never = spec
      return never
    }
  }
}

/**
 * argv for `execFile('wf', argv)`. `--domain` is appended after the
 * subcommand's own arguments (it is a global option, accepted anywhere).
 */
export function buildWfArgv(spec: WfCommandSpec, opts: { domain?: string } = {}): string[] {
  const argv = baseArgv(spec)
  const domain = opts.domain?.trim()
  if (domain) {
    if (!isValidWfDomainName(domain)) {
      throw new Error(`"${domain}" is not a usable wf domain name.`)
    }
    argv.push('--domain', domain)
  }
  return argv
}

const SAFE_SHELL_ARG = /^[A-Za-z0-9_/.:@%+=,~-]+$/

/** Double-quote an argument unless it is shell-safe as-is (bash/zsh/pwsh tolerant). */
export function quoteShellArg(arg: string): string {
  if (arg.length > 0 && SAFE_SHELL_ARG.test(arg)) return arg
  return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`
}

/**
 * Shell command line for a terminal. With a legacy CLI and a domain the
 * two-step form is used; without a domain the CLI's own default applies
 * (≥ 1.0.13: every solution in cwd, sequentially).
 */
export function buildWfShellCommand(spec: WfCommandSpec, opts: WfShellCommandOptions): string {
  const domain = opts.domain?.trim()
  if (domain && !opts.cliSupportsDomainFlag) {
    if (!isValidWfDomainName(domain)) {
      throw new Error(`"${domain}" is not a usable wf domain name.`)
    }
    const argv = buildWfArgv(spec)
    return `wf domain use ${domain} && wf ${argv.map(quoteShellArg).join(' ')}`
  }
  const argv = buildWfArgv(spec, domain ? { domain } : {})
  return `wf ${argv.map(quoteShellArg).join(' ')}`
}
