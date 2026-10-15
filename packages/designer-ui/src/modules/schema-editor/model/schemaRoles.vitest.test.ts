import { describe, expect, it } from 'vitest';

import {
  classifySchemaType,
  roleAllowsKeyword,
  roleKeywordViolation,
  rolesAllowingKeyword,
  schemaRoleSlotMismatch,
  schemaRolesEnforced,
} from './schemaRoles';

describe('schemaRolesEnforced', () => {
  it('is on from 0.0.56 and for an unknown pin', () => {
    expect(schemaRolesEnforced('0.0.56')).toBe(true);
    expect(schemaRolesEnforced('0.1.0')).toBe(true);
    expect(schemaRolesEnforced(undefined)).toBe(true);
    expect(schemaRolesEnforced('0.0.55')).toBe(false);
  });
});

describe('classifySchemaType', () => {
  it('separates none, roles and legacy values', () => {
    expect(classifySchemaType(undefined)).toEqual({ kind: 'none' });
    expect(classifySchemaType('')).toEqual({ kind: 'none' });
    expect(classifySchemaType('function')).toEqual({ kind: 'role', role: 'function' });
    expect(classifySchemaType('MASTER')).toEqual({ kind: 'legacy', value: 'MASTER' });
    expect(classifySchemaType('schema')).toEqual({ kind: 'legacy', value: 'schema' });
  });
});

describe('roleAllowsKeyword', () => {
  it('keeps record-only annotations on master', () => {
    for (const key of ['x-storage', 'x-computed', 'x-roles', 'x-masking', 'x-filterOperators', 'x-sortable', 'x-indexed']) {
      expect(roleAllowsKeyword('master', key)).toBe(true);
      expect(roleAllowsKeyword('transition', key)).toBe(false);
      expect(roleAllowsKeyword('component', key)).toBe(false);
    }
  });

  it('accepts base annotations and view hints everywhere', () => {
    for (const role of ['master', 'transition', 'component', 'function'] as const) {
      for (const key of ['x-labels', 'x-order', 'x-helpText', 'x-lov', 'x-conditional']) {
        expect(roleAllowsKeyword(role, key)).toBe(true);
      }
    }
  });

  it('places x-context-source on input roles and x-binding on component', () => {
    expect(roleAllowsKeyword('function', 'x-context-source')).toBe(true);
    expect(roleAllowsKeyword('master', 'x-context-source')).toBe(false);
    expect(roleAllowsKeyword('component', 'x-binding')).toBe(true);
    expect(roleAllowsKeyword('transition', 'x-binding')).toBe(false);
  });

  it('lets input roles carry only client encryption', () => {
    expect(roleAllowsKeyword('transition', 'x-encryption')).toBe(true);
    expect(roleAllowsKeyword('transition', 'x-encryption', { source: 'client', key: 'k', algorithm: 'RSA-OAEP-256' })).toBe(true);
    expect(roleAllowsKeyword('transition', 'x-encryption', { type: 'encrypt' })).toBe(false);
    expect(roleAllowsKeyword('master', 'x-encryption', { type: 'encrypt' })).toBe(true);
    expect(roleAllowsKeyword('component', 'x-encryption')).toBe(false);
  });

  it('refuses only x-indexed on an untyped schema', () => {
    expect(roleAllowsKeyword(undefined, 'x-indexed')).toBe(false);
    expect(roleAllowsKeyword(undefined, 'x-storage')).toBe(true);
    expect(roleAllowsKeyword(undefined, 'x-binding')).toBe(true);
  });
});

describe('roleKeywordViolation', () => {
  it('names the roles that accept the annotation', () => {
    expect(roleKeywordViolation('transition', 'x-roles', [])).toBe(
      'x-roles is not allowed on a transition schema. Allowed on: master.',
    );
    expect(rolesAllowingKeyword('x-context-source')).toEqual(['transition', 'function']);
  });

  it('explains the client-only encryption rule', () => {
    expect(roleKeywordViolation('function', 'x-encryption', { type: 'hash' })).toContain('client encryption');
  });

  it('returns null when accepted', () => {
    expect(roleKeywordViolation('master', 'x-storage', { binding: 'b' })).toBeNull();
  });
});

describe('schemaRoleSlotMismatch', () => {
  it('accepts a matching role and an untyped schema', () => {
    expect(schemaRoleSlotMismatch('transition', 'transition')).toBeNull();
    expect(schemaRoleSlotMismatch(undefined, 'master')).toBeNull();
  });

  it('explains a role used in the wrong slot', () => {
    expect(schemaRoleSlotMismatch('master', 'transition')).toContain('has the master role but is used as a transition body');
  });

  it('asks to replace a legacy type with the slot role', () => {
    expect(schemaRoleSlotMismatch('workflow', 'master')).toContain('"workflow" is a legacy value; set it to master');
  });
});

describe('removed annotations', () => {
  it('are refused in every role and on untyped schemas', () => {
    expect(roleKeywordViolation(undefined, 'x-persistance', {})).toContain('use x-storage');
    expect(roleKeywordViolation('master', 'x-encrypt', {})).toContain('use x-encryption');
  });
});
