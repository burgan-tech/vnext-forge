import type { Annotations } from '@vnext-forge-studio/vnext-types';

/**
 * Writers shared by the workflow timeout section and the subflow timeout
 * override editor. Both hold a `workflowTimeout`; empty values drop their key
 * so the saved JSON stays minimal.
 */
export interface TimeoutFieldHolder {
  annotations?: Annotations | null;
  _comment?: string;
}

export function setTimeoutAnnotations(t: TimeoutFieldHolder, next: Annotations | undefined): void {
  if (next && Object.keys(next).length > 0) t.annotations = next;
  else delete t.annotations;
}

export function setTimeoutComment(t: TimeoutFieldHolder, text: string): void {
  if (text.trim() === '') delete t._comment;
  else t._comment = text;
}
