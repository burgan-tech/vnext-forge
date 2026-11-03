import { useRef, useState, type DragEvent } from 'react';

import { registerFieldExtension } from '../../schema-form';
import { summarizeRuntimeError } from '../components/RuntimeErrorBanner';
import type { UploadTicket } from '../QuickRunApi';
import {
  chooseUploadRoute,
  fileToUploadValue,
  formatBytes,
  isFileHandle,
  toSchemaPath,
  type FileUploadValue,
  type StorageTransport,
} from '../utils/fileFields';
import { useStreamFileUploader } from './fileUploadContext';
import { FILE_FIELD_MARKER, FILE_TRANSPORT_MARKER } from './markFileFields';

function isUploadValue(value: unknown): value is FileUploadValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).content === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

/** `{ file }` echo (keeps a stored file) or a full stored handle. */
function keptFileName(value: unknown): string | null {
  if (isFileHandle(value)) return value.name ?? value.file;
  if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).file === 'string') {
    return String((value as Record<string, unknown>).file);
  }
  return null;
}

const buttonClass =
  'cursor-pointer rounded border border-[var(--vscode-button-border,transparent)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]';

/**
 * Picks a file for an `x-storage` field and sends it the way the runtime
 * expects. `inline` (default): `{ name, mimeType, size, content }` with base64
 * content in the request body. `stream` (runtime 0.0.102): the file is
 * uploaded right away and the body carries `{ file }` with the ticket; `any`
 * streams only what inline cannot carry. A stored handle (or `{ file }`) is
 * kept as is until replaced; clearing removes the field (the runtime then
 * clears it).
 */
export function FileUploadField({
  value,
  onChange,
  path,
  transport = 'inline',
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  /** Form path of the field (`list.0.doc`); the upload `path=` is its schema form. */
  path?: string;
  transport?: StorageTransport;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploader = useStreamFileUploader();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ticket, setTicket] = useState<UploadTicket | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const route = chooseUploadRoute(transport, file.size);
    if (route.route === 'too-large') {
      setError(
        transport === 'inline'
          ? `${file.name} is ${formatBytes(file.size)}; the runtime accepts about ${formatBytes(route.limit)} per request (base64 in a 10 MiB body).`
          : `${file.name} is ${formatBytes(file.size)}; streamed uploads stop at ${formatBytes(route.limit)} by default.`,
      );
      return;
    }
    if (route.route === 'stream' && (!uploader || !path)) {
      setError('Streamed upload is not available here; start or transition the instance from a QuickRun dialog.');
      return;
    }
    setError(null);
    setReading(true);
    try {
      if (route.route === 'inline') {
        setTicket(null);
        onChange(await fileToUploadValue(file));
        return;
      }
      const result = await uploader!(toSchemaPath(path!), file);
      if (!result.success) {
        const summary = summarizeRuntimeError(result.error);
        setError(`${summary.code ? `${summary.code}: ` : ''}${summary.summary}`);
        return;
      }
      setTicket({ ...result.data, name: result.data.name ?? file.name, size: result.data.size ?? file.size });
      onChange({ file: result.data.file });
    } catch {
      setError(`Could not ${route.route === 'stream' ? 'upload' : 'read'} ${file.name}.`);
    } finally {
      setReading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void pick(event.dataTransfer.files[0]);
  };

  const kept = keptFileName(value);
  const upload = isUploadValue(value) ? value : null;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex flex-col gap-1.5 rounded border border-dashed px-2.5 py-2 text-[11px] ${
        dragOver ? 'border-[var(--vscode-focusBorder)]' : 'border-[var(--vscode-input-border)]'
      }`}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label="Choose file"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {ticket && kept === ticket.file ? (
        <span>
          <span className="font-mono">{ticket.name}</span>{' '}
          <span className="text-[var(--vscode-descriptionForeground)]">
            {formatBytes(ticket.size)} · uploaded
            {ticket.expiresAt ? ` · send before ${new Date(ticket.expiresAt).toLocaleTimeString()}` : ''}
          </span>
        </span>
      ) : upload ? (
        <span>
          <span className="font-mono">{upload.name}</span>{' '}
          <span className="text-[var(--vscode-descriptionForeground)]">
            {formatBytes(upload.size)} · {upload.mimeType} · uploads with this request
          </span>
        </span>
      ) : kept ? (
        <span>
          Keeps the stored file <span className="font-mono">{kept}</span>
        </span>
      ) : (
        <span className="text-[var(--vscode-descriptionForeground)]">
          {reading ? (transport === 'inline' ? 'Reading…' : 'Uploading…') : 'Drop a file here or choose one.'}
          {transport !== 'inline' && !reading ? ` Streamed upload (${transport}).` : ''}
        </span>
      )}
      <span className="flex flex-wrap gap-1.5">
        <button type="button" className={buttonClass} onClick={() => inputRef.current?.click()} disabled={reading}>
          {upload || kept ? 'Replace…' : 'Choose file…'}
        </button>
        {upload || kept ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setTicket(null);
              onChange(undefined);
            }}>
            Clear
          </button>
        ) : null}
      </span>
      {error ? <span className="text-[var(--vscode-errorForeground)]">{error}</span> : null}
    </div>
  );
}

/** Registers the widget for nodes marked by `markFileFields` (idempotent). */
export function registerFileUploadField(): void {
  registerFieldExtension({
    id: 'quick-run/file-upload',
    match: (prop) => (prop as Record<string, unknown>)[FILE_FIELD_MARKER] === true,
    render: ({ prop, value, onChange, context }) => {
      const transport = (prop as Record<string, unknown>)[FILE_TRANSPORT_MARKER];
      return (
        <FileUploadField
          value={value}
          onChange={onChange}
          path={context.path}
          transport={transport === 'stream' || transport === 'any' ? transport : 'inline'}
        />
      );
    },
  });
}
