import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

/*
 * Form presentation hints (vnext-schema 0.0.56): `x-order` and the view-hints
 * mixin (`x-helpText`, `x-placeholder`, `x-uiHint`, `x-uiNote`, `x-group`).
 * Every role accepts them; the runtime reads none of them.
 */

interface CardProps {
  pointer: JsonPointer;
}

function toLocalizedTextMap(value: unknown): LocalizedTextMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: LocalizedTextMap = {};
  for (const [key, val] of Object.entries(value)) if (typeof val === 'string') out[key] = val;
  return out;
}

const ORDER_DEFAULT = (): number => 1;

/** `x-order`: form position, lower first; fields without it come after every ordered one. */
export function XOrderCard({ pointer }: CardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-order', ORDER_DEFAULT);
  const value = node?.['x-order'];

  return (
    <VNextCardShell
      xKey="x-order"
      title="Form order"
      purpose="Position of this field in a generated form, lower first. Needed because stored schemas do not keep property order."
      enabled={enabled}
      onToggle={toggle}
      error={enabled && typeof value !== 'number' ? 'x-order must be a number.' : undefined}>
      <Field label="Order">
        <Input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => {
            const n = Number(event.target.value);
            if (event.target.value !== '' && Number.isFinite(n)) updateComponent(setKeyword(pointer, 'x-order', n));
          }}
          inputClassName="text-xs"
        />
      </Field>
    </VNextCardShell>
  );
}

function localizedHintCard(xKey: 'x-helpText' | 'x-placeholder', title: string, purpose: string) {
  const defaultValue = (): LocalizedTextMap => ({ en: '' });
  function LocalizedHintCard({ pointer }: CardProps) {
    const { node } = useSchemaNode(pointer);
    const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
    const { enabled, toggle } = useVNextEnabled(pointer, xKey, defaultValue);
    return (
      <VNextCardShell xKey={xKey} title={title} purpose={purpose} enabled={enabled} onToggle={toggle}>
        <LocalizedTextMapEditor
          label={title}
          value={toLocalizedTextMap(node?.[xKey])}
          onChange={(next) => updateComponent(setKeyword(pointer, xKey, next))}
        />
      </VNextCardShell>
    );
  }
  LocalizedHintCard.displayName = `${xKey}Card`;
  return LocalizedHintCard;
}

function textHintCard(xKey: 'x-uiHint' | 'x-uiNote' | 'x-group', title: string, purpose: string, placeholder: string) {
  const defaultValue = (): string => '';
  function TextHintCard({ pointer }: CardProps) {
    const { node } = useSchemaNode(pointer);
    const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
    const { enabled, toggle } = useVNextEnabled(pointer, xKey, defaultValue);
    const value = typeof node?.[xKey] === 'string' ? (node[xKey]) : '';
    return (
      <VNextCardShell
        xKey={xKey}
        title={title}
        purpose={purpose}
        enabled={enabled}
        onToggle={toggle}
        error={enabled && value.trim() === '' ? `${xKey} must not be empty.` : undefined}>
        <Field label={title}>
          <Input
            type="text"
            value={value}
            onChange={(event) => updateComponent(setKeyword(pointer, xKey, event.target.value))}
            placeholder={placeholder}
            inputClassName="text-xs"
          />
        </Field>
      </VNextCardShell>
    );
  }
  TextHintCard.displayName = `${xKey}Card`;
  return TextHintCard;
}

export const XHelpTextCard = localizedHintCard('x-helpText', 'Help text', 'Shown under or beside the field.');
export const XPlaceholderCard = localizedHintCard('x-placeholder', 'Placeholder', 'Shown in an empty input.');
export const XGroupCard = textHintCard(
  'x-group',
  'Form group',
  'Section a generated form places the field in.',
  'personal-info',
);
export const XUiHintCard = textHintCard(
  'x-uiHint',
  'Rendering hint',
  "A hint for the client (e.g. 'hidden', 'readonly'); unknown hints are ignored.",
  'readonly',
);
export const XUiNoteCard = textHintCard(
  'x-uiNote',
  'Maintainer note',
  'Free-form note for whoever renders or maintains the field. Never displayed.',
  '',
);
