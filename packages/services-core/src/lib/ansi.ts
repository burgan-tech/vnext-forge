/**
 * Strip ANSI escape sequences from text (R-c4 - colourised `make` / `wf` output
 * streamed into a VS Code OutputChannel, which does not interpret ANSI codes).
 *
 * Covers CSI sequences (e.g. ESC-[0;33m, ESC-[1m, ESC-[0m - used by both the
 * vnext-runtime Makefile's colour constants and the `wf` CLI's chalk output)
 * and OSC sequences, since both are cheap to include in a single pattern.
 * Anything that is not an escape sequence - including non-ASCII text such as
 * box-drawing characters or emoji - is left untouched.
 */

// CSI (Control Sequence Introducer): ESC "[" <parameter bytes 0x30-0x3F>
// <intermediate bytes 0x20-0x2F> <final byte 0x40-0x7E> - e.g. ESC-[0;33m.
const CSI_PATTERN = '[\\u001B\\u009B]\\[[0-?]*[ -/]*[@-~]'

// OSC (Operating System Command): ESC "]" <any text> terminated by BEL
// (0x07) or ST (ESC "\"). Content is matched non-greedily up to the first
// terminator so it tolerates arbitrary text (including spaces) in between.
const OSC_PATTERN = '[\\u001B\\u009B]\\][\\s\\S]*?(?:\\u0007|\\u001B\\\\)'

const ANSI_PATTERN = new RegExp(`${OSC_PATTERN}|${CSI_PATTERN}`, 'g')

export function stripAnsi(text: string): string {
  if (!text) return text
  return text.replace(ANSI_PATTERN, '')
}
