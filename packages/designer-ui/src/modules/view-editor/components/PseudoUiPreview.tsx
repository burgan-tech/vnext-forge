import { useEffect, useMemo, useState } from 'react';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

import { JsonCodeField } from '../../../ui/JsonCodeField';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../ui/Resizable';
import { PseudoUiViewSurface } from '../../quick-run/pseudo-ui/PseudoUiViewSurface';
import { ViewModeToggle } from '../../quick-run/pseudo-ui/ViewModeToggle';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';

const DEBOUNCE_MS = 300;
const EMPTY_RECORD: Record<string, unknown> = {};

export interface PseudoUiPreviewProps {
  viewKey: string;
  content: string;
  onChange: (value: string) => void;
}

export function PseudoUiPreview({ viewKey, content, onChange }: PseudoUiPreviewProps) {
  const [debounced, setDebounced] = useState(content);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(content), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [content]);

  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const listener = () => setWide(mq.matches);
    mq.addEventListener('change', listener);
    listener();
    return () => mq.removeEventListener('change', listener);
  }, []);

  const [narrowTab, setNarrowTab] = useState<'json' | 'preview'>('json');

  const parsed = useMemo(() => {
    try {
      const t = debounced.trim();
      if (!t) return { ok: false as const };
      const obj = JSON.parse(t) as unknown;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false as const };
      return { ok: true as const, obj: obj as Record<string, unknown> };
    } catch {
      return { ok: false as const };
    }
  }, [debounced]);

  const contentRecord = parsed.ok ? parsed.obj : EMPTY_RECORD;

  const candidateViewResponse = useMemo<ViewResponse>(
    () => ({
      key: viewKey || 'preview',
      content: contentRecord,
      type: 'Json',
      renderer: ViewRenderer.PseudoUi,
    }),
    [contentRecord, viewKey],
  );

  const [lastValidResponse, setLastValidResponse] = useState<ViewResponse | null>(null);
  useEffect(() => {
    if (parsed.ok) setLastValidResponse(candidateViewResponse);
  }, [parsed.ok, candidateViewResponse]);

  const previewResponse = parsed.ok ? candidateViewResponse : lastValidResponse;
  const invalidWhileEdited = !parsed.ok && debounced.trim() !== '';

  const editor = <JsonCodeField value={content} onChange={onChange} language="json" height={wide ? 420 : 260} />;

  const previewBody = (
    <>
      {invalidWhileEdited && (
        <p className="mb-2 text-[11px] text-[var(--vscode-descriptionForeground)]" role="status">
          Preview paused until JSON is valid.
        </p>
      )}
      {previewResponse ? (
        <PseudoUiViewSurface
          viewResponse={previewResponse}
          mode="preview"
          ariaLabel={`View preview ${viewKey || 'untitled'}`}
          fillHeight={false}
        />
      ) : (
        <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
          Enter valid JSON to see the pseudo-ui preview.
        </p>
      )}
    </>
  );

  if (wide) {
    return (
      <div className="flex min-h-[440px] w-full flex-col gap-2">
        <ResizablePanelGroup orientation="horizontal" className="min-h-[420px] w-full">
          <ResizablePanel defaultSize={50} minSize={28}>
            <div className="h-full overflow-hidden pr-1">{editor}</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={28}>
            <div className="flex h-full min-h-0 flex-col gap-2 pl-1">
              <span className="shrink-0 text-[11px] font-semibold text-[var(--vscode-foreground)]">Live preview</span>
              <div className="min-h-0 flex-1 overflow-auto">{previewBody}</div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex justify-end">
        <ViewModeToggle
          mode={narrowTab === 'json' ? 'json' : 'preview'}
          onModeChange={(m) => setNarrowTab(m === 'json' ? 'json' : 'preview')}
        />
      </div>
      {narrowTab === 'json' ? (
        editor
      ) : (
        <div className="flex min-h-[260px] flex-col gap-2">
          <span className="text-[11px] font-semibold text-[var(--vscode-foreground)]">Live preview</span>
          <div className="min-h-0 flex-1 overflow-auto">{previewBody}</div>
        </div>
      )}
    </div>
  );
}
