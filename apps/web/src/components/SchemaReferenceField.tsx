import { useState } from 'react';
import { Plus, Trash2, ChevronRight, Database } from 'lucide-react';

/* ────────────── Types ────────────── */

export interface SchemaReference {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

interface SchemaReferenceFieldProps {
  value: SchemaReference | null | undefined;
  onChange: (ref: SchemaReference | null) => void;
  label?: string;
}

/* ────────────── Component ────────────── */

export function SchemaReferenceField({ value, onChange, label = 'Schema' }: SchemaReferenceFieldProps) {
  const [expanded, setExpanded] = useState(false);

  const handleCreate = () => {
    onChange({
      key: '',
      domain: '',
      version: '1.0.0',
      flow: 'sys-schemas',
    });
    setExpanded(true);
  };

  const handleRemove = () => {
    onChange(null);
    setExpanded(false);
  };

  const updateField = (field: keyof SchemaReference, val: string) => {
    if (!value) return;
    onChange({ ...value, [field]: val });
  };

  if (!value) {
    return (
      <button
        onClick={handleCreate}
        className="flex items-center gap-2 text-[11px] text-indigo-500 hover:text-indigo-600 px-2.5 py-2 border border-dashed border-indigo-200/60 rounded-xl hover:border-indigo-400/60 hover:bg-indigo-50/50 transition-all font-semibold"
      >
        <Plus size={13} />
        <span>Add {label}</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2.5 py-2 flex items-center gap-2 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className="size-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Database size={12} className="text-indigo-500" />
        </div>
        <span className="text-[11px] text-slate-600 flex-1 truncate">
          {value.key ? (
            <span className="font-mono font-semibold">{value.key}@{value.domain || '?'}</span>
          ) : (
            <span className="text-slate-400 italic">No schema configured</span>
          )}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-all"
          title="Remove schema"
        >
          <Trash2 size={13} />
        </button>
        <ChevronRight size={14} className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-100 pt-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Key</label>
              <input
                type="text"
                value={value.key}
                onChange={(e) => updateField('key', e.target.value)}
                placeholder="schema-key"
                className="w-full px-2.5 py-1.5 text-[11px] font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Domain</label>
              <input
                type="text"
                value={value.domain}
                onChange={(e) => updateField('domain', e.target.value)}
                placeholder="domain"
                className="w-full px-2.5 py-1.5 text-[11px] font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Version</label>
              <input
                type="text"
                value={value.version}
                onChange={(e) => updateField('version', e.target.value)}
                placeholder="1.0.0"
                className="w-full px-2.5 py-1.5 text-[11px] font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Flow</label>
              <input
                type="text"
                value={value.flow}
                disabled
                className="w-full px-2.5 py-1.5 text-[11px] font-mono border border-slate-200/80 rounded-lg bg-slate-100/80 text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
