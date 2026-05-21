import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Settings2, Trash2, X } from 'lucide-react';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../ui/LocalizedTextMapEditor';
import { Select } from '../../../ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Textarea } from '../../../ui/Textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCancelButton,
} from '../../../ui/Dialog';

type SchemaNode = Record<string, unknown>;
type SchemaUpdater = (draft: SchemaNode) => void;

const SCHEMA_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'] as const;
const ERROR_MESSAGE_KEYS = [
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
  'format',
  'enum',
  'const',
  'type',
] as const;
const CONDITIONAL_KINDS = ['showIf', 'hideIf', 'enableIf', 'disableIf'] as const;
const CONDITIONAL_OPERATORS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
  'contains',
  'greaterThan',
  'lessThan',
  'greaterThanOrEquals',
  'lessThanOrEquals',
  'startsWith',
  'endsWith',
] as const;
const ENCRYPTION_TYPES = ['none', 'transport', 'persisted'] as const;
const BINDING_TYPES = ['', 'required', 'optional'] as const;
const FORMAT_VALUES = ['', 'email', 'uri', 'url', 'date', 'date-time', 'time', 'phone', 'iban'] as const;

interface SchemaTreeProps {
  schema: SchemaNode;
  onChange: (updater: SchemaUpdater) => void;
}

