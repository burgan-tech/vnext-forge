/**
 * Workflow `attributes.rowSecurity` (vnext-schema 0.0.58 / runtime 0.0.102):
 * role-keyed row filters ANDed into the instance list, the instance GET and
 * the GetInstances / GetInstance tasks. A flow that declares it is deny by
 * default — there is no `default` rule.
 */
export interface RowSecurityRule {
  /** Static role names, or one of {@link ROW_SECURITY_IDENTITY_ROLES}. Never both in one rule. */
  roles: string[];
  /** List-engine filter JSON. Absent: every row (static rule) / the caller's own rows (identity rule). */
  filter?: Record<string, unknown>;
}

export interface RowSecurity {
  rules: RowSecurityRule[];
}

export const ROW_SECURITY_IDENTITY_ROLES = ['$InstanceStarter', '$InstanceBehalfOfStarter'] as const;

/** Parameter prefixes a filter value may reference (case-sensitive). */
export const ROW_SECURITY_PARAMETER_PREFIXES = [
  '$.context.Headers.',
  '$.context.QueryParameters.',
  '$.context.CurrentUser.',
] as const;

export const ROW_SECURITY_CURRENT_USER_FIELDS = ['ActorUserName', 'ActorUserId', 'UserName', 'Position'] as const;

/**
 * Publish codes mirrored from the runtime (`docs/domain/row-security.md`
 * § Publish validation). Only the schema-independent ones: the checks that
 * need the master schema (RS-E08/E14/E15/E18, RS-W1/W2a/W2b/W5) stay with the
 * runtime publish.
 */
export type RowSecurityIssueCode =
  | 'RS-E01'
  | 'RS-E02'
  | 'RS-E04'
  | 'RS-E05'
  | 'RS-E06'
  | 'RS-E07'
  | 'RS-E10'
  | 'RS-E11'
  | 'RS-E12'
  | 'RS-E13'
  | 'RS-E16'
  | 'RS-E17'
  | 'RS-W2c'
  | 'RS-W4'
  | 'RS-W7';

export interface RowSecurityIssue {
  code: RowSecurityIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** Index into `rules`, when the issue belongs to one rule. */
  ruleIndex?: number;
  /** State the issue points at (RS-W7). */
  stateKey?: string;
}

