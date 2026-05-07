import type { VnextWorkflow } from './Conversion';

export interface SearchItem {
  kind: 'state' | 'transition';
  /** React Flow node or edge id */
  id: string;
  key: string;
  label: string;
  stateType?: number;
  subType?: number;
  /** For transitions: the source state key */
  sourceStateKey?: string;
  /** For transitions: the target state key */
  targetStateKey?: string;
}

function getLabel(
  labels?: Array<{ language: string; label: string }>,
  fallback?: Array<{ language: string; label: string }>,
  key?: string,
): string {
  const list = labels || fallback;
  if (list?.length) {
    const en = list.find((l) => l.language === 'en');
    return en?.label || list[0].label || key || '';
  }
  return key || '';
}

/**
 * Build a flat searchable index from workflow JSON.
 * IDs follow the same convention as `workflowToReactFlow` in Conversion.ts.
 */
export function buildCanvasSearchIndex(
  workflowJson: Record<string, unknown> | null,
): SearchItem[] {
  if (!workflowJson) return [];

  const attrs = (workflowJson as any)?.attributes;
  if (!attrs) return [];

  const items: SearchItem[] = [];
  const states: any[] = attrs.states ?? [];

  for (const state of states) {
    const stateLabel = getLabel(state.labels, state.label, state.key);

    items.push({
      kind: 'state',
      id: state.key,
      key: state.key,
      label: stateLabel,
      stateType: state.stateType,
      subType: state.subType ?? 0,
    });

    const transitions: any[] = state.transitions ?? [];
    for (const t of transitions) {
      const target = t.target || t.to || '';
      const tLabel = getLabel(t.labels, t.label, t.key);

      const isSelfKeyword = target === '$self';
      let edgeId: string;
      if (isSelfKeyword) {
        const virtualId = `${state.key}::$self::${t.key}`;
        edgeId = `${state.key}->${virtualId}::${t.key}`;
      } else {
        edgeId = `${state.key}->${target}::${t.key}`;
      }

      items.push({
        kind: 'transition',
        id: edgeId,
        key: t.key,
        label: tLabel,
        sourceStateKey: state.key,
        targetStateKey: isSelfKeyword ? state.key : target,
      });
    }
  }

  return items;
}
