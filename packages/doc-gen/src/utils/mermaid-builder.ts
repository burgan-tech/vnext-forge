import { escapeMermaid, escapeMermaidLabel } from './markdown-helpers.js';

interface StateEntry {
  key: string;
  stateType?: number;
  subType?: number;
  transitions?: TransitionEntry[];
  labels?: { language: string; label: string }[];
}

interface TransitionEntry {
  key: string;
  target?: string;
  triggerType?: number;
  labels?: { language: string; label: string }[];
}

interface WorkflowJson {
  attributes?: {
    startTransition?: { key?: string; target?: string };
    states?: StateEntry[];
    sharedTransitions?: SharedTransitionEntry[];
    cancel?: { key?: string; target?: string } | null;
    exit?: { key?: string; target?: string } | null;
  };
}

interface SharedTransitionEntry {
  key: string;
  target?: string;
  availableIn?: string[];
  labels?: { language: string; label: string }[];
}

const STATE_TYPE_LABELS: Record<number, string> = {
  1: 'Initial',
  2: 'Intermediate',
  3: 'Final',
  4: 'SubFlow',
  5: 'Wizard',
};

function safeId(key: string): string {
  return escapeMermaid(key);
}

function resolveLabel(
  entries: { language: string; label: string }[] | undefined,
): string | null {
  if (!entries?.length) return null;
  const en = entries.find((e) => e.language === 'en-US' || e.language === 'en');
  return en?.label ?? entries[0]?.label ?? null;
}

export function buildStateDiagram(workflowJson: unknown): string {
  const wf = workflowJson as WorkflowJson;
  const attrs = wf.attributes;
  if (!attrs?.states?.length) return '';

  const diagramLines: string[] = ['stateDiagram-v2'];

  for (const state of attrs.states) {
    const id = safeId(state.key);
    const label = resolveLabel(state.labels) ?? state.key;
    const typeTag = STATE_TYPE_LABELS[state.stateType ?? 2] ?? '';
    const rawDisplay = typeTag ? `${label} (${typeTag})` : label;
    const displayLabel = escapeMermaidLabel(rawDisplay);
    diagramLines.push(`    ${id}: ${displayLabel}`);
  }

  const startTarget = attrs.startTransition?.target;
  if (startTarget) {
    diagramLines.push(`    [*] --> ${safeId(startTarget)}`);
  }

  for (const state of attrs.states) {
    if (state.stateType === 3) {
      diagramLines.push(`    ${safeId(state.key)} --> [*]`);
    }

    for (const tr of state.transitions ?? []) {
      if (!tr.target || tr.target === '$self') continue;
      const trLabel = escapeMermaidLabel(resolveLabel(tr.labels) ?? tr.key);
      diagramLines.push(
        `    ${safeId(state.key)} --> ${safeId(tr.target)}: ${trLabel}`,
      );
    }
  }

  for (const st of attrs.sharedTransitions ?? []) {
    if (!st.target) continue;
    for (const source of st.availableIn ?? []) {
      const trLabel = escapeMermaidLabel(resolveLabel(st.labels) ?? st.key);
      diagramLines.push(
        `    ${safeId(source)} --> ${safeId(st.target)}: ${trLabel}`,
      );
    }
  }

  if (attrs.cancel?.target) {
    const cancelTarget = attrs.cancel.target === '$self' ? null : attrs.cancel.target;
    if (cancelTarget) {
      for (const state of attrs.states) {
        if (state.stateType !== 3) {
          diagramLines.push(
            `    ${safeId(state.key)} --> ${safeId(cancelTarget)}: Cancel`,
          );
        }
      }
    }
  }

  return diagramLines.join('\n');
}
