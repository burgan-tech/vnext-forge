import { useState, useCallback } from 'react';
import { CSX_API_REFERENCE, type ApiSection, type ApiEntry } from './CsxApiReference';
import { ChevronRight, Copy, X, Search } from 'lucide-react';

/* ────────────── Props ────────────── */

interface CsxReferencePanelProps {
  onClose: () => void;
  onInsert?: (text: string) => void;
}

/* ────────────── Section Component ────────────── */

function ReferenceSection({ section, onInsert }: { section: ApiSection; onInsert?: (text: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50/80 transition-colors group"
      >
        <ChevronRight
          size={11}
          className={`text-slate-300 group-hover:text-slate-500 transition-all duration-150 shrink-0 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[11px] font-semibold text-slate-600 flex-1">{section.title}</span>
        <span className="size-5 rounded-md bg-slate-100 text-[10px] text-slate-400 flex items-center justify-center tabular-nums font-medium">
          {section.entries.length}
        </span>
      </button>

      {open && (
        <div className="pb-1">
          {section.entries.map((entry) => (
            <ReferenceEntry key={entry.name} entry={entry} onInsert={onInsert} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────── Entry Component ────────────── */

function ReferenceEntry({ entry, onInsert }: { entry: ApiEntry; onInsert?: (text: string) => void }) {
  const handleInsert = useCallback(() => {
    if (onInsert && entry.insertText) {
      onInsert(entry.insertText);
    }
  }, [onInsert, entry.insertText]);

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleInsert}
      className="w-full text-left px-4 py-1.5 hover:bg-indigo-50/60 transition-colors group flex items-center gap-2"
      title={entry.description}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">
            {entry.name}
          </span>
          {entry.returnType && (
            <span className="text-[9px] font-mono text-slate-400 shrink-0">→ {entry.returnType}</span>
          )}
        </div>
      </div>
      <Copy
        size={10}
        className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0"
      />
    </button>
  );
}

/* ────────────── Main Panel ────────────── */

export function CsxReferencePanel({ onClose, onInsert }: CsxReferencePanelProps) {
  const [search, setSearch] = useState('');

  const filteredSections = search.trim()
    ? CSX_API_REFERENCE
        .map((section) => ({
          ...section,
          entries: section.entries.filter(
            (e) =>
              e.name.toLowerCase().includes(search.toLowerCase()) ||
              e.description.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((s) => s.entries.length > 0)
    : CSX_API_REFERENCE;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200/80">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
        <span className="text-[11px] font-bold text-slate-600 flex-1 tracking-tight">C# API</span>
        <button
          onClick={onClose}
          className="size-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all"
        >
          <X size={12} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-6 pr-2 py-1 text-[11px] border border-slate-200/80 rounded-md bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredSections.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-6">No results</div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {filteredSections.map((section) => (
              <ReferenceSection key={section.title} section={section} onInsert={onInsert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
