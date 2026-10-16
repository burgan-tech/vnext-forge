import { getHostEditorCapabilities } from '../../../lsp/hostEditorCapabilitiesRegistry';
import { base64ToBytes } from '../utils/fileFields';

export interface HostFile {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * Types a browser would run as a document; the runtime serves them as
 * `attachment`, and the web shell never opens them in a tab either.
 */
export function isActiveContentType(mimeType: string): boolean {
  const type = mimeType.split(';')[0].trim().toLowerCase();
  return (
    type === 'text/html' ||
    type === 'application/xhtml+xml' ||
    type === 'image/svg+xml' ||
    type === 'text/xml' ||
    type === 'application/xml' ||
    type === 'text/javascript' ||
    type === 'application/javascript' ||
    type.endsWith('+xml')
  );
}

function downloadInBrowser(file: HostFile): void {
  const blob = new Blob([base64ToBytes(file.contentBase64) as BlobPart], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * "Save as": the VS Code host shows a save dialog (a Blob download is blocked
 * by the webview CSP); the web shell downloads through the browser.
 */
export function saveFileAs(file: HostFile): void {
  const post = getHostEditorCapabilities().postMessageToHost;
  if (post) {
    post({ type: 'host:save-bytes', ...file });
    return;
  }
  downloadInBrowser(file);
}

/**
 * "Open": the VS Code host writes a temporary copy and opens it in the
 * editor; the web shell opens a new tab, except for active content (HTML,
 * SVG, XML, JS), which is downloaded instead.
 */
export function openFile(file: HostFile): void {
  const post = getHostEditorCapabilities().postMessageToHost;
  if (post) {
    post({ type: 'host:open-bytes', ...file });
    return;
  }
  if (isActiveContentType(file.mimeType)) {
    downloadInBrowser(file);
    return;
  }
  const blob = new Blob([base64ToBytes(file.contentBase64) as BlobPart], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
