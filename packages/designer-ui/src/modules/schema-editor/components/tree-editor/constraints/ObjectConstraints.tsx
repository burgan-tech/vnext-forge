import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/Dialog';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { TagEditor } from '../../../../../ui/TagEditor';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { getNodeAt, summarizeNode } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useSetSelection } from '../../../hooks/useSchemaSelection';
import { NumberFieldInput } from './NumberFieldInput';
import { SubschemaLink } from './SubschemaLink';

interface ObjectConstraintsProps {
  pointer: JsonPointer;
}

/**
 * Constraint editors that apply to `type: "object"`:
 * minProperties, maxProperties, additionalProperties (tri-state),
 * patternProperties, dependentRequired, dependentSchemas.
 */
export function ObjectConstraints({ pointer }: ObjectConstraintsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberFieldInput
          pointer={pointer}
          keyword="minProperties"
          label="minProperties"
          hint="Minimum number of own properties."
          min={0}
          integerOnly
        />
        <NumberFieldInput
          pointer={pointer}
          keyword="maxProperties"
          label="maxProperties"
          hint="Maximum number of own properties."
          min={0}
          integerOnly
        />
      </div>

      <AdditionalPropertiesControl pointer={pointer} />
      <PatternPropertiesList pointer={pointer} />
      <DependentRequiredEditor pointer={pointer} />
      <DependentSchemasList pointer={pointer} />
    </div>
  );
}

type AdditionalMode = 'unset' | 'forbidden' | 'allowed-any' | 'schema';

function classifyAdditional(value: unknown): AdditionalMode {
  if (value === undefined) {
    return 'unset';
  }
  if (value === false) {
    return 'forbidden';
  }
  if (value === true) {
    return 'allowed-any';
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return 'schema';
  }
  return 'unset';
}

function AdditionalPropertiesControl({ pointer }: { pointer: JsonPointer }) {
  const { node, mutate } = useSchemaNode(pointer);
  const mode = classifyAdditional(node?.additionalProperties);

  return (
    <Field
      label="additionalProperties"
      hint="Controls whether keys outside `properties`/`patternProperties` are allowed.">
      <div className="space-y-2">
        <Select
          className="h-8 text-xs"
          value={mode}
          onChange={(event) => {
            const next = event.target.value as AdditionalMode;
            switch (next) {
              case 'unset':
                mutate(setKeyword(pointer, 'additionalProperties', undefined));
                break;
              case 'forbidden':
                mutate(setKeyword(pointer, 'additionalProperties', false));
                break;
              case 'allowed-any':
                mutate(setKeyword(pointer, 'additionalProperties', true));
                break;
              case 'schema':
                mutate(setKeyword(pointer, 'additionalProperties', {}));
                break;
            }
          }}>
          <option value="unset">No constraint (omit keyword)</option>
          <option value="forbidden">Forbidden (false)</option>
          <option value="allowed-any">Allowed, any shape (true)</option>
          <option value="schema">Allowed, must match a schema</option>
        </Select>

        {mode === 'schema' ? (
          <SubschemaLink
            targetPointer={appendPointer(pointer, 'additionalProperties')}
            label="additionalProperties schema"
            emptyHint="The schema additional properties must validate against."
          />
        ) : null}
      </div>
    </Field>
  );
}

function PatternPropertiesList({ pointer }: { pointer: JsonPointer }) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const setSelection = useSetSelection();
  const node = getNodeAt(componentJson, pointer);
  const map = isPlainObject(node?.patternProperties) ? node.patternProperties : {};

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patterns = Object.keys(map);

  function addPattern() {
    const trimmed = draft.trim();

    if (trimmed === '') {
      setError('Pattern is required.');
      return;
    }

    if (patterns.includes(trimmed)) {
      setError('Pattern already exists.');
      return;
    }

    try {
      new RegExp(trimmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid regular expression.');
      return;
    }

    updateComponent(
      setKeyword(pointer, 'patternProperties', { ...map, [trimmed]: {} }),
    );

    setDraft('');
    setError(null);
    setDialogOpen(false);
  }

  function removePattern(pattern: string) {
    const next: Record<string, unknown> = { ...map };
    delete next[pattern];
    updateComponent(
      setKeyword(pointer, 'patternProperties', Object.keys(next).length === 0 ? undefined : next),
    );
  }

  return (
    <Field
      label="patternProperties"
      hint="Maps regex patterns to schemas additional matching keys must satisfy.">
      <div className="space-y-2">
        {patterns.length === 0 ? (
          <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
            No pattern-keyed schemas yet.
          </p>
        ) : (
          patterns.map((pattern) => {
            const subPointer = appendPointer(pointer, 'patternProperties', pattern);
            const subNode = getNodeAt(componentJson, subPointer);

            return (
              <div
                key={pattern}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold">/{pattern}/</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-primary-text/65">
                    {summarizeNode(subNode)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                    subschema
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() => setSelection(subPointer)}>
                    <ExternalLink size={11} />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive-text"
                    aria-label={`Remove pattern ${pattern}`}
                    onClick={() => removePattern(pattern)}>
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => {
            setDialogOpen(true);
            setError(null);
          }}>
          <Plus size={10} />
          Add pattern
        </Button>

        <Dialog
          open={dialogOpen}
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) {
              setDraft('');
              setError(null);
            }
          }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add pattern</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Enter an ECMA-262 regular expression source (no slashes).
            </DialogDescription>
            <Input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  addPattern();
                }
              }}
              placeholder="^x-.*"
              inputClassName="font-mono text-sm"
              error={error}
              autoFocus
            />
            <DialogFooter>
              <DialogCancelButton variant="destructive">Cancel</DialogCancelButton>
              <Button type="button" variant="success" onClick={addPattern}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Field>
  );
}

