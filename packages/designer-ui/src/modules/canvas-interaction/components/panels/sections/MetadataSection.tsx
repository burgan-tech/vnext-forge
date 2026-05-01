import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function MetadataSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-muted-surface overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="group hover:bg-muted flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors">
        <ChevronRight
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-muted-foreground text-[12px] font-semibold tracking-tight">
          {title}
        </span>
      </button>
      {open && <div className="px-3 pt-1 pb-3">{children}</div>}
    </div>
  );
}
