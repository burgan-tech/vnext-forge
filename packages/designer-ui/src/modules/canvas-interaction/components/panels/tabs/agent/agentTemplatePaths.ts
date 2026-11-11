import { useEffect, useState } from 'react';

import {
  defaultSchemaComponentLoaderDeps,
  loadSchemaComponent,
  readSchemaReference,
} from '../../../../../vnext-workspace/loadSchemaComponent';

/**
 * Placeholder roots of the runtime's `AgentTemplateRenderer` (vnext#1105):
 * prompt templates, seed message content, `memory.key` and (without braces)
 * `prompt.context` paths.
 */
export const TEMPLATE_FIXED_PATHS = ['body.', 'instance.id', 'instance.key', 'state'] as const;

const MAX_PATHS = 400;
const MAX_DEPTH = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * `data.*` paths of a JSON schema root: every property, nested objects
 * (`data.customer.name`) and the first element of arrays
 * (`data.items[0].name`), in schema order.
 */
export function schemaDataPaths(schemaRoot: unknown): string[] {
  const out: string[] = [];
  const walk = (node: Record<string, unknown>, prefix: string, depth: number) => {
    if (depth > MAX_DEPTH || out.length >= MAX_PATHS) return;
    if (!isRecord(node.properties)) return;
    for (const [name, child] of Object.entries(node.properties)) {
      if (out.length >= MAX_PATHS) return;
      const path = `${prefix}.${name}`;
      out.push(path);
      if (!isRecord(child)) continue;
      if (isRecord(child.properties)) walk(child, path, depth + 1);
      if (isRecord(child.items)) {
        out.push(`${path}[0]`);
        walk(child.items, `${path}[0]`, depth + 1);
      }
    }
  };
  if (isRecord(schemaRoot)) walk(schemaRoot, 'data', 0);
  return out;
}

/** The open `{{ …` token before the caret: its text and where it starts, or `null`. */
export function openPlaceholderAt(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open < 0 || before.slice(open).includes('}}')) return null;
  const raw = before.slice(open + 2);
  if (/[\n{}]/.test(raw)) return null;
  return { query: raw.trimStart(), start: open + 2 + (raw.length - raw.trimStart().length) };
}

/**
 * Replaces the open placeholder token (from `start` to `caret`) with `path`.
 * A complete path is closed with ` }}` (unless `}}` already follows); a root
 * prefix such as `body.` stays open for more typing.
 */
export function insertTemplatePath(
  text: string,
  start: number,
  caret: number,
  path: string,
): { text: string; caret: number } {
  let before = text.slice(0, start);
  if (before.endsWith('{{')) before += ' ';
  let after = text.slice(caret);
  let insertText = path;
  if (!path.endsWith('.')) {
    if (/^\s*}}/.test(after)) {
      after = after.replace(/^\s*/, '');
      insertText = `${path} `;
    } else {
      insertText = `${path} }}`;
    }
  }
  return { text: before + insertText + after, caret: before.length + insertText.length };
}

/** Suggestions for a typed prefix (case-insensitive, prefix matches first). */
export function filterTemplatePaths(paths: readonly string[], query: string, limit = 12): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return paths.slice(0, limit);
  const starts = paths.filter((p) => p.toLowerCase().startsWith(q));
  const contains = paths.filter((p) => !p.toLowerCase().startsWith(q) && p.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Template paths for the workflow being edited: the fixed roots plus the
 * `data.*` paths of its master schema (`attributes.schema`), when the schema
 * component is in the project. Quietly only the fixed roots otherwise.
 */
export function useTemplatePaths(projectId: string | undefined, workflowJson: unknown): string[] {
  const attributes = isRecord(workflowJson) && isRecord(workflowJson.attributes) ? workflowJson.attributes : undefined;
  const ref = readSchemaReference(attributes?.schema);
  const refKey = ref?.key;
  const refDomain = ref?.domain;
  const [dataPaths, setDataPaths] = useState<string[]>([]);

  useEffect(() => {
    setDataPaths([]);
    if (!projectId || !refKey) return;
    const ref = { key: refKey, ...(refDomain ? { domain: refDomain } : {}) };
    let cancelled = false;
    void loadSchemaComponent(projectId, ref, defaultSchemaComponentLoaderDeps).then((component) => {
      if (cancelled) return;
      const componentAttributes = component && isRecord(component.attributes) ? component.attributes : undefined;
      setDataPaths(schemaDataPaths(componentAttributes?.schema));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, refKey, refDomain]);

  return ['data', ...dataPaths, ...TEMPLATE_FIXED_PATHS];
}
