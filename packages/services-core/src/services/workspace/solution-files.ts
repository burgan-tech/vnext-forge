/**
 * Multi-domain solution files.
 *
 * A workspace root may contain one default solution (`vnext.config.json`) plus
 * any number of domain-suffixed solutions (`vnext.<domain>.config.json`). Each
 * solution's `paths.componentsRoot` folder is that domain's sub-project. This
 * module discovers, validates and resolves solutions; it is `FileSystemAdapter`
 * based and free of Node globals so every shell (server, extension host) and
 * the unit tests share the same behaviour.
 */
import {
  domainFromSolutionFileName,
  isDefaultSolutionFileName,
  isSolutionFileName,
} from '@vnext-forge-studio/vnext-types'

import type { FileSystemAdapter } from '../../adapters/index.js'
import { getErrnoCode } from '../../internal/errno.js'
import { isAbsolutePosix, joinPosix, relativePosix, toPosix } from '../../internal/paths.js'
import type { VnextWorkspaceConfig, WorkspaceConfigReadStatus } from './types.js'
import { parseConfigStatus } from './workspace-analyzer.js'

export const PACKAGE_JSON_FILE_NAME = 'package.json'

export interface VnextSolutionFile {
  /** `vnext.config.json` or `vnext.<domain>.config.json` (as found on disk). */
  fileName: string
  /** POSIX absolute path of the solution file. */
  filePath: string
  /** POSIX absolute workspace root that holds the file. */
  rootPath: string
  /** Domain encoded in the file name; `undefined` for the default solution. */
  domainFromFileName?: string
  isDefault: boolean
  status: WorkspaceConfigReadStatus
  /** Present only when `status.status === 'ok'`. */
  config?: VnextWorkspaceConfig
  /** POSIX absolute `paths.componentsRoot`; absent when invalid or escaping the root. */
  componentsRootAbs?: string
  /** Resolved `package.json` for this solution (sub-project first, root fallback). */
  packageJsonPath?: string
}

export type SolutionIssueCode =
  | 'solution.invalidJson'
  | 'solution.schemaInvalid'
  | 'solution.domainMismatch'
  | 'solution.duplicateDomain'
  | 'solution.duplicateComponentsRoot'
  | 'solution.componentsRootEscapesRoot'
  | 'solution.schemaVersionMismatch'
  | 'solution.packageJsonMissing'
  | 'component.unknownDomain'
  | 'component.pathOutsideSolution'
  | 'component.missingDomain'

export type SolutionIssueSeverity = 'error' | 'warning' | 'info'

export interface SolutionIssue {
  code: SolutionIssueCode
  severity: SolutionIssueSeverity
  message: string
  /** File the diagnostic attaches to (solution file or component file). */
  filePath: string
  /** Other solution files involved (duplicates, shared package.json). */
  related?: string[]
}

export interface SolutionScanResult {
  rootPath: string
  solutions: VnextSolutionFile[]
  issues: SolutionIssue[]
  defaultSolution?: VnextSolutionFile
}

export interface ResolvedComponentSolution {
  solution: VnextSolutionFile | undefined
  issues: SolutionIssue[]
}

// ── discovery ───────────────────────────────────────────────────────────────

/** Solution files directly inside `rootPath`, default first, then by name. */
export async function listSolutionFiles(
  fs: FileSystemAdapter,
  rootPath: string,
): Promise<{ fileName: string; filePath: string }[]> {
  const root = toPosix(rootPath)
  let entries
  try {
    entries = await fs.readDir(root)
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT' || code === 'FileNotFound' || code === 'ENOTDIR') return []
    throw error
  }
  return entries
    .filter((entry) => entry.isFile && isSolutionFileName(entry.name))
    .map((entry) => ({ fileName: entry.name, filePath: joinPosix(root, entry.name) }))
    .sort((left, right) => {
      const leftDefault = isDefaultSolutionFileName(left.fileName)
      const rightDefault = isDefaultSolutionFileName(right.fileName)
      if (leftDefault !== rightDefault) return leftDefault ? -1 : 1
      return left.fileName.localeCompare(right.fileName)
    })
}

