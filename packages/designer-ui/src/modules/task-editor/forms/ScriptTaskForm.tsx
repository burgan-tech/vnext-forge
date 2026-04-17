import { JsonCodeField } from '../../../ui/JsonCodeField';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function ScriptTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground mb-1">C# Script</div>
      <JsonCodeField
        value={String(config.script || '')}
        onChange={(v) => onChange((d: any) => { d.script = v; })}
        language="csharp"
        height={300}
      />
    </div>
  );
}

