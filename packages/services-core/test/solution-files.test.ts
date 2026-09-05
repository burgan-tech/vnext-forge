import * as fsp from 'node:fs/promises'
import { homedir, platform, tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { FileSystemAdapter } from '../src/adapters/file-system.js'
import {
  listSolutionFiles,
  resolvePackageJsonPath,
  resolveSolutionForComponent,
  resolveSolutionForPath,
  scanSolutionRoot,
  validateSolutionSet,
} from '../src/services/workspace/solution-files.js'
import {
  domainFromSolutionFileName,
  isDefaultSolutionFileName,
  isSolutionFileName,
  solutionDisplayLabel,
  solutionFileNameForDomain,
} from '@vnext-forge-studio/vnext-types'

function createTestFs(): FileSystemAdapter {
  const isWin = platform() === 'win32'
  return {
    isWindows: isWin,
    readFile: (p) => fsp.readFile(p, 'utf-8') as Promise<string>,
    writeFile: async (p, c) => fsp.writeFile(p, c, 'utf-8'),
    deleteFile: (p) => fsp.unlink(p),
    chmod: async (p, m) => {
      await fsp.chmod(p, m)
    },
    rename: (a, b) => fsp.rename(a, b),
    mkdir: async (p, o) => {
      await fsp.mkdir(p, { recursive: o?.recursive ?? false })
    },
    rmrf: (p) => fsp.rm(p, { recursive: true, force: true }),
    copyRecursive: async () => {
      throw new Error('not used')
    },
    exists: async (p) => {
      try {
        await fsp.access(p)
        return true
      } catch {
        return false
      }
    },
    stat: async (p) => {
      const s = await fsp.stat(p)
      return { isDirectory: s.isDirectory(), isFile: s.isFile(), size: s.size, mtimeMs: s.mtimeMs }
    },
    readFileHead: async (p, len) => {
      const h = await fsp.open(p, 'r')
      try {
        const b = Buffer.alloc(len)
        const { bytesRead } = await h.read(b, 0, len, 0)
        return b.subarray(0, bytesRead)
      } finally {
        await h.close()
      }
    },
    realpath: (p) => fsp.realpath(p),
    readDir: async (dirPath) => {
      const e = await fsp.readdir(dirPath, { withFileTypes: true })
      return e.map((ent) => ({ name: ent.name, isDirectory: ent.isDirectory(), isFile: ent.isFile() }))
    },
    resolveHome: () => homedir(),
    cwd: () => process.cwd(),
  }
}

function configJson(domain: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      version: '1.0.0',
      domain,
      runtimeVersion: '0.0.61',
      schemaVersion: '0.0.52',
      paths: {
        componentsRoot: domain,
        tasks: 'Tasks',
        views: 'Views',
        functions: 'Functions',
        extensions: 'Extensions',
        workflows: 'Workflows',
        schemas: 'Schemas',
        mappings: 'Mappings',
      },
      ...overrides,
    },
    null,
    2,
  )
}

describe('solution file name helpers', () => {
  it('recognises default and domain-suffixed names case-insensitively', () => {
    expect(isSolutionFileName('vnext.config.json')).toBe(true)
    expect(isSolutionFileName('VNEXT.CONFIG.JSON')).toBe(true)
    expect(isSolutionFileName('vnext.partner.config.json')).toBe(true)
    expect(isSolutionFileName('vnext.json')).toBe(false)
    expect(isSolutionFileName('vnext.config.json.bak')).toBe(false)
    expect(isSolutionFileName('package.json')).toBe(false)
  })

  it('separates the default file from domain files', () => {
    expect(isDefaultSolutionFileName('vnext.config.json')).toBe(true)
    expect(isDefaultSolutionFileName('vnext.partner.config.json')).toBe(false)
    expect(domainFromSolutionFileName('vnext.config.json')).toBeUndefined()
    expect(domainFromSolutionFileName('vnext.partner.config.json')).toBe('partner')
    expect(domainFromSolutionFileName('vnext.my.domain.config.json')).toBe('my.domain')
    expect(domainFromSolutionFileName('other.json')).toBeUndefined()
  })

  it('builds file names and labels', () => {
    expect(solutionFileNameForDomain('partner')).toBe('vnext.partner.config.json')
    expect(solutionFileNameForDomain('')).toBe('vnext.config.json')
    expect(solutionFileNameForDomain(undefined)).toBe('vnext.config.json')
    expect(solutionDisplayLabel('vnext.config.json')).toBe('vNext Config')
    expect(solutionDisplayLabel('vnext.partner.config.json')).toBe('vNext Config (partner)')
  })
})

