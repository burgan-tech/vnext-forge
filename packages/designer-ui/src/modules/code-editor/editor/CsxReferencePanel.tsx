import { useCallback, useState } from 'react';
import { ChevronRight, Copy, Search, X } from 'lucide-react';
import { Input } from '../../../ui/Input';
import { filterCsxApiReferenceSections, type ApiEntry, type ApiSection } from './CsxApiReference';

interface CsxReferencePanelProps {
  onClose: () => void;
  onInsert?: (text: string) => void;
}

function ReferenceSection({
  section,
  onInsert,
}: {
  section: ApiSection;
  onInsert?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/80"
      >
        <ChevronRight
          size={11}
          className={`shrink-0 text-muted-icon transition-all duration-150 group-hover:text-muted-foreground ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 text-[11px] font-semibold text-foreground">{section.title}</span>
        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-medium tabular-nums text-muted-foreground">
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

function ReferenceEntry({ entry, onInsert }: { entry: ApiEntry; onInsert?: (text: string) => void }) {
  const handleInsert = useCallback(() => {
    if (onInsert && entry.insertText) {
      onInsert(entry.insertText);
    }
  }, [entry.insertText, onInsert]);

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleInsert}
      className="group flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-secondary-surface/80"
      title={entry.description}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[11px] font-semibold text-foreground transition-colors group-hover:text-secondary-text">
            {entry.name}
          </span>
          {entry.returnType && (
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
              → {entry.returnType}
            </span>
          )}
        </div>
      </div>
      <Copy
        size={10}
        className="shrink-0 text-muted-icon transition-colors group-hover:text-secondary-icon"
      />
    </button>
  );
}

export function CsxReferencePanel({ onClose, onInsert }: CsxReferencePanelProps) {
  const [search, setSearch] = useState('');

  const filteredSections = filterCsxApiReferenceSections(search);

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
        <span className="flex-1 text-[11px] font-bold tracking-tight text-foreground">C# API</span>
        <button
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <X size={12} />
        </button>
      </div>

      <div className="shrink-0 border-b border-border-subtle px-2 py-1.5">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          variant="muted"
          size="sm"
          leading={<Search size={11} />}
          className="rounded-md"
          inputClassName="text-[11px] font-medium"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredSections.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-muted-foreground">No results</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filteredSections.map((section) => (
              <ReferenceSection key={section.title} section={section} onInsert={onInsert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
