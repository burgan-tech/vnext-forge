import type { MappingCode, StateNotification } from '@vnext-forge-studio/vnext-types';
import { NotificationType } from '@vnext-forge-studio/vnext-types';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { CsxEditorField } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { IconPlus, IconTrash, Section, SelectField } from '../PropertyPanelShared';

/* ────────────── Helpers ────────────── */

function toScriptCode(mc: MappingCode | undefined): ScriptCode | null {
  if (!mc) return null;
  return mc as ScriptCode;
}

function fromScriptCode(sc: ScriptCode): MappingCode {
  return sc as MappingCode;
}

/* ────────────── Constants ────────────── */

const TYPE_OPTIONS = [{ value: String(NotificationType.State), label: 'State' }] as const;

function makeEmptyNotification(): StateNotification {
  return { type: NotificationType.State, mapping: { location: '', code: '' } };
}

/* ────────────── Props ────────────── */

interface StateNotificationsEditorProps {
  notifications: StateNotification[];
  stateKey: string;
  onChange: (next: StateNotification[]) => void;
}

/* ────────────── Component ────────────── */

export function StateNotificationsEditor({
  notifications,
  stateKey,
  onChange,
}: StateNotificationsEditorProps) {
  function patchEntry(index: number, patch: Partial<StateNotification>): void {
    onChange(notifications.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function addNotification(): void {
    onChange([...notifications, makeEmptyNotification()]);
  }

  function removeNotification(index: number): void {
    onChange(notifications.filter((_, i) => i !== index));
  }

  return (
    <Section
      title="Notifications"
      count={notifications.length}
      defaultOpen={notifications.length > 0}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Configure notifications fired when this state is entered.
      </p>

      <div className="space-y-2.5">
        {notifications.map((n, index) => (
          <div
            key={index}
            className="border border-border-subtle rounded-xl bg-surface p-2.5 space-y-2.5">
            {/* Type row */}
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Type
                </label>
                <SelectField
                  value={String(n.type)}
                  onChange={(v) =>
                    patchEntry(index, { type: Number(v) as NotificationType })
                  }
                  options={[...TYPE_OPTIONS]}
                />
              </div>
              <button
                type="button"
                onClick={() => removeNotification(index)}
                className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
                aria-label="Remove notification"
                title="Remove notification">
                <IconTrash />
              </button>
            </div>

            {/* Mapping section */}
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Mapping
              </label>
              <CsxEditorField
                value={toScriptCode(n.mapping)}
                onChange={(sc) => patchEntry(index, { mapping: fromScriptCode(sc) })}
                templateType="mapping"
                contextName={`${stateKey}-notification-${index}-mapping`}
                label="Mapping"
                stateKey={stateKey}
                listField="notifications"
                index={index}
                scriptField="mapping"
                allowRefEncoding
              />
              {n.mapping && (
                <MappingScriptsSection
                  value={(n.mapping as any).scripts}
                  onChange={(scripts) =>
                    patchEntry(index, {
                      mapping: { ...n.mapping, scripts: scripts ?? undefined },
                    })
                  }
                />
              )}
            </div>

            {/* Rule section */}
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Rule{' '}
                <span className="text-subtle font-normal">(optional)</span>
              </label>
              <CsxEditorField
                value={toScriptCode(n.rule)}
                onChange={(sc) => patchEntry(index, { rule: fromScriptCode(sc) })}
                onRemove={() => patchEntry(index, { rule: undefined })}
                templateType="condition"
                contextName={`${stateKey}-notification-${index}-rule`}
                label="Rule"
                stateKey={stateKey}
                listField="notifications"
                index={index}
                scriptField="rule"
                allowRefEncoding
              />
              {n.rule && (
                <MappingScriptsSection
                  value={(n.rule as any).scripts}
                  onChange={(scripts) =>
                    patchEntry(index, {
                      rule: { ...n.rule!, scripts: scripts ?? undefined },
                    })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addNotification}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors mt-2">
        <IconPlus />
        Add notification
      </button>
    </Section>
  );
}
