import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card.js';
import { cn } from '../../../lib/utils/cn.js';

/**
 * Shared no-op change handler for read-only form controls. Designer form
 * primitives are controlled components, so they still require an `onChange`;
 * editing is suppressed by `FormReadOnlyContext`, not by omitting the handler.
 * Use this instead of inlining `() => undefined` at every call site.
 */
export const noopChange = () => undefined;

export interface ReadOnlySectionCardProps {
  title: string;
  description?: string;
  /** Rendered inline after the title (typically a `<Badge>`). */
  badge?: ReactNode;
  children: ReactNode;
  /** Appended to the CardContent padding classes. */
  contentClassName?: string;
}

/**
 * The standard section card scaffold for read-only component detail views.
 * Used by all six detail cores (task, extension, function, mapping, schema,
 * view) so their sections stay visually identical — change the scaffold here,
 * not per core.
 *
 * When `children` contain designer form controls, this must be rendered inside
 * `<FormReadOnlyProvider>`; otherwise those controls appear editable.
 */
export function ReadOnlySectionCard({
  title,
  description,
  badge,
  children,
  contentClassName,
}: ReadOnlySectionCardProps) {
  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          {badge}
        </CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn('px-4 sm:px-6', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