describe('solution scanning', () => {
  const fs = createTestFs()
  let root = ''

  beforeEach(async () => {
    root = (await fsp.mkdtemp(join(tmpdir(), 'forge-solutions-'))).replace(/\\/g, '/')
  })

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true })
  })

  it('lists solution files with the default first', async () => {
    await fsp.writeFile(join(root, 'vnext.zeta.config.json'), configJson('zeta'))
    await fsp.writeFile(join(root, 'vnext.alpha.config.json'), configJson('alpha'))
    await fsp.writeFile(join(root, 'vnext.config.json'), configJson('core'))
    await fsp.writeFile(join(root, 'package.json'), '{}')
    const files = await listSolutionFiles(fs, root)
    expect(files.map((f) => f.fileName)).toEqual([
      'vnext.config.json',
      'vnext.alpha.config.json',
      'vnext.zeta.config.json',
    ])
  })

  it('returns an empty list for a missing root', async () => {
    expect(await listSolutionFiles(fs, join(root, 'nope'))).toEqual([])
  })

  it('resolves package.json from the sub-project first, then the root', async () => {
    await fsp.mkdir(join(root, 'partner'))
    expect(await resolvePackageJsonPath(fs, root, 'partner')).toBeUndefined()
    await fsp.writeFile(join(root, 'package.json'), '{}')
    expect(await resolvePackageJsonPath(fs, root, 'partner')).toBe(`${root}/package.json`)
    await fsp.writeFile(join(root, 'partner', 'package.json'), '{}')
    expect(await resolvePackageJsonPath(fs, root, 'partner')).toBe(`${root}/partner/package.json`)
    expect(await resolvePackageJsonPath(fs, root, '../escape')).toBe(`${root}/package.json`)
  })

  it('scans the vnext-example layout (core + partner sharing the root package.json)', async () => {
    await fsp.writeFile(join(root, 'vnext.config.json'), configJson('core'))
    await fsp.writeFile(join(root, 'vnext.partner.config.json'), configJson('partner'))
    await fsp.writeFile(join(root, 'package.json'), '{}')
    await fsp.mkdir(join(root, 'core'))
    await fsp.mkdir(join(root, 'partner'))

    const scan = await scanSolutionRoot(fs, root)
    expect(scan.solutions).toHaveLength(2)
    expect(scan.defaultSolution?.fileName).toBe('vnext.config.json')
    const partner = scan.solutions[1]
    expect(partner.isDefault).toBe(false)
    expect(partner.domainFromFileName).toBe('partner')
    expect(partner.status.status).toBe('ok')
    expect(partner.componentsRootAbs).toBe(`${root}/partner`)
    expect(partner.packageJsonPath).toBe(`${root}/package.json`)
    expect(scan.issues).toEqual([])
  })

  it('reports invalid JSON and schema-invalid files without failing the others', async () => {
    await fsp.writeFile(join(root, 'vnext.config.json'), configJson('core'))
    await fsp.writeFile(join(root, 'vnext.broken.config.json'), '{ not json')
    await fsp.writeFile(join(root, 'vnext.thin.config.json'), JSON.stringify({ domain: 'thin' }))
    await fsp.writeFile(join(root, 'package.json'), '{}')

    const scan = await scanSolutionRoot(fs, root)
    const codes = scan.issues.map((i) => [i.code, i.filePath.endsWith('broken.config.json') ? 'broken' : i.filePath.endsWith('thin.config.json') ? 'thin' : 'core'])
    expect(codes).toContainEqual(['solution.invalidJson', 'broken'])
    expect(codes).toContainEqual(['solution.schemaInvalid', 'thin'])
    expect(scan.solutions[0].status.status).toBe('ok')
  })

  it('flags domainMismatch, duplicateDomain, duplicateComponentsRoot, escapes, mismatched schemaVersion and missing package.json', async () => {
    await fsp.writeFile(join(root, 'vnext.config.json'), configJson('core'))
    // file says loans, domain says core → duplicate domain + mismatch, same componentsRoot as default
    await fsp.writeFile(join(root, 'vnext.loans.config.json'), configJson('core'))
    await fsp.writeFile(
      join(root, 'vnext.escape.config.json'),
      configJson('escape', { paths: { componentsRoot: '../outside', tasks: 'Tasks', views: 'Views', functions: 'Functions', extensions: 'Extensions', workflows: 'Workflows', schemas: 'Schemas', mappings: 'Mappings' } }),
    )
    await fsp.writeFile(join(root, 'vnext.newer.config.json'), configJson('newer', { schemaVersion: '0.0.53' }))

    const scan = await scanSolutionRoot(fs, root)
    const byCode = (code: string) => scan.issues.filter((i) => i.code === code)

    expect(byCode('solution.domainMismatch')).toHaveLength(1)
    expect(byCode('solution.domainMismatch')[0].filePath.endsWith('vnext.loans.config.json')).toBe(true)
    expect(byCode('solution.duplicateDomain')).toHaveLength(1)
    expect(byCode('solution.duplicateDomain')[0].message).toContain("already declared by vnext.config.json")
    expect(byCode('solution.duplicateComponentsRoot')).toHaveLength(2)
    expect(byCode('solution.componentsRootEscapesRoot')).toHaveLength(1)
    const mismatch = byCode('solution.schemaVersionMismatch')
    expect(mismatch).toHaveLength(1)
    expect(mismatch[0].filePath.endsWith('vnext.newer.config.json')).toBe(true)
    expect(mismatch[0].message).not.toContain('last saved value wins') // no package.json anywhere
    // no package.json at all → info on each ok solution
    expect(byCode('solution.packageJsonMissing').length).toBeGreaterThanOrEqual(3)
  })

  it('mentions the shared package.json in the schemaVersion mismatch message', async () => {
    await fsp.writeFile(join(root, 'vnext.config.json'), configJson('core'))
    await fsp.writeFile(join(root, 'vnext.newer.config.json'), configJson('newer', { schemaVersion: '0.0.53' }))
    await fsp.writeFile(join(root, 'package.json'), '{}')
    const scan = await scanSolutionRoot(fs, root)
    const mismatch = scan.issues.find((i) => i.code === 'solution.schemaVersionMismatch')
    expect(mismatch?.message).toContain('Both solutions resolve to package.json; the last saved value wins.')
  })
})

