/**
 * Round-trip safety for declarative task mappings (runtime vnext#1229): the
 * vnext-example `declarative-mapping-lab` flow opens and saves back byte for
 * byte, and an edit through the editor's helpers changes only the edited
 * value — `set` key order (semantic) and every other member stay as stored.
 * Fixture: `__fixtures__/declarative-mapping-lab.json` (vnext-example, branch
 * feature/declarative-task-mappings).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const written = new Map<string, string>();

vi.mock('../../project-workspace/WorkspaceApi', () => ({
  readFile: vi.fn(),
  readOptionalFile: vi.fn(),
  createDirectory: vi.fn(async () => ({ success: true, data: undefined })),
  writeFile: vi.fn(async (path: string, content: string) => {
    written.set(path, content);
    return { success: true, data: undefined };
  }),
}));

import { saveWorkflowDocument } from '../../flow-editor/FlowEditorApi';
import { flowEditorDocumentSchema } from '../../flow-editor/FlowEditorSchema';
import { useWorkflowStore } from '../../../store/useWorkflowStore';
import {
  addSetEntry,
  renameSetKey,
  setBlockMember,
  setSetExpression,
  type MappingBindingLike,
} from './declarativeMapping';
import { DeclarativeMappingEditor } from './DeclarativeMappingEditor';
import { TaskBindingMappingField } from './TaskBindingMappingField';

const TEXT = readFileSync(join(__dirname, '__fixtures__', 'declarative-mapping-lab.json'), 'utf8');
const DIR = '/ws/core/Workflows/declarative-mapping-lab';
const FILE = `${DIR}/declarative-mapping-lab.json`;

type Doc = { attributes: { states: Record<string, any>[] } };

function transitionBinding(doc: Doc): MappingBindingLike {
  return doc.attributes.states[0].transitions[0].onExecutionTasks[0];
}

async function save(): Promise<string> {
  const result = await saveWorkflowDocument({
    workflowDir: DIR,
    workflowFilePath: FILE,
    workflowJson: useWorkflowStore.getState().workflowJson!,
  });
  expect(result.success).toBe(true);
  return written.get(FILE)!;
}

describe('declarative-mapping-lab round-trip', () => {
  beforeEach(() => {
    written.clear();
    useWorkflowStore.getState().clearWorkflow();
    useWorkflowStore
      .getState()
      .setWorkflow(flowEditorDocumentSchema.parse(JSON.parse(TEXT)), { nodePos: {} });
  });

  it('saves back unchanged when nothing is edited', async () => {
    expect(await save()).toBe(TEXT.trimEnd());
  });

  it('an expression edit changes only that value; set order and the other bindings stay', async () => {
    useWorkflowStore
      .getState()
      .updateWorkflow((draft) =>
        setSetExpression(
          transitionBinding(draft as Doc),
          'output',
          '$.dml.state',
          'instance.effectiveState',
        ),
      );
    const saved = await save();
    expect(saved).toBe(
      TEXT.trimEnd().replace(
        '"$.dml.state": "instance.currentState"',
        '"$.dml.state": "instance.effectiveState"',
      ),
    );
    const keys = Object.keys((transitionBinding(JSON.parse(saved)).output as { set: object }).set);
    expect(keys).toEqual([
      '$.dml.score',
      '$.dml.status',
      '$.dml.state',
      '$.dml.instanceKey',
      '$.dml.checkedAt',
      '$.dml.callerKnown',
      '$.dml.inputAmount',
      '$.dml.missing',
      '$.dml.calledUrl',
    ]);
  });

  it('a rename keeps the entry at its position', async () => {
    useWorkflowStore
      .getState()
      .updateWorkflow(
        (draft) =>
          void renameSetKey(
            transitionBinding(draft as Doc),
            'input',
            '$.body.customerId',
            '$.body.id',
          ),
      );
    expect(await save()).toBe(
      TEXT.trimEnd().replace(
        '"$.body.customerId": "data.customer.id",',
        '"$.body.id": "data.customer.id",',
      ),
    );
  });

  it('a new block on a script-free binding lands after the existing members', () => {
    useWorkflowStore.getState().updateWorkflow((draft) => {
      const entry = (draft as Doc).attributes.states[2].onEntries[0] as MappingBindingLike;
      delete entry.input;
      addSetEntry(entry, 'input', '$.body.field', 'data.customer.id');
      setBlockMember(entry, 'output', 'into', '$.entry');
    });
    const entry = (useWorkflowStore.getState().workflowJson as unknown as Doc).attributes.states[2]
      .onEntries[0];
    expect(Object.keys(entry)).toEqual(['order', 'task', 'output', 'input']);
    expect(Object.keys(entry.output)).toEqual(['select', 'into', 'set']);
  });
});

describe('editor rendering', () => {
  const doc = JSON.parse(TEXT) as Doc;

  it('lists set entries in declaration order', () => {
    const html = renderToStaticMarkup(
      createElement(DeclarativeMappingEditor, {
        binding: transitionBinding(doc),
        onUpdate: () => undefined,
      }),
    );
    const order = [
      '$.dml.score',
      '$.dml.status',
      '$.dml.state',
      '$.dml.checkedAt',
      '$.dml.missing',
    ].map((k) => html.indexOf(`value="${k}"`));
    expect(order.every((pos, i) => pos > 0 && (i === 0 || pos > order[i - 1]))).toBe(true);
    expect(html).toContain('value="$.data.customer"');
    expect(html).toContain('value="result.body.score.AsInt32() + 10"');
  });

  const field = (binding: MappingBindingLike) =>
    renderToStaticMarkup(
      createElement(TaskBindingMappingField, {
        binding,
        onUpdate: () => undefined,
        renderScript: () => createElement('div', { 'data-script': 'yes' }),
      }),
    );

  it('a new binding starts declarative', () => {
    const html = field({ order: 1, task: { key: 't' } });
    expect(html).toMatch(/aria-checked="true"[^>]*>Declarative</);
    expect(html).toContain('data-testid="declarative-input"');
    expect(html).not.toContain('data-script');
  });

  it('a binding with a C# mapping opens the script editor', () => {
    const html = field({
      order: 1,
      task: { key: 't' },
      mapping: { location: './a.csx', code: '' },
    });
    expect(html).toMatch(/aria-checked="true"[^>]*>C# script</);
    expect(html).toContain('data-script="yes"');
    expect(html).not.toContain('data-testid="declarative-input"');
  });

  it('a binding with both shows the conflict and the script the runtime runs', () => {
    const html = field({
      order: 1,
      task: { key: 't' },
      mapping: { location: './a.csx', code: '' },
      output: { into: '$.x' },
    });
    expect(html).toContain('Publish rejects it');
    expect(html).toContain('data-script="yes"');
  });
});
