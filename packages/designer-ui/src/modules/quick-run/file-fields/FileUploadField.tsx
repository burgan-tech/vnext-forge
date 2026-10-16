import { useRef, useState, type DragEvent } from 'react';

import { registerFieldExtension } from '../../schema-form';
import {
  MAX_UPLOAD_BYTES,
  fileToUploadValue,
  formatBytes,
  isFileHandle,
  type FileUploadValue,
} from '../utils/fileFields';
import { FILE_FIELD_MARKER } from './markFileFields';

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
 * expects: `{ name, mimeType, size, content }` with base64 content in the
 * request body. A stored handle (or `{ file }`) is kept as is until replaced;
 * clearing removes the field (the runtime then clears it).
 */
export function FileUploadField({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `${file.name} is ${formatBytes(file.size)}; the runtime accepts about ${formatBytes(MAX_UPLOAD_BYTES)} per request (base64 in a 10 MiB body).`,
      );
      return;
    }
    setError(null);
    setReading(true);
    try {
      onChange(await fileToUploadValue(file));
    } catch {
      setError(`Could not read ${file.name}.`);
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
      {upload ? (
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
          {reading ? 'Reading…' : 'Drop a file here or choose one.'}
        </span>
      )}
      <span className="flex flex-wrap gap-1.5">
        <button type="button" className={buttonClass} onClick={() => inputRef.current?.click()} disabled={reading}>
          {upload || kept ? 'Replace…' : 'Choose file…'}
        </button>
        {upload || kept ? (
          <button type="button" className={buttonClass} onClick={() => onChange(undefined)}>
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
    render: ({ value, onChange }) => <FileUploadField value={value} onChange={onChange} />,
  });
}
