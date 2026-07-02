import { describe, expect, it, vi } from 'vitest'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import {
  createRuntimeProxyService,
  type LoggerAdapter,
  type NetworkAdapter,
} from '@vnext-forge-studio/services-core'

const noopLogger: LoggerAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: () => noopLogger,
}

function createNetworkStub(): NetworkAdapter & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async fetch(url: string) {
      calls.push(url)
      return {
        status: 200,
        contentType: 'application/json',
        text: async () => '{"ok":true}',
      }
    },
  } as NetworkAdapter & { calls: string[] }
}

describe('runtime-proxy SSRF allow-list', () => {
  it('rejects runtimeUrl override when allowRuntimeUrlOverride is false', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: false,
    })

    await expect(
      proxy.proxy({
        method: 'GET',
        runtimePath: '/health',
        runtimeUrl: 'http://attacker.example.com',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.API_FORBIDDEN,
    })

    // Confirm we never even attempted the network call.
    expect(network.calls).toEqual([])
  })

  it('rejects runtimeUrl override that is not in the allow-list', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: true,
      allowedBaseUrls: ['http://localhost:4202'],
    })

    let caught: VnextForgeError | undefined
    try {
      await proxy.proxy({
        method: 'GET',
        runtimePath: '/health',
        runtimeUrl: 'http://169.254.169.254',
      })
    } catch (error) {
      caught = error as VnextForgeError
    }
    expect(caught?.code).toBe(ERROR_CODES.API_FORBIDDEN)
    expect(network.calls).toEqual([])
  })

  it('accepts runtimeUrl that is exactly the default base URL', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: true,
      allowedBaseUrls: [],
    })

    await proxy.proxy({
      method: 'GET',
      runtimePath: '/health',
      runtimeUrl: 'http://localhost:4201',
    })
    expect(network.calls).toEqual(['http://localhost:4201/health'])
  })

  it('accepts runtimeUrl that appears in the allow-list', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: true,
      allowedBaseUrls: ['http://localhost:4202/'],
    })

    await proxy.proxy({
      method: 'GET',
      runtimePath: '/health',
      runtimeUrl: 'http://localhost:4202',
    })
    expect(network.calls).toEqual(['http://localhost:4202/health'])
  })

  it('accepts runtimeUrl returned by an allowedBaseUrls callback', async () => {
    const network = createNetworkStub()
    let dynamicUrls: string[] = []
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: true,
      allowedBaseUrls: () => dynamicUrls,
    })

    // Before the URL is in the list → rejected
    await expect(
      proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://runtime.example.com' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.API_FORBIDDEN })

    // Add to dynamic list → now accepted
    dynamicUrls = ['http://runtime.example.com']
    await proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://runtime.example.com' })
    expect(network.calls).toEqual(['http://runtime.example.com/health'])
  })

  it('rejects runtimeUrl not returned by the allowedBaseUrls callback', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: true,
      allowedBaseUrls: () => ['http://localhost:4202'],
    })

    await expect(
      proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://169.254.169.254' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.API_FORBIDDEN })
    expect(network.calls).toEqual([])
  })

  it('falls back to defaultRuntimeUrl when no runtimeUrl is supplied', async () => {
    const network = createNetworkStub()
    const proxy = createRuntimeProxyService({
      network,
      logger: noopLogger,
      defaultRuntimeUrl: 'http://localhost:4201',
      allowRuntimeUrlOverride: false,
    })

    await proxy.proxy({ method: 'GET', runtimePath: '/health' })
    expect(network.calls).toEqual(['http://localhost:4201/health'])
  })
})
