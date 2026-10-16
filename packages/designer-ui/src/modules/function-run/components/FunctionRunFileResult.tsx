import { Button } from '../../../ui/Button';
import { openFile, saveFileAs, type HostFile } from '../../quick-run/file-fields/fileHostActions';
import { describeFileFunctionResult, type FileFunctionResponse } from '../functionRunFile';

export interface FunctionRunFileResultProps {
  response: FileFunctionResponse;
  /** The `file` id that was requested — the name fallback. */
  fileId: string;
  durationMs: number | null;
}

/**
 * The built-in `file` function's response: a binary body, so it is shown as
 * a file (name, size, content type, ETag) with Open and Save as rather than
 * as text. Both actions go through `fileHostActions`: the VS Code host opens
 * a temporary copy or shows a save dialog; the web shell uses a Blob.
 */
export function FunctionRunFileResult({ response, fileId, durationMs }: FunctionRunFileResultProps) {
  const view = describeFileFunctionResult(response, fileId);
  const file: HostFile = {
    fileName: view.fileName,
    mimeType: view.mimeType,
    contentBase64: response.contentBase64,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="border-success-border bg-success text-success-foreground rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
          200
        </span>
        {durationMs !== null ? <span className="text-muted-foreground">{Math.round(durationMs)} ms</span> : null}
        <span className="text-muted-foreground">{view.sizeLabel}</span>
      </div>

      <dl className="border-border-subtle grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded border p-2 text-[11px]">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="m-0 font-mono break-all">{view.fileName}</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd className="m-0">{view.sizeLabel}</dd>
        <dt className="text-muted-foreground">Content type</dt>
        <dd className="m-0 font-mono">{view.mimeType}</dd>
        <dt className="text-muted-foreground">ETag</dt>
        <dd className="m-0 font-mono break-all">{view.eTag ?? '—'}</dd>
      </dl>

      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={() => openFile(file)}>
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={() => saveFileAs(file)}>
          Save as…
        </Button>
      </div>
    </div>
  );
}