const LOGICAL = new Set(['and', 'or', 'not']);
const OPERATORS = new Set([
  'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull', 'includes',
]);
const ARRAY_OPERATORS = new Set(['in', 'nin', 'between']);
const PATTERN_OPERATORS = new Set(['like', 'match', 'startswith', 'endswith']);
const NOT_A_FILTER_MEMBER = ['sort', 'orderBy', 'groupBy', 'aggregations'];
const IDENTITY_COLUMN: Record<string, string> = {
  $InstanceStarter: 'createdBy',
  $InstanceBehalfOfStarter: 'createdByBehalfOf',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isRowSecurityIdentityRole(role: string): boolean {
  return (ROW_SECURITY_IDENTITY_ROLES as readonly string[]).includes(role);
}

/** Why a `$.context.` value is malformed (RS-E07), or `undefined` when it is a valid parameter. */
export function rowSecurityParameterError(value: string): string | undefined {
  const headerOrQuery = /^\$\.context\.(Headers|QueryParameters)\.(.+)$/.exec(value);
  if (headerOrQuery) return headerOrQuery[2].trim() ? undefined : `"${value}" names no ${headerOrQuery[1] === 'Headers' ? 'header' : 'query parameter'}.`;
  const currentUser = /^\$\.context\.CurrentUser\.(.*)$/.exec(value);
  if (currentUser) {
    return (ROW_SECURITY_CURRENT_USER_FIELDS as readonly string[]).includes(currentUser[1])
      ? undefined
      : `"${value}": CurrentUser has ${ROW_SECURITY_CURRENT_USER_FIELDS.join(', ')}.`;
  }
  return `"${value}": parameters read $.context.Headers.*, $.context.QueryParameters.* or $.context.CurrentUser.*.`;
}

interface WalkContext {
  ruleIndex: number;
  issues: RowSecurityIssue[];
  operators: Set<string>;
}

function walkFilter(node: unknown, column: string | null, operator: string | null, ctx: WalkContext): void {
  const push = (code: RowSecurityIssueCode, message: string) =>
    ctx.issues.push({ code, severity: code.startsWith('RS-W') ? 'warning' : 'error', message, ruleIndex: ctx.ruleIndex });
  const rule = `Rule ${ctx.ruleIndex + 1}`;

  if (Array.isArray(node)) {
    for (const item of node) walkFilter(item, column, operator, ctx);
    return;
  }

  if (typeof node === 'string') {
    checkValue(node, column, operator, push, rule);
    return;
  }

  if (!isRecord(node)) return;

  if ('$param' in node) {
    const param = node.$param;
    if (typeof param === 'string') checkValue(param, column, operator, push, rule);
    if ('split' in node && operator !== null && !ARRAY_OPERATORS.has(operator)) {
      push('RS-E11', `${rule}: "split" only applies to in, nin and between, not "${operator}".`);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (LOGICAL.has(key)) {
      walkFilter(value, column, operator, ctx);
    } else if (OPERATORS.has(key)) {
      ctx.operators.add(key);
      if (key === 'between' && Array.isArray(value) && value.length !== 2) {
        push('RS-E10', `${rule}: between takes exactly two operands.`);
      }
      walkFilter(value, column, key, ctx);
    } else {
      walkFilter(value, key, null, ctx);
    }
  }
}

function checkValue(
  value: string,
  column: string | null,
  operator: string | null,
  push: (code: RowSecurityIssueCode, message: string) => void,
  rule: string,
): void {
  const identityColumn = IDENTITY_COLUMN[value];
  if (identityColumn) {
    if (column !== identityColumn) push('RS-E06', `${rule}: ${value} is only valid as the value of ${identityColumn}.`);
    return;
  }
  if (value.startsWith('$.context.')) {
    const error = rowSecurityParameterError(value);
    if (error) push('RS-E07', `${rule}: ${error}`);
    if (operator !== null && (PATTERN_OPERATORS.has(operator) || operator === 'includes')) {
      push('RS-E17', `${rule}: a parameter cannot feed "${operator}" (a caller value would change the pattern).`);
    }
    return;
  }
  if (value.toLowerCase().startsWith('$.context.')) {
    push('RS-W4', `${rule}: "${value}" is not written as $.context. (case-sensitive), so it is compared as a literal.`);
  }
}

/** Mirrors the runtime's schema-independent `rowSecurity` publish checks. Empty when the flow declares none. */
export function rowSecurityIssues(workflowJson: unknown): RowSecurityIssue[] {
  const attributes = isRecord(workflowJson) && isRecord(workflowJson.attributes) ? workflowJson.attributes : undefined;
  if (!attributes || attributes.rowSecurity === undefined || attributes.rowSecurity === null) return [];
  const rowSecurity = attributes.rowSecurity;
  const issues: RowSecurityIssue[] = [];
  const error = (code: RowSecurityIssueCode, message: string, ruleIndex?: number) =>
    issues.push({ code, severity: 'error', message, ...(ruleIndex !== undefined ? { ruleIndex } : {}) });

  const flowKey = isRecord(workflowJson) && typeof workflowJson.key === 'string' ? workflowJson.key : '';
  if (flowKey.startsWith('sys-')) error('RS-E16', 'System (sys-*) flows cannot declare row security.');

  if (!isRecord(rowSecurity)) {
    error('RS-E12', 'rowSecurity must be an object with a rules list.');
    return issues;
  }
  const extra = Object.keys(rowSecurity).filter((key) => key !== 'rules');
  if (extra.length > 0) error('RS-E12', `rowSecurity only has "rules"; remove ${extra.map((k) => `"${k}"`).join(', ')}.`);
  const rules = rowSecurity.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    error('RS-E12', 'rowSecurity needs at least one rule.');
    return issues;
  }

  rules.forEach((rule, ruleIndex) => {
    const label = `Rule ${ruleIndex + 1}`;
    if (!isRecord(rule)) {
      error('RS-E12', `${label} must be an object with roles and an optional filter.`, ruleIndex);
      return;
    }
    const unknown = Object.keys(rule).filter((key) => key !== 'roles' && key !== 'filter');
    if (unknown.length > 0) error('RS-E12', `${label} only has "roles" and "filter"; remove ${unknown.map((k) => `"${k}"`).join(', ')}.`, ruleIndex);

    const roles = Array.isArray(rule.roles) ? rule.roles : [];
    if (roles.length === 0 || roles.some((role) => typeof role !== 'string' || role.trim() === '')) {
      error('RS-E12', `${label} needs at least one role, and every role must be a non-empty name.`, ruleIndex);
    }
    let hasStatic = false;
    let hasIdentity = false;
    for (const role of roles) {
      if (typeof role !== 'string' || role === '') continue;
      if (isRowSecurityIdentityRole(role)) {
        hasIdentity = true;
      } else if (role === '$PreviousUser' || role === '$PreviousBehalfOfUser') {
        error('RS-E01', `${label}: ${role} cannot be a row-security role.`, ruleIndex);
      } else if (/^\$(user|userBehalfOf|role)\./.test(role)) {
        error('RS-E02', `${label}: dynamic grants (${role}) cannot be row-security roles.`, ruleIndex);
      } else if (role.startsWith('$')) {
        error('RS-E05', `${label}: ${role} is not a row-security role; use a static role, $InstanceStarter or $InstanceBehalfOfStarter.`, ruleIndex);
      } else {
        hasStatic = true;
      }
    }
    if (hasStatic && hasIdentity) {
      error('RS-E04', `${label} mixes static roles with ${ROW_SECURITY_IDENTITY_ROLES.join(' / ')}; split it into two rules.`, ruleIndex);
    }

    if (rule.filter === undefined) return;
    if (!isRecord(rule.filter)) {
      error('RS-E12', `${label}: filter must be a JSON object.`, ruleIndex);
      return;
    }
    const forbidden = NOT_A_FILTER_MEMBER.filter((key) => key in (rule.filter as Record<string, unknown>));
    if (forbidden.length > 0) error('RS-E13', `${label}: ${forbidden.join(', ')} cannot be part of a row filter.`, ruleIndex);

    const ctx: WalkContext = { ruleIndex, issues, operators: new Set() };
    walkFilter(rule.filter, null, null, ctx);
    const comparisons = [...ctx.operators];
    if (comparisons.length > 0 && comparisons.every((op) => op === 'ne' || op === 'nin')) {
      issues.push({
        code: 'RS-W2c',
        severity: 'warning',
        ruleIndex,
        message: `${label} only uses ne / nin, which match almost every row; prefer a narrowing operator.`,
      });
    }
  });

  const states = Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
  for (const state of states) {
    if (!isRecord(state.subFlow)) continue;
    const stateKey = typeof state.key === 'string' ? state.key : '';
    issues.push({
      code: 'RS-W7',
      severity: 'warning',
      stateKey,
      message: `State "${stateKey}" starts a SubFlow; its instances are read through the child flow's own rowSecurity, not this one.`,
    });
  }
  return issues;
}
