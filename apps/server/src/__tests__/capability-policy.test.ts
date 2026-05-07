import { describe, expect, it } from 'vitest'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import {
  assertCapabilityAllowed,
  methodCapability,
} from '@vnext-forge-studio/services-core'

describe('capability policy', () => {
  it('classifies privileged FS / proxy methods correctly', () => {
    expect(methodCapability('files/read')).toBe('privileged')
    expect(methodCapability('files/write')).toBe('privileged')
    expect(methodCapability('files/delete')).toBe('privileged')
    expect(methodCapability('files/browse')).toBe('privileged')
    expect(methodCapability('runtime/proxy')).toBe('privileged')
    expect(methodCapability('projects/create')).toBe('privileged')
    expect(methodCapability('projects/import')).toBe('privileged')
    expect(methodCapability('projects/remove')).toBe('privileged')
    expect(methodCapability('projects/export')).toBe('privileged')
    expect(methodCapability('projects/writeConfig')).toBe('privileged')
    expect(methodCapability('projects/seedVnextComponentLayout')).toBe('privileged')
  })

  it('classifies read-only / pure methods as public', () => {
    expect(methodCapability('projects/list')).toBe('public')
    expect(methodCapability('projects/getById')).toBe('public')
    expect(methodCapability('projects/getTree')).toBe('public')
    expect(methodCapability('projects/getConfig')).toBe('public')
    expect(methodCapability('projects/getWorkspaceBootstrap')).toBe('public')
    expect(methodCapability('validate/workflow')).toBe('public')
    expect(methodCapability('validate/getSchema')).toBe('public')
    expect(methodCapability('health/check')).toBe('public')
  })

  it('returns undefined for unknown methods so the dispatcher fails closed', () => {
    // intentionally invalid: tests unknown method rejection
    expect(methodCapability('not.a.method')).toBeUndefined()
  })

  it('bypasses the gate when the caller is trusted', () => {
    expect(() =>
      assertCapabilityAllowed('files/write', { trusted: true }, 'trace-123'),
    ).not.toThrow()
    expect(() =>
      assertCapabilityAllowed('runtime/proxy', { trusted: true }),
    ).not.toThrow()
  })

  it('rejects privileged methods when the origin is not allow-listed', () => {
    expect(() =>
      assertCapabilityAllowed(
        'files/write',
        {
          trusted: false,
          origin: 'http://attacker.example.com',
          allowedOrigins: ['http://localhost:5173'],
        },
        'trace-123',
      ),
    ).toThrowError(VnextForgeError)
  })

  it('accepts privileged methods when the origin IS allow-listed', () => {
    expect(() =>
      assertCapabilityAllowed('files/write', {
        trusted: false,
        origin: 'http://localhost:5173',
        allowedOrigins: ['http://localhost:5173'],
      }),
    ).not.toThrow()
  })

  it('rejects privileged methods when no origin header is supplied', () => {
    let caught: VnextForgeError | undefined
    try {
      assertCapabilityAllowed('runtime/proxy', {
        trusted: false,
        origin: null,
        allowedOrigins: ['http://localhost:5173'],
      })
    } catch (error) {
      caught = error as VnextForgeError
    }
    expect(caught?.code).toBe(ERROR_CODES.API_FORBIDDEN)
  })

  it('always allows public methods regardless of origin', () => {
    expect(() =>
      assertCapabilityAllowed('projects/list', {
        trusted: false,
        origin: 'http://attacker.example.com',
        allowedOrigins: [],
      }),
    ).not.toThrow()
    expect(() =>
      assertCapabilityAllowed('health/check', {
        trusted: false,
        origin: null,
        allowedOrigins: [],
      }),
    ).not.toThrow()
  })

  it('fails closed for unknown methods', () => {
    // intentionally invalid: tests unknown method rejection
    expect(() =>
      assertCapabilityAllowed('not.a.method', {
        trusted: false,
        origin: 'http://localhost:5173',
        allowedOrigins: [],
      }),
    ).toThrowError(VnextForgeError)
  })
})