describe('resolveSolutionForComponent', () => {
  const root = '/ws'
  const mk = (fileName: string, domain: string, componentsRoot = domain) => ({
    fileName,
    filePath: `${root}/${fileName}`,
    rootPath: root,
    ...(fileName === 'vnext.config.json' ? {} : { domainFromFileName: domain }),
    isDefault: fileName === 'vnext.config.json',
    status: { status: 'ok' as const, config: JSON.parse(configJson(domain, { paths: { componentsRoot, tasks: 'Tasks', views: 'Views', functions: 'Functions', extensions: 'Extensions', workflows: 'Workflows', schemas: 'Schemas', mappings: 'Mappings' } })) },
    config: JSON.parse(configJson(domain, { paths: { componentsRoot, tasks: 'Tasks', views: 'Views', functions: 'Functions', extensions: 'Extensions', workflows: 'Workflows', schemas: 'Schemas', mappings: 'Mappings' } })),
    componentsRootAbs: `${root}/${componentsRoot}`,
  })
  const core = mk('vnext.config.json', 'core')
  const partner = mk('vnext.partner.config.json', 'partner')
  const solutions = [core, partner]

  it('picks the solution by $.domain', () => {
    const r = resolveSolutionForComponent(solutions, 'partner', `${root}/partner/Workflows/x.json`)
    expect(r.solution).toBe(partner)
    expect(r.issues).toEqual([])
  })

  it('warns when the domain matches but the file lives under another componentsRoot', () => {
    const r = resolveSolutionForComponent(solutions, 'partner', `${root}/core/Workflows/x.json`)
    expect(r.solution).toBe(partner)
    expect(r.issues.map((i) => i.code)).toEqual(['component.pathOutsideSolution'])
  })

  it('falls back to path containment then default for an unknown domain, with a warning', () => {
    const byPath = resolveSolutionForComponent(solutions, 'loans', `${root}/partner/Tasks/t.json`)
    expect(byPath.solution).toBe(partner)
    expect(byPath.issues.map((i) => i.code)).toEqual(['component.unknownDomain'])

    const byDefault = resolveSolutionForComponent(solutions, 'loans', `${root}/elsewhere/t.json`)
    expect(byDefault.solution).toBe(core)
    expect(byDefault.issues[0].message).toContain("Using vnext.config.json (domain 'core')")
  })

  it('returns undefined when nothing matches and there is no default', () => {
    const r = resolveSolutionForComponent([partner], 'loans', `${root}/elsewhere/t.json`)
    expect(r.solution).toBeUndefined()
  })

  it('resolves by path with the longest componentsRoot prefix', () => {
    const nested = mk('vnext.nested.config.json', 'nested', 'partner/nested')
    expect(resolveSolutionForPath([core, partner, nested], `${root}/partner/nested/Tasks/a.json`)).toBe(nested)
    expect(resolveSolutionForPath([core, partner, nested], `${root}/partner/Tasks/a.json`)).toBe(partner)
    expect(resolveSolutionForPath([core, partner], `${root}/README.md`)).toBeUndefined()
  })

  it('ignores invalid solutions', () => {
    const broken = { ...partner, status: { status: 'invalid' as const, message: 'x' }, config: undefined }
    const r = resolveSolutionForComponent([core, broken], 'partner', `${root}/partner/Tasks/t.json`)
    expect(r.solution).toBe(core)
  })
})

