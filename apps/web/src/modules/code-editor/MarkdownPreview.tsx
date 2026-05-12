import { memo, useEffect, useId, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
// plantuml-encoder ships without types; we only use `.encode`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no shipped types
import plantumlEncoder from 'plantuml-encoder';

import { cn } from '@vnext-forge-studio/designer-ui';

const previewBaseClass = cn(
  'h-full min-h-0 overflow-auto px-4 py-3 text-sm leading-relaxed',
  '[--md-code-bg:var(--color-muted)] [--md-blockquote-border:var(--color-border)] [--md-link:var(--color-info-text)]',
  'dark:[--md-code-bg:var(--color-tertiary)]',
  'transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
);

/**
 * Mermaid block — lazy-imports the mermaid library (≈700 KB) so the
 * markdown preview's first paint isn't blocked when no diagrams are
 * present. Each block gets a stable React-id so consecutive renders
 * don't collide. We render the produced SVG via dangerouslySetInnerHTML
 * because mermaid emits a self-contained `<svg>` document; ReactMarkdown
 * has already passed the raw code through `rehype-sanitize` so the
 * source can't smuggle scripts (mermaid's output itself is structural).
 */
function MermaidBlock({ code }: { code: string }) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          fontFamily: 'inherit',
        });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render mermaid diagram');
          setSvg('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="my-3 rounded border border-destructive-border bg-destructive/5 px-3 py-2 text-xs text-destructive-foreground">
        <div className="font-semibold mb-1">Mermaid render error</div>
        <pre className="whitespace-pre-wrap font-mono text-[11px] opacity-80">{error}</pre>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Mermaid diagram"
      className="my-3 flex justify-center overflow-x-auto rounded border border-border bg-surface p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * PlantUML block — encodes the source with `plantuml-encoder` (deflate
 * + custom base64 alphabet that PlantUML's public servers expect) and
 * renders an `<img>` pointing at plantuml.com's SVG endpoint. This
 * requires network access at render time; for fully offline use the
 * user would need a local PlantUML server and a different endpoint
 * (kroki.io as alternate). We expose a small fallback when the image
 * fails to load so the user knows the diagram source is still there.
 */
function PlantUMLBlock({ code }: { code: string }) {
  const encoded = useMemo(() => {
    try {
      return (plantumlEncoder as { encode: (s: string) => string }).encode(code);
    } catch {
      return '';
    }
  }, [code]);

  const [errored, setErrored] = useState(false);

  if (!encoded) {
    return (
      <div className="my-3 rounded border border-destructive-border bg-destructive/5 px-3 py-2 text-xs text-destructive-foreground">
        Failed to encode PlantUML source.
      </div>
    );
  }

  const src = `https://www.plantuml.com/plantuml/svg/${encoded}`;

  if (errored) {
    return (
      <div className="my-3 rounded border border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="font-semibold mb-1">PlantUML render unavailable</div>
        <p className="text-muted-foreground text-[11px]">
          Could not load the diagram from plantuml.com. Check network access.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">{code}</pre>
      </div>
    );
  }

  return (
    <div className="my-3 flex justify-center overflow-x-auto rounded border border-border bg-surface p-2">
      <img
        src={src}
        alt="PlantUML diagram"
        onError={() => setErrored(true)}
        className="max-w-full"
      />
    </div>
  );
}

function extractCodeString(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractCodeString).join('');
  if (children && typeof children === 'object') {
    const asObj = children as unknown as Record<string, unknown>;
    if ('props' in asObj) {
      const props = asObj.props as { children?: React.ReactNode } | undefined;
      if (props && 'children' in props) {
        return extractCodeString(props.children);
      }
    }
  }
  return '';
}

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
    // Diagram fences are intercepted at the `pre` level (where we get
    // the wrapping element). The `code` element itself just falls
    // through with default styling — `pre` decides whether to swap
    // in a diagram renderer or render a regular code block.
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
  pre: ({ className, children, ...props }) => {
    // Look at the first child `<code>` to find the language fence.
    // ReactMarkdown produces `<pre><code className="language-mermaid">…</code></pre>`
    // for fenced code blocks, so we inspect the immediate child.
    const firstChild = Array.isArray(children)
      ? (children as React.ReactNode[]).find((c) => c && typeof c === 'object')
      : children;
    let childProps: { className?: string; children?: React.ReactNode } = {};
    if (firstChild && typeof firstChild === 'object') {
      const asObj = firstChild as unknown as Record<string, unknown>;
      if ('props' in asObj) {
        childProps =
          (asObj.props as { className?: string; children?: React.ReactNode } | undefined) ?? {};
      }
    }
    const lang = childProps.className?.match(/language-([\w+-]+)/)?.[1]?.toLowerCase() ?? '';

    if (lang === 'mermaid') {
      return <MermaidBlock code={extractCodeString(childProps.children).trim()} />;
    }
    if (lang === 'plantuml' || lang === 'puml' || lang === 'uml') {
      return <PlantUMLBlock code={extractCodeString(childProps.children).trim()} />;
    }

    return (
      <pre
        className={cn(
          'rounded-md border border-border bg-muted p-3 dark:bg-[var(--md-code-bg)]',
          'overflow-x-auto font-mono text-[13px] text-foreground',
          className,
        )}
        {...props}>
        {children}
      </pre>
    );
  },
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
