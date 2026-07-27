import type { ResourceLock, ResourceLockAction, ResourceLockOnConflict, ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Field } from '../../../../../../ui/Field';
import { Input } from '../../../../../../ui/Input';
import { Select } from '../../../../../../ui/Select';
import { Section } from '../PropertyPanelShared';

interface TransitionResourceLockSectionProps {
  resourceLock: ResourceLock | null | undefined;
  stateKey: string;
  transitionKey: string;
  index: number;
  onUpdateResourceLock: (keyExpression: ScriptCode) => void;
  onRemoveResourceLock: () => void;
  onUpdateResourceLockField: (
    field: 'action' | 'ttlSeconds' | 'onConflict',
    value: string | number | undefined,
  ) => void;
  /**
   * Optional handlers for the `scripts` sub-object on this transition's
   * resource-lock key expression. When omitted, the scripts section is
   * suppressed (used by code paths that aren't yet wired through).
   */
  onScriptsChange?: (next: ScriptsConfig | undefined) => void;
}

export function TransitionResourceLockSection({
  resourceLock,
  stateKey,
  transitionKey,
  index,
  onUpdateResourceLock,
  onRemoveResourceLock,
  onUpdateResourceLockField,
  onScriptsChange,
}: TransitionResourceLockSectionProps) {
  const keyExpression = (resourceLock?.keyExpression as ScriptCode | undefined) ?? null;

  return (
    <Section title="Resource Lock" defaultOpen={!!keyExpression?.code}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Acquires, releases, or extends a distributed lock keyed by the mapping script below when this
        transition fires.
      </p>
      <CsxEditorField
        value={keyExpression}
        onChange={onUpdateResourceLock}
        onRemove={onRemoveResourceLock}
        templateType="mapping"
        contextName={`${stateKey}-${transitionKey || 'resource-lock'}-key`}
        label="Lock Key Expression"
        stateKey={stateKey}
        listField="transitions"
        index={index}
        scriptField="resourceLock.keyExpression"
      />
      {keyExpression && onScriptsChange && (
        <MappingScriptsSection value={keyExpression.scripts} onChange={onScriptsChange} />
      )}

      <div className="grid grid-cols-2 gap-3 mt-2">
        <Field label="Action">
          <Select
            value={resourceLock?.action ?? 'Acquire'}
            onChange={(e) => onUpdateResourceLockField('action', e.target.value as ResourceLockAction)}
            className="text-xs">
            <option value="Acquire">Acquire</option>
            <option value="Release">Release</option>
            <option value="Extend">Extend</option>
          </Select>
        </Field>
        <Field label="TTL (seconds)" hint="Default 300.">
          <Input
            type="number"
            min={1}
            step={1}
            placeholder="300 (default)"
            value={resourceLock?.ttlSeconds ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onUpdateResourceLockField('ttlSeconds', undefined);
                return;
              }
              const n = Math.trunc(Number(raw));
              onUpdateResourceLockField('ttlSeconds', Number.isFinite(n) && n >= 1 ? n : undefined);
            }}
            size="sm"
            inputClassName="text-xs"
          />
        </Field>
      </div>
      <Field label="On Conflict" className="mt-2">
        <Select
          value={resourceLock?.onConflict ?? 'Abort'}
          onChange={(e) => onUpdateResourceLockField('onConflict', e.target.value as ResourceLockOnConflict)}
          className="text-xs">
          <option value="Abort">Abort</option>
        </Select>
      </Field>
    </Section>
  );
}
