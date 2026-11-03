import { createContext, useContext } from 'react';

import { uploadFile } from '../QuickRunApi';
import { bytesToBase64 } from '../utils/fileFields';

/**
 * Streams one picked file for the field at `schemaPath` (`files[]`, …) and
 * resolves to the runtime's upload ticket. Provided by the dialog that owns
 * the request (it knows the flow, version, headers and environment).
 */
export type StreamFileUploader = (schemaPath: string, file: File) => ReturnType<typeof uploadFile>;

const FileUploadContext = createContext<StreamFileUploader | null>(null);

export const FileUploadProvider = FileUploadContext.Provider;

/** The surrounding dialog's uploader, or `null` where streamed uploads are not wired. */
export function useStreamFileUploader(): StreamFileUploader | null {
  return useContext(FileUploadContext);
}

/** The uploader a QuickRun dialog provides: the file's bytes go through `quickrun/uploadFile`. */
export function createStreamFileUploader(target: {
  domain: string;
  workflowKey: string;
  version?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): StreamFileUploader {
  return async (schemaPath, file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return uploadFile({
      domain: target.domain,
      workflowKey: target.workflowKey,
      path: schemaPath,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64: bytesToBase64(bytes),
      ...(target.version ? { version: target.version } : {}),
      ...(target.headers ? { headers: target.headers } : {}),
      ...(target.runtimeUrl ? { runtimeUrl: target.runtimeUrl } : {}),
    });
  };
}
