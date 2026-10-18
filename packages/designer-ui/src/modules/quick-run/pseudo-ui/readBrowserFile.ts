import type { FileReadRequest, PickedFileValue } from '@burgan-tech/pseudo-ui';

import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('pseudo-ui');

/** Bytes per `String.fromCharCode` call; keeps the argument list far below engine limits. */
const CHUNK = 0x8000;

/**
 * `PseudoViewDelegate.readFile` for browser / VS Code webview hosts.
 *
 * `input.file` is the platform handle the picker got from its dialog — a
 * `File` (a `Blob`) here. Uses `Blob.arrayBuffer()` + chunked `btoa` rather
 * than `FileReader` so it works in the webview and in Node tests alike.
 * Returns `null` for a non-Blob handle (the SDK shows its "failed" text).
 * Logs name / type / size only — never content.
 */
export async function readBrowserFile(input: FileReadRequest): Promise<PickedFileValue | null> {
  const { file } = input;
  if (typeof Blob === 'undefined' || !(file instanceof Blob)) {
    logger.warn('[readFile] handle is not a Blob; cannot read.', { name: input.name });
    return null;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return {
      name: input.name,
      mimeType: input.mimeType,
      size: bytes.length,
      content: btoa(binary),
    };
  } catch (error) {
    logger.warn('[readFile] failed to read file.', {
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      error,
    });
    return null;
  }
}
