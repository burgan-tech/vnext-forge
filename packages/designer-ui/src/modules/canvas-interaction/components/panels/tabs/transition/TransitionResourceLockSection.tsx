import {
  RESOURCE_LOCK_ON_CONFLICT_VALUES,
  type ResourceLock,
  type ResourceLockAction,
  type ResourceLockOnConflict,
  type ScriptsConfig,
} from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Field } from '../../../../../../ui/Field';
import { Input } from '../../../../../../ui/Input';
import { Select } from '../../../../../../ui/Select';
import { Section } from '../PropertyPanelShared';
import { schemaEnumValues } from '../../../../../schema-capabilities/SchemaCapabilities';
import { useSchemaCapabilities } from '../../../../../schema-capabilities/useSchemaCapabilities';

const ON_CONFLICT_HINTS: Record<ResourceLockOnConflict, string> = {
  Abort:
    'The instance faults and the caller gets 409 Execution:200010. To keep the instance alive, add a state or workflow error boundary rule for Execution:200010 that routes to a transition.',
  Reject:
    'The instance is left untouched and the caller gets 409 Execution:200014. Retry the same transition once the lock is released.',
};

/**
 * `onConflict` values to offer: the active schema's enum when known (older
 * schema versions only allow `Abort`), plus the current value so an
 * existing document always round-trips.
 */
function onConflictOptions(allowed: readonly string[] | undefined, current: ResourceLockOnConflict): ResourceLockOnConflict[] {
  return RESOURCE_LOCK_ON_CONFLICT_VALUES.filter((value) => value === current || !allowed || allowed.includes(value));
}

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
  const workflowCaps = useSchemaCapabilities('workflow');
  const action: ResourceLockAction = resourceLock?.action ?? 'Acquire';
  const onConflict: ResourceLockOnConflict = resourceLock?.onConflict ?? 'Abort';
  // Release carries no TTL; only Acquire consults onConflict (a failed Extend is always 200010).
  const showTtl = action !== 'Release';
  const showOnConflict = action === 'Acquire';
  const conflictOptions = onConflictOptions(
    schemaEnumValues(workflowCaps, 'resourceLockDefinition', 'onConflict'),
    onConflict,
  );

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
            value={action}
            onChange={(e) => onUpdateResourceLockField('action', e.target.value as ResourceLockAction)}
            className="text-xs">
            <option value="Acquire">Acquire</option>
            <option value="Release">Release</option>
            <option value="Extend">Extend</option>
          </Select>
        </Field>
        {showTtl && (
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
        )}
      </div>
      {action === 'Extend' && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          A failed extend (the lock is no longer held by this instance) always answers 409 Execution:200010.
        </p>
      )}
      {showOnConflict && (
        <Field label="On Conflict" className="mt-2">
          <Select
            value={onConflict}
            onChange={(e) => onUpdateResourceLockField('onConflict', e.target.value as ResourceLockOnConflict)}
            className="text-xs"
            aria-describedby={`${stateKey}-${transitionKey}-on-conflict-hint`}>
            {conflictOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <p
            id={`${stateKey}-${transitionKey}-on-conflict-hint`}
            className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            {ON_CONFLICT_HINTS[onConflict]}
          </p>
        </Field>
      )}
    </Section>
  );
}