describe('validateSolutionSet (pure)', () => {
  it('returns nothing for an empty set', () => {
    expect(validateSolutionSet([])).toEqual([])
  })
})

describe('missingDomainIssue', () => {
  it('builds the DOMAIN_MISMATCH warning for a component without $.domain', async () => {
    const { missingDomainIssue } = await import('../src/services/workspace/solution-files.js')
    const solution = {
      fileName: 'vnext.partner.config.json',
      filePath: '/ws/vnext.partner.config.json',
      rootPath: '/ws',
      domainFromFileName: 'partner',
      isDefault: false,
      status: { status: 'ok' as const, config: JSON.parse(configJson('partner')) },
      config: JSON.parse(configJson('partner')),
      componentsRootAbs: '/ws/partner',
    }
    const issue = missingDomainIssue('C:\\ws\\partner\\Tasks\\t.json', solution)
    expect(issue.code).toBe('component.missingDomain')
    expect(issue.severity).toBe('warning')
    expect(issue.filePath).toBe('C:/ws/partner/Tasks/t.json')
    expect(issue.related).toEqual(['/ws/vnext.partner.config.json'])
    expect(issue.message).toBe(
      `Component has no "domain" field; wf update will skip it with DOMAIN_MISMATCH. Expected 'partner'.`,
    )
  })
})
