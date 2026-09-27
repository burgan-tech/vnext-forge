import { describe, expect, it } from 'vitest'

import { parseWfIndexesGenerateOutput } from '../../src/services/cli/wf-indexes-output.js'

// Shapes follow vnext-workflow-cli origin/master src/commands/indexes.js:
// LOG.success(`Generated ${count} SQL file(s): ${batch}`) → "  ✓ …" (chalk green),
// LOG.info(...) → "  ○ …" (chalk dim), LOG.error(message) → "  ✗ …" (chalk red).

describe('parseWfIndexesGenerateOutput', () => {
  it('reads the count and the batch folder from the success line', () => {
    const stdout =
      '  ✓ Generated 2 SQL file(s): /ws/index-sql/2026-09-24T10-00-00-000Z-Ab12Cd\n' +
      '  ○ No API or database connection was made. Give this batch to your DBA for review and execution.\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'generated',
      count: 2,
      batchPath: '/ws/index-sql/2026-09-24T10-00-00-000Z-Ab12Cd',
    })
  })

  it('ignores ANSI colours and keeps Windows paths with spaces intact', () => {
    const stdout =
      '\u001b[32m  ✓ Generated 1 SQL file(s): C:\\Work Space\\index-sql\\2026-09-24T10-00-00-000Z-x\u001b[39m\r\n' +
      '\u001b[2m  ○ No API or database connection was made.\u001b[22m\r\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'generated',
      count: 1,
      batchPath: 'C:\\Work Space\\index-sql\\2026-09-24T10-00-00-000Z-x',
    })
  })

  it('returns the CLI error line on failure', () => {
    const stdout =
      '\u001b[31m  ✗ No workflows referencing attributes.type: master schemas found; no SQL files generated.\u001b[39m\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'failed',
      message: 'No workflows referencing attributes.type: master schemas found; no SQL files generated.',
    })
  })

  it('prefers an Error: line from a crash over the trailing Node banner', () => {
    const stderr =
      '/usr/lib/node_modules/@burgan-tech/vnext-workflow-cli/src/lib/indexes/sql.js:10\n' +
      'TypeError: Cannot read properties of undefined (reading \'map\')\n' +
      '    at generateSql (sql.js:10:5)\n\nNode.js v20.11.0\n'
    expect(parseWfIndexesGenerateOutput('', stderr)).toEqual({
      kind: 'failed',
      message: "TypeError: Cannot read properties of undefined (reading 'map')",
    })
  })

  it('falls back to the last line, then to a fixed message', () => {
    expect(parseWfIndexesGenerateOutput('something unexpected\n\n')).toEqual({
      kind: 'failed',
      message: 'something unexpected',
    })
    expect(parseWfIndexesGenerateOutput('', '')).toEqual({
      kind: 'failed',
      message: 'The Workflow CLI printed no result.',
    })
  })
})