export function SchemaTree({ schema, onChange }: SchemaTreeProps) {
  const properties = (schema.properties ?? {}) as Record<string, SchemaNode>;
  const required = (schema.required ?? []) as string[];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [schemaRulesOpen, setSchemaRulesOpen] = useState(false);

  function confirmAddProperty() {
    const name = newPropertyName.trim();
    if (!name) return;

    onChange((draft) => {
      const propertiesDraft = ensureProperties(draft);
      propertiesDraft[name] = { type: 'string' };
    });

    setNewPropertyName('');
    setDialogOpen(false);
  }

  function removeProperty(propertyName: string) {
    onChange((draft) => {
      const propertiesDraft = draft.properties as Record<string, SchemaNode> | undefined;
      if (propertiesDraft) delete propertiesDraft[propertyName];
      if (Array.isArray(draft.required)) {
        draft.required = (draft.required as string[]).filter(
          (requiredName) => requiredName !== propertyName,
        );
      }
    });
  }

  function updatePropertyType(propertyName: string, newType: string) {
    onChange((draft) => {
      const propertyDraft = (draft.properties as Record<string, SchemaNode> | undefined)?.[
        propertyName
      ];

      if (!propertyDraft) return;

      propertyDraft.type = newType;
      if (newType === 'object' && !propertyDraft.properties) {
        propertyDraft.properties = {};
      }
    });
  }

  function toggleRequired(propertyName: string) {
    onChange((draft) => {
      if (!Array.isArray(draft.required)) draft.required = [];
      const requiredDraft = draft.required as string[];
      const requiredIndex = requiredDraft.indexOf(propertyName);

      if (requiredIndex >= 0) {
        requiredDraft.splice(requiredIndex, 1);
      } else {
        requiredDraft.push(propertyName);
      }
    });
  }

  return (
    <div className="space-y-0.5">
      {typeof schema.title === 'string' && (
        <div className="mb-2 text-xs font-medium">{schema.title}</div>
      )}
      {typeof schema.description === 'string' && (
        <div className="mb-2 text-[10px] text-muted-foreground">{schema.description}</div>
      )}

      <div className="mb-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 text-[10px]"
          onClick={() => setSchemaRulesOpen((open) => !open)}>
          <Settings2 size={11} />
          Conditional required rules
        </Button>
        {schemaRulesOpen ? (
          <SchemaCompositionRules schema={schema} onChange={onChange} />
        ) : null}
      </div>

      {Object.entries(properties).map(([propertyName, propertySchema]) => (
        <SchemaPropertyRow
          key={propertyName}
          name={propertyName}
          schema={propertySchema}
          isRequired={required.includes(propertyName)}
          onTypeChange={(type) => updatePropertyType(propertyName, type)}
          onToggleRequired={() => toggleRequired(propertyName)}
          onRemove={() => removeProperty(propertyName)}
          onChange={(updater) => {
            onChange((draft) => {
              const propertyDraft = (draft.properties as Record<string, SchemaNode> | undefined)?.[
                propertyName
              ];
              if (propertyDraft) updater(propertyDraft);
            });
          }}
          depth={0}
          typeAlign="end"
        />
      ))}

      <Button
        onClick={() => setDialogOpen(true)}
        variant="success"
        size="sm"
        className="mt-2 text-[10px]">
        <Plus size={10} />
        Add property
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setNewPropertyName('');
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
          </DialogHeader>
          <DialogDescription>Enter a name for the new schema property.</DialogDescription>

          <Input
            type="text"
            value={newPropertyName}
            onChange={(e) => setNewPropertyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAddProperty();
            }}
            placeholder="property_name"
            inputClassName="font-mono text-sm"
            autoFocus
          />

          <DialogFooter>
            <DialogCancelButton variant="destructive">Cancel</DialogCancelButton>
            <Button
              type="button"
              variant="success"
              disabled={!newPropertyName.trim()}
              onClick={confirmAddProperty}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SchemaPropertyRowProps {
  name: string;
  schema: SchemaNode;
  isRequired: boolean;
  onTypeChange: (type: string) => void;
  onToggleRequired: () => void;
  onRemove: () => void;
  onChange: (updater: SchemaUpdater) => void;
  depth: number;
  typeAlign?: 'start' | 'end';
}

function SchemaPropertyRow({
  name,
  schema,
  isRequired,
  onTypeChange,
  onToggleRequired,
  onRemove,
  onChange,
  depth,
  typeAlign = 'end',
}: SchemaPropertyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const childProperties = (schema.properties as Record<string, SchemaNode> | undefined) ?? {};
  const hasChildren = schema.type === 'object' && Object.keys(childProperties).length > 0;
  const schemaType = String(Array.isArray(schema.type) ? schema.type[0] : (schema.type ?? 'string'));
  const requiredChildren = Array.isArray(schema.required) ? (schema.required as string[]) : [];

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md px-1 py-1 text-xs transition-colors hover:bg-muted-surface"
        style={{ paddingLeft: depth * 16 + 4 }}>
        {hasChildren ? (
          <Button
            onClick={() => setExpanded(!expanded)}
            variant="ghost"
            size="icon"
            className="size-5 text-muted-foreground">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </Button>
        ) : (
          <span className="w-4" />
        )}

        <span className="min-w-20 font-mono text-[11px]">{name}</span>
        {isRequired && (
          <Badge variant="warning" className="px-1.5 py-0.5 text-[9px]">
            Required
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="ml-auto h-6 w-28 justify-end gap-1.5 px-2 text-[10px]">
              {schemaType}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={typeAlign} className="w-28 min-w-0">
            {SCHEMA_TYPES.map((type) => (
              <DropdownMenuItem
                key={type}
                className="text-xs"
                onSelect={() => onTypeChange(type)}>
                {type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Badge
          asChild
          variant={isRequired ? 'warning' : 'muted'}
          interactive
          hoverable
          className="px-1.5 py-0.5 text-[9px]"
          title="Toggle required">
          <button onClick={onToggleRequired} type="button">
            req
          </button>
        </Badge>

        <Button
          onClick={() => setConfigurationOpen((v) => !v)}
          variant="secondary"
          size="icon"
          className="size-6"
          title="Edit schema configuration">
          <Settings2 size={10} />
        </Button>

        <Button
          onClick={onRemove}
          variant="destructive"
          size="icon"
          className="size-6"
          title="Remove property">
          <Trash2 size={10} />
        </Button>
      </div>

      {configurationOpen && (
        <SchemaConfigurationPanel
          schema={schema}
          schemaType={schemaType}
          onChange={onChange}
          depth={depth}
        />
      )}

      {expanded && hasChildren && (
        <div>
          {Object.entries(childProperties).map(([childName, childSchema]) => (
            <SchemaPropertyRow
              key={childName}
              name={childName}
              schema={childSchema}
              isRequired={requiredChildren.includes(childName)}
              onTypeChange={(type) =>
                onChange((draft) => {
                  const propertyDraft = ensureProperties(draft)[childName];
                  propertyDraft.type = type;
                  if (type === 'object' && !propertyDraft.properties) {
                    propertyDraft.properties = {};
                  }
                })
              }
              onToggleRequired={() =>
                onChange((draft) => {
                  if (!Array.isArray(draft.required)) draft.required = [];
                  const requiredDraft = draft.required as string[];
                  const requiredIndex = requiredDraft.indexOf(childName);
                  if (requiredIndex >= 0) requiredDraft.splice(requiredIndex, 1);
                  else requiredDraft.push(childName);
                })
              }
              onRemove={() =>
                onChange((draft) => {
                  const propertiesDraft = draft.properties as
                    | Record<string, SchemaNode>
                    | undefined;
                  if (propertiesDraft) delete propertiesDraft[childName];
                })
              }
              onChange={(updater) =>
                onChange((draft) => {
                  const childDraft = ensureProperties(draft)[childName];
                  if (childDraft) updater(childDraft);
                })
              }
              depth={depth + 1}
              typeAlign={typeAlign}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SchemaConfigurationPanelProps {
  schema: SchemaNode;
  schemaType: string;
  onChange: (updater: SchemaUpdater) => void;
  depth: number;
}

function SchemaConfigurationPanel({
  schema,
  schemaType,
  onChange,
  depth,
}: SchemaConfigurationPanelProps) {
  const labels = getRecord(schema['x-labels']);
  const xEnum = getRecord(schema['x-enum']);
  const errorMessages = getRecord(schema['x-errorMessages']);
  const lov = getRecord(schema['x-lov']);
  const lookup = getRecord(schema['x-lookup']);
  const validation = getRecord(schema['x-validation']);
  const encryption = getRecord(schema['x-encryption']);
  const conditional = getRecord(schema['x-conditional']);
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter((value): value is string => typeof value === 'string')
    : Object.keys(xEnum);

  const conditionalEntry = CONDITIONAL_KINDS.find((kind) => isRecord(conditional[kind]));
  const conditionalKind = conditionalEntry ?? 'showIf';
  const conditionalRule = getRecord(conditional[conditionalKind]);

  function setExtensionRecord(key: string, value: Record<string, unknown>) {
    onChange((draft) => {
      const cleaned = pruneEmptyRecord(value);
      if (Object.keys(cleaned).length === 0) delete draft[key];
      else draft[key] = cleaned;
    });
  }

  function setSchemaValue(key: string, value: unknown) {
    onChange((draft) => {
      if (value === undefined || value === '') delete draft[key];
      else draft[key] = value;
    });
  }

  function setNumberSchemaValue(key: string, value: string) {
    const trimmed = value.trim();
    setSchemaValue(key, trimmed === '' ? undefined : Number(trimmed));
  }

  function setJsonSchemaValue(key: string, value: unknown) {
    setSchemaValue(key, value);
  }

  function setLocalizedExtension(key: string, value: LocalizedTextMap) {
    setExtensionRecord(key, value);
  }

  function setErrorMessages(key: string, value: LocalizedTextMap) {
    const next = { ...errorMessages, [key]: Object.keys(value).length > 0 ? value : undefined };
    setExtensionRecord('x-errorMessages', next);
  }

  function setEnumValues(raw: string) {
    const values = raw
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);
    onChange((draft) => {
      if (values.length === 0) {
        delete draft.enum;
        delete draft['x-enum'];
        return;
      }
      draft.enum = values;
      const nextXEnum: Record<string, unknown> = {};
      for (const value of values) {
        nextXEnum[value] = xEnum[value] ?? { en: value };
      }
      draft['x-enum'] = nextXEnum;
    });
  }

  function setEnumLabel(value: string, label: LocalizedTextMap) {
    const next = { ...xEnum, [value]: Object.keys(label).length > 0 ? label : undefined };
    setExtensionRecord('x-enum', next);
  }

  function setLovField(key: string, value: string) {
    setExtensionRecord('x-lov', { ...lov, [key]: value.trim() || undefined });
  }

  function setLovFilter(filter: unknown[]) {
    setExtensionRecord('x-lov', { ...lov, filter: filter.length > 0 ? filter : undefined });
  }

  function setLookupField(key: string, value: string) {
    setExtensionRecord('x-lookup', { ...lookup, [key]: value.trim() || undefined });
  }

  function setLookupFilter(filter: unknown[]) {
    setExtensionRecord('x-lookup', { ...lookup, filter: filter.length > 0 ? filter : undefined });
  }

  function setBinding(value: string) {
    onChange((draft) => {
      if (value) draft['x-binding'] = value;
      else delete draft['x-binding'];
    });
  }

  function setEncryptionType(value: string) {
    if (!value) {
      onChange((draft) => {
        delete draft['x-encryption'];
      });
      return;
    }
    setExtensionRecord('x-encryption', { ...encryption, type: value });
  }

  function setConditionalKind(nextKind: string) {
    onChange((draft) => {
      const rule = isRecord(conditional[conditionalKind])
        ? conditional[conditionalKind]
        : { field: '', operator: 'equals', value: '' };
      draft['x-conditional'] = { [nextKind]: rule };
    });
  }

  function setConditionalField(key: string, value: string) {
    onChange((draft) => {
      const nextRule = {
        ...conditionalRule,
        [key]: key === 'value' ? parsePrimitive(value) : value.trim(),
      };
      draft['x-conditional'] = { [conditionalKind]: pruneEmptyRecord(nextRule) };
    });
  }

  function setConditionalJson(value: unknown) {
    if (!isRecord(value)) return;
    setExtensionRecord('x-conditional', value);
  }

  function clearConditional() {
    onChange((draft) => {
      delete draft['x-conditional'];
    });
  }

  function setValidationField(key: string, value: string) {
    const next =
      key === 'parameters'
        ? { ...validation, parameters: parseJsonObjectOrUndefined(value) }
        : { ...validation, [key]: value.trim() || undefined };
    setExtensionRecord('x-validation', next);
  }

  function setValidationErrorMessages(value: LocalizedTextMap) {
    setExtensionRecord('x-validation', {
      ...validation,
      errorMessages: Object.keys(value).length > 0 ? value : undefined,
    });
  }

  return (
    <div
      className="border-border-subtle bg-surface/60 mt-1 space-y-3 rounded-md border p-3"
      style={{ marginLeft: depth * 16 + 28 }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Schema configuration</p>
          <p className="text-[10px] text-muted-foreground">Standard JSON Schema rules and vNext platform extensions.</p>
        </div>
        <Badge variant="muted" className="px-1.5 py-0.5 text-[9px]">
          {schemaType}
        </Badge>
      </div>

      <Tabs defaultValue="labels" className="gap-3">
        <TabsList variant="secondary" className="h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="constraints" variant="secondary" className="h-7 px-2 text-[10px]">Constraints</TabsTrigger>
          <TabsTrigger value="labels" variant="secondary" className="h-7 px-2 text-[10px]">Labels</TabsTrigger>
          <TabsTrigger value="messages" variant="secondary" className="h-7 px-2 text-[10px]">Messages</TabsTrigger>
          <TabsTrigger value="options" variant="secondary" className="h-7 px-2 text-[10px]">Options</TabsTrigger>
          <TabsTrigger value="data" variant="secondary" className="h-7 px-2 text-[10px]">Data</TabsTrigger>
          <TabsTrigger value="rules" variant="secondary" className="h-7 px-2 text-[10px]">Rules</TabsTrigger>
          <TabsTrigger value="meta" variant="secondary" className="h-7 px-2 text-[10px]">Meta</TabsTrigger>
        </TabsList>

        <TabsContent value="constraints" className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <Field label="minLength">
              <Input
                size="sm"
                type="number"
                value={asString(schema.minLength)}
                onChange={(event) => setNumberSchemaValue('minLength', event.target.value)}
              />
            </Field>
            <Field label="maxLength">
              <Input
                size="sm"
                type="number"
                value={asString(schema.maxLength)}
                onChange={(event) => setNumberSchemaValue('maxLength', event.target.value)}
              />
            </Field>
            <Field label="minimum">
              <Input
                size="sm"
                type="number"
                value={asString(schema.minimum)}
                onChange={(event) => setNumberSchemaValue('minimum', event.target.value)}
              />
            </Field>
            <Field label="maximum">
              <Input
                size="sm"
                type="number"
                value={asString(schema.maximum)}
                onChange={(event) => setNumberSchemaValue('maximum', event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="pattern">
              <Input
                size="sm"
                value={asString(schema.pattern)}
                onChange={(event) => setSchemaValue('pattern', event.target.value.trim() || undefined)}
                placeholder="^[A-Z0-9]+$"
              />
            </Field>
            <Field label="format">
              <Select
                className="h-8 text-xs"
                value={asString(schema.format)}
                onChange={(event) => setSchemaValue('format', event.target.value || undefined)}>
                {FORMAT_VALUES.map((format) => (
                  <option key={format || 'none'} value={format}>{format || 'None'}</option>
                ))}
              </Select>
            </Field>
            <Field label="const">
              <Input
                size="sm"
                value={asString(schema.const)}
                onChange={(event) => setSchemaValue('const', parsePrimitive(event.target.value))}
                placeholder="true"
              />
            </Field>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="default">
              <Input
                size="sm"
                value={asString(schema.default)}
                onChange={(event) => setSchemaValue('default', parsePrimitive(event.target.value))}
              />
            </Field>
            <JsonObjectEditor
              label="not"
              value={getRecord(schema.not)}
              placeholder={'{"const":"deprecated"}'}
              onChange={(value) => setJsonSchemaValue('not', Object.keys(value).length > 0 ? value : undefined)}
            />
          </div>
          <JsonArrayEditor
            label="allOf"
            value={Array.isArray(schema.allOf) ? schema.allOf : []}
            placeholder={'[{"if":{"properties":{"customerType":{"const":"individual"}}},"then":{"required":["tckn"]}}]'}
            onChange={(value) => setJsonSchemaValue('allOf', value.length > 0 ? value : undefined)}
          />
          <JsonArrayEditor
            label="anyOf"
            value={Array.isArray(schema.anyOf) ? schema.anyOf : []}
            placeholder={'[{"required":["email"]},{"required":["phone"]}]'}
            onChange={(value) => setJsonSchemaValue('anyOf', value.length > 0 ? value : undefined)}
          />
        </TabsContent>

        <TabsContent value="labels">
          <LocalizedTextMapEditor
            label="x-labels"
            value={toLocalizedTextMap(labels)}
            onChange={(value) => setLocalizedExtension('x-labels', value)}
          />
        </TabsContent>

        <TabsContent value="messages" className="space-y-3">
          {ERROR_MESSAGE_KEYS.map((key) => (
            <LocalizedTextMapEditor
              key={key}
              label={`x-errorMessages.${key}`}
              value={toLocalizedTextMap(errorMessages[key])}
              onChange={(value) => setErrorMessages(key, value)}
            />
          ))}
        </TabsContent>

        <TabsContent value="options" className="space-y-3">
          <Field label="Enum values" hint="Separate values with commas or new lines. Labels are stored in x-enum.">
            <Textarea
              className="min-h-16 font-mono text-xs"
              value={enumValues.join('\n')}
              onChange={(event) => setEnumValues(event.target.value)}
              placeholder={'individual\ncorporate'}
            />
          </Field>
          {enumValues.map((value) => (
            <LocalizedTextMapEditor
              key={value}
              label={`x-enum.${value}`}
              value={toLocalizedTextMap(xEnum[value])}
              onChange={(localizedValue) => setEnumLabel(value, localizedValue)}
            />
          ))}
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataSourceEditor
            label="x-lov"
            source={lov}
            resultFieldKey="displayField"
            resultFieldLabel="Display field"
            resultFieldPlaceholder="$.response.data.name"
            showValueField
            onFieldChange={setLovField}
            onFilterChange={setLovFilter}
          />
          <DataSourceEditor
            label="x-lookup"
            source={lookup}
            resultFieldKey="resultField"
            resultFieldLabel="Result field"
            resultFieldPlaceholder="$.response.data"
            onFieldChange={setLookupField}
            onFilterChange={setLookupFilter}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Field label="Condition">
              <Select className="h-8 text-xs" value={conditionalKind} onChange={(e) => setConditionalKind(e.target.value)}>
                {CONDITIONAL_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </Select>
            </Field>
            <Field label="Field">
              <Input size="sm" value={asString(conditionalRule.field)} onChange={(e) => setConditionalField('field', e.target.value)} placeholder="customerType" />
            </Field>
            <Field label="Operator">
              <Select className="h-8 text-xs" value={asString(conditionalRule.operator) || 'equals'} onChange={(e) => setConditionalField('operator', e.target.value)}>
                {CONDITIONAL_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
              </Select>
            </Field>
            <Field label="Value">
              <div className="flex gap-1">
                <Input size="sm" value={asString(conditionalRule.value)} onChange={(e) => setConditionalField('value', e.target.value)} placeholder="individual" />
                <Button type="button" variant="ghost" size="icon" className="size-8" title="Clear condition" onClick={clearConditional}>
                  <X size={12} />
                </Button>
              </div>
            </Field>
          </div>
          <JsonObjectEditor
            label="Compound x-conditional JSON"
            hint="Use allOf, anyOf, or not for compound visibility/enabled rules."
            value={conditional}
            placeholder={'{"showIf":{"allOf":[{"field":"customerType","operator":"equals","value":"individual"}]}}'}
            onChange={setConditionalJson}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Validation rule">
              <Input size="sm" value={asString(validation.rule)} onChange={(e) => setValidationField('rule', e.target.value)} placeholder="validateEmailDomain" />
            </Field>
            <JsonObjectEditor
              label="Validation parameters"
              value={getRecord(validation.parameters)}
              placeholder={'{"blockedDomains":["tempmail.com"]}'}
              onChange={(value) => setValidationField('parameters', JSON.stringify(value))}
            />
          </div>
          <LocalizedTextMapEditor
            label="x-validation.errorMessages"
            value={toLocalizedTextMap(validation.errorMessages)}
            onChange={setValidationErrorMessages}
          />
        </TabsContent>

        <TabsContent value="meta" className="grid gap-2 md:grid-cols-2">
          <Field label="x-binding">
            <Select className="h-8 text-xs" value={asString(schema['x-binding'])} onChange={(e) => setBinding(e.target.value)}>
              {BINDING_TYPES.map((type) => <option key={type || 'none'} value={type}>{type || 'None'}</option>)}
            </Select>
          </Field>
          <Field label="x-encryption">
            <Select className="h-8 text-xs" value={asString(encryption.type)} onChange={(e) => setEncryptionType(e.target.value)}>
              <option value="">None</option>
              {ENCRYPTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </Field>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DataSourceEditorProps {
  label: string;
  onFieldChange: (key: string, value: string) => void;
  onFilterChange: (filter: unknown[]) => void;
  resultFieldKey: 'displayField' | 'resultField';
  resultFieldLabel: string;
  resultFieldPlaceholder: string;
  showValueField?: boolean;
  source: Record<string, unknown>;
}

function DataSourceEditor({
  label,
  onFieldChange,
  onFilterChange,
  resultFieldKey,
  resultFieldLabel,
  resultFieldPlaceholder,
  showValueField = false,
  source,
}: DataSourceEditorProps) {
  const filter = Array.isArray(source.filter) ? source.filter.filter(isRecord) : [];

  function updateFilter(index: number, key: string, value: string | boolean) {
    const next = filter.map((item) => ({ ...item }));
    next[index] = { ...next[index], [key]: value };
    onFilterChange(next.map(pruneEmptyRecord).filter((item) => Object.keys(item).length > 0));
  }

  function addFilter() {
    onFilterChange([...filter, { param: '', value: '', required: false }]);
  }

  function removeFilter(index: number) {
    onFilterChange(filter.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="border-border-subtle rounded-md border p-2">
      <p className="mb-2 text-[11px] font-semibold text-foreground">{label}</p>
      <div className="grid gap-2 md:grid-cols-3">
        <Field label="Source">
          <Input
            size="sm"
            value={asString(source.source)}
            onChange={(event) => onFieldChange('source', event.target.value)}
            placeholder="urn:amorphie:func:domain:shared:get-cities"
          />
        </Field>
        {showValueField ? (
          <Field label="Value field">
            <Input
              size="sm"
              value={asString(source.valueField)}
              onChange={(event) => onFieldChange('valueField', event.target.value)}
              placeholder="$.response.data.code"
            />
          </Field>
        ) : null}
        <Field label={resultFieldLabel}>
          <Input
            size="sm"
            value={asString(source[resultFieldKey])}
            onChange={(event) => onFieldChange(resultFieldKey, event.target.value)}
            placeholder={resultFieldPlaceholder}
          />
        </Field>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-primary-text/75 text-xs font-semibold">Filter</p>
          <Button type="button" variant="secondary" size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={addFilter}>
            <Plus size={11} />
            Add filter
          </Button>
        </div>
        {filter.map((item, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <Input
              size="sm"
              value={asString(item.param)}
              onChange={(event) => updateFilter(index, 'param', event.target.value)}
              placeholder="cityCode"
              aria-label={`${label} filter param`}
            />
            <Input
              size="sm"
              value={asString(item.value)}
              onChange={(event) => updateFilter(index, 'value', event.target.value)}
              placeholder="$form.city"
              aria-label={`${label} filter value`}
            />
            <label className="text-muted-foreground flex h-8 items-center gap-1 text-[10px]">
              <input
                type="checkbox"
                checked={item.required === true}
                onChange={(event) => updateFilter(index, 'required', event.target.checked)}
              />
              Required
            </label>
            <Button type="button" variant="ghost" size="icon" className="size-8" title="Remove filter" onClick={() => removeFilter(index)}>
              <X size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface JsonObjectEditorProps {
  hint?: string;
  label: string;
  onChange: (value: Record<string, unknown>) => void;
  placeholder?: string;
  value: Record<string, unknown>;
}

function JsonObjectEditor({ hint, label, onChange, placeholder, value }: JsonObjectEditorProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function commit(nextDraft: string) {
    setDraft(nextDraft);
    if (!nextDraft.trim()) {
      setError(null);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(nextDraft) as unknown;
      if (!isRecord(parsed)) {
        setError('JSON value must be an object.');
        return;
      }
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON object.');
    }
  }

  return (
    <Field label={label} hint={hint} errorMsg={error}>
      <Textarea
        className="min-h-20 font-mono text-xs"
        value={draft}
        onChange={(event) => commit(event.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

interface JsonArrayEditorProps {
  hint?: string;
  label: string;
  onChange: (value: unknown[]) => void;
  placeholder?: string;
  value: unknown[];
}

function JsonArrayEditor({ hint, label, onChange, placeholder, value }: JsonArrayEditorProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function commit(nextDraft: string) {
    setDraft(nextDraft);
    if (!nextDraft.trim()) {
      setError(null);
      onChange([]);
      return;
    }
    try {
      const parsed = JSON.parse(nextDraft) as unknown;
      if (!Array.isArray(parsed)) {
        setError('JSON value must be an array.');
        return;
      }
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON array.');
    }
  }

  return (
    <Field label={label} hint={hint} errorMsg={error}>
      <Textarea
        className="min-h-20 font-mono text-xs"
        value={draft}
        onChange={(event) => commit(event.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

function SchemaCompositionRules({ schema, onChange }: SchemaTreeProps) {
  function setArrayComposition(key: 'allOf' | 'anyOf', value: unknown[]) {
    onChange((draft) => {
      if (value.length === 0) delete draft[key];
      else draft[key] = value;
    });
  }

  function setNotComposition(value: Record<string, unknown>) {
    onChange((draft) => {
      if (Object.keys(value).length === 0) delete draft.not;
      else draft.not = value;
    });
  }

  return (
    <div className="border-border-subtle bg-surface/60 mt-2 space-y-3 rounded-md border p-3">
      <p className="text-[11px] font-semibold text-foreground">Conditional required rules</p>
      <JsonArrayEditor
        label="allOf"
        hint="JSON Schema allOf array."
        value={Array.isArray(schema.allOf) ? schema.allOf : []}
        placeholder={'[{"if":{"properties":{"customerType":{"const":"individual"}},"required":["customerType"]},"then":{"required":["tckn","birthDate"]}}]'}
        onChange={(value) => setArrayComposition('allOf', value)}
      />
      <JsonArrayEditor
        label="anyOf"
        hint="JSON Schema anyOf array."
        value={Array.isArray(schema.anyOf) ? schema.anyOf : []}
        placeholder={'[{"required":["email"]},{"required":["phone"]}]'}
        onChange={(value) => setArrayComposition('anyOf', value)}
      />
      <JsonObjectEditor
        label="not"
        value={getRecord(schema.not)}
        placeholder={'{"required":["deprecatedField"]}'}
        onChange={setNotComposition}
      />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function toLocalizedTextMap(value: unknown): LocalizedTextMap {
  if (!isRecord(value)) return {};
  const next: LocalizedTextMap = {};
  for (const [language, text] of Object.entries(value)) {
    if (typeof text === 'string' && text.trim()) next[language] = text;
  }
  return next;
}

function parseJsonObjectOrUndefined(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parsePrimitive(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function pruneEmptyRecord(record: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === '') continue;
    if (isRecord(value)) {
      const nested = pruneEmptyRecord(value);
      if (Object.keys(nested).length > 0) next[key] = nested;
      continue;
    }
    next[key] = value;
  }
  return next;
}

function ensureProperties(schema: SchemaNode) {
  if (!schema.properties || typeof schema.properties !== 'object') {
    schema.properties = {};
  }

  return schema.properties as Record<string, SchemaNode>;
}
