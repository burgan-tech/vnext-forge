import { describe, expect, it } from 'vitest'

import {
  buildWfArgv,
  buildWfShellCommand,
  isValidWfDomainName,
  quoteShellArg,
  wfSupportsDomainFlag,
} from '../../src/services/cli/wf-argv.js'

describe('wfSupportsDomainFlag', () => {
  it('accepts 1.0.13 and newer, rejects older and unknown', () => {
    expect(wfSupportsDomainFlag('1.0.13')).toBe(true)
    expect(wfSupportsDomainFlag('v1.0.13')).toBe(true)
    expect(wfSupportsDomainFlag('wf 1.0.13\n')).toBe(true)
    expect(wfSupportsDomainFlag('1.1.0')).toBe(true)
    expect(wfSupportsDomainFlag('2.0.0-beta.1')).toBe(true)
    expect(wfSupportsDomainFlag('1.0.12')).toBe(false)
    expect(wfSupportsDomainFlag('0.9.99')).toBe(false)
    expect(wfSupportsDomainFlag(undefined)).toBe(false)
    expect(wfSupportsDomainFlag(null)).toBe(false)
    expect(wfSupportsDomainFlag('')).toBe(false)
    expect(wfSupportsDomainFlag('not a version')).toBe(false)
  })
})

describe('buildWfArgv', () => {
  it('maps every workspace command without a --yes flag', () => {
    expect(buildWfArgv({ base: 'check' })).toEqual(['check'])
    expect(buildWfArgv({ base: 'update' })).toEqual(['update'])
    expect(buildWfArgv({ base: 'update --all' })).toEqual(['update', '--all'])
    expect(buildWfArgv({ base: 'update -f', filePath: '/ws/core/Tasks/t.json' })).toEqual([
      'update',
      '-f',
      '/ws/core/Tasks/t.json',
    ])
    expect(buildWfArgv({ base: 'csx --all' })).toEqual(['csx', '--all'])
    expect(buildWfArgv({ base: 'sync' })).toEqual(['sync'])
    expect(buildWfArgv({ base: 'reset' })).toEqual(['reset'])
    for (const argv of [buildWfArgv({ base: 'update' }), buildWfArgv({ base: 'update --all' })]) {
      expect(argv).not.toContain('--yes')
    }
  })

  it('appends --domain after the subcommand arguments', () => {
    expect(buildWfArgv({ base: 'update --all' }, { domain: 'partner' })).toEqual([
      'update',
      '--all',
      '--domain',
      'partner',
    ])
    expect(buildWfArgv({ base: 'update -f', filePath: 'x.json' }, { domain: 'core' })).toEqual([
      'update',
      '-f',
      'x.json',
      '--domain',
      'core',
    ])
    expect(buildWfArgv({ base: 'reset' }, { domain: '  core  ' })).toEqual(['reset', '--domain', 'core'])
  })

  it('ignores an empty domain and rejects an unsafe one', () => {
    expect(buildWfArgv({ base: 'sync' }, { domain: '' })).toEqual(['sync'])
    expect(() => buildWfArgv({ base: 'sync' }, { domain: 'a b' })).toThrow(/not a usable/)
    expect(() => buildWfArgv({ base: 'sync' }, { domain: 'x;rm' })).toThrow(/not a usable/)
    expect(() => buildWfArgv({ base: 'update -f', filePath: '  ' })).toThrow(/filePath is required/)
  })
})

describe('quoteShellArg', () => {
  it('leaves safe arguments alone and quotes the rest', () => {
    expect(quoteShellArg('/ws/core/Tasks/t.json')).toBe('/ws/core/Tasks/t.json')
    expect(quoteShellArg('--domain')).toBe('--domain')
    expect(quoteShellArg('/ws/My Domain/t.json')).toBe('"/ws/My Domain/t.json"')
    expect(quoteShellArg('a"b')).toBe('"a\\"b"')
    expect(quoteShellArg('$HOME')).toBe('"\\$HOME"')
    expect(quoteShellArg('')).toBe('""')
  })
})

describe('buildWfShellCommand', () => {
  it('uses --domain on a capable CLI', () => {
    expect(
      buildWfShellCommand({ base: 'update --all' }, { domain: 'partner', cliSupportsDomainFlag: true }),
    ).toBe('wf update --all --domain partner')
    expect(buildWfShellCommand({ base: 'reset' }, { domain: 'partner', cliSupportsDomainFlag: true })).toBe(
      'wf reset --domain partner',
    )
    expect(
      buildWfShellCommand(
        { base: 'update -f', filePath: '/ws/My Domain/core/Workflows/x.json' },
        { domain: 'core', cliSupportsDomainFlag: true },
      ),
    ).toBe('wf update -f "/ws/My Domain/core/Workflows/x.json" --domain core')
  })

  it('falls back to the legacy two-step form on an old CLI', () => {
    expect(
      buildWfShellCommand({ base: 'update --all' }, { domain: 'partner', cliSupportsDomainFlag: false }),
    ).toBe('wf domain use partner && wf update --all')
    expect(buildWfShellCommand({ base: 'reset' }, { domain: 'core', cliSupportsDomainFlag: false })).toBe(
      'wf domain use core && wf reset',
    )
    expect(() =>
      buildWfShellCommand({ base: 'reset' }, { domain: 'a b', cliSupportsDomainFlag: false }),
    ).toThrow(/not a usable/)
  })

  it('omits the domain entirely when none is given', () => {
    expect(buildWfShellCommand({ base: 'csx --all' }, { cliSupportsDomainFlag: true })).toBe('wf csx --all')
    expect(buildWfShellCommand({ base: 'csx --all' }, { cliSupportsDomainFlag: false })).toBe('wf csx --all')
    expect(buildWfShellCommand({ base: 'update' }, { domain: '', cliSupportsDomainFlag: false })).toBe(
      'wf update',
    )
  })

  it('validates domain names', () => {
    expect(isValidWfDomainName('core')).toBe(true)
    expect(isValidWfDomainName('my.domain_v2-x')).toBe(true)
    expect(isValidWfDomainName('core partner')).toBe(false)
    expect(isValidWfDomainName('')).toBe(false)
  })
})
