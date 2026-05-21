import { useEffect, useState } from 'react';

import { Checkbox } from '../../../../../../ui/Checkbox';
import { Field } from '../../../../../../ui/Field';
import { Input } from '../../../../../../ui/Input';
import { Label } from '../../../../../../ui/Label';
import { Select } from '../../../../../../ui/Select';
import { TagEditor } from '../../../../../../ui/TagEditor';
import { Textarea } from '../../../../../../ui/Textarea';
import {
  appendPointer,
  lastSegment,
  parentPointer as getParentPointer,
  ROOT_POINTER,
  type JsonPointer,
} from '../../../../model/jsonPointer';
import {
  renameProp,
  setKeyword,
  setRequired,
  setType,
} from '../../../../model/mutators';
import { PRIMITIVE_TYPES, isRequiredKey, type PrimitiveType } from '../../../../model/schemaNode';
import { getUnknownKeywords } from '../../../../model/recognizedKeywords';
import { useSchemaEditorStore } from '../../../../useSchemaEditorStore';
import { useResolvedSelection, useSetSelection } from '../../../../hooks/useSchemaSelection';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { RawJsonFallback } from '../../raw/RawJsonFallback';
import { RawPassthroughBadge } from '../../raw/RawPassthroughBadge';

interface GeneralTabProps {
  pointer: JsonPointer;
}

/**
 * "General" tab for the selected node. Edits the property key (when the
 * pointer addresses a property), the JSON Schema type, descriptive
 * metadata (title/description), and the basic scalar fields (default,
 * const, enum, format). Unrecognized keywords are surfaced via the
 * passthrough badge and editable through `RawJsonFallback` so nothing is
 * lost on save.
 */
export function GeneralTab({ pointer }: GeneralTabProps) {
  const { node, mutate } = useSchemaNode(pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const setSelection = useSetSelection();
  const selection = useResolvedSelection();

  const parent = getParentPointer(pointer);
  const isPropertyOfObject =
    parent !== null && pointer !== ROOT_POINTER && lastSegment(getParentPointer(pointer) ?? '') === 'properties';
  const propertyKey =
    isPropertyOfObject && pointer !== ROOT_POINTER ? lastSegment(pointer) : null;
  const grandparentPointer = isPropertyOfObject ? getParentPointer(parent) : null;

  const unknownKeys = getUnknownKeywords(node);

  if (!node) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Select a property in the tree to edit its details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary-text">
          {propertyKey ?? 'Schema root'}
        </h2>
        <RawPassthroughBadge unknownKeys={unknownKeys} />
      </div>

      {propertyKey !== null && grandparentPointer !== null ? (
        <PropertyKeyField
          parentPointer={grandparentPointer}
          currentKey={propertyKey}
          onRenameComplete={(nextKey) => {
            const nextPointer = appendPointer(grandparentPointer, 'properties', nextKey);
            if (selection === pointer) {
              setSelection(nextPointer);
            }
          }}
        />
      ) : null}

      <Field label="Type" hint="Primitive JSON Schema type for this node.">
        <Select
          className="h-8 text-xs"
          value={typeof node.type === 'string' ? node.type : ''}
          onChange={(event) => {
            const next = event.target.value;
            mutate(setType(pointer, next === '' ? null : (next as PrimitiveType)));
          }}>
          <option value="">(any)</option>
          {PRIMITIVE_TYPES.map((primitiveType) => (
            <option key={primitiveType} value={primitiveType}>
              {primitiveType}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" hint="Human-friendly label for documentation tools.">
        <Input
          type="text"
          value={typeof node.title === 'string' ? node.title : ''}
          onChange={(event) => {
            const value = event.target.value;
            mutate(setKeyword(pointer, 'title', value === '' ? undefined : value));
          }}
          placeholder="(optional)"
        />
      </Field>

      <Field label="Description" hint="Short prose that explains the field.">
        <Textarea
          value={typeof node.description === 'string' ? node.description : ''}
          onChange={(event) => {
            const value = event.target.value;
            mutate(setKeyword(pointer, 'description', value === '' ? undefined : value));
          }}
          placeholder="(optional)"
        />
      </Field>

      <DefaultValueField pointer={pointer} value={node.default} />

      <ConstValueField pointer={pointer} value={node.const} />

      <EnumValuesField pointer={pointer} value={node.enum} />

      {propertyKey !== null && grandparentPointer !== null ? (
        <RequiredToggle
          parentPointer={grandparentPointer}
          propertyKey={propertyKey}
        />
      ) : null}

      {unknownKeys.length > 0 ? (
        <div className="space-y-3 rounded-md border border-warning-border/60 bg-warning-muted/30 p-3">
          <p className="text-[11px] font-semibold text-warning-text">
            Passthrough keywords — preserved on save, edit as raw JSON.
          </p>
          {unknownKeys.map((key) => (
            <RawJsonFallback key={key} pointer={pointer} keyword={key} />
          ))}
        </div>
      ) : null}

      {/* Reference grandparent / componentJson so React tracks them
          and re-renders this tab after store mutations. */}
      <span hidden aria-hidden>
        {componentJson === null ? '' : ''}
      </span>
    </div>
  );
}

interface PropertyKeyFieldProps {
  parentPointer: JsonPointer;
  currentKey: string;
  onRenameComplete: (nextKey: string) => void;
}

function PropertyKeyField({ parentPointer, currentKey, onRenameComplete }: PropertyKeyFieldProps) {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const [draft, setDraft] = useState(currentKey);

  useEffect(() => {
    setDraft(currentKey);
  }, [currentKey]);

  function commit() {
    const next = draft.trim();

    if (next === '' || next === currentKey) {
      setDraft(currentKey);
      return;
    }

    updateComponent(renameProp(parentPointer, currentKey, next));
    onRenameComplete(next);
  }

  return (
    <Field label="Property name" hint="Used as the key in the parent object's `properties` map.">
      <Input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setDraft(currentKey);
            event.currentTarget.blur();
          }
        }}
        inputClassName="font-mono text-sm"
      />
    </Field>
  );
}

