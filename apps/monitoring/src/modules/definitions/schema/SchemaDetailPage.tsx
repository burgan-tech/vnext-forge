import { useState } from 'react';
import { Badge, Button, JsonCodeField } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import Ajv from 'ajv/dist/2020';

const ajv = new Ajv({ allErrors: true, strict: false });

type Tab = 'overview' | 'definition' | 'test';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'test', label: 'Test' },
];

type ValidationResult =
  | { status: 'valid' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'parse-error'; message: string }
  | { status: 'schema-error'; message: string };

function validate(schemaData: Record<string, unknown>, input: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return { status: 'parse-error', message: e instanceof Error ? e.message : String(e) };
  }

  let compiledValidate: ReturnType<typeof ajv.compile>;
  try {
    compiledValidate = ajv.compile(schemaData);
  } catch (e) {
    return { status: 'schema-error', message: e instanceof Error ? e.message : String(e) };
  }

  const valid = compiledValidate(parsed);
  if (valid) return { status: 'valid' };

  const errors = (compiledValidate.errors ?? []).map((err) => {
    const path = err.instancePath || '(root)';
    return `${path}: ${err.message ?? 'validation failed'}`;
  });
  return { status: 'invalid', errors };
}

export function SchemaDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [result, setResult] = useState<ValidationResult | null>(null);

  const { data, isLoading } = useComponentDetail('schema', id);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading schema…</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Schema not found</div>;

  const type = data.type != null ? String(data.type) : null;
  const comment = data._comment ? String(data._comment) : null;
  const key = String(data.key ?? '—');
  const flow = String(data.flow ?? '—');
  const flowVersion = String(data.flowVersion ?? '—');
  type LabelItem = { label: string; language?: string } | string;
  const rawLabels = Array.isArray(data.labels) ? (data.labels as LabelItem[]) : [];
  const labels = rawLabels.map((l) => (typeof l === 'string' ? l : l.label));
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];

  function handleValidate() {
    if (!data) return;
    setResult(validate(data, testInput));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{String(data.key ?? id)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{String(data.domain ?? '')} · {String(data.version ?? '')}</p>
        </div>
        <VersionPicker currentVersion={String(data.version ?? '')} versions={[String(data.version ?? '')]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {type && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{type}</Badge>
            </div>
          )}
          {comment && <p className="text-sm text-muted-foreground">{comment}</p>}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <span className="text-muted-foreground">Key</span>
            <span className="font-mono text-foreground">{key}</span>
            <span className="text-muted-foreground">Flow</span>
            <span className="font-mono text-foreground">{flow}</span>
            <span className="text-muted-foreground">Flow Version</span>
            <span className="font-mono text-foreground">{flowVersion}</span>
          </div>
          {labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Labels</span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
                ))}
              </div>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'test' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Enter a JSON object to validate against this schema (JSON Schema draft 2020-12).
          </p>
          <JsonCodeField
            value={testInput}
            language="json"
            height={240}
            onChange={(v) => { setTestInput(v); setResult(null); }}
          />
          <div className="flex items-start gap-3">
            <Button onClick={handleValidate} size="sm">Validate</Button>
            {result && (
              <div className="flex flex-col gap-1">
                {result.status === 'valid' && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ Valid
                  </span>
                )}
                {result.status === 'parse-error' && (
                  <span className="text-sm font-medium text-destructive">
                    ✗ Invalid JSON: {result.message}
                  </span>
                )}
                {result.status === 'schema-error' && (
                  <span className="text-sm font-medium text-destructive">
                    ✗ Schema compile error: {result.message}
                  </span>
                )}
                {result.status === 'invalid' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-destructive">
                      ✗ Validation failed ({result.errors.length} error{result.errors.length !== 1 ? 's' : ''})
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {result.errors.map((err, i) => (
                        <li key={i} className="font-mono text-xs text-destructive/80">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
