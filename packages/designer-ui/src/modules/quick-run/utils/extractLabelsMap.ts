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
  };
}

function resolveLabel(entries?: LabelEntry[]): string | null {
  if (!entries?.length) return null;
  const enUs = entries.find((e) => e.language === 'en-US');
  return enUs?.label ?? entries[0]?.label ?? null;
}

export function extractLabelsMap(flowJson: unknown): FlowLabelsMap {
  const wf = flowJson as FlowJson;
  const workflowLabel = resolveLabel(wf.attributes?.labels);
  const states: Record<string, string> = {};
  const transitions: Record<string, string> = {};

  for (const state of wf.attributes?.states ?? []) {
    const sLabel = resolveLabel(state.labels);
    if (sLabel) states[state.key] = sLabel;
    for (const tr of state.transitions ?? []) {
      const tLabel = resolveLabel(tr.labels);
      if (tLabel) transitions[tr.key] = tLabel;
    }
  }

  const startTr = wf.attributes?.startTransition;
  if (startTr) {
    const stLabel = resolveLabel(startTr.labels);
    if (stLabel) transitions[startTr.key] = stLabel;
  }

  return { workflowLabel, states, transitions };
}
