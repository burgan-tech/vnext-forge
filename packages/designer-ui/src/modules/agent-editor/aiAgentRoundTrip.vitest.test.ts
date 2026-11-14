/**
 * Round-trip safety for the AI Agent contract (runtime 0.0.105, vnext#1105):
 * every ai-agent-lab example opens in the designer and saves back unchanged —
 * the state `agent` block, transition `description`, the agent's tool fields
 * and any member Forge does not model. Fixtures: `__fixtures__/ai-agent-lab`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAgentCandidates, validateAiAgentStates } from '@vnext-forge-studio/vnext-types';

const written = new Map<string, string>();

vi.mock('../project-workspace/WorkspaceApi', () => ({
  readFile: vi.fn(),
  readOptionalFile: vi.fn(),
  createDirectory: vi.fn(async () => ({ success: true, data: undefined })),
  writeFile: vi.fn(async (path: string, content: string) => {
    written.set(path, content);
    return { success: true, data: undefined };
  }),
}));

import { saveWorkflowDocument } from '../flow-editor/FlowEditorApi';
import { flowEditorDocumentSchema } from '../flow-editor/FlowEditorSchema';
import { toVnextWorkflow, workflowToReactFlow } from '../canvas-interaction/utils/Conversion';
import { validateWorkflow } from '../workflow-validation/ValidationEngine';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import {
  setAgentTool,
  setAgentAttribute,
  emptyAgentTool,
  toolKindOf,
} from './agentDocument';
import { updateAgentBinding } from '../canvas-interaction/components/panels/tabs/agent/agentStateDocument';

const FIXTURES = join(__dirname, '__fixtures__', 'ai-agent-lab');

function fixtureFiles(dir: 'workflows' | 'agents'): { name: string; text: string }[] {
  return readdirSync(join(FIXTURES, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(FIXTURES, dir, name), 'utf8') }));
}

const workflows = fixtureFiles('workflows');
const agents = fixtureFiles('agents');

/** Forge writes `JSON.stringify(json, null, 2)`; the examples only add a trailing newline. */
function sameDocument(saved: string, original: string): void {
  expect(saved).toBe(original.trimEnd());
}

describe('ai-agent-lab fixtures', () => {
  it('cover the 7 flows and 4 agents of the example repository', () => {
    expect(workflows).toHaveLength(7);
    expect(agents).toHaveLength(4);
  });
});

describe.each(workflows)('workflow $name', ({ name, text }) => {
  beforeEach(() => {
    written.clear();
    useWorkflowStore.getState().clearWorkflow();
  });

  it('opens on the canvas, raises no AI Agent finding and saves back unchanged', async () => {
    const original = JSON.parse(text) as Record<string, unknown>;
    const loaded = flowEditorDocumentSchema.parse(JSON.parse(text));
    useWorkflowStore.getState().setWorkflow(loaded, { nodePos: {} });

    const { nodes } = workflowToReactFlow(toVnextWorkflow(loaded), { nodePos: {} });
    const agentNode = nodes.find((n) => (n.data as { stateType?: number }).stateType === 6);
    expect(agentNode, 'the AiAgent state renders as a node').toBeDefined();

    const states = (loaded.attributes as { states: unknown[] }).states;
    expect(validateAiAgentStates(states)).toEqual([]);
    const findings = validateWorkflow(loaded).filter((f) => f.rule === 'ai-agent-state' || f.severity === 'error');
    expect(findings).toEqual([]);

    const json = useWorkflowStore.getState().workflowJson!;
    const result = await saveWorkflowDocument({
      workflowDir: '/ws/core/Workflows/ai-agent-lab',
      workflowFilePath: `/ws/core/Workflows/ai-agent-lab/${name}`,
      workflowJson: json,
    });
    expect(result.success).toBe(true);
    const saved = written.get(`/ws/core/Workflows/ai-agent-lab/${name}`)!;
    sameDocument(saved, text);
    expect(JSON.parse(saved)).toEqual(original);
  });

  it('keeps the agent block and every other member when the agent editor changes one field', () => {
    const loaded = JSON.parse(text) as Record<string, unknown>;
    useWorkflowStore.getState().setWorkflow(loaded, { nodePos: {} });
    const stateKey = (loaded.attributes as { states: { key: string; stateType: number }[] }).states.find(
      (s) => s.stateType === 6,
    )!.key;

    useWorkflowStore.getState().updateWorkflow((draft) =>
      updateAgentBinding(draft, stateKey, (agent) => {
        agent.output = { ...(agent.output as object), path: '$.changed' };
      }),
    );
    const after = useWorkflowStore.getState().workflowJson as typeof loaded;
    const expected = JSON.parse(text) as { attributes: { states: Record<string, any>[] } };
    expected.attributes.states.find((s) => s.key === stateKey)!.agent.output.path = '$.changed';
    expect(after).toEqual(expected);
  });
});

describe('AI Agent candidates over the examples', () => {
  it('match the runtime candidate set (rule-less automatic transitions minus reserved exits)', () => {
    const byName = Object.fromEntries(
      workflows.map(({ name, text }) => {
        const state = (JSON.parse(text).attributes.states as { stateType: number }[]).find((s) => s.stateType === 6);
        return [name, resolveAgentCandidates(state)];
      }),
    );
    expect(byName['ai-agent-lab.json'].candidates.map((c) => [c.key, c.whenSource])).toEqual([
      ['is-question', 'hint'],
      ['is-fraud', 'description'],
    ]);
    expect(byName['ai-agent-lab.json'].reserved.map((r) => r.role)).toEqual(['fallback', 'onExhausted']);
    expect(byName['ai-agent-lab-approval.json'].reserved.map((r) => [r.role, r.key])).toEqual([
      ['fallback', 'assess-failed'],
      ['onApprovalRequest', 'needs-approval'],
    ]);
    expect(byName['ai-agent-lab-rules.json'].candidates).toEqual([]);
    expect(byName['ai-agent-lab-rules.json'].ruled).toEqual(['to-other', 'to-question']);
  });
});

describe.each(agents)('agent $name', ({ text }) => {
  it('saves back unchanged after a no-op edit of every tool', () => {
    let json = JSON.parse(text) as Record<string, unknown>;
    const tools = ((json.attributes as { tools?: unknown[] }).tools ?? []) as Record<string, unknown>[];
    tools.forEach((tool, index) => {
      json = setAgentTool(json, index, { ...tool });
    });
    sameDocument(JSON.stringify(json, null, 2), text);
  });

  it('keeps tool fields it does not model when one attribute changes', () => {
    const json = setAgentAttribute(JSON.parse(text), 'provider', 'bank-llm');
    const expected = JSON.parse(text);
    expected.attributes.provider = 'bank-llm';
    expect(json).toEqual(expected);
  });
});

describe('agent tool helpers', () => {
  it('builds an empty tool per kind with the required binding', () => {
    expect(emptyAgentTool(1)).toMatchObject({ kind: 1, binding: { task: expect.any(Object) } });
    expect(emptyAgentTool(2)).toMatchObject({ kind: 2, binding: { code: { location: 'dynamicExpresso', encoding: 'NAT' } } });
    expect(emptyAgentTool(3)).toMatchObject({ kind: 3, binding: { allow: [] } });
    expect(toolKindOf({ kind: 3 })).toBe(3);
    expect(toolKindOf({ kind: 9 })).toBeUndefined();
  });
});
