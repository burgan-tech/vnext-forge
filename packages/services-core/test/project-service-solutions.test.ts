import * as fsp from 'node:fs/promises'
import { homedir, platform, tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { FileSystemAdapter, LoggerAdapter } from '../src/adapters/index.js'
import { createProjectService } from '../src/services/project/project.service.js'
import type { TemplateService } from '../src/services/template/template.service.js'
import { createWorkspaceService } from '../src/services/workspace/workspace.service.js'
import { VnextForgeError } from '@vnext-forge-studio/app-contracts'

function createTestFs(): FileSystemAdapter {
  return {
    isWindows: platform() === 'win32',
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

const silentLogger: LoggerAdapter = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const stubTemplate: TemplateService = {
  scaffoldFromTemplate: async () => {},
  applyCustomConfig: async () => {},
  checkValidateScript: async () => ({ exists: false }),
}

function fullConfig(domain: string, overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    description: `${domain} domain`,
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
    exports: {
      functions: [],
      workflows: [],
      tasks: [],
      views: [],
      schemas: [],
      extensions: [],
      mappings: [],
      visibility: 'private' as const,
      metadata: { description: 'x', maintainer: 'm', license: 'MIT', keywords: ['k'] },
    },
    dependencies: { domains: [], npm: [] },
    referenceResolution: {
      enabled: true,
      validateOnBuild: true,
      strictMode: true,
      validateReferenceConsistency: true,
      validateSchemas: true,
      allowedHosts: ['registry.npmjs.org'],
      schemaValidationRules: {
        enforceKeyFormat: true,
        enforceVersionFormat: true,
        enforceFilenameConsistency: true,
        allowUnknownProperties: false,
      },
    },
    ...overrides,
  }
}

describe('ProjectService — multi-domain solutions', () => {
  const fs = createTestFs()
  let root = ''

  const build = () => {
    const workspaceService = createWorkspaceService({ fs, logger: silentLogger })
    return createProjectService({
      fs,
      logger: silentLogger,
      workspaceRootResolver: { resolveProjectsRoot: async () => root },
      workspaceService,
      templateService: stubTemplate,
    })
  }

  beforeEach(async () => {
    root = (await fsp.mkdtemp(join(tmpdir(), 'forge-projects-'))).replace(/\\/g, '/')
    await fsp.writeFile(join(root, 'vnext.config.json'), JSON.stringify(fullConfig('core'), null, 2))
    await fsp.writeFile(join(root, 'vnext.partner.config.json'), JSON.stringify(fullConfig('partner'), null, 2))
    await fsp.mkdir(join(root, 'core'))
    await fsp.mkdir(join(root, 'partner'))
    await fsp.writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.52' } }, null, 2) + '\n',
    )
  })

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true })
  })

  it('imports a domain-suffixed solution and records configFileName in the link file', async () => {
    const service = build()
    const entry = await service.importProject(root, undefined, { configFileName: 'vnext.partner.config.json' })
    expect(entry.id).toBe('partner')
    expect(entry.domain).toBe('partner')
    expect(entry.configFileName).toBe('vnext.partner.config.json')

    const link = JSON.parse(await fsp.readFile(join(root, 'partner.link.json'), 'utf-8'))
    expect(link.configFileName).toBe('vnext.partner.config.json')

    const status = await service.getConfigStatus('partner')
    expect(status.status).toBe('ok')
    if (status.status === 'ok') expect(status.config.domain).toBe('partner')
    const config = await service.getConfig('partner')
    expect(config.domain).toBe('partner')
  })

  it('keeps the default solution untouched: no configFileName on the entry or link', async () => {
    const service = build()
    const entry = await service.importProject(root)
    expect(entry.id).toBe('core')
    expect(entry.configFileName).toBeUndefined()
    const link = JSON.parse(await fsp.readFile(join(root, 'core.link.json'), 'utf-8'))
    expect(link.configFileName).toBeUndefined()
  })

  it('imports every readable solution at a root', async () => {
    await fsp.writeFile(join(root, 'vnext.broken.config.json'), '{ nope')
    const service = build()
    const entries = await service.importSolutionsAtRoot(root)
    expect(entries.map((e) => e.id).sort()).toEqual(['core', 'partner'])
    const listed = await service.listProjects()
    const partner = listed.find((p) => p.id === 'partner')
    expect(partner?.configFileName).toBe('vnext.partner.config.json')
  })

  it('rejects an invalid configFileName', async () => {
    const service = build()
    await expect(service.importProject(root, undefined, { configFileName: '../etc/passwd' })).rejects.toThrow(
      VnextForgeError,
    )
  })

  it('writeProjectConfig renames a domain-suffixed file when its domain changes and swaps the link', async () => {
    const service = build()
    await service.importProject(root, undefined, { configFileName: 'vnext.partner.config.json' })

    const next = await service.writeProjectConfig('partner', fullConfig('loans', { paths: { ...fullConfig('loans').paths, componentsRoot: 'partner' } }))
    expect(next.id).toBe('loans')
    expect(next.configFileName).toBe('vnext.loans.config.json')
    expect(await fs.exists(join(root, 'vnext.loans.config.json'))).toBe(true)
    expect(await fs.exists(join(root, 'vnext.partner.config.json'))).toBe(false)
    expect(await fs.exists(join(root, 'loans.link.json'))).toBe(true)
    expect(await fs.exists(join(root, 'partner.link.json'))).toBe(false)
  })

  it('writeProjectConfig never renames the default solution file', async () => {
    const service = build()
    await service.importProject(root)
    const next = await service.writeProjectConfig('core', fullConfig('renamed'))
    expect(next.id).toBe('renamed')
    expect(next.configFileName).toBeUndefined()
    expect(await fs.exists(join(root, 'vnext.config.json'))).toBe(true)
    expect(JSON.parse(await fsp.readFile(join(root, 'vnext.config.json'), 'utf-8')).domain).toBe('renamed')
  })

  it('writeProjectConfig refuses a domain already used by a sibling solution', async () => {
    const service = build()
    await service.importProject(root, undefined, { configFileName: 'vnext.partner.config.json' })
    await expect(service.writeProjectConfig('partner', fullConfig('core'))).rejects.toMatchObject({
      code: 'PROJECT_ALREADY_EXISTS',
    })
    // nothing was written
    expect(JSON.parse(await fsp.readFile(join(root, 'vnext.partner.config.json'), 'utf-8')).domain).toBe('partner')
  })

  it('writeProjectConfig syncs @burgan-tech/vnext-schema when schemaVersion changes', async () => {
    const service = build()
    await service.importProject(root, undefined, { configFileName: 'vnext.partner.config.json' })

    await service.writeProjectConfig('partner', fullConfig('partner', { schemaVersion: '0.0.53' }))
    const pkg = JSON.parse(await fsp.readFile(join(root, 'package.json'), 'utf-8'))
    expect(pkg.dependencies['@burgan-tech/vnext-schema']).toBe('^0.0.53')

    // sub-project package.json takes precedence when present
    await fsp.writeFile(join(root, 'partner', 'package.json'), JSON.stringify({ dependencies: {} }))
    await service.writeProjectConfig('partner', fullConfig('partner', { schemaVersion: '0.0.54' }))
    const sub = JSON.parse(await fsp.readFile(join(root, 'partner', 'package.json'), 'utf-8'))
    expect(sub.dependencies['@burgan-tech/vnext-schema']).toBe('^0.0.54')
    const rootPkg = JSON.parse(await fsp.readFile(join(root, 'package.json'), 'utf-8'))
    expect(rootPkg.dependencies['@burgan-tech/vnext-schema']).toBe('^0.0.53')
  })

  it('writeProjectConfig leaves package.json alone when schemaVersion is unchanged', async () => {
    const service = build()
    await service.importProject(root)
    const before = await fsp.readFile(join(root, 'package.json'), 'utf-8')
    await service.writeProjectConfig('core', fullConfig('core', { description: 'edited' }))
    expect(await fsp.readFile(join(root, 'package.json'), 'utf-8')).toBe(before)
  })

  it('getWorkspaceBootstrap and listVnextComponents read the linked solution', async () => {
    const service = build()
    await service.importProject(root, undefined, { configFileName: 'vnext.partner.config.json' })
    await fsp.mkdir(join(root, 'partner', 'Tasks'), { recursive: true })
    await fsp.writeFile(
      join(root, 'partner', 'Tasks', 'ping.json'),
      JSON.stringify({ key: 'ping', flow: 'sys-tasks', version: '1.0.0', domain: 'partner' }),
    )
    const bootstrap = await service.getWorkspaceBootstrap('partner')
    expect(bootstrap.project.configFileName).toBe('vnext.partner.config.json')
    expect(bootstrap.configStatus.status).toBe('ok')
    if (bootstrap.configStatus.status === 'ok') expect(bootstrap.configStatus.config.domain).toBe('partner')

    const components = await service.listVnextComponents('partner', {})
    expect(components.components.tasks.map((t) => t.key)).toEqual(['ping'])
  })
})
