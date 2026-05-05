import { encodeToBase64, decodeFromBase64 } from './Base64Handler';

export type ScriptEncoding = 'B64' | 'NAT';

export function decodeScriptCode(code: string | undefined, encoding?: string): string {
  if (!code) return '';
  if (encoding === 'NAT') return code;
  return decodeFromBase64(code);
}

export function encodeScriptCode(plainText: string, encoding: ScriptEncoding): string {
  if (encoding === 'NAT') return plainText;
  return encodeToBase64(plainText);
}

export function getScriptEncoding(encoding?: string): ScriptEncoding {
  return encoding === 'NAT' ? 'NAT' : 'B64';
}
