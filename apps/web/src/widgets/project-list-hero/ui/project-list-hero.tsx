import { Layers, Link2 } from 'lucide-react';

export function ProjectListHero() {
  return (
    <section className="mb-8 flex flex-col items-center text-center">
      {/* Icon */}
      <div className="relative mb-5 h-18 w-18">
        <div className="from-brand-from via-brand-via to-brand-to absolute inset-0 rounded-[22px] bg-gradient-to-br opacity-20 blur-xl" />
        <div className="from-brand-glow via-brand-via to-brand-to shadow-brand-glow/25 ring-brand-ring/70 relative flex h-full w-full items-center justify-center rounded-[22px] border border-white/60 bg-gradient-to-br shadow-lg ring-4">
          <img src="/icon.svg" alt="vNext Forge" className="h-9 w-9 drop-shadow" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-foreground mb-3 text-[2.6rem] leading-none font-[650] tracking-[-0.03em]">
        vNext Forge
      </h1>

      {/* Subtitle badges */}
      <div className="text-subtle flex items-center gap-4 text-[10.5px] font-semibold tracking-[0.18em] uppercase">
        <span className="flex items-center gap-1.5">
          <Layers size={11} />
          Workflow Design
        </span>
        <span className="bg-border h-3 w-px" />
        <span className="flex items-center gap-1.5">
          <Link2 size={11} />
          Workspace
        </span>
      </div>
    </section>
  );
}
