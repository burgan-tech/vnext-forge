import { useState } from 'react';

interface CopyIdButtonProps {
  /** The full value to put on the clipboard — never a truncated display form. */
  value: string;
  /** What is being copied, e.g. `Correlation ID`. Used for the tooltip and the accessible name. */
  label: string;
}

/**
 * Icon button that copies `value` and flips to a check mark for 1.5s.
 *
 * `navigator.clipboard` is optional-chained: a sandboxed webview may not
 * expose the async Clipboard API at all (see `PseudoUiErrorBoundary`), and a
 * dead button beats a thrown TypeError.
 */
export function CopyIdButton({ value, label }: CopyIdButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
      title={copied ? 'Copied!' : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.27 10.87h.01l4.49-4.49-1.06-1.06-3.44 3.44-1.44-1.44-1.06 1.06 2.5 2.49z"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 4v-1.5A1.5 1.5 0 015.5 1h5A1.5 1.5 0 0112 2.5v7A1.5 1.5 0 0110.5 11H9v1.5A1.5 1.5 0 017.5 14h-5A1.5 1.5 0 011 12.5v-7A1.5 1.5 0 012.5 4H4zm1 0h2.5A1.5 1.5 0 019 5.5V10h1.5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5V4zm-2.5 1a.5.5 0 00-.5.5v7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5z"/></svg>
      )}
    </button>
  );
}
