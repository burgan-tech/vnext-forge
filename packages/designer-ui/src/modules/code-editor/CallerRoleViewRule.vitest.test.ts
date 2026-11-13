/**
 * Acceptance for the runtime 0.0.105 handoff `script-caller-roles`: a
 * role-based view rule can be authored with completions and round-trips
 * unchanged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scriptCallerSurfaceOf, type ScriptCallerSurface } from '@vnext-forge-studio/vnext-types';

import type { ActiveScript } from './ScriptPanelStore.js';
import { applyScriptValueToWorkflow } from './ScriptWorkflowSync.js';
import { registerContextAwareCompletions, setCsxModelCallerSurface } from './editor/CsxCompletions.js';
import { validateCsxScript } from './editor/CsxDiagnostics.js';
import { decodeScriptCode, encodeScriptCode } from './editor/ScriptCodec.js';

// Roslyn readiness is module state in lspClient; the tests flip it.
const lsp = vi.hoisted(() => ({ ready: false }));
vi.mock('./editor/lspClient', () => ({ isCsharpLspReady: () => lsp.ready }));

/* ── Minimal Monaco double: captures the providers CsxCompletions registers ── */

type Provider = { triggerCharacters?: string[]; provideCompletionItems?: Function; provideHover?: Function };

function fakeMonaco() {
  const completion: Provider[] = [];
  const hover: Provider[] = [];
  const monaco = {
    languages: {
      registerCompletionItemProvider: (_lang: string, p: Provider) => completion.push(p),
      registerHoverProvider: (_lang: string, p: Provider) => hover.push(p),
      CompletionItemKind: { Method: 0, Property: 1, Class: 2, Snippet: 3, Field: 4, Value: 5, Text: 6 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    },
    Range: class {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number,
      ) {}
    },
  };
  registerContextAwareCompletions(monaco as never);
  return { dot: completion.find((p) => p.triggerCharacters?.includes('.'))!, hover: hover[0]! };
}

function model(text: string, surface: ScriptCallerSurface | undefined) {
  const lines = text.split('\n');
  const m = {
    getValue: () => text,
    getLineContent: (n: number) => lines[n - 1] ?? '',
    getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
    getWordAtPosition: (pos: { lineNumber: number; column: number }) => {
      const line = lines[pos.lineNumber - 1] ?? '';
      const re = /\w+/g;
      let w: RegExpExecArray | null;
      while ((w = re.exec(line)) !== null) {
        if (pos.column >= w.index + 1 && pos.column <= w.index + w[0].length + 1) {
          return { word: w[0], startColumn: w.index + 1, endColumn: w.index + w[0].length + 1 };
        }
      }
      return null;
    },
  };
  setCsxModelCallerSurface(m, surface);
  return m;
}

const endOf = (text: string) => {
  const lines = text.split('\n');
  return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
};

function labelsAfterDot(provider: Provider, text: string, surface: ScriptCallerSurface | undefined): string[] {
  const result = provider.provideCompletionItems!(model(text, surface), endOf(text));
  return result.suggestions.map((s: { label: string }) => s.label);
}

const HEAD = [
  'public class IsApproverView : ScriptBase, IConditionMapping',
  '{',
  '    public async Task<bool> Handler(ScriptContext context)',
  '    {',
].join('\n');

const AUTHORED = [
  HEAD,
  '        return await context.Caller.HasRoleAsync("morph-idm.approver");',
  '    }',
  '}',
].join('\n');

/* ── Workflow fixture: a state and a transition with role-based views ── */

const viewRef = (key: string) => ({ key, domain: 'core', flow: 'sys-views', version: '1.0.0' });
const oldRule = { location: './src/IsApproverView.csx', code: encodeScriptCode('// draft', 'B64'), encoding: 'B64' };

function workflow() {
  return {
    key: 'approval',
    flow: 'sys-flows',
    attributes: {
      states: [
        {
          key: 'review',
          views: [{ rule: { ...oldRule }, view: viewRef('approver-form'), loadData: true }, { view: viewRef('read-only') }],
          transitions: [
            {
              key: 'approve',
              target: 'done',
              triggerType: 0,
              views: { views: [{ rule: { ...oldRule }, view: viewRef('approve-form') }, { view: viewRef('approve-basic') }] },
            },
          ],
        },
      ],
    },
  };
}

function viewRuleScript(listField: string, index: number, scriptField: string): ActiveScript {
  return {
    stateKey: 'review',
    listField,
    index,
    scriptField,
    value: oldRule,
    templateType: 'condition',
    label: 'Rule (optional)',
  };
}

