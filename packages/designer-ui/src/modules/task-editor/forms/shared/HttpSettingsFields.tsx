import { Field } from '../../../../ui/Field';
import { Input } from '../../../../ui/Input';
import { KVEditor } from '../../../../ui/KeyValueEditor';
import { Select } from '../../../../ui/Select';
import { AcceptedStatusCodesField } from './AcceptedStatusCodesField';

interface HttpSettingsFieldsProps {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
  showValidateSsl?: boolean;
}

/**
 * Shared fields for HTTP-capable task types:
 * timeoutSeconds, validateSsl (optional), headers (KVEditor), acceptedStatusCodes.
 */
export function HttpSettingsFields({ config, onChange, showValidateSsl = true }: HttpSettingsFieldsProps) {
  const headers = config.headers as Record<string, string> | undefined;
  const headerPairs = headers
    ? Object.entries(headers).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <>
      <div className={showValidateSsl ? 'grid grid-cols-2 gap-3' : ''}>
        <Field label="Timeout (seconds)">
          <Input
            type="number"
            value={Number(config.timeoutSeconds ?? 30)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.timeoutSeconds = Number.isFinite(n) ? n : undefined; });
            }}
            size="sm"
            inputClassName="text-xs"
          />
        </Field>
        {showValidateSsl ? (
          <Field label="Validate SSL">
            <Select
              value={config.validateSsl === false ? 'false' : 'true'}
              onChange={(e) => onChange((d: any) => { d.validateSsl = e.target.value === 'true'; })}
              className="text-xs"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </Field>
        ) : null}
      </div>
      <Field label="Headers">
        <KVEditor
          pairs={headerPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.headers = pairs.length > 0
              ? Object.fromEntries(pairs.map((p) => [p.key, p.value]))
              : undefined;
          })}
        />
      </Field>
      <AcceptedStatusCodesField
        value={config.acceptedStatusCodes as string[] | undefined}
        onChange={onChange}
      />
    </>
  );
}
