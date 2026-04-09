import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface SchemaTreeProps {
  schema: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function SchemaTree({ schema, onChange }: SchemaTreeProps) {
  const properties = (schema.properties || {}) as Record<string, any>;
  const required = (schema.required || []) as string[];

  function addProperty() {
    const name = prompt('Property name:');
    if (!name) return;
    onChange((draft: any) => {
      if (!draft.properties) draft.properties = {};
      draft.properties[name] = { type: 'string' };
    });
  }

  function removeProperty(propName: string) {
    onChange((draft: any) => {
      if (draft.properties) delete draft.properties[propName];
      if (draft.required) {
        draft.required = (draft.required as string[]).filter((r: string) => r !== propName);
      }
    });
  }

  function updatePropertyType(propName: string, newType: string) {
    onChange((draft: any) => {
      if (draft.properties?.[propName]) {
        draft.properties[propName].type = newType;
        if (newType === 'object' && !draft.properties[propName].properties) {
          draft.properties[propName].properties = {};
        }
      }
    });
  }

  function toggleRequired(propName: string) {
    onChange((draft: any) => {
      if (!draft.required) draft.required = [];
      const idx = (draft.required as string[]).indexOf(propName);
      if (idx >= 0) {
        (draft.required as string[]).splice(idx, 1);
      } else {
        (draft.required as string[]).push(propName);
      }
    });
  }

  return (
    <div className="space-y-0.5">
      {typeof schema.title === 'string' && <div className="text-xs font-medium mb-2">{schema.title}</div>}
      {typeof schema.description === 'string' && <div className="text-[10px] text-muted-foreground mb-2">{schema.description}</div>}

      {Object.entries(properties).map(([propName, propSchema]) => (
        <SchemaPropertyRow
          key={propName}
          name={propName}
          schema={propSchema}
          isRequired={required.includes(propName)}
          onTypeChange={(t) => updatePropertyType(propName, t)}
          onToggleRequired={() => toggleRequired(propName)}
          onRemove={() => removeProperty(propName)}
          onChange={(updater) => {
            onChange((draft: any) => {
              if (draft.properties?.[propName]) updater(draft.properties[propName]);
            });
          }}
          depth={0}
        />
      ))}

      <button onClick={addProperty}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-2">
        <Plus size={10} /> Add property
      </button>
    </div>
  );
}

interface SchemaPropertyRowProps {
  name: string;
  schema: any;
  isRequired: boolean;
  onTypeChange: (type: string) => void;
  onToggleRequired: () => void;
  onRemove: () => void;
  onChange: (updater: (draft: any) => void) => void;
  depth: number;
}

function SchemaPropertyRow({ name, schema, isRequired, onTypeChange, onToggleRequired, onRemove, onChange, depth }: SchemaPropertyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = schema.type === 'object' && schema.properties;
  const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type || 'string';

  return (
    <div>
      <div className="flex items-center gap-1 py-1 px-1 text-xs hover:bg-muted/50 rounded group"
        style={{ paddingLeft: depth * 16 + 4 }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="w-4 text-muted-foreground">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <span className="w-4" />}

        <span className="font-mono text-[11px] min-w-[80px]">{name}</span>
        {isRequired && <span className="text-[9px] text-destructive">*</span>}

        <select value={schemaType} onChange={(e) => onTypeChange(e.target.value)}
          className="px-1 py-0.5 text-[10px] border border-border rounded bg-background ml-auto">
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="integer">integer</option>
          <option value="boolean">boolean</option>
          <option value="object">object</option>
          <option value="array">array</option>
          <option value="null">null</option>
        </select>

        <button onClick={onToggleRequired}
          className={`text-[9px] px-1 py-0.5 rounded ${isRequired ? 'bg-destructive/10 text-destructive' : 'hover:bg-muted text-muted-foreground'}`}
          title="Toggle required">
          req
        </button>

        <button onClick={onRemove}
          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100">
          <Trash2 size={10} />
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {Object.entries(schema.properties || {}).map(([childName, childSchema]: [string, any]) => (
            <SchemaPropertyRow
              key={childName}
              name={childName}
              schema={childSchema}
              isRequired={(schema.required || []).includes(childName)}
              onTypeChange={(t) => onChange((d) => { if (d.properties?.[childName]) d.properties[childName].type = t; })}
              onToggleRequired={() => onChange((d) => {
                if (!d.required) d.required = [];
                const idx = d.required.indexOf(childName);
                if (idx >= 0) d.required.splice(idx, 1);
                else d.required.push(childName);
              })}
              onRemove={() => onChange((d) => { if (d.properties) delete d.properties[childName]; })}
              onChange={(updater) => onChange((d) => { if (d.properties?.[childName]) updater(d.properties[childName]); })}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
