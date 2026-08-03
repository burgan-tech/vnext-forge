import { useCallback, useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';

import { Button } from '../../../ui/Button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../ui/Dialog.js';
import { JsonCodeField } from '../../../ui/JsonCodeField.js';
import { noopChange } from './ReadOnlySectionCard.js';

/**
 * Vertical space the fullscreen dialog chrome (header band + content padding)
 * takes away from the viewport. `JsonCodeField` only accepts a numeric height,
 * so the fullscreen editor height is computed from `window.innerHeight` instead
 * of being expressed in CSS.
 */
const FULLSCREEN_CHROME_PX = 120;
const FULLSCREEN_MIN_HEIGHT = 240;
/** Used when no `window` is available (server-side render / static markup). */
const FULLSCREEN_SSR_HEIGHT = 600;

function fullScreenEditorHeight(): number {
  if (typeof window === 'undefined') return FULLSCREEN_SSR_HEIGHT;
  return Math.max(FULLSCREEN_MIN_HEIGHT, window.innerHeight - FULLSCREEN_CHROME_PX);
}

/** Display names for the Monaco languages the read-only cores actually use. */
const LANGUAGE_LABELS: Record<string, string> = {
  csharp: 'C#',
  html: 'HTML',
  json: 'JSON',
  markdown: 'Markdown',
  plaintext: 'Text',
};

function languageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language;
}

export interface ReadOnlyCodeFieldProps {
  value: string;
  /** Monaco language id. Defaults to `json`. */
  language?: string;
  /** Inline (non-fullscreen) editor height in pixels. */
  height?: number;
  /** Title shown in the fullscreen dialog header (e.g. script location or field label). */
  title?: string;
}

/**
 * Read-only code display with a slim right-aligned header row carrying a
 * "Full screen" action. Clicking it opens the same content in a fullscreen
 * modal, which is the only way to comfortably read long `.csx` mappings and
 * large JSON payloads inside the narrow detail panels.
 *
 * Quiet read-only, like its sibling sections: the Monaco `onChange` is a no-op
 * and `readOnly` is passed explicitly, so it also works standalone — but it is
 * meant to be rendered inside `<FormReadOnlyProvider>` for consistency with the
 * surrounding read-only form controls.
 *
 * ESC / overlay dismiss and the header close button come from Radix `Dialog`.
 */
export function ReadOnlyCodeField({
  value,
  language = 'json',
  height = 220,
  title,
}: ReadOnlyCodeFieldProps) {
  const [open, setOpen] = useState(false);
  const [fullScreenHeight, setFullScreenHeight] = useState(FULLSCREEN_MIN_HEIGHT);

  const openFullScreen = useCallback(() => {
    setFullScreenHeight(fullScreenEditorHeight());
    setOpen(true);
  }, []);

  // Keep the fullscreen editor filling the viewport when the window (or the
  // VS Code webview panel) is resized while the dialog is open.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleResize = () => setFullScreenHeight(fullScreenEditorHeight());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  const dialogTitle = title?.trim() ? title : languageLabel(language);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={openFullScreen}
          aria-label="Full screen">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <JsonCodeField
        value={value}
        onChange={noopChange}
        readOnly
        language={language}
        height={height}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col gap-0 rounded-none p-0">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate font-mono text-sm">{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            <JsonCodeField
              value={value}
              onChange={noopChange}
              readOnly
              language={language}
              height={fullScreenHeight}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
