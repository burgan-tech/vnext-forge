import * as vscode from 'vscode';

const CODE_LINE_REGEX = /"code"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/;
const ENCODING_LINE_REGEX = /"encoding"\s*:\s*"(B64|NAT|REF)"/;
const PREVIEW_LINE_LIMIT = 200;

function isValidBase64(value: string): boolean {
  if (!value) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

function decodeBase64(value: string): string | null {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Locate the surrounding mapping object's `encoding` field by scanning
 * nearby lines. The mapping shapes we care about always keep
 * `encoding` within a handful of lines of `code` (sibling keys), so a
 * small radius is enough and avoids pulling in a JSON parser.
 */
function findSiblingEncoding(document: vscode.TextDocument, codeLine: number): 'B64' | 'NAT' | 'REF' | null {
  const radius = 20;
  const from = Math.max(0, codeLine - radius);
  const to = Math.min(document.lineCount - 1, codeLine + radius);
  let braceBalance = 0;
  for (let line = codeLine; line >= from; line--) {
    const text = document.lineAt(line).text;
    for (let i = text.length - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '}') braceBalance += 1;
      else if (ch === '{') braceBalance -= 1;
      if (braceBalance < 0) {
        // Walked past the parent object; look forward from here for the encoding key.
        break;
      }
    }
    const match = ENCODING_LINE_REGEX.exec(text);
    if (match) return match[1] as 'B64' | 'NAT' | 'REF';
    if (braceBalance < 0) break;
  }
  for (let line = codeLine + 1; line <= to; line++) {
    const text = document.lineAt(line).text;
    const match = ENCODING_LINE_REGEX.exec(text);
    if (match) return match[1] as 'B64' | 'NAT' | 'REF';
    if (text.includes('{')) break;
  }
  return null;
}

/**
 * Inline hover preview for the `code` field on every mapping shape
 * inside component JSON files. Decodes per the sibling `encoding`
 * (default B64) and shows the CSX body as a fenced ```csharp block.
 *
 * Absorbs the hover feature from the archived `csx-json-sync`
 * extension and extends it with `NAT` (pass-through) and `REF`
 * (sys-mappings reference summary) awareness.
 */
export class CsxJsonHoverProvider implements vscode.HoverProvider {
  constructor(private readonly logger: vscode.OutputChannel) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    if (document.languageId !== 'json') return null;

    const line = document.lineAt(position.line).text;
    const match = CODE_LINE_REGEX.exec(line);
    if (!match) return null;

    const value = match[1];
    const start = line.indexOf(`"${value}"`);
    if (start === -1) return null;
    const valueStart = start + 1; // inside the opening quote
    const valueEnd = valueStart + value.length;
    if (position.character < valueStart || position.character > valueEnd) return null;

    const encoding = findSiblingEncoding(document, position.line) ?? 'B64';

    let decoded: string | null = null;
    if (encoding === 'B64') {
      if (!isValidBase64(value)) {
        return new vscode.Hover(
          new vscode.MarkdownString('*Value is not valid Base64.*'),
        );
      }
      decoded = decodeBase64(value);
    } else if (encoding === 'NAT') {
      // JSON unescape happens via the parser path: value in the doc
      // already shows `\n` / `\"` escape sequences. Reuse JSON.parse
      // to materialise the actual string.
      try {
        decoded = JSON.parse(`"${value}"`) as string;
      } catch {
        decoded = value;
      }
    } else if (encoding === 'REF') {
      // REF means `code` is an object, not a string — the regex
      // above will not even match. Bail out defensively.
      return null;
    }
    if (decoded == null) return null;

    const truncated = decoded.split('\n').slice(0, PREVIEW_LINE_LIMIT).join('\n');
    const wasTruncated = decoded.split('\n').length > PREVIEW_LINE_LIMIT;

    const md = new vscode.MarkdownString();
    md.appendCodeblock(truncated, 'csharp');
    md.appendMarkdown(
      `\n---\n*Encoding: ${encoding}* · *Length: ${value.length} chars*${wasTruncated ? ' · *truncated*' : ''}`,
    );
    md.isTrusted = false;

    const range = new vscode.Range(
      new vscode.Position(position.line, valueStart),
      new vscode.Position(position.line, valueEnd),
    );

    this.logger.appendLine(`csx-sync hover: ${encoding} preview at ${document.fileName}:${position.line + 1}`);
    return new vscode.Hover(md, range);
  }
}