function DefaultValueField({ pointer, value }: { pointer: JsonPointer; value: unknown }) {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const initial = value === undefined ? '' : JSON.stringify(value);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value === undefined ? '' : JSON.stringify(value));
    setError(null);
  }, [value]);

  return (
    <Field
      label="Default"
      hint="JSON literal applied when the value is unset. Leave blank to omit."
      errorMsg={error}>
      <Input
        type="text"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next.trim() === '') {
            setError(null);
            updateComponent(setKeyword(pointer, 'default', undefined));
            return;
          }

          try {
            const parsed: unknown = JSON.parse(next);
            setError(null);
            updateComponent(setKeyword(pointer, 'default', parsed));
          } catch {
            setError('Must be a JSON literal (e.g. "text", 42, true, null).');
          }
        }}
        placeholder='e.g. "pending" or 42 or true'
        inputClassName="font-mono text-sm"
      />
    </Field>
  );
}

function ConstValueField({ pointer, value }: { pointer: JsonPointer; value: unknown }) {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const initial = value === undefined ? '' : JSON.stringify(value);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value === undefined ? '' : JSON.stringify(value));
    setError(null);
  }, [value]);

  return (
    <Field
      label="Const"
      hint="Locks the value to a single JSON literal. Leave blank to omit."
      errorMsg={error}>
      <Input
        type="text"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next.trim() === '') {
            setError(null);
            updateComponent(setKeyword(pointer, 'const', undefined));
            return;
          }

          try {
            const parsed: unknown = JSON.parse(next);
            setError(null);
            updateComponent(setKeyword(pointer, 'const', parsed));
          } catch {
            setError('Must be a JSON literal.');
          }
        }}
        placeholder='e.g. "active"'
        inputClassName="font-mono text-sm"
      />
    </Field>
  );
}

function EnumValuesField({ pointer, value }: { pointer: JsonPointer; value: unknown }) {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const list: string[] = Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
    : [];

  return (
    <Field
      label="Enum values"
      hint="Allowed values. Use JSON syntax for non-string entries (e.g. 42, true).">
      <TagEditor
        tags={list}
        onChange={(next) => {
          if (next.length === 0) {
            updateComponent(setKeyword(pointer, 'enum', undefined));
            return;
          }

          const parsed: unknown[] = next.map((entry) => {
            try {
              return JSON.parse(entry) as unknown;
            } catch {
              return entry;
            }
          });

          updateComponent(setKeyword(pointer, 'enum', parsed));
        }}
        placeholder="add value..."
      />
    </Field>
  );
}

function RequiredToggle({
  parentPointer,
  propertyKey,
}: {
  parentPointer: JsonPointer;
  propertyKey: string;
}) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { node: parent } = useSchemaNode(parentPointer);
  const checked = isRequiredKey(parent, propertyKey);

  // Touch componentJson so the effect of an unrelated re-render reaches us.
  void componentJson;

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary-border/60 px-3 py-2">
      <Checkbox
        id={`required-${propertyKey}`}
        checked={checked}
        onCheckedChange={(value) => {
          updateComponent(setRequired(parentPointer, propertyKey, value === true));
        }}
      />
      <Label htmlFor={`required-${propertyKey}`} className="cursor-pointer text-xs">
        Required in parent object
      </Label>
    </div>
  );
}
