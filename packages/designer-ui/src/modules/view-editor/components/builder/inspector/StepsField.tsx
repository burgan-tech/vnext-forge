/**
 * Stepper `steps[]` editor (R12).
 *
 * SDK vocabulary (`view-vocabulary.json` → Stepper → `steps[]`):
 *
 *   {
 *     title:    textContent  // string | { en, tr, ... } — required
 *     subtitle: textContent  // optional
 *     content:  ComponentNode[]  // required, edited via outline/canvas
 *   }
 *
 * This field surfaces a typed editor for the title and subtitle labels
 * (multi-language aware via `MultiLangInput`) and a read-only badge
 * for the step's content children — actual content editing happens
 * through the outline tree and the canvas SDK drop targets so the
 * standard insertion / reorder flow stays consistent.
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { MultiLangInput } from './MultiLangInput';

export interface StepValue {
  title?: unknown;
  subtitle?: unknown;
  content?: unknown[];
  [extra: string]: unknown;
}

export interface StepsFieldProps {
  value: unknown;
  onChange: (next: unknown) => void;
}

function asStepArray(value: unknown): StepValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is StepValue => typeof s === 'object' && s !== null);
}

export function StepsField({ value, onChange }: StepsFieldProps) {
  const steps = asStepArray(value);

  const updateStep = (index: number, patch: Partial<StepValue>): void => {
    const next = steps.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeStep = (index: number): void => {
    const next = steps.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const moveStep = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  };

  const addStep = (): void => {
    onChange([...steps, { title: '', content: [] }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {steps.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          No steps defined. Stepper requires at least 2 steps to render.
        </p>
      ) : null}
      {steps.map((step, i) => {
        const childCount = Array.isArray(step.content) ? step.content.length : 0;
        return (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Step {i + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move step up"
                  disabled={i === 0}
                  onClick={() => moveStep(i, -1)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronUp size={11} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Move step down"
                  disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronDown size={11} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Remove step"
                  onClick={() => removeStep(i)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-errorForeground)]"
                >
                  <Trash2 size={11} aria-hidden />
                </button>
              </div>
            </div>

            <Field label="Title">
              <MultiLangInput
                value={step.title}
                onChange={(next) => updateStep(i, { title: next })}
                placeholder="Step title"
              />
            </Field>
            <Field label="Subtitle">
              <MultiLangInput
                value={step.subtitle}
                onChange={(next) =>
                  updateStep(i, {
                    subtitle: next === '' || next == null ? undefined : next,
                  })
                }
                placeholder="Optional"
              />
            </Field>

            <div className="rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] px-1.5 py-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
              Content: {childCount} {childCount === 1 ? 'child' : 'children'} — edit from the outline / canvas.
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addStep}
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
      >
        <Plus size={10} aria-hidden /> Add step
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-[var(--vscode-foreground)]">{label}</span>
      {children}
    </label>
  );
}
