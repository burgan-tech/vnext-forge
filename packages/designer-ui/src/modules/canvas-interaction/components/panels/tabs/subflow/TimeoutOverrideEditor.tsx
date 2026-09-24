import { useState } from 'react';
import type { MappingCode, TimeoutTransition } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { EditableInput, IconTrash } from '../PropertyPanelShared';
import { setTimeoutAnnotations, setTimeoutComment } from '../shared/timeoutFields';
import { TransitionAnnotationsSection } from '../transition/TransitionAnnotationsSection';
import { KeyCombobox } from './KeyCombobox';

export interface TimeoutOverrideEditorProps {
  timeout: TimeoutTransition | undefined;
  /** Parent state owning the subflow — addresses the mapping script. */
  stateKey: string;
  /** Child state keys offered as targets; free text stays allowed. */
  childStateKeys: string[];
  onUpdate: (updater: (t: TimeoutTransition) => void) => void;
  onClear: () => void;
}

const LABEL = 'text-[10px] font-medium text-muted-foreground mb-0.5 block';

export function TimeoutOverrideEditor({
  timeout,
  stateKey,
  childStateKeys,
  onUpdate,
  onClear,
}: TimeoutOverrideEditorProps) {
  const [open, setOpen] = useState(!!timeout?.key);
  const configured = !!timeout?.key;
  const mapping = timeout?.mapping;

  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">
          Timeout override
        </span>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
          {configured ? 'Configured' : 'Not set'}
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-1.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Replaces the child workflow timeout as a whole, annotations included.
          </p>
          <div>
            <label className={LABEL}>Key</label>
            <EditableInput
              value={timeout?.key ?? ''}
              onChange={(v) =>
                onUpdate((t) => {
                  t.key = v;
                })
              }
              mono
              placeholder="e.g. child-abandoned"
            />
          </div>
          <div>
            <label className={LABEL}>Target</label>
            <KeyCombobox
              value={timeout?.target ?? ''}
              options={childStateKeys}
              onCommit={(v) =>
                onUpdate((t) => {
                  t.target = v;
                })
              }
              ariaLabel="Timeout target state"
              placeholder="e.g. child-timedout"
            />
          </div>
          <div>
            <label className={LABEL}>Version strategy</label>
            <EditableInput
              value={timeout?.versionStrategy ?? ''}
              onChange={(v) =>
                onUpdate((t) => {
                  t.versionStrategy = v || undefined;
                })
              }
              placeholder="e.g. Minor"
            />
          </div>
          <div>
            <label className={LABEL}>Timer reset</label>
            <EditableInput
              value={timeout?.timer?.reset ?? ''}
              onChange={(v) =>
                onUpdate((t) => {
                  t.timer ??= {};
                  t.timer.reset = v || undefined;
                })
              }
              placeholder="e.g. never"
            />
          </div>
          <div>
            <label className={LABEL}>Duration (ISO 8601)</label>
            <EditableInput
              value={timeout?.timer?.duration ?? ''}
              onChange={(v) =>
                onUpdate((t) => {
                  t.timer ??= {};
                  t.timer.duration = v || undefined;
                })
              }
              mono
              placeholder="e.g. PT25M"
            />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              value={timeout?._comment ?? ''}
              onChange={(e) => {
                const text = e.target.value;
                onUpdate((t) => setTimeoutComment(t, text));
              }}
              rows={2}
              aria-label="Timeout override description"
              placeholder="Why the parent overrides the child timeout..."
              className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all resize-y"
            />
          </div>
          <TransitionAnnotationsSection
            annotations={timeout?.annotations ?? undefined}
            onChange={(next) => onUpdate((t) => setTimeoutAnnotations(t, next))}
          />
          <div>
            <label className={LABEL}>Mapping (optional)</label>
            <CsxEditorField
              value={(mapping as ScriptCode | undefined) ?? null}
              onChange={(sc) =>
                onUpdate((t) => {
                  t.mapping = sc as MappingCode;
                })
              }
              onRemove={() =>
                onUpdate((t) => {
                  delete t.mapping;
                })
              }
              templateType="mapping"
              contextName={`${stateKey}-subflow-timeout`}
              label="Timeout mapping"
              stateKey={stateKey}
              listField="subFlow"
              index={0}
              scriptField="overrides.timeout.mapping"
            />
            {mapping && (
              <MappingScriptsSection
                value={mapping.scripts}
                onChange={(scripts) =>
                  onUpdate((t) => {
                    if (!t.mapping) return;
                    if (scripts === undefined) delete t.mapping.scripts;
                    else t.mapping.scripts = scripts;
                  })
                }
              />
            )}
          </div>
          {configured && (
            <button
              type="button"
              onClick={onClear}
              className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors mt-1">
              <IconTrash />
              Clear timeout override
            </button>
          )}
        </div>
      )}
    </div>
  );
}
