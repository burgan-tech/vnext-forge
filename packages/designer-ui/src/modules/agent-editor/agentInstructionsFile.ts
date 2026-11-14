import { decodeScriptCode, encodeScriptCode } from '../code-editor/editor/ScriptCodec';
import { resolveWorkflowScriptAbsolutePath } from '../code-editor/createWorkflowScriptFile';

/**
 * `attributes.instructions` from a file (`location` + inlined `code`).
 *
 * The runtime only reads `instructions.code` (or `text`), and the wf CLI
 * only re-inlines `.csx` files, so Forge keeps the pair in sync the way it
 * does for workflow scripts:
 *   - open: the file on disk wins; a differing file is re-encoded into `code`
 *     (the document turns dirty and the editor says so);
 *   - save: `code` is written back to the file.
 * In VS Code the save-time CSX sync also re-inlines `.md` locations, so an
 * edit made outside Forge reaches the JSON without opening the designer.
 */
export interface InstructionsFileRef {
  location: string;
  encoding: 'B64' | 'NAT';
  /** Decoded instructions text currently inlined in `code`. */
  text: string;
  /** Absolute path of the file, next to the agent JSON. */
  absolutePath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function directoryOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(0, slash) : '.';
}

/** The file-backed instructions of an agent document, or `null` (inline text, REF, no location). */
export function instructionsFileRef(json: unknown, agentFilePath: string): InstructionsFileRef | null {
  const attributes = isRecord(json) && isRecord(json.attributes) ? json.attributes : null;
  const instructions = attributes && isRecord(attributes.instructions) ? attributes.instructions : null;
  if (!instructions) return null;
  const location = typeof instructions.location === 'string' ? instructions.location.trim() : '';
  if (!location || typeof instructions.code !== 'string') return null;
  if (instructions.encoding === 'REF') return null;
  const encoding = instructions.encoding === 'NAT' ? 'NAT' : 'B64';
  return {
    location,
    encoding,
    text: decodeScriptCode(instructions.code, encoding),
    absolutePath: resolveWorkflowScriptAbsolutePath(directoryOf(agentFilePath), location),
  };
}

/** Puts `text` into `instructions.code` with the document's encoding. */
export function setInstructionsCode(draft: Record<string, unknown>, text: string): void {
  const attributes = isRecord(draft.attributes) ? draft.attributes : null;
  const instructions = attributes && isRecord(attributes.instructions) ? attributes.instructions : null;
  if (!instructions) return;
  const encoding = instructions.encoding === 'NAT' ? 'NAT' : 'B64';
  instructions.code = encodeScriptCode(text, encoding);
}

/** Text files may differ only by CRLF / a trailing newline added by an editor. */
export function sameInstructionsText(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  return norm(a) === norm(b);
}
