import { type JsonPointer } from '../../../../model/jsonPointer';
import { getNodeType, type PrimitiveType } from '../../../../model/schemaNode';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { ArrayConstraints } from '../../constraints/ArrayConstraints';
import { NumberConstraints } from '../../constraints/NumberConstraints';
import { ObjectConstraints } from '../../constraints/ObjectConstraints';
import { StringConstraints } from '../../constraints/StringConstraints';

interface ConstraintsTabProps {
  pointer: JsonPointer;
}

/**
 * Type-aware constraints editor. Renders the constraint group(s) that
 * apply to the selected node's `type`. Nodes without an explicit type
 * fall back to a hint telling the user to set one in the General tab.
 */
export function ConstraintsTab({ pointer }: ConstraintsTabProps) {
  const { node } = useSchemaNode(pointer);

  if (!node) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Select a property in the tree to edit its constraints.
      </div>
    );
  }

  const type = getNodeType(node);

  if (type === null) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Set a primitive type in the General tab to unlock matching constraints.
      </div>
    );
  }

  return <ConstraintsByType pointer={pointer} type={type} />;
}

function ConstraintsByType({ pointer, type }: { pointer: JsonPointer; type: PrimitiveType }) {
  switch (type) {
    case 'string':
      return <StringConstraints pointer={pointer} />;
    case 'number':
      return <NumberConstraints pointer={pointer} />;
    case 'integer':
      return <NumberConstraints pointer={pointer} integerOnly />;
    case 'array':
      return <ArrayConstraints pointer={pointer} />;
    case 'object':
      return <ObjectConstraints pointer={pointer} />;
    case 'boolean':
    case 'null':
      return (
        <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
          {type === 'boolean' ? 'Boolean' : 'Null'} schemas have no constraint keywords. Use
          General → Const if you need to lock the value.
        </div>
      );
  }
}
