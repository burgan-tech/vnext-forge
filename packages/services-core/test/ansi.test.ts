import { describe, expect, it } from 'vitest'

import { stripAnsi } from '../src/lib/ansi.js'

const ESC = '\u001B'

describe('stripAnsi', () => {
  it('strips a chalk-style coloured string', () => {
    expect(stripAnsi(`${ESC}[32m✓ Domain added${ESC}[39m`)).toBe('✓ Domain added')
  })

  it('strips a Makefile-style colour code (RED/GREEN/YELLOW/NC from vnext-runtime)', () => {
    // vnext-runtime/Makefile defines colours as e.g. YELLOW = \033[1;33m ... NC = \033[0m
    expect(stripAnsi(`${ESC}[1;33mStarting…${ESC}[0m`)).toBe('Starting…')
  })

  it('strips multiple sequences within a single line', () => {
    const input = `${ESC}[36m${ESC}[1m🌐 Domains:${ESC}[22m${ESC}[39m`
    expect(stripAnsi(input)).toBe('🌐 Domains:')
  })

  it('returns text with no escape sequences unchanged', () => {
    expect(stripAnsi('plain text, nothing to see here')).toBe('plain text, nothing to see here')
  })

  it('returns an empty string unchanged', () => {
    expect(stripAnsi('')).toBe('')
  })

  it('leaves non-ASCII text that is not an escape sequence untouched', () => {
    // The point of stripAnsi is to remove escape codes, not to sanitise Unicode.
    const input = `═══ ✅ done ✗ failed … ${ESC}[0m`
    expect(stripAnsi(input)).toBe('═══ ✅ done ✗ failed … ')
  })

  it('strips OSC sequences terminated by BEL', () => {
    const BEL = '\u0007'
    const input = `${ESC}]0;window title${BEL}visible text`
    expect(stripAnsi(input)).toBe('visible text')
  })
})
