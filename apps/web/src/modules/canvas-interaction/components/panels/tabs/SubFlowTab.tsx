import { Section, ResourceRef } from './PropertyPanelShared';

export function SubFlowTab({ state }: { state: any }) {
  const sf = state.subFlow;
  if (!sf) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[10px] text-muted-foreground">No SubFlow configured</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-surface">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">SubFlow Reference</div>
        <ResourceRef resource={sf} />
      </div>
      {sf.body && (
        <Section title="Input Body" defaultOpen>
          <pre className="text-[10px] font-mono text-foreground bg-muted-surface border border-border rounded-md p-2 overflow-x-auto">
            {typeof sf.body === 'string' ? sf.body : JSON.stringify(sf.body, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}
