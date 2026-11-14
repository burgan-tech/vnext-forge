import { describe, expect, it } from 'vitest'
import type { VnextWorkspaceConfig } from '@vnext-forge-studio/vnext-types'

import { resolveFileRoute } from './file-router'

const paths = {
  componentsRoot: 'core',
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Workflows',
  schemas: 'Schemas',
  mappings: 'Mappings',
}

function config(extra: Partial<VnextWorkspaceConfig['paths']> = {}): VnextWorkspaceConfig {
  return { domain: 'core', version: '1.0.0', paths: { ...paths, ...extra } } as unknown as VnextWorkspaceConfig
}

describe('resolveFileRoute: sys-agents (runtime 0.0.105)', () => {
  it('routes a file under paths.agents to the agent editor', () => {
    const route = resolveFileRoute('/ws/core/Agents/ai-agent-lab/ai-triage-agent.json', config({ agents: 'Agents' }), '/ws')
    expect(route).toMatchObject({ kind: 'agent', group: 'ai-agent-lab', name: 'ai-triage-agent' })
  })

  it('falls back to the Agents folder when the solution has no paths.agents', () => {
    const route = resolveFileRoute('/ws/core/Agents/ai-triage-agent.json', config(), '/ws')
    expect(route).toMatchObject({ kind: 'agent', name: 'ai-triage-agent' })
  })

  it('keeps routing workflows as before', () => {
    const route = resolveFileRoute('/ws/core/Workflows/ai-agent-lab/ai-agent-lab.json', config({ agents: 'Agents' }), '/ws')
    expect(route).toMatchObject({ kind: 'workflow', group: 'ai-agent-lab', name: 'ai-agent-lab' })
  })
})
