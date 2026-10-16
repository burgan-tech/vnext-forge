import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { useProjectStore } from '../../../store/useProjectStore';
import { parseJsonEditorValue, toJsonEditorValue } from '../TaskEditorSchema';

/**
 * Runtime 0.0.100 names its topics `vnext.{domain}.{environment}.*` (#1095) so
 * a Kafka ACL can grant a domain `vnext.{domain}.*`. Domain-authored topics are
 * used verbatim and must follow the same prefix under Kafka. A hint, not an
 * error: other pub/sub brokers accept any name.
 */
export function kafkaTopicHint(topic: string, domain: string | undefined): string | null {
  const trimmed = topic.trim();
  if (trimmed === '' || !domain) return null;
  if (trimmed.startsWith(`vnext.${domain}.`)) return null;
  return `On Kafka, runtime 0.0.100 expects topics named vnext.${domain}.{environment}.… (e.g. vnext.${domain}.production.order-created.v1); a domain's Kafka user is usually granted only vnext.${domain}.*.`;
}

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprPubSubTaskForm({ config, onChange }: Props) {
  const domain = useProjectStore((s) => s.vnextConfig?.domain);
  const topicHint = kafkaTopicHint(String(config.topic || ''), domain);
  const metadata = config.metadata as Record<string, string> | undefined;
  const metadataPairs = metadata
    ? Object.entries(metadata).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-3">
      <Field label="PubSub Name" required>
        <Input type="text" value={String(config.pubSubName || '')}
          onChange={(e) => onChange((d: any) => { d.pubSubName = e.target.value; })}
          placeholder="pubsub"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Topic" required>
        <Input type="text" value={String(config.topic || '')}
          onChange={(e) => onChange((d: any) => { d.topic = e.target.value; })}
          placeholder={domain ? `vnext.${domain}.production.my-event.v1` : 'my-topic'}
          size="sm"
          inputClassName="font-mono text-xs" />
        {topicHint ? <p className="text-[10px] text-amber-600 dark:text-amber-400">{topicHint}</p> : null}
      </Field>
      <Field label="Data (JSON)">
        <JsonCodeField
          value={toJsonEditorValue(config.data)}
          onChange={(value) => onChange((draft: any) => { draft.data = parseJsonEditorValue(value); })}
        />
      </Field>
      <Field label="Metadata">
        <KVEditor
          pairs={metadataPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.metadata = pairs.length > 0
              ? Object.fromEntries(pairs.map((p) => [p.key, p.value]))
              : undefined;
          })}
        />
      </Field>
    </div>
  );
}
