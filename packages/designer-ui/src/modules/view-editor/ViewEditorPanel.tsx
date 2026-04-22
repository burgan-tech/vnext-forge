import { useState } from 'react';
import { LabelEditor } from '../../modules/save-component/components/LabelEditor';
import { getViewEditorFieldError } from '../../modules/view-editor/ViewEditorSchema';
import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
} from '../component-metadata';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Field } from '../../ui/Field';
import { JsonCodeField } from '../../ui/JsonCodeField';
import { TagEditor } from '../../ui/TagEditor';
import { ViewDisplayStrategyPicker } from './components/ViewDisplayStrategyPicker';

interface ViewEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

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
                <MetadataEditableTextInput
                  value={String(json.key || '')}
                  onChange={(e) => onChange((draft) => { draft.key = e.target.value; })}
                />
              </Field>
              <Field label="Version" errorMsg={versionError}>
                <MetadataEditableTextInput
                  value={version}
                  onChange={(e) => onChange((draft) => { draft.version = e.target.value; })}
                  aria-invalid={Boolean(versionError)}
                />
              </Field>
              <Field label="Domain" errorMsg={domainError}>
                <MetadataLockedTextInput value={domain} aria-invalid={Boolean(domainError)} />
              </Field>
              <Field label="Flow" errorMsg={flowError}>
                <MetadataLockedTextInput value={flow} aria-invalid={Boolean(flowError)} />
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
          <ViewDisplayStrategyPicker
            value={String(attrs.displayStrategy ?? 'full-page')}
            onChange={(strategy) =>
              onChange((draft) => {
                if (!draft.attributes) draft.attributes = {};
                (draft.attributes as Record<string, unknown>).displayStrategy = strategy;
              })
            }
          />
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
