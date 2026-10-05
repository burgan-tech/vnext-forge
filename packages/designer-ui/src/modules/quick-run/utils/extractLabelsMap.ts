import type { FlowLabelsMap } from '../types/quickrun.types';

interface LabelEntry {
  language: string;
  label: string;
}

interface TransitionEntry {
  key: string;
  labels?: LabelEntry[];
}

interface StateEntry {
  key: string;
  labels?: LabelEntry[];
  transitions?: TransitionEntry[];
}

interface FlowJson {
  attributes?: {
    labels?: LabelEntry[];
    startTransition?: TransitionEntry;
    states?: StateEntry[];
    sharedTransitions?: TransitionEntry[];
    cancel?: TransitionEntry;
    exit?: TransitionEntry;
    updateData?: TransitionEntry;
    timeout?: TransitionEntry;
  };
}

/** en-US first, otherwise the first entry. */
export function pickLabel(entries?: readonly LabelEntry[] | null): string | null {
  if (!entries?.length) return null;
  const enUs = entries.find((e) => e.language === 'en-US');
  return enUs?.label ?? entries[0]?.label ?? null;
}

export function stateTransitionLabelKey(state: string, transition: string): string {
  return `${state}/${transition}`;
}

export function extractLabelsMap(flowJson: unknown): FlowLabelsMap {
  const wf = flowJson as FlowJson;
  const attrs = wf.attributes;
  const workflowLabel = pickLabel(attrs?.labels);
  const states: Record<string, string> = {};
  const transitions: Record<string, string> = {};
  const stateTransitions: Record<string, string> = {};

  const addTransition = (tr: TransitionEntry | undefined) => {
    if (!tr?.key) return;
    const label = pickLabel(tr.labels);
    if (label) transitions[tr.key] = label;
  };

  for (const state of attrs?.states ?? []) {
    const sLabel = pickLabel(state.labels);
    if (sLabel) states[state.key] = sLabel;
    for (const tr of state.transitions ?? []) {
      const tLabel = pickLabel(tr.labels);
      if (!tLabel) continue;
      transitions[tr.key] = tLabel;
      stateTransitions[stateTransitionLabelKey(state.key, tr.key)] = tLabel;
    }
  }

  for (const tr of attrs?.sharedTransitions ?? []) addTransition(tr);
  addTransition(attrs?.cancel);
  addTransition(attrs?.exit);
  addTransition(attrs?.updateData);
  addTransition(attrs?.timeout);
  addTransition(attrs?.startTransition);

  return { workflowLabel, states, transitions, stateTransitions };
}
