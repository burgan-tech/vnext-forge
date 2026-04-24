import * as fsp from 'node:fs/promises'
import { homedir, platform, tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { FileSystemAdapter } from '../src/adapters/file-system.js'
import {
  flowToExportCategory,
  parseVnextComponentJson,
  scanVnextComponents,
} from '../src/services/project/vnext-component-scanner.js'

/** Minimal `FileSystemAdapter` for this package’s tests (mirrors `apps/server` node adapter). */
function createTestFs(): FileSystemAdapter {
  const isWin = platform() === 'win32'
  return {
    isWindows: isWin,
    readFile: (p) => fsp.readFile(p, 'utf-8') as Promise<string>,
    writeFile: async (p, c) => fsp.writeFile(p, c, 'utf-8'),
    deleteFile: (p) => fsp.unlink(p),
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
      return e.map((ent) => ({
        name: ent.name,
        isDirectory: ent.isDirectory(),
        isFile: ent.isFile(),
      }))
    },
    resolveHome: () => homedir(),
    cwd: () => process.cwd(),
  }
}

describe('parseVnextComponentJson', () => {
  it('returns key, flow, and optional version for valid JSON', () => {
    expect(
      parseVnextComponentJson(
        JSON.stringify({
          key: 'my-task',
          flow: 'sys-tasks',
          domain: 'x',
          version: '1.0.0',
        }),
      ),
    ).toEqual({ key: 'my-task', flow: 'sys-tasks', version: '1.0.0' })
  })

  it('trims key and flow', () => {
    expect(
      parseVnextComponentJson(JSON.stringify({ key: '  k  ', flow: '  sys-flows  ' })),
    ).toEqual({ key: 'k', flow: 'sys-flows' })
  })

  it('returns null for invalid JSON', () => {
    expect(parseVnextComponentJson('{')).toBeNull()
  })

  it('returns null when key or flow missing or not string', () => {
    expect(parseVnextComponentJson(JSON.stringify({ flow: 'sys-tasks' }))).toBeNull()
    expect(parseVnextComponentJson(JSON.stringify({ key: 'a', flow: 1 }))).toBeNull()
    expect(parseVnextComponentJson(JSON.stringify([]))).toBeNull()
  })
})

describe('flowToExportCategory', () => {
  it('maps sys-* flows', () => {
    expect(flowToExportCategory('sys-tasks')).toBe('tasks')
    expect(flowToExportCategory('sys-flows')).toBe('workflows')
  })

  it('returns null for unknown', () => {
    expect(flowToExportCategory('sys-workflows')).toBeNull()
  })
})

describe('scanVnextComponents (disk)', () => {
  it('buckets task JSON under tasks path', async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), 'vnext-scan-'))
    try {
      const tasksDir = join(root, 'openbanking', 'Tasks', 'g')
      await fsp.mkdir(tasksDir, { recursive: true })
      await fsp.writeFile(
        join(tasksDir, 't.json'),
        JSON.stringify({ key: 't1', flow: 'sys-tasks', version: '1.0.0' }, null, 2),
        'utf-8',
      )

      const fs = createTestFs()
      const paths = {
        componentsRoot: 'openbanking',
        tasks: 'Tasks',
        workflows: 'Workflows',
        views: 'Views',
        schemas: 'Schemas',
        functions: 'Functions',
        extensions: 'Extensions',
      }

      const { components } = await scanVnextComponents(fs, root, paths, { onlyCategory: 'tasks' })
      expect(components.tasks).toHaveLength(1)
      expect(components.tasks[0]?.key).toBe('t1')
      expect(components.workflows).toHaveLength(0)
      const readBack = await fsp.readFile(components.tasks[0]!.path, 'utf-8')
      expect(readBack).toContain('t1')
    } finally {
      await fsp.rm(root, { recursive: true, force: true })
    }
  })
})
