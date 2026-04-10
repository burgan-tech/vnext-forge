import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCancelButton,
} from '@shared/ui/Dialog';

type SchemaNode = Record<string, unknown>;
type SchemaUpdater = (draft: SchemaNode) => void;

const SCHEMA_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'] as const;

interface SchemaTreeProps {
  schema: SchemaNode;
  onChange: (updater: SchemaUpdater) => void;
}

export function SchemaTree({ schema, onChange }: SchemaTreeProps) {
  const properties = (schema.properties || {}) as Record<string, SchemaNode>;
  const required = (schema.required || []) as string[];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');

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
            <DialogDescription>Enter a name for the new schema property.</DialogDescription>
          </DialogHeader>

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
  const childProperties = (schema.properties as Record<string, SchemaNode> | undefined) ?? {};
  const hasChildren = schema.type === 'object' && Object.keys(childProperties).length > 0;
  const schemaType = String(Array.isArray(schema.type) ? schema.type[0] : schema.type || 'string');
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
          onClick={onRemove}
          variant="destructive"
          size="icon"
          className="size-6"
          title="Remove property">
          <Trash2 size={10} />
        </Button>
      </div>

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

function ensureProperties(schema: SchemaNode) {
  if (!schema.properties || typeof schema.properties !== 'object') {
    schema.properties = {};
  }

  return schema.properties as Record<string, SchemaNode>;
}
