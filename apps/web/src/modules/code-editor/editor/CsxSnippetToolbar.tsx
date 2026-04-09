import { useCallback } from 'react';
import { getSnippetsForType, type CsxSnippet } from './CsxSnippets';
import type { TemplateType } from './CsxTemplates';
import {
  Globe, FileOutput, ShieldAlert, Settings, Lock, List,
  MessageSquare, Radio, Server, CornerDownLeft, Database,
} from 'lucide-react';

/* ────────────── Icon Map ────────────── */

const ICON_MAP: Record<string, typeof Globe> = {
  'http-setup': Globe,
  'response-parse': FileOutput,
  'error-handle': ShieldAlert,
  'config-access': Settings,
  'safe-property': Lock,
  'array-mutate': List,
  'log-pattern': MessageSquare,
  'pubsub-event': Radio,
  'dapr-service': Server,
  'ok-fail': CornerDownLeft,
  'get-instance': Database,
};

/* ────────────── Props ────────────── */

interface CsxSnippetToolbarProps {
  templateType: TemplateType;
  editorRef: React.RefObject<any>;
}

/* ────────────── Snippet → Plain text (strip placeholders) ────────────── */

/** Convert Monaco snippet syntax to plain text for fallback insertion.
 *  $1, ${1:placeholder} → placeholder text, $0 → empty */
function snippetToPlainText(snippet: string): string {
  return snippet
    // ${1:placeholder} → placeholder
    .replace(/\$\{(\d+):([^}]*)}/g, '$2')
    // $1, $0 → empty
    .replace(/\$\d+/g, '');
}

/* ────────────── Component ────────────── */

export function CsxSnippetToolbar({ templateType, editorRef }: CsxSnippetToolbarProps) {
  const snippets = getSnippetsForType(templateType);

  const insertSnippet = useCallback((snippet: CsxSnippet) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Ensure editor has focus first
    editor.focus();

    // Small delay to let focus settle, then try snippet insertion
    setTimeout(() => {
      try {
        // Primary approach: Monaco snippet action
        const contribution = editor.getContribution?.('snippetController2');
        if (contribution) {
          // Direct snippet controller — most reliable
          contribution.insert?.(snippet.code);
          return;
        }
      } catch {
        // fallback below
      }

      try {
        // Second approach: trigger the action
        editor.trigger('snippet-toolbar', 'editor.action.insertSnippet', {
          snippet: snippet.code,
        });
      } catch {
        // Final fallback: plain text insertion via executeEdits
        const selection = editor.getSelection();
        if (selection) {
          const plainText = snippetToPlainText(snippet.code);
          editor.executeEdits('snippet-toolbar', [
            {
              range: selection,
              text: plainText,
              forceMoveMarkers: true,
            },
          ]);
        }
      }
    }, 50);
  }, [editorRef]);

  if (snippets.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto">
      {snippets.map((snippet) => {
        const Icon = ICON_MAP[snippet.id] || MessageSquare;
        return (
          <button
            key={snippet.id}
            onMouseDown={(e) => {
              // Prevent the button click from stealing focus from Monaco editor
              e.preventDefault();
            }}
            onClick={() => insertSnippet(snippet)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-[11px] font-medium whitespace-nowrap shrink-0"
            title={snippet.description}
          >
            <Icon size={13} />
            <span>{snippet.label}</span>
          </button>
        );
      })}
    </div>
  );
}
