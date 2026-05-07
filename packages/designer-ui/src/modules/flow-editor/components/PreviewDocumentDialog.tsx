import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateWorkflowMarkdown } from '@vnext-forge-studio/doc-gen';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { Copy, Check, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface PreviewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowJson: unknown;
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <pre className="bg-destructive-surface text-destructive-text overflow-x-auto rounded-lg p-3 text-xs">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="text-muted-icon animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Scoped typographic styles for the markdown preview article.
 * `@tailwindcss/typography` is not installed in this package, so we provide
 * a lightweight stylesheet that mirrors VS Code / GitHub Markdown preview
 * spacing, font sizes, and table treatment.
 */
const markdownStyles = `
.md-preview {
  color: var(--color-foreground, #d4d4d4);
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
}
.md-preview > *:first-child { margin-top: 0; }
.md-preview > *:last-child  { margin-bottom: 0; }

/* Headings */
.md-preview h1 { font-size: 1.8em; font-weight: 700; margin: 1.2em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border, #333); }
.md-preview h2 { font-size: 1.4em; font-weight: 600; margin: 1.1em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid var(--color-border, #333); }
.md-preview h3 { font-size: 1.15em; font-weight: 600; margin: 1em 0 0.4em; }
.md-preview h4 { font-size: 1em; font-weight: 600; margin: 0.8em 0 0.3em; }

/* Paragraphs / lists */
.md-preview p  { margin: 0.7em 0; }
.md-preview ul, .md-preview ol { margin: 0.5em 0; padding-left: 1.8em; }
.md-preview li { margin: 0.25em 0; }
.md-preview li > p { margin: 0.3em 0; }

/* Blockquotes */
.md-preview blockquote {
  margin: 0.8em 0;
  padding: 0.4em 1em;
  border-left: 4px solid var(--color-primary-border, #3b82f6);
  background: var(--color-muted, rgba(255,255,255,0.04));
  border-radius: 4px;
  color: var(--color-muted-foreground, #a0a0a0);
}

/* Code inline */
.md-preview :not(pre) > code {
  padding: 0.15em 0.4em;
  font-size: 0.88em;
  background: var(--color-muted, rgba(255,255,255,0.06));
  border-radius: 4px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}

/* Code blocks */
.md-preview pre {
  margin: 0.8em 0;
  padding: 0.9em 1.1em;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.55;
  background: var(--color-muted, rgba(255,255,255,0.04));
  border-radius: 8px;
  border: 1px solid var(--color-border, #333);
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
.md-preview pre code { padding: 0; background: none; border-radius: 0; font-size: inherit; }

/* Tables */
.md-preview table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 0.9em;
}
.md-preview th, .md-preview td {
  padding: 0.5em 0.8em;
  border: 1px solid var(--color-border, #333);
  text-align: left;
}
.md-preview th {
  font-weight: 600;
  background: var(--color-muted, rgba(255,255,255,0.04));
}
.md-preview tr:nth-child(even) td {
  background: var(--color-muted, rgba(255,255,255,0.02));
}

/* Horizontal rule */
.md-preview hr {
  margin: 1.5em 0;
  border: none;
  border-top: 1px solid var(--color-border, #333);
}

/* Links */
.md-preview a {
  color: var(--color-action, #6366f1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.md-preview a:hover { opacity: 0.8; }

/* Strong / emphasis */
.md-preview strong { font-weight: 600; }
.md-preview em { font-style: italic; }

/* Images / SVG from mermaid */
.md-preview img, .md-preview svg { max-width: 100%; height: auto; }
`;

export function PreviewDocumentDialog({
  open,
  onOpenChange,
  workflowJson,
}: PreviewDocumentDialogProps) {
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!open) setFullScreen(false);
  }, [open]);

  const markdown = useMemo(() => {
    if (!open || !workflowJson) return '';
    try {
      return generateWorkflowMarkdown(workflowJson);
    } catch {
      return '> Failed to generate documentation preview.';
    }
  }, [open, workflowJson]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may not be available in VS Code webview
    }
  }, [markdown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      <DialogContent
        className={`flex flex-col gap-0 p-0 transition-all duration-200 ${
          fullScreen
            ? 'h-screen max-h-screen w-screen max-w-none rounded-none'
            : 'max-h-[80vh] w-full max-w-[900px]'
        }`}>
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Workflow Documentation Preview</DialogTitle>
              <DialogDescription>
                A read-only Markdown preview of the current workflow.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFullScreen((v) => !v)}
              aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
              className="shrink-0">
              {fullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </div>
        </DialogHeader>

        <div className={`min-h-0 flex-1 overflow-y-auto py-6 ${fullScreen ? 'px-12' : 'px-8'}`}>
          <article className="md-preview mx-auto max-w-[760px]">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...rest }) {
                  const match = /language-mermaid/.exec(className || '');
                  if (match) {
                    return <MermaidBlock code={String(children).trim()} />;
                  }
                  return (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  );
                },
              }}>
              {markdown}
            </Markdown>
          </article>
        </div>

        <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
