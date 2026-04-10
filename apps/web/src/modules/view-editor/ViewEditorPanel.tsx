import { useState } from 'react';
import { LabelEditor } from '@modules/save-component/components/LabelEditor';
import { getViewEditorFieldError } from '@modules/view-editor/ViewEditorSchema';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Field } from '@shared/ui/Field';
import { Input } from '@shared/ui/Input';
import { JsonCodeField } from '@shared/ui/JsonCodeField';
import { TagEditor } from '@shared/ui/TagEditor';

interface ViewEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

const DISPLAY_STRATEGIES = [
  { value: 'full-page', label: 'Full Page', desc: 'Takes full screen' },
  { value: 'popup', label: 'Popup', desc: 'Modal dialog' },
  { value: 'drawer', label: 'Drawer', desc: 'Side panel' },
  { value: 'bottom-sheet', label: 'Bottom Sheet', desc: 'Slides up' },
  { value: 'top-sheet', label: 'Top Sheet', desc: 'Slides down' },
  { value: 'inline', label: 'Inline', desc: 'Embedded in page' },
];

const PLATFORMS = ['default', 'web', 'ios', 'android'] as const;

export function ViewEditorPanel({ json, onChange }: ViewEditorPanelProps) {
  const [platform, setPlatform] = useState<'default' | 'web' | 'ios' | 'android'>('default');
  const attrs = (json.attributes || {}) as Record<string, unknown>;
  const version = String(json.version || '');
  const domain = String(json.domain || '');
  const flow = String(json.flow || '');
  const versionError = getViewEditorFieldError('version', version);
  const domainError = getViewEditorFieldError('domain', domain);
  const flowError = getViewEditorFieldError('flow', flow);

  return (
    <div className="space-y-4 p-4">
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">View Metadata</CardTitle>
          <CardDescription className="text-xs">Identity and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Key">
                <Input
                  type="text"
                  value={String(json.key || '')}
                  readOnly
                  variant="muted"
                  className="w-full"
                  inputClassName="font-mono text-xs"
                />
              </Field>
              <Field label="Version" errorMsg={versionError}>
                <Input
                  type="text"
                  value={version}
                  onChange={(e) => onChange((draft) => { draft.version = e.target.value; })}
                  className="w-full"
                  inputClassName="font-mono text-xs"
                  aria-invalid={Boolean(versionError)}
                />
              </Field>
              <Field label="Domain" errorMsg={domainError}>
                <Input
                  type="text"
                  value={domain}
                  onChange={(e) => onChange((draft) => { draft.domain = e.target.value; })}
                  className="w-full"
                  inputClassName="font-mono text-xs"
                  aria-invalid={Boolean(domainError)}
                />
              </Field>
              <Field label="Flow" errorMsg={flowError}>
                <Input
                  type="text"
                  value={flow}
                  onChange={(e) => onChange((draft) => { draft.flow = e.target.value; })}
                  className="w-full"
                  inputClassName="font-mono text-xs"
                  aria-invalid={Boolean(flowError)}
                />
              </Field>
            </div>
            <Field label="Labels">
              <LabelEditor
                labels={(json.label as any[]) || []}
                onChange={(labels) => onChange((draft) => { draft.label = labels; })}
              />
            </Field>
            <Field label="Tags">
              <TagEditor
                tags={(json.tags as string[]) || []}
                onChange={(tags) => onChange((draft) => { draft.tags = tags; })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Display Strategy</CardTitle>
          <CardDescription className="text-xs">How the view is presented.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-1">
            {DISPLAY_STRATEGIES.map((strategy) => (
              <Button
                key={strategy.value}
                type="button"
                variant={String(attrs.displayStrategy) === strategy.value ? 'success' : 'default'}
                aria-pressed={String(attrs.displayStrategy) === strategy.value}
                onClick={() =>
                  onChange((draft) => {
                    if (!draft.attributes) draft.attributes = {};
                    (draft.attributes as Record<string, unknown>).displayStrategy = strategy.value;
                  })
                }
                className="h-auto flex-1 rounded-xl px-3 py-2 text-xs">
                <span className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">{strategy.label}</span>
                  <span className="text-[10px] opacity-70">{strategy.desc}</span>
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b flex-row items-center">
          <div>
            <CardTitle className="text-base">Content</CardTitle>
            <CardDescription className="text-xs">Platform-specific HTML content.</CardDescription>
          </div>
          <div className="ml-auto flex gap-1">
            {PLATFORMS.map((p) => (
              <Button
                key={p}
                type="button"
                variant={platform === p ? 'success' : 'default'}
                size="sm"
                aria-pressed={platform === p}
                onClick={() => setPlatform(p)}
                className="h-6 px-2 text-[10px]">
                {p}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <JsonCodeField
            value={getContentForPlatform(attrs, platform)}
            onChange={(value) =>
              onChange((draft) => {
                if (!draft.attributes) draft.attributes = {};
                setContentForPlatform(draft.attributes as Record<string, unknown>, platform, value);
              })
            }
            language="json"
            height={300}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function getContentForPlatform(attrs: Record<string, unknown>, platform: string): string {
  if (platform === 'default') {
    return String(attrs.content || '');
  }

  const overrides = (attrs.platformOverrides || {}) as Record<string, Record<string, unknown>>;
  return String(overrides[platform]?.content || attrs.content || '');
}

function setContentForPlatform(
  attrs: Record<string, unknown>,
  platform: string,
  content: string,
) {
  if (platform === 'default') {
    attrs.content = content;
    return;
  }

  if (!attrs.platformOverrides) {
    attrs.platformOverrides = {};
  }

  const overrides = attrs.platformOverrides as Record<string, Record<string, unknown>>;

  if (!overrides[platform]) {
    overrides[platform] = {};
  }

  overrides[platform].content = content;
}
