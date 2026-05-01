import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ViewType } from '@vnext-forge/vnext-types';

import { cn } from '../../../lib/utils/cn.js';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { linkTypeFieldKey } from '../viewContentHelpers';

interface HrefUrnFieldProps {
  viewType: number;
  value: string;
  onChange: (value: string) => void;
}

function parseFieldValue(raw: string, fieldKey: string): string {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && typeof obj[fieldKey] === 'string') {
      return obj[fieldKey];
    }
  } catch {
    // not valid JSON -- fall through
  }
  return '';
}

function serializeFieldValue(fieldKey: string, fieldValue: string): string {
  return JSON.stringify({ [fieldKey]: fieldValue }, null, 2);
}

const TYPE_LABELS: Record<number, { label: string; placeholder: string; hint: string }> = {
  [ViewType.DeepLink]: {
    label: 'Deep Link URL',
    placeholder: 'on-burgan://onboarding/${param}',
    hint: 'App deep link with optional ${param} binding.',
  },
  [ViewType.Http]: {
    label: 'HTTP URL',
    placeholder: 'https://example.com/page?s=${param}',
    hint: 'External or in-app web URL with optional ${param} binding.',
  },
  [ViewType.URN]: {
    label: 'URN',
    placeholder: 'urn:vnext:flow:continue:domain:flow:${instanceId}',
    hint: 'Platform command URN with optional ${param} binding.',
  },
};

export function HrefUrnField({ viewType, value, onChange }: HrefUrnFieldProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const rawPanelId = useId();
  const fieldKey = linkTypeFieldKey(viewType);
  const meta = TYPE_LABELS[viewType] ?? TYPE_LABELS[ViewType.Http]!;
  const fieldValue = parseFieldValue(value, fieldKey);

  const handleFieldChange = (next: string) => {
    onChange(serializeFieldValue(fieldKey, next));
  };

  return (
    <div className="space-y-3">
      <Field label={meta.label} hint={meta.hint}>
        <Input
          value={fieldValue}
          placeholder={meta.placeholder}
          size="sm"
          onChange={(e) => handleFieldChange(e.target.value)}
        />
      </Field>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => setRawOpen((prev) => !prev)}
          aria-expanded={rawOpen}
          aria-controls={rawPanelId}>
          <ChevronRight
            className={cn('size-3.5 transition-transform', rawOpen && 'rotate-90')}
            aria-hidden
          />
          Raw JSON
        </Button>
        {rawOpen && (
          <div id={rawPanelId} className="mt-1.5">
            <JsonCodeField
              value={value}
              onChange={onChange}
              language="json"
              height={120}
            />
          </div>
        )}
      </div>
    </div>
  );
}
