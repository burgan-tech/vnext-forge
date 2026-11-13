import { describe, expect, it } from 'vitest'

import {
  SCRIPT_CALLER_SURFACES,
  scriptCallerAvailable,
  scriptCallerIssues,
  scriptCallerSurfaceOf,
  type ScriptCallerSurface,
} from '@vnext-forge-studio/vnext-types'

const codes = (code: string, surface?: ScriptCallerSurface) =>
  scriptCallerIssues(code, surface).map((i) => [i.code, i.line, i.column])

const IS_APPROVER = [
  'public class IsApprover : ScriptBase, IConditionMapping',
  '{',
  '    public async Task<bool> Handler(ScriptContext context) =>',
  '        await context.Caller.HasRoleAsync("morph-idm.approver");',
  '}',
].join('\n')

describe('SCRIPT_CALLER_SURFACES (runtime 0.0.105 availability table)', () => {
  it('mirrors the runtime doc', () => {
    const by = (a: string) =>
      (Object.keys(SCRIPT_CALLER_SURFACES) as ScriptCallerSurface[]).filter((s) => SCRIPT_CALLER_SURFACES[s].availability === a)
    expect(by('request')).toEqual(['transitionSchemaRule', 'functionContractRule', 'viewRule'])
    expect(by('callerDriven')).toEqual(['automaticRule', 'timer', 'subFlowMapping'])
    expect(by('unavailable')).toEqual(['taskMapping', 'transitionMapping', 'extension', 'resourceLock', 'eventMapping'])
    expect(scriptCallerAvailable(undefined)).toBe(true)
    expect(scriptCallerAvailable('viewRule')).toBe(true)
    expect(scriptCallerAvailable('eventMapping')).toBe(false)
  })
})

describe('scriptCallerIssues', () => {
  it('accepts a role read on every selection surface', () => {
    for (const surface of ['transitionSchemaRule', 'functionContractRule', 'viewRule'] as const) {
      expect(scriptCallerIssues(IS_APPROVER, surface)).toEqual([])
    }
  })

  it('warns where context.Caller is unavailable, at the Caller token', () => {
    for (const surface of ['taskMapping', 'transitionMapping', 'extension', 'resourceLock', 'eventMapping'] as const) {
      const issues = scriptCallerIssues(IS_APPROVER, surface)
      expect(issues).toMatchObject([{ code: 'caller.unavailable', severity: 'warning', line: 4, column: 23, endColumn: 29 }])
      expect(issues[0].message).toContain(SCRIPT_CALLER_SURFACES[surface].label)
    }
    // Every use is flagged, IsAvailable included: it is always false there.
    expect(codes('if (context.Caller.IsAvailable) { var r = await context.Caller.RolesAsync(); }', 'taskMapping')).toEqual([
      ['caller.unavailable', 1, 13],
      ['caller.unavailable', 1, 57],
    ])
  })

  it('warns on an unguarded role read in automatic rules, timers and SubFlow output mappings', () => {
    for (const surface of ['automaticRule', 'timer', 'subFlowMapping'] as const) {
      expect(codes(IS_APPROVER, surface)).toEqual([['caller.unguarded', 4, 30]])
    }
    const guarded = [
      'public async Task<TimerSchedule> Handler(ScriptContext context)',
      '{',
      '    var vip = context.Caller.IsAvailable && await context.Caller.HasRoleAsync("vip");',
      '    return TimerSchedule.FromDuration(vip ? TimeSpan.FromHours(48) : TimeSpan.FromHours(24));',
      '}',
    ].join('\n')
    expect(scriptCallerIssues(guarded, 'timer')).toEqual([])
    expect(scriptCallerIssues(guarded, 'automaticRule')).toEqual([])
    // Selection surfaces always have a caller: no guard needed.
    expect(scriptCallerIssues(IS_APPROVER, 'viewRule')).toEqual([])
  })

  it('splits a SubFlow mapping into InputHandler (no caller) and OutputHandler (child settler)', () => {
    const code = [
      'public class Sub : ScriptBase, IMapping',
      '{',
      '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
      '    {',
      '        var r = await context.Caller.RolesAsync();',
      '        return new ScriptResponse();',
      '    }',
      '    public async Task<ScriptResponse> OutputHandler(ScriptContext context)',
      '    {',
      '        var ok = context.Caller.IsAvailable && await context.Caller.HasRoleAsync("x");',
      '        return new ScriptResponse();',
      '    }',
      '}',
    ].join('\n')
    expect(codes(code, 'subFlowMapping')).toEqual([['caller.unavailable', 5, 31]])
    expect(scriptCallerIssues(code, 'subFlowMapping')[0].message).toContain('a SubFlow input mapping')
  })

  it('warns on parsing the role header, on any surface', () => {
    expect(codes('var role = context.Headers["role"]?.ToString();')).toEqual([['caller.roleHeader', 1, 20]])
    expect(codes('var role = context.Headers?["Role"];', 'viewRule')).toEqual([['caller.roleHeader', 1, 20]])
    expect(codes('var role = context.Headers?.role;', 'timer')).toEqual([['caller.roleHeader', 1, 20]])
    expect(scriptCallerIssues('var t = context.Headers["authorization"]; var r = data.role;', undefined)).toEqual([])
  })

  it('ignores comments and strings', () => {
    const code = [
      '// await context.Caller.HasRoleAsync("x"); context.Headers["role"]',
      '/* context.Caller.RolesAsync() */',
      'LogInformation("context.Caller.HasRoleAsync and Headers[\\"role\\"]");',
    ].join('\n')
    for (const surface of [undefined, 'taskMapping', 'timer'] as const) expect(scriptCallerIssues(code, surface)).toEqual([])
  })

  it('runs only the role-header check on an unknown surface', () => {
    expect(scriptCallerIssues(IS_APPROVER, undefined)).toEqual([])
  })
})

