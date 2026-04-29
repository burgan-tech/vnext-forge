import {
  SchemaReferenceField,
  type SchemaReference,
} from '../../../../../../modules/save-component/components/SchemaReferenceField';
import { OpenVnextComponentInModalButton } from '../../../../../../modules/save-component/components/OpenVnextComponentInModalButton.js';
import { ChooseFromExistingVnextComponentButton } from '../ChooseExistingTaskDialog';
import { CreateNewComponentButton } from '../CreateNewComponentDialog';
import { IconTrash, Section } from '../PropertyPanelShared';

interface TransitionSchemaSectionProps {
  schema: SchemaReference | null;
  onChange: (ref: SchemaReference | null) => void;
  onBrowse: () => void;
  onCreateNew: () => void;
  canPickExisting: boolean;
}

export function TransitionSchemaSection({
  schema,
  onChange,
  onBrowse,
  onCreateNew,
  canPickExisting,
}: TransitionSchemaSectionProps) {
  const hasSchema = schema?.key || schema?.flow;

  return (
    <Section title="Schema" defaultOpen={false}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Optional payload schema for this transition. Pick from the workspace, create a new one, or
        enter a reference manually.
      </p>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <ChooseFromExistingVnextComponentButton
          category="schemas"
          onClick={onBrowse}
          disabled={!canPickExisting}
          label="Choose from existing schemas"
          title={
            canPickExisting
              ? 'Pick a schema from workspace JSON files'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
        <CreateNewComponentButton
          category="schemas"
          onClick={onCreateNew}
          disabled={!canPickExisting}
        />
      </div>

      {hasSchema && <SchemaReferenceField value={schema} onChange={onChange} />}

      {hasSchema && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
            <IconTrash />
            Clear schema
          </button>

          {schema?.key && schema?.flow && (
            <OpenVnextComponentInModalButton
              componentKey={String(schema.key)}
              flow={String(schema.flow)}
              title="Open schema JSON in modal editor"
            />
          )}
        </div>
      )}
    </Section>
  );
}