function DependentRequiredEditor({ pointer }: { pointer: JsonPointer }) {
  const { node, mutate } = useSchemaNode(pointer);
  const map = isPlainObject(node?.dependentRequired) ? node.dependentRequired : {};

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const triggers = Object.keys(map);

  function addTrigger() {
    const trimmed = draft.trim();

    if (trimmed === '') {
      setError('Property name is required.');
      return;
    }

    if (triggers.includes(trimmed)) {
      setError('Already in the list.');
      return;
    }

    mutate(setKeyword(pointer, 'dependentRequired', { ...map, [trimmed]: [] }));
    setDraft('');
    setError(null);
    setDialogOpen(false);
  }

  function setRequiredFor(key: string, list: string[]) {
    const next: Record<string, unknown> = { ...map, [key]: list };
    mutate(setKeyword(pointer, 'dependentRequired', next));
  }

  function removeTrigger(key: string) {
    const next: Record<string, unknown> = { ...map };
    delete next[key];
    mutate(
      setKeyword(pointer, 'dependentRequired', Object.keys(next).length === 0 ? undefined : next),
    );
  }

  return (
    <Field
      label="dependentRequired"
      hint="If the trigger property is present, these other properties become required.">
      <div className="space-y-2">
        {triggers.length === 0 ? (
          <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
            No dependent-required rules yet.
          </p>
        ) : (
          triggers.map((trigger) => {
            const current = map[trigger];
            const list: string[] = Array.isArray(current)
              ? current.filter((value): value is string => typeof value === 'string')
              : [];

            return (
              <div
                key={trigger}
                className="space-y-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold">if "{trigger}" present</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive-text"
                    aria-label={`Remove rule for ${trigger}`}
                    onClick={() => removeTrigger(trigger)}>
                    <Trash2 size={11} />
                  </Button>
                </div>
                <TagEditor
                  tags={list}
                  onChange={(next) => setRequiredFor(trigger, next)}
                  placeholder="add required property..."
                />
              </div>
            );
          })
        )}

        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => {
            setDialogOpen(true);
            setError(null);
          }}>
          <Plus size={10} />
          Add rule
        </Button>

        <Dialog
          open={dialogOpen}
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) {
              setDraft('');
              setError(null);
            }
          }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add dependent-required rule</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Name the trigger property — the dependent required list is added next.
            </DialogDescription>
            <Input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  addTrigger();
                }
              }}
              placeholder="customerType"
              inputClassName="font-mono text-sm"
              error={error}
              autoFocus
            />
            <DialogFooter>
              <DialogCancelButton variant="destructive">Cancel</DialogCancelButton>
              <Button type="button" variant="success" onClick={addTrigger}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Field>
  );
}

function DependentSchemasList({ pointer }: { pointer: JsonPointer }) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const setSelection = useSetSelection();
  const node = getNodeAt(componentJson, pointer);
  const map = isPlainObject(node?.dependentSchemas) ? node.dependentSchemas : {};

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const triggers = Object.keys(map);

  function addTrigger() {
    const trimmed = draft.trim();

    if (trimmed === '') {
      setError('Property name is required.');
      return;
    }

    if (triggers.includes(trimmed)) {
      setError('Already in the list.');
      return;
    }

    updateComponent(setKeyword(pointer, 'dependentSchemas', { ...map, [trimmed]: {} }));
    setDraft('');
    setError(null);
    setDialogOpen(false);
  }

  function removeTrigger(key: string) {
    const next: Record<string, unknown> = { ...map };
    delete next[key];
    updateComponent(
      setKeyword(pointer, 'dependentSchemas', Object.keys(next).length === 0 ? undefined : next),
    );
  }

  return (
    <Field
      label="dependentSchemas"
      hint="If the trigger property is present, the instance must additionally match this schema.">
      <div className="space-y-2">
        {triggers.length === 0 ? (
          <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
            No dependent-schema rules yet.
          </p>
        ) : (
          triggers.map((trigger) => {
            const subPointer = appendPointer(pointer, 'dependentSchemas', trigger);
            const subNode = getNodeAt(componentJson, subPointer);

            return (
              <div
                key={trigger}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold">if "{trigger}" present</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-primary-text/65">
                    {summarizeNode(subNode)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                    subschema
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() => setSelection(subPointer)}>
                    <ExternalLink size={11} />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive-text"
                    aria-label={`Remove rule for ${trigger}`}
                    onClick={() => removeTrigger(trigger)}>
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => {
            setDialogOpen(true);
            setError(null);
          }}>
          <Plus size={10} />
          Add rule
        </Button>

        <Dialog
          open={dialogOpen}
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) {
              setDraft('');
              setError(null);
            }
          }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add dependent-schema rule</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Name the trigger property — the conditional schema is added next.
            </DialogDescription>
            <Input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  addTrigger();
                }
              }}
              placeholder="customerType"
              inputClassName="font-mono text-sm"
              error={error}
              autoFocus
            />
            <DialogFooter>
              <DialogCancelButton variant="destructive">Cancel</DialogCancelButton>
              <Button type="button" variant="success" onClick={addTrigger}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Field>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
