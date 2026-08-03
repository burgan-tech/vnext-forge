import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Pure, store-free content previews shared by the editable `ViewEditorPanel`
 * and the read-only `ViewDetailCore`.
 *
 * Bundle-safety contract: this module must stay free of store, transport and
 * quick-run imports so `modules/component-readonly` can consume it (mirrors the
 * `viewContentHelpers` exception documented there).
 */

/** Shared frame for every view content preview. */
export const PREVIEW_SHELL =
  'min-h-[280px] max-h-[min(560px,60vh)] w-full overflow-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3';

export function StaticJsonPreview({ text }: { text: string }) {
  const formatted = useMemo(() => {
    const t = text.trim();
    if (t === '') return '';
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return text;
    }
  }, [text]);

  return (
    <div className={PREVIEW_SHELL}>
      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--vscode-foreground)]">
        {formatted}
      </pre>
    </div>
  );
}

export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div
      className={`${PREVIEW_SHELL} text-[var(--vscode-foreground)] [&_a]:text-[var(--vscode-textLink-foreground)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--vscode-textCodeBlock-background)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11px] [&_h1]:mb-2 [&_h1]:text-[1rem] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_li]:my-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[var(--vscode-textCodeBlock-background)] [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[11px] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
    </div>
  );
}