describe('scriptCallerSurfaceOf (script panel address → surface)', () => {
  const at = (listField: string, scriptField: string) => scriptCallerSurfaceOf({ listField, scriptField })

  it('maps every address the designer opens', () => {
    expect(at('transitions', 'schemas[0].rule')).toBe('transitionSchemaRule')
    expect(at('transitions', 'views[2].rule')).toBe('viewRule')
    expect(at('views', 'views[0].rule')).toBe('viewRule')
    for (const slot of ['functionInputSchema', 'functionOutputSchema', 'functionInputView', 'functionOutputView']) {
      expect(at(slot, 'rule')).toBe('functionContractRule')
    }
    expect(at('transitions', 'rule')).toBe('automaticRule')
    expect(at('transitions', 'condition')).toBe('automaticRule')
    expect(at('transitions', 'timer')).toBe('timer')
    expect(at('subFlow', 'mapping')).toBe('subFlowMapping')
    expect(at('transitions', 'mapping')).toBe('transitionMapping')
    expect(at('timeout', 'mapping')).toBe('transitionMapping')
    expect(at('transitions', 'event.mapping')).toBe('eventMapping')
    expect(at('event', 'mapping')).toBe('eventMapping')
    expect(at('transitions', 'resourceLock.keyExpression')).toBe('resourceLock')
    expect(at('onEntries', 'mapping')).toBe('taskMapping')
    expect(at('onExits', 'mapping')).toBe('taskMapping')
    expect(at('transitions', 'onExecutionTasks.1.mapping')).toBe('taskMapping')
    expect(at('functionOutputMapping', 'mapping')).toBe('taskMapping')
    expect(at('attributes', 'task.mapping')).toBe('taskMapping')
  })

  it('leaves surfaces the runtime table does not cover unknown', () => {
    expect(at('notifications', 'rule')).toBeUndefined()
    expect(at('notifications', 'mapping')).toBeUndefined()
    expect(at('interaction', 'longPoll.rule')).toBeUndefined()
    expect(at('subFlow', 'overrides.timeout.mapping')).toBeUndefined()
    expect(at('attributes', 'output')).toBeUndefined()
    expect(at('attributes', 'config.key')).toBeUndefined()
    expect(at('attributes', 'code')).toBeUndefined()
  })
})
