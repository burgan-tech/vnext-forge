import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { Select } from '../../../ui/Select';
import { Textarea } from '../../../ui/Textarea';
import { AcceptedStatusCodesField } from './shared';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function SoapTaskForm({ config, onChange }: Props) {
  const headers = config.headers as Record<string, string> | undefined;
  const headerPairs = headers
    ? Object.entries(headers).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-3">
      <Field label="URL" required>
        <Input
          type="text"
          value={String(config.url || '')}
          onChange={(e) => onChange((d: any) => { d.url = e.target.value; })}
          placeholder="https://api.example.com/services/CustomerService"
          size="sm"
          inputClassName="font-mono text-xs"
        />
      </Field>
      <Field label="SOAPAction">
        <Input
          type="text"
          value={String(config.soapAction || '')}
          onChange={(e) => onChange((d: any) => { d.soapAction = e.target.value; })}
          placeholder="http://example.com/GetCustomer"
          size="sm"
          inputClassName="font-mono text-xs"
        />
      </Field>
      <Field label="SOAP Version">
        <Select
          value={String(config.soapVersion || '1.1')}
          onChange={(e) => onChange((d: any) => { d.soapVersion = e.target.value; })}
          className="text-xs">
          <option value="1.1">1.1</option>
          <option value="1.2">1.2</option>
        </Select>
      </Field>
      <Field label="Body (XML)">
        <Textarea
          value={String(config.body ?? '')}
          onChange={(e) => onChange((d: any) => {
            d.body = e.target.value || undefined;
          })}
          placeholder="<soapenv:Envelope>...</soapenv:Envelope>"
          className="min-h-40 font-mono text-xs"
        />
      </Field>
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
      <div className="grid grid-cols-2 gap-3">
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
        <Field label="Validate SSL">
          <Select
            value={config.validateSsl === false ? 'false' : 'true'}
            onChange={(e) => onChange((d: any) => { d.validateSsl = e.target.value === 'true'; })}
            className="text-xs">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </Field>
      </div>
      <AcceptedStatusCodesField
        value={config.acceptedStatusCodes as string[] | undefined}
        onChange={onChange}
      />
    </div>
  );
}
