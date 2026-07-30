import { describe, expect, it } from 'vitest'

import {
  extractDbNameFromAppSettings,
  normalizeDbName,
} from '../../src/services/local-runtime/db-name.js'

describe('normalizeDbName', () => {
  // Mirrors create-domain.sh: non-alphanumerics become '_', then the first
  // character is upper-cased. The rest of the string is left alone.
  it('capitalises the first character', () => {
    expect(normalizeDbName('core')).toBe('vNext_Core')
  })

  it('replaces non-alphanumeric characters with underscores', () => {
    expect(normalizeDbName('my-domain')).toBe('vNext_My_domain')
  })

  it('leaves interior casing untouched', () => {
    expect(normalizeDbName('myDomain')).toBe('vNext_MyDomain')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDbName('  core  ')).toBe('vNext_Core')
  })

  it('returns null for an empty domain', () => {
    expect(normalizeDbName('')).toBeNull()
    expect(normalizeDbName('   ')).toBeNull()
  })
})

describe('extractDbNameFromAppSettings', () => {
  it('pulls the database out of a connection string', () => {
    const content = JSON.stringify({
      ConnectionStrings: {
        Default: 'Host=postgres;Port=5432;Database=vNext_Core;Username=postgres',
      },
    })
    expect(extractDbNameFromAppSettings(content)).toBe('vNext_Core')
  })

  it('handles the database appearing at the end without a trailing semicolon', () => {
    expect(extractDbNameFromAppSettings('"Host=postgres;Database=vNext_Sales"')).toBe(
      'vNext_Sales',
    )
  })

  it('returns null when there is no Database= segment', () => {
    expect(extractDbNameFromAppSettings('{"ConnectionStrings":{}}')).toBeNull()
  })

  it('returns null for unparseable input', () => {
    expect(extractDbNameFromAppSettings('')).toBeNull()
  })

  it('picks ConnectionStrings.Default even when another Database= appears first in the file', () => {
    // The ClickHouse block is listed before ConnectionStrings in the object
    // literal (and would be encountered first by a whole-content scan), so
    // this only passes if the function specifically reads
    // ConnectionStrings.Default instead of matching the first Database=
    // anywhere in the content.
    const content = JSON.stringify({
      ClickHouse: {
        ConnectionString: 'Host=vnext-clickhouse;Port=8123;Database=workflow_analytics;Username=default',
      },
      ConnectionStrings: {
        Default: 'Host=vnext-postgres;Port=5432;Database=vNext_Core;Username=postgres',
      },
    })
    expect(extractDbNameFromAppSettings(content)).toBe('vNext_Core')
  })
})
