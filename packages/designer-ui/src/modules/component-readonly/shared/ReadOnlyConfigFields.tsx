import { Field } from '../../../ui/Field.js';
import { Input } from '../../../ui/Input.js';
import { TagEditor } from '../../../ui/TagEditor.js';
import { ReadOnlyCodeField } from './ReadOnlyCodeField.js';
import { toDisplayText } from './readonlyText.js';

/**
 * Renders a config bag as designer form fields in quiet read-only
 * (FormReadOnlyContext supplies readOnly; the onChange handlers are no-ops).
 * Must be rendered inside `<FormReadOnlyProvider>`; otherwise the controls
 * appear editable.
 */
export function ReadOnlyConfigFields({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config);
  if (entries.length === 0) {
    return <div className="text-muted-foreground text-sm">No configuration.</div>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        if (value === null || value === undefined) return null;

        if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
          return (
            <Field key={key} label={key}>
              <TagEditor tags={value} onChange={() => undefined} />
            </Field>
          );
        }

        if (typeof value === 'object') {
          return (
            <Field key={key} label={key}>
              <ReadOnlyCodeField
                value={JSON.stringify(value, null, 2)}
                language="json"
                height={160}
                title={key}
              />
            </Field>
          );
        }

        return (
          <Field key={key} label={key}>
            <Input value={toDisplayText(value)} onChange={() => undefined} size="sm" />
          </Field>
        );
      })}
    </div>
  );
}
