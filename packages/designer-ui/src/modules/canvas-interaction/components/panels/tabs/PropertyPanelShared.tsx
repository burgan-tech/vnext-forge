import { useState, useMemo } from 'react';
import {
  ChevronRight, CheckSquare, ArrowRight, Code2, FileText,
  Copy, Plus, Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';
import { copyToClipboard, decodeBase64 } from './PropertyPanelHelpers';

/* ────────────── Editable Fields ────────────── */

export function EditableInput({ value, onChange, mono = false, placeholder = '' }: {
  value: string; onChange: (v: string) => void; mono?: boolean; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle ${mono ? 'font-mono' : ''}`}
    />
  );
}

export function SelectField({ value, onChange, options }: {
  value: string | number; onChange: (v: string) => void; options: Array<{ value: string | number; label: string; disabled?: boolean }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  );
}

/* ────────────── Icons (Lucide) ────────────── */

export function IconChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={14}
      className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    />
  );
}

export function IconTask() { return <CheckSquare size={14} />; }
export function IconTransition() { return <ArrowRight size={14} />; }
export function IconCode() { return <Code2 size={13} />; }
export function IconFile() { return <FileText size={12} />; }
export function IconCopy() { return <Copy size={12} />; }
export function IconPlus() { return <Plus size={13} />; }
export function IconTrash() { return <Trash2 size={13} />; }
export function IconUp() { return <ArrowUp size={12} />; }
export function IconDown() { return <ArrowDown size={12} />; }

/* ────────────── Reusable Components ────────────── */

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold leading-none tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function Section({
  title,
  count,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden bg-muted-surface">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left group hover:bg-muted transition-colors cursor-pointer"
      >
        <span className="text-muted-foreground group-hover:text-primary-icon transition-colors">
          <IconChevron open={open} />
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[12px] font-semibold text-muted-foreground tracking-tight flex-1">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">{count}</span>
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

export function InfoRow({ label, value, mono = false, copyable = false }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-1.5">
      {label && <span className="text-[11px] text-muted-foreground shrink-0 w-20 font-medium">{label}</span>}
      <span className={`text-xs text-foreground break-all flex-1 ${mono ? 'font-mono bg-muted px-2 py-1 rounded-lg' : ''}`}>
        {value}
      </span>
      {copyable && (
        <button
          onClick={() => copyToClipboard(value)}
          className="shrink-0 p-1.5 text-subtle hover:text-secondary-icon hover:bg-secondary rounded-lg transition-all cursor-pointer"
          title="Copy"
        >
          <IconCopy />
        </button>
      )}
    </div>
  );
}

export function CodePreview({ code, location }: { code: string; location?: string }) {
  const [expanded, setExpanded] = useState(false);
  const decoded = useMemo(() => decodeBase64(code), [code]);
  const lines = decoded.split('\n');
  const preview = lines.slice(0, expanded ? lines.length : 8).join('\n');
  const hasMore = lines.length > 8;

  return (
    <div className="mt-2">
      {location && (
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
          <IconFile />
          <span className="font-mono">{location}</span>
        </div>
      )}
      <div className="relative">
        <pre className="text-[11px] leading-relaxed font-mono text-foreground bg-muted-surface rounded-xl p-3 overflow-x-auto max-h-75 overflow-y-auto">
          {preview}
        </pre>
        {hasMore && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface to-transparent rounded-b-xl" />
        )}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-secondary-icon hover:text-secondary-foreground mt-1.5 font-medium cursor-pointer"
        >
          {expanded ? 'Show less' : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

export function ResourceRef({ resource }: { resource: any }) {
  return (
    <div className="space-y-1">
      <InfoRow label="Key" value={resource.key || '\u2014'} mono copyable />
      <InfoRow label="Domain" value={resource.domain || '\u2014'} mono />
      <InfoRow label="Version" value={resource.version || '\u2014'} mono />
      <InfoRow label="Flow" value={resource.flow || '\u2014'} mono />
    </div>
  );
}

export function LabelList({ labels }: { labels: any[] }) {
  return (
    <div className="space-y-1.5 mt-1">
      {labels.map((l: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-6 h-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-mono shrink-0 uppercase font-bold">
            {l.language || '?'}
          </span>
          <span className="text-xs text-foreground">{l.label || '(empty)'}</span>
        </div>
      ))}
    </div>
  );
}

export function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg px-2 py-2 text-center ${color}`}>
      <div className="text-base font-bold leading-none tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-[9px] font-semibold leading-tight opacity-60">{label}</div>
    </div>
  );
}
