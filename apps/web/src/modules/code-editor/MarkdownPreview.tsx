import { memo, useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

import { cn } from '@vnext-forge-studio/designer-ui';

const previewBaseClass = cn(
  'h-full min-h-0 overflow-auto px-4 py-3 text-sm leading-relaxed',
  '[--md-code-bg:var(--color-muted)] [--md-blockquote-border:var(--color-border)] [--md-link:var(--color-info-text)]',
  'dark:[--md-code-bg:var(--color-tertiary)]',
  'transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
);

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn('text-foreground mt-6 mb-3 border-b border-border pb-1 text-xl font-semibold first:mt-0', className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('text-foreground mt-5 mb-2 text-lg font-semibold first:mt-0', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('text-foreground mt-4 mb-2 text-base font-semibold first:mt-0', className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn('text-foreground mt-3 mb-1.5 text-sm font-semibold first:mt-0', className)} {...props} />
  ),
  h5: ({ className, ...props }) => (
    <h5 className={cn('text-foreground mt-3 mb-1 text-sm font-medium first:mt-0', className)} {...props} />
  ),
  h6: ({ className, ...props }) => (
    <h6 className={cn('text-muted-foreground mt-3 mb-1 text-sm font-medium first:mt-0', className)} {...props} />
  ),
  p: ({ className, ...props }) => <p className={cn('text-foreground my-3 first:mt-0 last:mb-0', className)} {...props} />,
  a: ({ className, ...props }) => (
    <a
      className={cn('text-[var(--md-link)] underline decoration-border underline-offset-2 hover:opacity-90', className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn('text-foreground my-3 list-disc space-y-1 pl-6 first:mt-0', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn('text-foreground my-3 list-decimal space-y-1 pl-6 first:mt-0', className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn('text-foreground [&>p]:my-1', className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        'border-[var(--md-blockquote-border)] text-muted-foreground my-3 border-l-4 py-0.5 pl-4 italic',
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn('border-border my-6', className)} {...props} />,
  table: ({ className, ...props }) => (
    <div className="my-4 w-full overflow-x-auto">
      <table className={cn('border-border w-full border-collapse border text-[13px]', className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn('bg-muted/80', className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn('border-border text-foreground border px-2 py-1.5 text-left font-semibold', className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn('border-border text-foreground border px-2 py-1.5 align-top', className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return (
        <code className={cn('font-mono text-[13px]', className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          'rounded px-1 py-px font-mono text-[13px]',
          'bg-muted text-foreground ring-1 ring-border/60 dark:bg-[var(--md-code-bg)] dark:ring-border/80',
          className,
        )}
        {...props}>
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'rounded-md border border-border bg-muted p-3 dark:bg-[var(--md-code-bg)]',
        'overflow-x-auto font-mono text-[13px] text-foreground',
        className,
      )}
      {...props}
    />
  ),
};

export interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
}

export const MarkdownPreview = memo(function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeSanitize], []);

  const trimmed = markdown.trim();
  if (!trimmed) {
    return (
      <div
        role="region"
        aria-label="Markdown preview"
        className={cn(previewBaseClass, 'text-muted-foreground flex items-start', className)}>
        <p className="text-sm">Nothing to preview yet.</p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Markdown preview" className={cn(previewBaseClass, className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

const DEFAULT_DEBOUNCE_MS = 200;

export interface DebouncedMarkdownPreviewProps {
  markdown: string;
  debounceMs?: number;
}

/** Debounced preview for split mode (large documents). */
export function DebouncedMarkdownPreview({
  markdown,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: DebouncedMarkdownPreviewProps) {
  const [display, setDisplay] = useState(markdown);

  useEffect(() => {
    const id = window.setTimeout(() => setDisplay(markdown), debounceMs);
    return () => window.clearTimeout(id);
  }, [markdown, debounceMs]);

  return <MarkdownPreview markdown={display} />;
}
