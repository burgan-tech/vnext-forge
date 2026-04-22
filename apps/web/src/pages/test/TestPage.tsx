import type { ReactNode } from 'react';
import {
  Code2,
  FileJson,
  LayoutTemplate,
  SquareSplitHorizontal,
  SquareSplitVertical,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vnext-forge/designer-ui/ui';

/**
 * `/test` — yalnızca `@vnext-forge/designer-ui` Resizable (react-resizable-panels v4) denemeleri.
 */
export function TestPage() {
  return (
    <div className="bg-background text-foreground min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-2">
          <Badge variant="muted">/test</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Resizable</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            <code className="text-foreground/90">ResizablePanelGroup</code>,{' '}
            <code className="text-foreground/90">ResizablePanel</code>,{' '}
            <code className="text-foreground/90">ResizableHandle</code> — yatay ve dikey düzen,
            ince ayırıcı; hit alanı sol panelin scrollbar sütununa taşmaz.
          </p>
        </header>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SquareSplitHorizontal className="text-muted-foreground size-4" aria-hidden />
            İki sütun
          </div>
          <div className="border-border h-[min(24rem,70vh)] min-h-56 overflow-hidden rounded-xl border">
            <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 w-full">
              <ResizablePanel defaultSize="42%" minSize="18%">
                <PanelPlaceholder
                  title="Sol panel"
                  description="defaultSize 42%, minSize 18%"
                  icon={<FileJson className="size-5" aria-hidden />}
                />
              </ResizablePanel>
              <ResizableHandle />

              <ResizablePanel defaultSize="58%" minSize="22%">
                <PanelPlaceholder
                  title="Sağ panel"
                  description="Kalan alan; sürükleyerek oranı değiştir."
                  icon={<Code2 className="size-5" aria-hidden />}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SquareSplitVertical className="text-muted-foreground size-4" aria-hidden />
            Üst / alt — dikey bölme
          </div>
          <div className="border-border h-[min(22rem,60vh)] min-h-48 overflow-hidden rounded-xl border">
            <ResizablePanelGroup orientation="vertical" className="h-full min-h-0 w-full">
              <ResizablePanel defaultSize="40%" minSize="15%">
                <div className="bg-secondary/30 flex h-full min-h-0 items-center justify-center p-4">
                  <p className="text-muted-foreground text-sm">Üst bölge</p>
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="60%" minSize="20%">
                <div className="bg-muted/40 flex h-full min-h-0 items-center justify-center p-4">
                  <p className="text-muted-foreground text-sm">Alt bölge</p>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LayoutTemplate className="text-muted-foreground size-4" aria-hidden />
            Üç sütun — ince ayırıcı (without handle)
          </div>
          <div className="border-border h-48 min-h-40 overflow-hidden rounded-xl border">
            <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 w-full">
              <ResizablePanel defaultSize="25%" minSize="12%">
                <div className="text-muted-foreground border-border/60 flex h-full items-center justify-center border-r text-xs">
                  A
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="50%" minSize="20%">
                <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                  B
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="25%" minSize="12%">
                <div className="text-muted-foreground border-border/60 flex h-full items-center justify-center border-l text-xs">
                  C
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </section>
      </div>
    </div>
  );
}

function PanelPlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-auto p-3">
      <Card variant="secondary" className="h-full min-h-0 border-0 shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="bg-primary-muted text-primary-icon flex size-10 shrink-0 items-center justify-center rounded-lg">
              {icon}
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Burada form önizleme, özet veya log alanı gibi gerçek içerik olabilir. Yükseklik
            sınırlandığı için taşan metin bu kart içinde kaydırılır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
