import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ViewType } from '@vnext-forge-studio/vnext-types';
import { isLinkType, linkTypeFieldKey } from '../viewContentHelpers';

interface ViewContentPreviewProps {
  viewType: number;
  content: string;
}

function NoContent() {
  return (
    <p className="text-muted-foreground p-6 text-center text-sm">No content to preview.</p>
  );
}

function HtmlPreview({ html }: { html: string }) {
  if (!html.trim()) return <NoContent />;
  return (
    <iframe
      sandbox="allow-same-origin"
      srcDoc={html}
      title="HTML preview"
      className="min-h-64 w-full border-0"
    />
  );
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) return <NoContent />;
  return (
    <div className="text-foreground p-4 text-sm [&_a]:text-blue-500 [&_a]:underline [&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_blockquote]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-medium [&_hr]:border-border [&_hr]:my-3 [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:mb-2 [&_p]:mb-2 [&_pre]:bg-muted [&_pre]:mb-2 [&_pre]:rounded [&_pre]:p-3 [&_table]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border-border [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_th]:border-border [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-xs [&_th]:font-medium [&_ul]:list-disc [&_ul]:mb-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function JsonPreview({ content }: { content: string }) {
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // show raw content
  }
  if (!formatted.trim() || formatted === '{}') return <NoContent />;
  return (
    <pre className="text-foreground/80 overflow-auto p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
      {formatted}
    </pre>
  );
}

function LinkPreview({ content, viewType }: { content: string; viewType: number }) {
  const key = linkTypeFieldKey(viewType);
  let value = '';
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    value = String(parsed?.[key] ?? '');
  } catch {
    value = content;
  }

  const label = viewType === ViewType.URN ? 'URN' : 'URL';
  if (!value.trim()) return <NoContent />;

  return (
    <div className="space-y-1 p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="font-mono text-sm break-all">{value}</p>
    </div>
  );
}

export function ViewContentPreview({ viewType, content }: ViewContentPreviewProps) {
  if (viewType === ViewType.Html) return <HtmlPreview html={content} />;
  if (viewType === ViewType.Markdown) return <MarkdownPreview content={content} />;
  if (isLinkType(viewType)) return <LinkPreview content={content} viewType={viewType} />;
  return <JsonPreview content={content} />;
}
