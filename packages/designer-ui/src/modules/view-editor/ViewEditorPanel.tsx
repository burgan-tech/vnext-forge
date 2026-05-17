import { useCallback, useState } from 'react';
import { ViewType } from '@vnext-forge-studio/vnext-types';
import { LabelEditor } from '../../modules/save-component/components/LabelEditor';
import { getViewEditorFieldError } from '../../modules/view-editor/ViewEditorSchema';
import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
} from '../component-metadata';
import { ConfirmAlertDialog } from '../../ui/AlertDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { ComponentDescriptionField } from '../../ui/ComponentDescriptionField';
import { Field } from '../../ui/Field';
import { JsonCodeField } from '../../ui/JsonCodeField';
import { TagEditor } from '../../ui/TagEditor';
import { ComponentValidationSummary } from '../save-component/components/ComponentValidationSummary';
import { ViewDisplayStrategyPicker } from './components/ViewDisplayStrategyPicker';
import { ViewTypePicker } from './components/ViewTypePicker';
import { HrefUrnField } from './components/HrefUrnField';
import { ViewContentPreview } from './components/ViewContentPreview';
import {
  viewTypeToMonacoLanguage,
  scaffoldContentForViewType,
  isContentEmpty,
  isLinkType,
} from './viewContentHelpers';

interface ViewEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  showPreview?: boolean;
}

const VIEW_TYPE_LABELS: Record<number, string> = {
  [ViewType.Json]: 'JSON',
  [ViewType.Html]: 'HTML',
  [ViewType.Markdown]: 'Markdown',
  [ViewType.DeepLink]: 'Deep Link',
  [ViewType.Http]: 'HTTP',
  [ViewType.URN]: 'URN',
};

export function ViewEditorPanel({ json, onChange, showPreview = false }: ViewEditorPanelProps) {
  const [pendingType, setPendingType] = useState<number | null>(null);

  const attrs = (json.attributes || {}) as Record<string, unknown>;
  const currentType = Number(attrs.type ?? ViewType.Json);
  const version = String(json.version || '');
  const domain = String(json.domain || '');
  const flow = String(json.flow || '');
  const versionError = getViewEditorFieldError('version', version);
  const domainError = getViewEditorFieldError('domain', domain);
  const flowError = getViewEditorFieldError('flow', flow);

  const monacoLanguage = viewTypeToMonacoLanguage(currentType);
  const contentValue = String(attrs.content || '');

  const applyTypeChange = useCallback(
    (nextType: number) => {
      onChange((draft) => {
        if (!draft.attributes) draft.attributes = {};
        const a = draft.attributes as Record<string, unknown>;
        a.type = nextType;
        a.content = scaffoldContentForViewType(nextType);
      });
    },
    [onChange],
  );

  const handleTypeChange = useCallback(
    (nextType: number) => {
      if (nextType === currentType) return;

      if (isContentEmpty(contentValue)) {
        applyTypeChange(nextType);
      } else {
        setPendingType(nextType);
      }
    },
    [currentType, contentValue, applyTypeChange],
  );

  const handleContentChange = useCallback(
    (value: string) => {
      onChange((draft) => {
        if (!draft.attributes) draft.attributes = {};
        (draft.attributes as Record<string, unknown>).content = value;
      });
    },
    [onChange],
  );

  return (
    <div className="space-y-4 p-4">
      <ComponentValidationSummary />
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
                labels={(attrs.labels as { language: string; label: string }[]) || []}
                onChange={(labels) =>
                  onChange((draft) => {
                    if (!draft.attributes) draft.attributes = {};
                    (draft.attributes as Record<string, unknown>).labels = labels;
                  })
                }
              />
            </Field>
            <Field label="Tags">
              <TagEditor
                tags={(json.tags as string[]) || []}
                onChange={(tags) => onChange((draft) => { draft.tags = tags; })}
              />
            </Field>
            <ComponentDescriptionField
              value={String(json._comment || '')}
              onChange={(value) => onChange((d) => { d._comment = value || undefined; })}
            />
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
            value={String(attrs.display ?? 'full-page')}
            onChange={(strategy) =>
              onChange((draft) => {
                if (!draft.attributes) draft.attributes = {};
                (draft.attributes as Record<string, unknown>).display = strategy;
              })
            }
          />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Content</CardTitle>
          <CardDescription className="text-xs">
            Choose what kind of payload this view carries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <Field label="Content Type">
            <ViewTypePicker value={currentType} onChange={handleTypeChange} />
          </Field>

          {isLinkType(currentType) ? (
            <HrefUrnField
              viewType={currentType}
              value={contentValue}
              onChange={handleContentChange}
            />
          ) : (
            <JsonCodeField
              value={contentValue}
              onChange={handleContentChange}
              language={monacoLanguage}
              height={300}
            />
          )}
        </CardContent>
      </Card>

      {showPreview && (
        <Card variant="default" className="gap-0 overflow-hidden">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription className="text-xs">
              Rendered view content.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ViewContentPreview viewType={currentType} content={contentValue} />
          </CardContent>
        </Card>
      )}

      <ConfirmAlertDialog
        open={pendingType !== null}
        onOpenChange={(open) => { if (!open) setPendingType(null); }}
        tone="warning"
        title="Change content type?"
        description={`Switching to ${VIEW_TYPE_LABELS[pendingType ?? ViewType.Json]} will replace the current content with a template. This can be undone.`}
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingType !== null) {
            applyTypeChange(pendingType);
            setPendingType(null);
          }
        }}
      />
    </div>
  );
}
