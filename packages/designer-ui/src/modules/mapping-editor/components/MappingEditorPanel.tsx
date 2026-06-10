import { useCallback, useMemo } from 'react';
import { useComponentStore } from '../../../store/useComponentStore';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { Input } from '../../../ui/Input';
import { MappingMetadataForm } from './MappingMetadataForm';

interface MappingEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (mutator: (draft: Record<string, unknown>) => void) => void;
}

/**
 * Editor surface for a `sys-mappings` component. The whole `attributes`
 * payload is `{ name, location?, code, encoding }`:
 *
 *   - `name` is the helper class identifier surfaced as a plain text input.
 *   - The remaining `{ location, code, encoding }` triplet matches the
 *     existing `ScriptCode` shape, so we reuse `CsxEditorField` for the
 *     script body. The field is restricted to `B64` / `NAT` since a
 *     mapping cannot reference itself (`REF` is rejected at the schema
 *     level for sys-mappings).
 */
export function MappingEditorPanel({ json, onChange }: MappingEditorPanelProps) {
  const attributes = useMemo<Record<string, unknown>>(() => {
    const a = json.attributes;
    return a && typeof a === 'object' && !Array.isArray(a)
      ? (a as Record<string, unknown>)
      : {};
  }, [json]);

  const name = typeof attributes.name === 'string' ? attributes.name : '';

  const scriptValue: ScriptCode = useMemo(() => {
    const enc = attributes.encoding === 'NAT' ? 'NAT' : 'B64';
    const location = typeof attributes.location === 'string' ? attributes.location : '';
    const code = typeof attributes.code === 'string' ? attributes.code : '';
    return { location, code, encoding: enc };
  }, [attributes]);

  const handleNameChange = useCallback(
    (next: string) => {
      onChange((draft) => {
        const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
        attrs.name = next;
        draft.attributes = attrs;
      });
    },
    [onChange],
  );

  const handleScriptChange = useCallback(
    (next: ScriptCode) => {
      onChange((draft) => {
        const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
        attrs.location = next.location ?? '';
        attrs.code = next.code;
        // sys-mappings schema constrains encoding to B64 / NAT; never
        // forward `REF` even if the editor produced one.
        attrs.encoding = next.encoding === 'NAT' ? 'NAT' : 'B64';
        draft.attributes = attrs;
      });
    },
    [onChange],
  );

  const handleRemoveScript = useCallback(() => {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      attrs.code = '';
      attrs.location = '';
      attrs.encoding = 'B64';
      draft.attributes = attrs;
    });
  }, [onChange]);

  const mappingKey = typeof json.key === 'string' ? json.key : 'mapping';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4">
      <MappingMetadataForm json={json} onChange={onChange} />

      <div>
        <label className="text-secondary-text mb-1 block text-[11px] font-medium uppercase tracking-wide">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="JsonHelper"
          className="h-8 text-[12px]"
        />
        <p className="text-muted-foreground mt-1 text-[10px]">
          Helper / class name exposed by this mapping (referenced from
          other mappings via the <code>scripts.helpers</code> list).
        </p>
      </div>

      <CsxEditorField
        value={scriptValue}
        onChange={handleScriptChange}
        onRemove={handleRemoveScript}
        templateType="mapping"
        contextName={`mapping-${mappingKey}`}
        label="Mapping body"
        stateKey={mappingKey}
        listField="attributes"
        index={0}
        scriptField="code"
        // sys-mappings cannot reference itself — hide the REF option
        // from the picker. The AJV schema enforces the same constraint
        // server-side, but suppressing it here keeps the affordance
        // out of reach in the UI.
        allowRefEncoding={false}
      />
    </div>
  );
}
