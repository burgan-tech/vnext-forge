import * as fs from 'node:fs';
import * as vscode from 'vscode';

/**
 * Loads a built webview page, rewrites its asset URLs and injects the CSP and
 * `window.__VNEXT_CONFIG__`. Same policy as `QuickRunPanel.buildHtml`, minus
 * the pseudo-ui tenant stylesheet the monitor does not render.
 */
export function buildWebviewHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  htmlFile: string,
  config: Record<string, unknown>,
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview-ui');
  let html = fs.readFileSync(vscode.Uri.joinPath(distPath, htmlFile).fsPath, 'utf8');

  html = html.replace(/((?:src|href)=")(\.?\/?assets\/[^"]+)(")/g, (_m, prefix, assetPath, suffix) => {
    const clean = (assetPath as string).replace(/^\.?\/?/, '');
    return `${prefix}${webview.asWebviewUri(vscode.Uri.joinPath(distPath, clean)).toString()}${suffix}`;
  });

  const nonce = generateNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
    `worker-src ${webview.cspSource} blob:`,
    `font-src ${webview.cspSource} data:`,
    `img-src ${webview.cspSource} data:`,
    `connect-src ${webview.cspSource}`,
  ].join('; ');

  html = html.replace(/<script(\s[^>]*)?>/g, (match: string, attrs?: string) =>
    (attrs ?? '').includes('nonce=') ? match : `<script${attrs ?? ''} nonce="${nonce}">`,
  );
  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    `<script nonce="${nonce}">\n  window.__VNEXT_CONFIG__ = ${JSON.stringify(config)};\n</script>`,
  ].join('\n');
  return html.replace('</head>', `${head}\n</head>`);
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
