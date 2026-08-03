import { Badge } from '../../../ui/Badge.js';
import {
  decodeScriptCode,
  formatScriptCodeRef,
  getScriptEncoding,
  isScriptCodeRef,
} from '../../code-editor/editor/ScriptCodec.js';
import { ComponentRefCard } from './ComponentRefCard.js';
import { ReadOnlyCodeField } from './ReadOnlyCodeField.js';
import type { HelperRefLike as HelperRef, ScriptLike } from './readonlyGuards.js';

export interface ReadOnlyScriptSectionProps {
  label: string;
  script: ScriptLike | null | undefined;
  onNavigateToMapping?: (ref: { key?: string; domain?: string; version?: string }) => void;
}

/** `formatScriptCodeRef` when the ref is well-formed, best-effort text otherwise. */
function helperLabel(helper: HelperRef): string {
  if (isScriptCodeRef(helper)) return formatScriptCodeRef(helper);
  const domain = typeof helper.domain === 'string' ? `${helper.domain}/` : '';
  const key = typeof helper.key === 'string' ? helper.key : '';
  const version = typeof helper.version === 'string' ? `@${helper.version}` : '';
  return `${domain}${key}${version}` || 'unknown';
}

/**
 * Decoded script body (or a sys-mappings REF card) in quiet read-only
 * (the Monaco onChange handler is a no-op and `readOnly` is passed explicitly).
 * Must be rendered inside `<FormReadOnlyProvider>`; otherwise the controls
 * appear editable.
 */
export function ReadOnlyScriptSection({
  label,
  script,
  onNavigateToMapping,
}: ReadOnlyScriptSectionProps) {
  if (!script || (script.code === undefined && !script.location)) return null;

  const encoding = getScriptEncoding(script.encoding);
  const code = script.code;
  const helpers = script.scripts?.helpers ?? [];
  const allowedAssemblies = script.scripts?.allowedAssemblies ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {script.location && (
          <span className="text-muted-foreground font-mono text-xs">{script.location}</span>
        )}
        <Badge variant="outline" className="text-xs">
          {encoding}
        </Badge>
      </div>
      {isScriptCodeRef(code) ? (
        <ComponentRefCard
          refValue={code}
          onNavigate={onNavigateToMapping ? () => onNavigateToMapping(code) : undefined}
        />
      ) : (
        <ReadOnlyCodeField
          value={decodeScriptCode(typeof code === 'string' ? code : undefined, encoding)}
          language="csharp"
          height={220}
          title={script.location ?? label}
        />
      )}
      {helpers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Helpers</span>
          {helpers.map((helper, index) => (
            <Badge key={index} variant="secondary" className="font-mono text-xs">
              {helperLabel(helper)}
            </Badge>
          ))}
        </div>
      )}
      {allowedAssemblies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Allowed assemblies</span>
          {allowedAssemblies.map((assembly) => (
            <Badge key={assembly} variant="outline" className="font-mono text-xs">
              {assembly}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
