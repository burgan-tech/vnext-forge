import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { buildWorkflowOpenApi, createSchemaResolver, createComponentResolver } from '@vnext-forge-studio/doc-gen';
import { Braces, Check, Copy, Download, FileText, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { createLogger } from '../../../lib/logger/createLogger';
import { getHostEditorCapabilities } from '../../../lsp/hostEditorCapabilitiesRegistry';
import { collectComponents } from '../OpenApiPreviewApi';

const logger = createLogger('flow-editor/OpenApiPreviewDialog');

type ViewMode = 'rendered' | 'json';

interface OpenApiPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowJson: unknown;
  /** Active project id; used to resolve Schema/Function/Task component references. */
  projectId: string | undefined;
}

type RedocComponent = ComponentType<{ spec?: object; options?: Record<string, unknown> }>;

/**
 * Lazy-loaded Redoc renderer. Redoc is ~900KB so it is only imported when the
 * user switches to the rendered view. "Try it out" is irrelevant (Redoc is
 * read-only); search is disabled to avoid its web worker under the webview CSP.
 */
function RedocBlock({ spec }: { spec: object }) {
  const [Comp, setComp] = useState<RedocComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = (await import('redoc')) as { RedocStandalone: RedocComponent };
        if (!cancelled) setComp(() => mod.RedocStandalone);
      } catch (err) {
        logger.error('failed to load Redoc renderer', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) setError('Could not load the Redoc renderer. Switch to the JSON view.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className="text-destructive-text p-4 text-sm">{error}</div>;
  }
  if (!Comp) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="text-muted-icon animate-spin" />
      </div>
    );
  }
  return (
    <div className="redoc-host bg-white">
      <Comp
        spec={spec}
        options={{ disableSearch: true, hideDownloadButton: true, nativeScrollbars: true, expandResponses: '200,201' }}
      />
    </div>
  );
}

function workflowKey(workflowJson: unknown): string {
  const key = (workflowJson as { key?: unknown } | null)?.key;
  return typeof key === 'string' && key ? key : 'workflow';
}

export function OpenApiPreviewDialog({
  open,
  onOpenChange,
  workflowJson,
  projectId,
}: OpenApiPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [specObject, setSpecObject] = useState<object | null>(null);
  const [specText, setSpecText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFullScreen(false);
      setViewMode('rendered');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !workflowJson) {
      setSpecObject(null);
      setSpecText('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [schemaComponents, resolvableComponents] = projectId
          ? await Promise.all([
              collectComponents(projectId, ['schemas']),
              // functions + tasks (function endpoints) and workflows (sub-flows).
              collectComponents(projectId, ['functions', 'tasks', 'workflows']),
            ])
          : [[], []];
        const resolveSchema = createSchemaResolver(schemaComponents);
        const resolveComponent = createComponentResolver(resolvableComponents);
        const doc = buildWorkflowOpenApi(workflowJson, { resolveSchema, resolveComponent });
        if (!cancelled) {
          setSpecObject(doc);
          setSpecText(JSON.stringify(doc, null, 2));
        }
      } catch (err) {
        logger.error('failed to generate OpenAPI preview', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) {
          setSpecObject(null);
          setSpecText('{\n  "error": "Failed to generate OpenAPI specification."\n}');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workflowJson, projectId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(specText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may not be available in VS Code webview
    }
  }, [specText]);

  const handleDownload = useCallback(() => {
    const fileName = `${workflowKey(workflowJson)}.openapi.json`;
    // In the VS Code webview an <a download> + blob URL is blocked by CSP, so
    // route the save through the host (native save dialog). In the plain web
    // shell postMessageToHost is absent and the blob anchor works.
    const postToHost = getHostEditorCapabilities().postMessageToHost;
    if (postToHost) {
      postToHost({ type: 'host:save-file', fileName, content: specText });
      return;
    }
    try {
      const blob = new Blob([specText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.warn('in-browser download failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [specText, workflowJson]);

  const ready = !loading && !!specText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        enableResize={!fullScreen}
        resizeStorageKey="vnext-forge.dialog.openapi-preview"
        resizeDefaultWidth={960}
        resizeDefaultHeight={720}
        className={`flex flex-col gap-0 p-0 transition-all duration-200 ${
          fullScreen ? 'h-screen max-h-screen w-screen max-w-none rounded-none' : ''
        }`}>
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>Workflow OpenAPI Preview</DialogTitle>
              <DialogDescription>
                A read-only OpenAPI 3.1 specification for the current workflow.
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="border-border mr-1 flex items-center gap-0.5 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={viewMode === 'rendered' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setViewMode('rendered')}>
                  <FileText size={13} /> Rendered
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'json' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setViewMode('json')}>
                  <Braces size={13} /> JSON
                </Button>
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
          </div>
        </DialogHeader>

        <div
          className={`min-h-0 flex-1 overflow-auto ${
            viewMode === 'json' ? `py-4 ${fullScreen ? 'px-12' : 'px-6'}` : ''
          }`}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="text-muted-icon animate-spin" />
            </div>
          ) : viewMode === 'rendered' ? (
            specObject ? (
              <RedocBlock spec={specObject} />
            ) : (
              <div className="text-muted-foreground p-6 text-sm">
                Specification could not be generated. Switch to the JSON view for details.
              </div>
            )
          ) : (
            <pre className="text-foreground overflow-x-auto rounded-lg bg-[var(--color-muted,#1e1e1e)] p-4 font-mono text-xs leading-relaxed">
              {specText}
            </pre>
          )}
        </div>

        <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()} disabled={!ready}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!ready}>
            <Download size={14} />
            Download
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
