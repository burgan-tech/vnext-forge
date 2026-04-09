import { useState } from 'react';
import { Field } from '@modules/save-component/components/Field';
import { TagEditor } from '@modules/save-component/components/TagEditor';
import { LabelEditor } from '@modules/save-component/components/LabelEditor';
import { JsonCodeField } from '@modules/save-component/components/JsonCodeField';

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

export function ViewEditorPanel({ json, onChange }: ViewEditorPanelProps) {
  const [platform, setPlatform] = useState<'default' | 'web' | 'ios' | 'android'>('default');
  const attrs = (json.attributes || {}) as Record<string, unknown>;

  return (
    <div className="p-4 space-y-4">
      {/* Metadata */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key">
            <input type="text" value={String(json.key || '')} readOnly
              className="w-full px-2 py-1 text-xs border border-border rounded bg-muted font-mono" />
          </Field>
          <Field label="Version">
            <input type="text" value={String(json.version || '')}
              onChange={(e) => onChange((d) => { d.version = e.target.value; })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
          </Field>
          <Field label="Domain">
            <input type="text" value={String(json.domain || '')}
              onChange={(e) => onChange((d) => { d.domain = e.target.value; })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
          </Field>
          <Field label="Flow">
            <input type="text" value={String(json.flow || '')}
              onChange={(e) => onChange((d) => { d.flow = e.target.value; })}
              className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
          </Field>
        </div>
        <Field label="Labels">
          <LabelEditor
            labels={(json.label as any[]) || []}
            onChange={(labels) => onChange((d) => { d.label = labels; })}
          />
        </Field>
        <Field label="Tags">
          <TagEditor
            tags={(json.tags as string[]) || []}
            onChange={(tags) => onChange((d) => { d.tags = tags; })}
          />
        </Field>
      </div>

      {/* Display Strategy */}
      <div className="border-t border-border pt-4">
        <div className="text-xs font-medium mb-2">Display Strategy</div>
        <div className="grid grid-cols-3 gap-1">
          {DISPLAY_STRATEGIES.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange((d) => {
                if (!d.attributes) d.attributes = {};
                (d.attributes as any).displayStrategy = s.value;
              })}
              className={`p-2 text-left border rounded text-xs ${
                String(attrs.displayStrategy) === s.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform Override */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-medium">Content</div>
          <div className="ml-auto flex gap-1">
            {(['default', 'web', 'ios', 'android'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-2 py-0.5 text-[10px] rounded ${platform === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <JsonCodeField
          value={getContentForPlatform(attrs, platform)}
          onChange={(v) => onChange((d) => {
            if (!d.attributes) d.attributes = {};
            setContentForPlatform(d.attributes as any, platform, v);
          })}
          language="html"
          height={300}
        />
      </div>
    </div>
  );
}

function getContentForPlatform(attrs: Record<string, unknown>, platform: string): string {
  if (platform === 'default') return String(attrs.content || '');
  const overrides = (attrs.platformOverrides || {}) as Record<string, any>;
  return String(overrides[platform]?.content || attrs.content || '');
}

function setContentForPlatform(attrs: Record<string, unknown>, platform: string, content: string) {
  if (platform === 'default') {
    attrs.content = content;
  } else {
    if (!attrs.platformOverrides) attrs.platformOverrides = {};
    const overrides = attrs.platformOverrides as Record<string, any>;
    if (!overrides[platform]) overrides[platform] = {};
    overrides[platform].content = content;
  }
}
