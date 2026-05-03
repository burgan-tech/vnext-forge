import { table } from './markdown-helpers.js';

interface WorkflowAttrs {
  cancel?: unknown | null;
  exit?: unknown | null;
  updateData?: unknown | null;
  schema?: { schema?: unknown } | null;
  functions?: unknown[] | null;
  extensions?: unknown[] | null;
  features?: unknown[] | null;
  timeout?: unknown | null;
  errorBoundary?: unknown | null;
  sharedTransitions?: unknown[] | null;
  queryRoles?: unknown[] | null;
}

function check(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) return value.length > 0 ? 'Yes' : '-';
  return 'Yes';
}

export function buildFeatureMatrix(attrs: unknown): string {
  const a = (attrs ?? {}) as WorkflowAttrs;

  const headers = ['Feature', 'Status'];
  const rows: string[][] = [
    ['Cancel Transition', check(a.cancel)],
    ['Exit Transition', check(a.exit)],
    ['Update Data Transition', check(a.updateData)],
    ['Master Schema', check(a.schema?.schema)],
    ['Functions', check(a.functions)],
    ['Extensions', check(a.extensions ?? a.features)],
    ['Timeout', check(a.timeout)],
    ['Error Boundary', check(a.errorBoundary)],
    ['Shared Transitions', check(a.sharedTransitions)],
    ['Query Roles', check(a.queryRoles)],
  ];

  return table(headers, rows);
}