describe('role-based view rule (runtime 0.0.105 context.Caller)', () => {
  // The two addresses ViewBindingsSection opens: state views and transition views.
  const stateRule = viewRuleScript('views', 0, 'views[0].rule');
  const transitionRule = viewRuleScript('transitions', 0, 'views[0].rule');

  it('resolves both view-rule addresses to the viewRule surface', () => {
    expect(scriptCallerSurfaceOf(stateRule)).toBe('viewRule');
    expect(scriptCallerSurfaceOf(transitionRule)).toBe('viewRule');
  });

  it('offers Caller and its members while authoring the rule', () => {
    const { dot, hover } = fakeMonaco();
    expect(labelsAfterDot(dot, `${HEAD}\n        return await context.`, 'viewRule')).toContain('Caller');
    expect(labelsAfterDot(dot, `${HEAD}\n        return await context.Caller.`, 'viewRule')).toEqual([
      'HasRoleAsync',
      'RolesAsync',
      'IsAvailable',
      'ResolutionFailed',
      'RolesFromHeader',
    ]);

    // Hover on the authored call names the surface and whose roles answer.
    const line = AUTHORED.split('\n')[4];
    const result = hover.provideHover!(model(AUTHORED, 'viewRule'), { lineNumber: 5, column: line.indexOf('HasRoleAsync') + 2 });
    expect(result.contents[0].value).toContain('ICallerAccessor.HasRoleAsync');
    expect(result.contents[0].value).toContain("In a view rule:** the request's caller");

    // Not offered where the runtime never has a caller; unknown surfaces keep it.
    expect(labelsAfterDot(dot, 'var x = context.', 'taskMapping')).not.toContain('Caller');
    expect(labelsAfterDot(dot, 'var x = context.', undefined)).toContain('Caller');
  });

  describe('while Roslyn is connected', () => {
    afterEach(() => {
      lsp.ready = false;
    });

    it('leaves Caller completions to Roslyn and keeps only the surface note on hover', () => {
      const { dot, hover } = fakeMonaco();
      lsp.ready = true;
      const ctx = labelsAfterDot(dot, `${HEAD}\n        return await context.`, 'viewRule');
      expect(ctx).not.toContain('Caller');
      expect(ctx).toContain('Instance');
      expect(labelsAfterDot(dot, `${HEAD}\n        return await context.Caller.`, 'viewRule')).toEqual([]);

      const line = AUTHORED.split('\n')[4];
      const at = { lineNumber: 5, column: line.indexOf('HasRoleAsync') + 2 };
      expect(hover.provideHover!(model(AUTHORED, 'viewRule'), at).contents[0].value).toBe(
        "**In a view rule:** the request's caller.",
      );
      // No surface known: nothing to add to Roslyn's hover.
      expect(hover.provideHover!(model(AUTHORED, undefined), at)).toBeNull();
    });

    it('still lints: Roslyn cannot tell where the script runs', () => {
      lsp.ready = true;
      expect(validateCsxScript(AUTHORED, 'condition', 'taskMapping').filter((m) => m.message.includes('Caller'))).toHaveLength(1);
    });
  });

  it('lints the authored rule clean on a view rule and flags it in a task mapping', () => {
    const callerIssues = (surface: ScriptCallerSurface) =>
      validateCsxScript(AUTHORED, 'condition', surface).filter((m) => m.message.includes('Caller'));
    expect(callerIssues('viewRule')).toEqual([]);
    expect(callerIssues('taskMapping')).toHaveLength(1);
  });

  it.each([
    ['state views', stateRule, (wf: ReturnType<typeof workflow>) => wf.attributes.states[0].views[0]],
    ['transition views', transitionRule, (wf: ReturnType<typeof workflow>) => wf.attributes.states[0].transitions[0].views.views[0]],
  ])('round-trips the rule unchanged (%s)', (_label, script, entryOf) => {
    const value = { ...oldRule, code: encodeScriptCode(AUTHORED, 'B64') };
    const draft = workflow();
    applyScriptValueToWorkflow(draft, script, value);

    // Only the rule changed; the binding and every sibling keep their shape.
    const expected = workflow();
    entryOf(expected).rule = value;
    expect(draft).toEqual(expected);

    // Serialized and read back, the script decodes to exactly what was authored.
    const reread = JSON.parse(JSON.stringify(draft)) as ReturnType<typeof workflow>;
    const rule = entryOf(reread).rule!;
    expect(decodeScriptCode(rule.code, rule.encoding)).toBe(AUTHORED);

    // Re-opening and saving without edits is a no-op.
    applyScriptValueToWorkflow(reread, { ...script, value: rule }, rule);
    expect(reread).toEqual(draft);
  });
});
