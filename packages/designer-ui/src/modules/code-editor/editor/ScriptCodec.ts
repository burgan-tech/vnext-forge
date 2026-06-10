import { encodeToBase64, decodeFromBase64 } from './Base64Handler';

export type ScriptEncoding = 'B64' | 'NAT' | 'REF';

/**
 * Reference shape used when `encoding === 'REF'` — the script body
 * delegates to a sys-mappings component identified by `{key, version,
 * flow, domain}`.
 */
export interface ScriptCodeRef {
  key: string;
  version: string;
  flow: 'sys-mappings';
  domain?: string;
}

export function isScriptCodeRef(code: unknown): code is ScriptCodeRef {
  return (
    typeof code === 'object' &&
    code !== null &&
    typeof (code as ScriptCodeRef).key === 'string' &&
    typeof (code as ScriptCodeRef).version === 'string' &&
    (code as ScriptCodeRef).flow === 'sys-mappings'
  );
}

/**
 * Best-effort text representation of a script body for preview /
 * Monaco editing. REF entries have no inline body — we return an empty
 * string and the surrounding card switches to a picker UI instead.
 */
export function decodeScriptCode(
  code: string | ScriptCodeRef | undefined,
  encoding?: string,
): string {
  if (!code) return '';
  if (encoding === 'REF') return '';
  if (typeof code !== 'string') return '';
  if (encoding === 'NAT') return code;
  return decodeFromBase64(code);
}

export function encodeScriptCode(plainText: string, encoding: ScriptEncoding): string {
  if (encoding === 'REF') return '';
  if (encoding === 'NAT') return plainText;
  return encodeToBase64(plainText);
}

export function getScriptEncoding(encoding?: string): ScriptEncoding {
  if (encoding === 'NAT') return 'NAT';
  if (encoding === 'REF') return 'REF';
  return 'B64';
}

/**
 * One-line, human-readable label for a script REF — used in the
 * compact ref card surfaced by `CsxEditorField` when encoding is REF.
 */
export function formatScriptCodeRef(ref: ScriptCodeRef): string {
  const prefix = ref.domain ? `${ref.domain}/` : '';
  return `${prefix}${ref.key}@${ref.version}`;
}