/**
 * `<root>/<componentsRoot>/package.json` when the sub-project has its own,
 * otherwise `<root>/package.json` (legacy template layout), otherwise `undefined`.
 */
export async function resolvePackageJsonPath(
  fs: FileSystemAdapter,
  rootPath: string,
  componentsRoot: string | undefined,
): Promise<string | undefined> {
  const root = toPosix(rootPath)
  const trimmed = componentsRoot?.trim()
  if (trimmed && !isAbsolutePosix(trimmed)) {
    const candidate = joinPosix(root, trimmed, PACKAGE_JSON_FILE_NAME)
    if (isInsideRoot(root, candidate) && (await fs.exists(candidate))) return candidate
  }
  const rootCandidate = joinPosix(root, PACKAGE_JSON_FILE_NAME)
  if (await fs.exists(rootCandidate)) return rootCandidate
  return undefined
}

/** Read one solution file and derive its sub-project facts. Never throws on bad content. */
export async function readSolutionFile(
  fs: FileSystemAdapter,
  rootPath: string,
  fileName: string,
): Promise<VnextSolutionFile> {
  const root = toPosix(rootPath)
  const filePath = joinPosix(root, fileName)
  const isDefault = isDefaultSolutionFileName(fileName)
  const domainFromFileName = domainFromSolutionFileName(fileName)

  let status: WorkspaceConfigReadStatus
  try {
    const raw = await fs.readFile(filePath)
    status = parseConfigStatus(raw, fileName)
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT' || code === 'FileNotFound') {
      status = { status: 'missing' }
    } else {
      status = {
        status: 'invalid',
        message: `${fileName} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  const solution: VnextSolutionFile = {
    fileName,
    filePath,
    rootPath: root,
    ...(domainFromFileName ? { domainFromFileName } : {}),
    isDefault,
    status,
  }

  if (status.status !== 'ok') return solution
  solution.config = status.config

  const componentsRoot = status.config.paths.componentsRoot.trim()
  if (componentsRoot && !isAbsolutePosix(componentsRoot)) {
    const abs = joinPosix(root, componentsRoot)
    if (isInsideRoot(root, abs)) solution.componentsRootAbs = abs
  }

  const packageJsonPath = await resolvePackageJsonPath(fs, root, componentsRoot)
  if (packageJsonPath) solution.packageJsonPath = packageJsonPath
  return solution
}

/** Discover + read + cross-validate every solution file at `rootPath`. */
export async function scanSolutionRoot(
  fs: FileSystemAdapter,
  rootPath: string,
): Promise<SolutionScanResult> {
  const root = toPosix(rootPath)
  const files = await listSolutionFiles(fs, root)
  const solutions = await Promise.all(files.map((file) => readSolutionFile(fs, root, file.fileName)))
  const issues = validateSolutionSet(solutions)
  const defaultSolution = pickDefaultSolution(solutions)
  return { rootPath: root, solutions, issues, ...(defaultSolution ? { defaultSolution } : {}) }
}

export function pickDefaultSolution(
  solutions: readonly VnextSolutionFile[],
): VnextSolutionFile | undefined {
  return solutions.find((solution) => solution.isDefault)
}

// ── validation ──────────────────────────────────────────────────────────────

/**
 * Pure cross-file validation of one root's solution set. Per-file read problems
 * (`invalid` status) are also converted into issues here so the caller has a
 * single list to publish.
 */
export function validateSolutionSet(solutions: readonly VnextSolutionFile[]): SolutionIssue[] {
  const issues: SolutionIssue[] = []
  const okSolutions: VnextSolutionFile[] = []

  for (const solution of solutions) {
    if (solution.status.status === 'invalid') {
      const message = solution.status.message
      const isJson = message.endsWith(' is not a valid JSON file.') || message.includes(' could not be read: ')
      issues.push({
        code: isJson ? 'solution.invalidJson' : 'solution.schemaInvalid',
        severity: 'error',
        message,
        filePath: solution.filePath,
      })
      continue
    }
    if (solution.status.status !== 'ok' || !solution.config) continue
    okSolutions.push(solution)

    const config = solution.config
    if (solution.domainFromFileName && solution.domainFromFileName !== config.domain) {
      issues.push({
        code: 'solution.domainMismatch',
        severity: 'warning',
        message: `File name declares domain '${solution.domainFromFileName}' but "domain" is '${config.domain}'. Rename the file to vnext.${config.domain}.config.json or change the domain field.`,
        filePath: solution.filePath,
      })
    }

    const componentsRoot = config.paths.componentsRoot.trim()
    if (componentsRoot && !solution.componentsRootAbs) {
      issues.push({
        code: 'solution.componentsRootEscapesRoot',
        severity: 'error',
        message: `paths.componentsRoot '${componentsRoot}' points outside the workspace root.`,
        filePath: solution.filePath,
      })
    }

    if (!solution.packageJsonPath) {
      const checked = componentsRoot
        ? `${componentsRoot}/${PACKAGE_JSON_FILE_NAME} and ${PACKAGE_JSON_FILE_NAME}`
        : PACKAGE_JSON_FILE_NAME
      issues.push({
        code: 'solution.packageJsonMissing',
        severity: 'info',
        message: `No package.json found for this solution (checked ${checked}). schemaVersion changes will not update @burgan-tech/vnext-schema.`,
        filePath: solution.filePath,
      })
    }
  }

  // Duplicate domains: the first file (default first, then by name) wins.
  const byDomain = new Map<string, VnextSolutionFile>()
  for (const solution of okSolutions) {
    const domain = solution.config!.domain
    const first = byDomain.get(domain)
    if (!first) {
      byDomain.set(domain, solution)
      continue
    }
    issues.push({
      code: 'solution.duplicateDomain',
      severity: 'error',
      message: `Domain '${domain}' is already declared by ${first.fileName}. This file is ignored.`,
      filePath: solution.filePath,
      related: [first.filePath],
    })
  }

  // Duplicate componentsRoot: every participant is flagged.
  const byComponentsRoot = new Map<string, VnextSolutionFile[]>()
  for (const solution of okSolutions) {
    if (!solution.componentsRootAbs) continue
    const key = solution.componentsRootAbs.toLowerCase()
    const list = byComponentsRoot.get(key) ?? []
    list.push(solution)
    byComponentsRoot.set(key, list)
  }
  for (const group of byComponentsRoot.values()) {
    if (group.length < 2) continue
    for (const solution of group) {
      const others = group.filter((other) => other !== solution)
      issues.push({
        code: 'solution.duplicateComponentsRoot',
        severity: 'error',
        message: `componentsRoot '${solution.config!.paths.componentsRoot}' is also used by ${others.map((o) => o.fileName).join(', ')}. Each solution needs its own componentsRoot folder.`,
        filePath: solution.filePath,
        related: others.map((other) => other.filePath),
      })
    }
  }

  // schemaVersion mismatch against the default solution.
  const defaultSolution = okSolutions.find((solution) => solution.isDefault)
  if (defaultSolution) {
    const defaultVersion = defaultSolution.config!.schemaVersion
    for (const solution of okSolutions) {
      if (solution === defaultSolution) continue
      const version = solution.config!.schemaVersion
      if (version === defaultVersion) continue
      const sharesPackageJson =
        !!solution.packageJsonPath && solution.packageJsonPath === defaultSolution.packageJsonPath
      const suffix = sharesPackageJson
        ? ` Both solutions resolve to ${relativePosix(solution.rootPath, solution.packageJsonPath!)}; the last saved value wins.`
        : ''
      issues.push({
        code: 'solution.schemaVersionMismatch',
        severity: 'warning',
        message: `schemaVersion '${version}' differs from ${defaultSolution.fileName} ('${defaultVersion}').${suffix}`,
        filePath: solution.filePath,
        related: [defaultSolution.filePath],
      })
    }
  }

  return issues
}

// ── resolution ──────────────────────────────────────────────────────────────

/**
 * Which solution does a component belong to?
 *
 * 1. The component's own `$.domain` is primary: the (first, valid) solution whose
 *    `domain` matches wins. If the file is not under that solution's
 *    `componentsRoot`, a `component.pathOutsideSolution` warning is attached.
 * 2. Otherwise, path containment: the solution whose `componentsRoot` contains the file.
 * 3. Otherwise, the default solution, with a `component.unknownDomain` warning.
 * 4. No default → `solution: undefined`.
 */
export function resolveSolutionForComponent(
  solutions: readonly VnextSolutionFile[],
  componentDomain: string | undefined,
  componentFilePath: string,
): ResolvedComponentSolution {
  const okSolutions = solutions.filter((solution) => solution.status.status === 'ok' && solution.config)
  const filePath = toPosix(componentFilePath)
  const issues: SolutionIssue[] = []
  const domain = componentDomain?.trim()

  if (domain) {
    const byDomain = okSolutions.find((solution) => solution.config!.domain === domain)
    if (byDomain) {
      if (byDomain.componentsRootAbs && !isInsideRoot(byDomain.componentsRootAbs, filePath)) {
        issues.push({
          code: 'component.pathOutsideSolution',
          severity: 'warning',
          message: `Component declares domain '${domain}' but is not under that solution's componentsRoot '${byDomain.config!.paths.componentsRoot}/'.`,
          filePath,
          related: [byDomain.filePath],
        })
      }
      return { solution: byDomain, issues }
    }
  }

  const byPath = resolveSolutionForPath(okSolutions, filePath)
  if (byPath) {
    if (domain) {
      issues.push({
        code: 'component.unknownDomain',
        severity: 'warning',
        message: `Component domain '${domain}' does not match any solution file in this workspace. Using ${byPath.fileName} (domain '${byPath.config!.domain}').`,
        filePath,
        related: [byPath.filePath],
      })
    }
    return { solution: byPath, issues }
  }

  const fallback = pickDefaultSolution(okSolutions)
  if (fallback) {
    if (domain) {
      issues.push({
        code: 'component.unknownDomain',
        severity: 'warning',
        message: `Component domain '${domain}' does not match any solution file in this workspace. Using ${fallback.fileName} (domain '${fallback.config!.domain}').`,
        filePath,
        related: [fallback.filePath],
      })
    }
    return { solution: fallback, issues }
  }

  return { solution: undefined, issues }
}

