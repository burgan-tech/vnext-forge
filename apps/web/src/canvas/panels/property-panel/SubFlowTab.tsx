import { Section, ResourceRef } from './shared';

export function SubFlowTab({ state }: { state: any }) {
  const sf = state.subFlow;
  if (!sf) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[10px] text-slate-400">No SubFlow configured</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="border border-slate-200 rounded-lg p-3 bg-white">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">SubFlow Reference</div>
        <ResourceRef resource={sf} />
      </div>
      {sf.body && (
        <Section title="Input Body" defaultOpen>
          <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2 overflow-x-auto">
            {typeof sf.body === 'string' ? sf.body : JSON.stringify(sf.body, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}
