import type { ScriptCodeRef } from './editor/ScriptCodec';
import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';

export interface ScriptCode {
  location: string;
  /**
   * Inline body (`encoding` = `B64`/`NAT`) or a reference to a
   * sys-mappings component (`encoding` = `REF`).
   */
  code: string | ScriptCodeRef;
  encoding?: 'B64' | 'NAT' | 'REF';
  /**
   * Optional `scripts` sub-object — `{helpers, allowedAssemblies}`.
   * Authored alongside the body; lives on the same mapping object so
   * editors can show / mutate it without touching the parent shape.
   */
  scripts?: ScriptsConfig;
}