/**
 * A component under `solution.componentsRoot` that has no `$.domain`. The
 * Workflow CLI (≥ 1.0.13) skips such components with `DOMAIN_MISMATCH`, so
 * Forge surfaces the gap before the user publishes.
 */
export function missingDomainIssue(componentFilePath: string, solution: VnextSolutionFile): SolutionIssue {
  const expected = solution.config?.domain ?? solution.domainFromFileName ?? ''
  return {
    code: 'component.missingDomain',
    severity: 'warning',
    message: `Component has no "domain" field; wf update will skip it with DOMAIN_MISMATCH. Expected '${expected}'.`,
    filePath: toPosix(componentFilePath),
    related: [solution.filePath],
  }
}

/** Solution whose `componentsRoot` contains `filePath` (longest prefix wins). */
export function resolveSolutionForPath(
  solutions: readonly VnextSolutionFile[],
  filePath: string,
): VnextSolutionFile | undefined {
  const target = toPosix(filePath)
  let best: VnextSolutionFile | undefined
  for (const solution of solutions) {
    if (solution.status.status !== 'ok' || !solution.componentsRootAbs) continue
    if (!isInsideRoot(solution.componentsRootAbs, target)) continue
    if (!best || solution.componentsRootAbs.length > best.componentsRootAbs!.length) {
      best = solution
    }
  }
  return best
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isInsideRoot(rootAbs: string, targetAbs: string): boolean {
  const root = toPosix(rootAbs).replace(/\/+$/, '').toLowerCase()
  const target = toPosix(targetAbs).toLowerCase()
  if (target === root) return true
  return target.startsWith(`${root}/`) && !relativePosix(root, target).split('/').includes('..')
}

