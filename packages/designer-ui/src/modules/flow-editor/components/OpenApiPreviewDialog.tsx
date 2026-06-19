import { useCallback, useEffect, useState } from 'react';
import { buildWorkflowOpenApi, createSchemaResolver } from '@vnext-forge-studio/doc-gen';
import { Copy, Check, Download, Loader2, Maximize2, Minimize2 } from 'lucide-react';
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
import { collectSchemaComponents } from '../OpenApiPreviewApi';

const logger = createLogger('flow-editor/OpenApiPreviewDialog');

interface OpenApiPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowJson: unknown;
  /** Active project id; used to resolve Schema component references. */
  projectId: string | undefined;
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
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) setFullScreen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !workflowJson) {
      setSpec('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const schemaComponents = projectId ? await collectSchemaComponents(projectId) : [];
        const resolveSchema = createSchemaResolver(schemaComponents);
        const doc = buildWorkflowOpenApi(workflowJson, resolveSchema);
        if (!cancelled) setSpec(JSON.stringify(doc, null, 2));
      } catch (err) {
        logger.error('failed to generate OpenAPI preview', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) setSpec('{\n  "error": "Failed to generate OpenAPI specification."\n}');
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
      await navigator.clipboard.writeText(spec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may not be available in VS Code webview
    }
  }, [spec]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([spec], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowKey(workflowJson)}.openapi.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // download may be unavailable in restricted webview contexts
    }
  }, [spec, workflowJson]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        enableResize={!fullScreen}
        resizeStorageKey="vnext-forge.dialog.openapi-preview"
        resizeDefaultWidth={900}
        resizeDefaultHeight={700}
        className={`flex flex-col gap-0 p-0 transition-all duration-200 ${
          fullScreen ? 'h-screen max-h-screen w-screen max-w-none rounded-none' : ''
        }`}>
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Workflow OpenAPI Preview</DialogTitle>
              <DialogDescription>
                A read-only OpenAPI 3.1 specification for the current workflow.
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

        <div className={`min-h-0 flex-1 overflow-auto py-4 ${fullScreen ? 'px-12' : 'px-6'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="text-muted-icon animate-spin" />
            </div>
          ) : (
            <pre className="text-foreground overflow-x-auto rounded-lg bg-[var(--color-muted,#1e1e1e)] p-4 font-mono text-xs leading-relaxed">
              {spec}
            </pre>
          )}
        </div>

        <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()} disabled={!spec || loading}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!spec || loading}>
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
