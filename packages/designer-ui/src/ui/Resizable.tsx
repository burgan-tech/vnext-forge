import * as React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '../lib/utils/cn.js';

type LibraryPanelProps = React.ComponentProps<typeof Panel>;

/**
 * @see https://github.com/bvaughn/react-resizable-panels/blob/main/packages/react-resizable-panels/README.md#panel
 */
export type ResizablePanelProps = LibraryPanelProps & {
  /**
   * `true` iken (kütüphane `react-resizable-panels`):
   * Sürükleme ile `minSize` sınırının **altına** inildiğinde panel `collapsedSize` değerine (varsayılan `0%`) kapanabilir
   * (yani tam kapanma için `collapsedSize` verilmezse genişlik 0).
   */
  autoCollapseBelowMin?: boolean;
  /**
   * Sadece **piksel** tabanlı `minSize` (`number` veya `"160px"`) ile anlamlıdır.
   * Kütüphaneye giden eşik `minSize - collapseOvershootPx` olur: önce min’e inilir, bu kadar piksel **daha**
   * aşılınca çökme eşiği devreye girer (min 160, 30 verilirse ~130 piksele kadar inmeden kapanmaz).
   * @default 0
   */
  collapseOvershootPx?: number;
};

function resolveMinSizeForCollapseOvershoot(
  minSize: LibraryPanelProps['minSize'] | undefined,
  overshootPx: number
): LibraryPanelProps['minSize'] | undefined {
  if (overshootPx <= 0 || minSize === undefined) {
    return minSize;
  }
  if (typeof minSize === 'number') {
    return Math.max(0, minSize - overshootPx);
  }
  if (typeof minSize === 'string') {
    const t = minSize.trim();
    if (t.endsWith('px')) {
      const n = parseFloat(t);
      if (Number.isFinite(n)) {
        return `${Math.max(0, n - overshootPx)}px`;
      }
    }
  }
  return minSize;
}

/**
 * shadcn/ui Resizable — `react-resizable-panels` v4 (Group / Panel / Separator).
 * Ayırıcı: 1px çizgi `::before` ile; sütun ayracında çizgi handle sütununun solunda (sol panel kenarına bitişik)
 * (kalın bar yok). `disableCursor` varsayılan açık.
 * @see https://ui.shadcn.com/docs/components/radix/resizable
 */
function ResizablePanelGroup({
  className,
  disableCursor = true,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className)}
      disableCursor={disableCursor}
      {...props}
    />
  );
}

function ResizablePanel({
  autoCollapseBelowMin = false,
  collapseOvershootPx = 0,
  minSize,
  collapsible,
  collapsedSize,
  ...props
}: ResizablePanelProps) {
  const effectiveMinSize = autoCollapseBelowMin
    ? resolveMinSizeForCollapseOvershoot(minSize, collapseOvershootPx)
    : minSize;

  return (
    <Panel
      data-slot="resizable-panel"
      {...props}
      collapsedSize={autoCollapseBelowMin && collapsedSize === undefined ? '0%' : collapsedSize}
      collapsible={autoCollapseBelowMin ? true : collapsible}
      minSize={effectiveMinSize}
    />
  );
}

function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'group/resizable-handle',
        'relative z-20 flex shrink-0 self-stretch bg-transparent',
        'min-w-2.5 w-2.5',
        'aria-[orientation=horizontal]:h-2.5 aria-[orientation=horizontal]:min-h-2.5',
        'aria-[orientation=horizontal]:min-w-0 aria-[orientation=horizontal]:w-full',
        "before:content-[''] before:pointer-events-none before:absolute before:z-[1] before:w-px before:bg-border",
        'before:transition-colors before:duration-150 before:ease-out',
        'before:top-0 before:bottom-0 before:left-0 before:translate-x-0',
        'hover:before:bg-primary-border-hover data-[separator=active]:before:bg-primary-border-hover',
        'aria-[orientation=horizontal]:before:top-0 aria-[orientation=horizontal]:before:bottom-auto',
        'aria-[orientation=horizontal]:before:left-0 aria-[orientation=horizontal]:before:h-px',
        'aria-[orientation=horizontal]:before:w-full aria-[orientation=horizontal]:before:translate-y-0',
        'aria-[orientation=horizontal]:before:translate-x-0',
        'outline-none focus:outline-none focus-visible:outline-none',
        'ring-0 ring-offset-0 focus:ring-0 focus-visible:ring-0',
        'aria-[orientation=vertical]:cursor-ew-resize aria-[orientation=horizontal]:cursor-ns-resize',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        'aria-disabled:before:bg-border',
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };

export {
  useDefaultLayout,
  useGroupCallbackRef,
  useGroupRef,
  usePanelCallbackRef,
  usePanelRef,
} from 'react-resizable-panels';
