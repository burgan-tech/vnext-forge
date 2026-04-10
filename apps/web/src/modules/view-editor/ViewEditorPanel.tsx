import { useState } from 'react';
import { LabelEditor } from '@modules/save-component/components/LabelEditor';
import { getViewEditorFieldError } from '@modules/view-editor/ViewEditorSchema';
import { Field } from '@shared/ui/Field';
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

const INPUT_CLASS_NAME =
  'w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground';
const READONLY_INPUT_CLASS_NAME =
  'w-full rounded border border-muted-border bg-muted-surface px-2 py-1 font-mono text-xs text-muted-foreground';
const SELECTABLE_BUTTON_BASE_CLASS_NAME =
  'cursor-pointer rounded border p-2 text-left text-xs transition-colors';
const SELECTABLE_BUTTON_IDLE_CLASS_NAME =
  'border-primary-border bg-primary text-primary-text hover:border-primary-border-hover hover:bg-primary-hover';
const SELECTABLE_BUTTON_ACTIVE_CLASS_NAME =
  'border-primary-border bg-primary-muted text-primary-text';
const PLATFORM_BUTTON_BASE_CLASS_NAME =
  'cursor-pointer rounded border px-2 py-0.5 text-[10px] transition-colors';
const PLATFORM_BUTTON_IDLE_CLASS_NAME =
  'border-primary-border bg-primary text-muted-foreground hover:border-primary-border-hover hover:bg-primary-hover hover:text-primary-text';
const PLATFORM_BUTTON_ACTIVE_CLASS_NAME =
  'border-primary-border bg-primary-muted text-primary-text';

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
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key">
            <input
              type="text"
              value={String(json.key || '')}
              readOnly
              className={READONLY_INPUT_CLASS_NAME}
            />
          </Field>
          <Field label="Version" errorMsg={versionError}>
            <input
              type="text"
              value={version}
              onChange={(e) =>
                onChange((draft) => {
                  draft.version = e.target.value;
                })
              }
              className={INPUT_CLASS_NAME}
            />
          </Field>
          <Field label="Domain" errorMsg={domainError}>
            <input
              type="text"
              value={domain}
              onChange={(e) =>
                onChange((draft) => {
                  draft.domain = e.target.value;
                })
              }
              className={INPUT_CLASS_NAME}
            />
          </Field>
          <Field label="Flow" errorMsg={flowError}>
            <input
              type="text"
              value={flow}
              onChange={(e) =>
                onChange((draft) => {
                  draft.flow = e.target.value;
                })
              }
              className={INPUT_CLASS_NAME}
            />
          </Field>
        </div>
        <Field label="Labels">
          <LabelEditor
            labels={(json.label as unknown[]) || []}
            onChange={(labels) =>
              onChange((draft) => {
                draft.label = labels;
              })
            }
          />
        </Field>
        <Field label="Tags">
          <TagEditor
            tags={(json.tags as string[]) || []}
            onChange={(tags) =>
              onChange((draft) => {
                draft.tags = tags;
              })
            }
          />
        </Field>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-2 text-xs font-medium">Display Strategy</div>
        <div className="grid grid-cols-3 gap-1">
          {DISPLAY_STRATEGIES.map((strategy) => (
            <button
              key={strategy.value}
              onClick={() =>
                onChange((draft) => {
                  if (!draft.attributes) {
                    draft.attributes = {};
                  }

                  (draft.attributes as Record<string, unknown>).displayStrategy = strategy.value;
                })
              }
              className={`${SELECTABLE_BUTTON_BASE_CLASS_NAME} ${
                String(attrs.displayStrategy) === strategy.value
                  ? SELECTABLE_BUTTON_ACTIVE_CLASS_NAME
                  : SELECTABLE_BUTTON_IDLE_CLASS_NAME
              }`}
            >
              <div className="font-medium">{strategy.label}</div>
              <div className="text-[10px] text-muted-foreground">{strategy.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-xs font-medium">Content</div>
          <div className="ml-auto flex gap-1">
            {(['default', 'web', 'ios', 'android'] as const).map((nextPlatform) => (
              <button
                key={nextPlatform}
                onClick={() => setPlatform(nextPlatform)}
                className={`${PLATFORM_BUTTON_BASE_CLASS_NAME} ${
                  platform === nextPlatform
                    ? PLATFORM_BUTTON_ACTIVE_CLASS_NAME
                    : PLATFORM_BUTTON_IDLE_CLASS_NAME
                }`}
              >
                {nextPlatform}
              </button>
            ))}
          </div>
        </div>
        <JsonCodeField
          value={getContentForPlatform(attrs, platform)}
          onChange={(value) =>
            onChange((draft) => {
              if (!draft.attributes) {
                draft.attributes = {};
              }

              setContentForPlatform(
                draft.attributes as Record<string, unknown>,
                platform,
                value,
              );
            })
          }
          language="html"
          height={300}
        />
      </div>
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
