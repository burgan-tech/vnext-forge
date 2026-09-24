import { stripAnsi } from '../../lib/ansi.js'

/**
 * Parser for the output of `wf indexes generate` (vnext-workflow-cli ≥ 1.0.14,
 * `src/commands/indexes.js`). The CLI prints through chalk:
 *   success → `  ✓ Generated <N> SQL file(s): <absolute batch folder>`
 *   failure → `  ✗ <message>` and exit code 1
 * Colours are normally off when stdout is not a TTY; they are stripped anyway.
 */
export type WfIndexesGenerateOutcome =
  | { kind: 'generated'; count: number; batchPath: string }
  | { kind: 'failed'; message: string }

const GENERATED_LINE = /Generated (\d+) SQL file\(s\): (.+)$/
const CLI_ERROR_LINE = /^✗\s+(.+)$/
const CRASH_ERROR_LINE = /^[A-Za-z]*Error: .+$/
const NO_RESULT_MESSAGE = 'The Workflow CLI printed no result.'

export function parseWfIndexesGenerateOutput(stdout: string, stderr = ''): WfIndexesGenerateOutcome {
  const lines = stripAnsi(`${stdout}\n${stderr}`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (const line of lines) {
    const generated = GENERATED_LINE.exec(line)
    if (generated) {
      return {
        kind: 'generated',
        count: Number.parseInt(generated[1] ?? '0', 10),
        batchPath: (generated[2] ?? '').trim(),
      }
    }
  }
  for (const line of lines) {
    const cliError = CLI_ERROR_LINE.exec(line)
    if (cliError) return { kind: 'failed', message: (cliError[1] ?? '').trim() }
  }
  const crash = lines.find((line) => CRASH_ERROR_LINE.test(line))
  if (crash) return { kind: 'failed', message: crash }
  const last = lines.length > 0 ? lines[lines.length - 1] : undefined
  return { kind: 'failed', message: last ?? NO_RESULT_MESSAGE }
}
