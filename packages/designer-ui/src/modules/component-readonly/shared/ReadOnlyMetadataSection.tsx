import type { ReactNode } from 'react';

import { Badge } from '../../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card.js';
import { ComponentDescriptionField } from '../../../ui/ComponentDescriptionField.js';
import { TagEditor } from '../../../ui/TagEditor.js';
import { ReadOnlyValueField } from './ReadOnlyValueField.js';
import { toDisplayText } from './readonlyText.js';

export interface ReadOnlyMetadataSectionProps {
  json: Record<string, unknown>;
  /** Extra fields rendered inside the grid after the common four. */
  children?: ReactNode;
  title?: string;
  description?: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) =>
          typeof entry === 'string'
            ? entry
            : toDisplayText((entry as { label?: unknown } | null)?.label),
        )
        .filter(Boolean)
    : [];
}

/**
 * Common component metadata card in quiet read-only (FormReadOnlyContext
 * supplies readOnly; the TagEditor / description onChange handlers are no-ops).
 * Must be rendered inside `<FormReadOnlyProvider>`; otherwise the controls
 * appear editable.
 */
export function ReadOnlyMetadataSection({
  json,
  children,
  title = 'Metadata',
  description = 'Identity, scope and flow bindings.',
}: ReadOnlyMetadataSectionProps) {
  const tags = asStringArray(json.tags);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const labels = asStringArray(attrs.labels ?? json.labels);
  const comment = typeof json._comment === 'string' ? json._comment : '';

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyValueField label="Key" value={json.key} mono />
          <ReadOnlyValueField label="Version" value={json.version} mono />
          <ReadOnlyValueField label="Domain" value={json.domain} mono />
          <ReadOnlyValueField label="Flow" value={json.flow} mono />
          {children}
        </div>
        {labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Labels</span>
            {labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}
        {tags.length > 0 && <TagEditor tags={tags} onChange={() => undefined} />}
        {comment && <ComponentDescriptionField value={comment} onChange={() => undefined} />}
      </CardContent>
    </Card>
  );
}
