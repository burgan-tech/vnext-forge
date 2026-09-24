import { describe, expect, it } from 'vitest'

import {
  buildWfArgv,
  buildWfIndexesGenerateArgv,
  buildWfShellCommand,
  isValidWfDomainName,
  isValidWfFlowKey,
  quoteShellArg,
  WF_INDEXES_MIN_VERSION,
  WF_PUBLISH_COMPLETED_MIN_VERSION,
  wfSupportsDomainFlag,
  wfSupportsIndexes,
  wfSupportsPublishCompleted,
  type WfIndexesGenerateSpec,
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

describe('wfSupportsIndexes / wfSupportsPublishCompleted', () => {
  it('uses one 1.1.0 floor for both features', () => {
    expect(WF_INDEXES_MIN_VERSION).toBe('1.1.0')
    expect(WF_PUBLISH_COMPLETED_MIN_VERSION).toBe(WF_INDEXES_MIN_VERSION)
  })

  it('accepts 1.1.0 and newer, rejects older and unknown', () => {
    for (const gate of [wfSupportsIndexes, wfSupportsPublishCompleted]) {
      expect(gate('1.1.0')).toBe(true)
      expect(gate('v1.1.0')).toBe(true)
      expect(gate('wf 1.2.3\n')).toBe(true)
      expect(gate('2.0.0-beta.1')).toBe(true)
      expect(gate('1.0.14')).toBe(false)
      expect(gate('1.0.13')).toBe(false)
      expect(gate(undefined)).toBe(false)
      expect(gate(null)).toBe(false)
      expect(gate('')).toBe(false)
      expect(gate('dev-build')).toBe(false)
    }
  })

  it('leaves the --domain gate at 1.0.13', () => {
    expect(wfSupportsDomainFlag('1.0.13')).toBe(true)
    expect(wfSupportsDomainFlag('1.0.12')).toBe(false)
  })
})

describe('isValidWfFlowKey', () => {
  it('follows the CLI physical-schema rule', () => {
    expect(isValidWfFlowKey('money-transfer')).toBe(true)
    expect(isValidWfFlowKey('_internal_flow')).toBe(true)
    expect(isValidWfFlowKey('A1')).toBe(true)
    expect(isValidWfFlowKey('a'.repeat(63))).toBe(true)
    expect(isValidWfFlowKey('a'.repeat(64))).toBe(false)
    expect(isValidWfFlowKey('1-starts-with-digit')).toBe(false)
    expect(isValidWfFlowKey('-starts-with-dash')).toBe(false)
    expect(isValidWfFlowKey('has space')).toBe(false)
    expect(isValidWfFlowKey('has.dot')).toBe(false)
    expect(isValidWfFlowKey('')).toBe(false)
  })
})

describe('buildWfIndexesGenerateArgv', () => {
  it('builds the all-flows form', () => {
    expect(buildWfIndexesGenerateArgv({ base: 'indexes generate' })).toEqual(['indexes', 'generate'])
  })

  it('adds --flow, -o and --retire-obsolete in CLI order', () => {
    expect(
      buildWfIndexesGenerateArgv({
        base: 'indexes generate',
        flow: '  money-transfer ',
        output: './index-sql',
        retireObsolete: true,
      }),
    ).toEqual(['indexes', 'generate', '--flow', 'money-transfer', '-o', './index-sql', '--retire-obsolete'])
    expect(buildWfIndexesGenerateArgv({ base: 'indexes generate', retireObsolete: false })).toEqual([
      'indexes',
      'generate',
    ])
  })

  it('rejects an invalid flow key or output folder', () => {
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: '' })).toThrow(/not a valid flow key/)
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: 'x;rm' })).toThrow(
      /not a valid flow key/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: 'a'.repeat(64) })).toThrow(
      /not a valid flow key/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', output: '  ' })).toThrow(
      /output folder must not be empty/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', output: '--retire-obsolete' })).toThrow(
      /must not start with "-"/,
    )
  })

  it('never emits --domain, even when a caller smuggles one in', () => {
    const spec = { base: 'indexes generate', flow: 'loan', domain: 'core' } as WfIndexesGenerateSpec & {
      domain: string
    }
    const argv = buildWfIndexesGenerateArgv(spec)
    expect(argv).toEqual(['indexes', 'generate', '--flow', 'loan'])
    expect(argv).not.toContain('--domain')
    expect(argv).not.toContain('core')
  })
})
