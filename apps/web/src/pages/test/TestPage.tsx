import { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  MoreHorizontal,
  Settings,
  Sparkles,
} from 'lucide-react';

import {
  Accordion,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vnext-forge/designer-ui/ui';

type SurfaceVariant = 'default' | 'secondary' | 'tertiary';

const surfaceVariants: SurfaceVariant[] = ['default', 'secondary', 'tertiary'];

export function TestPage() {
  const [checkboxes, setCheckboxes] = useState<Record<SurfaceVariant, boolean>>({
    default: true,
    secondary: false,
    tertiary: true,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="space-y-3">
            <Badge variant="muted">Shared UI Test Surface</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Primitive Variant Showcase</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Button, card, checkbox, dialog, dropdown menu, accordion, alert ve badge icin variant,
              hover ve border davranislarini ayni sayfada test edebilirsin.
            </p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {surfaceVariants.map((variant) => (
            <Card key={variant} variant={variant} hoverable className="gap-4">
              <CardHeader>
                <CardTitle className="capitalize">{variant} Card</CardTitle>
                <CardDescription>
                  Surface, border ve icon tonu bu card uzerinden kolayca gorulebilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-current/8">
                    <FolderOpen className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Workspace Preview</p>
                    <p className="text-xs text-current/70">
                      Variant family burada body ve icon tonuna yansiyor.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={variant}>badge</Badge>
                  <Badge variant={variant} noBorder>
                    noBorder
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-xs text-current/70">Hover card</span>
                <Button size="sm" variant={variant}>
                  Action
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Checkbox + Badge</CardTitle>
              <CardDescription>Variant ve border davranislarini birlikte test et.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {surfaceVariants.map((variant) => (
                <div
                  key={variant}
                  className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium capitalize">{variant}</p>
                    <p className="text-muted-foreground text-xs">
                      Hover, checked ve noBorder davranisi
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      variant={variant}
                      checked={checkboxes[variant]}
                      onCheckedChange={(checked) =>
                        setCheckboxes((prev) => ({ ...prev, [variant]: checked === true }))
                      }
                    />
                    <Checkbox variant={variant} checked={checkboxes[variant]} noBorder />
                    <Badge variant={variant}>{checkboxes[variant] ? 'checked' : 'idle'}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Alert + Badge</CardTitle>
              <CardDescription>Her variantin metin, icon ve hover dengesi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="default">
                <Bell />
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>
                  Primary surface ve semantik icon rengi kullanir.
                </AlertDescription>
              </Alert>
              <Alert variant="secondary">
                <Sparkles />
                <AlertTitle>Secondary Alert</AlertTitle>
                <AlertDescription>
                  Secondary surface daha yumusak ama gorunur kalir.
                </AlertDescription>
              </Alert>
              <Alert variant="tertiary">
                <CheckCircle2 />
                <AlertTitle>Tertiary Alert</AlertTitle>
                <AlertDescription>Success benzeri ama destructive olmayan vurgu.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Destructive Alert</AlertTitle>
                <AlertDescription>
                  Kritik aksiyon ve hata yuzeyi icin ayrilmis durumda.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Dialog Variants</CardTitle>
              <CardDescription>
                Content surface, close button hover ve footer aksiyonlarini test et.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {surfaceVariants.map((variant) => (
                <Dialog key={variant}>
                  <DialogTrigger asChild>
                    <Button variant={variant} leftIcon={<FolderOpen />} className="capitalize">
                      {variant} dialog
                    </Button>
                  </DialogTrigger>
                  <DialogContent variant={variant} className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle className="capitalize">{variant} Dialog</DialogTitle>
                      <DialogDescription>
                        Dialog content ve close button artik shared semantic token yapisini
                        kullaniyor.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 rounded-2xl border border-current/10 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-current/8">
                          <Settings className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Dialog body content</p>
                          <p className="text-xs text-current/70">
                            Hoverable ve border yapisini burada kontrol edebilirsin.
                          </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button variant={variant}>Save changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Dropdown Menu</CardTitle>
              <CardDescription>
                Content, item ve checkbox item varyasyonlarini bu bloktan acabilirsin.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {surfaceVariants.map((variant) => (
                <DropdownMenu key={variant}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={variant}
                      rightIcon={<ChevronDown />}
                      rightIconVariant={variant}
                      className="capitalize">
                      {variant} menu
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent variant={variant} className="w-64">
                    <DropdownMenuLabel variant={variant} className="capitalize">
                      {variant} actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator variant={variant} />
                    <DropdownMenuItem variant={variant}>
                      <FolderOpen />
                      Open project
                    </DropdownMenuItem>
                    <DropdownMenuItem variant={variant}>
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem
                      variant={variant}
                      checked={notificationsEnabled}
                      onCheckedChange={(checked) => setNotificationsEnabled(checked === true)}>
                      Notifications enabled
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      variant={variant}
                      checked={compactMode}
                      onCheckedChange={(checked) => setCompactMode(checked === true)}>
                      Compact mode
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator variant={variant} />
                    <DropdownMenuItem variant="destructive">
                      <AlertCircle />
                      Delete item
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Accordion</CardTitle>
              <CardDescription>
                Trigger hover, left icon motion ve chevron davranisi burada gorunur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion
                defaultOpenItemIds={['secondary']}
                items={surfaceVariants.map((variant) => ({
                  id: variant,
                  title: `${variant[0].toUpperCase()}${variant.slice(1)} accordion item`,
                  badge: variant,
                  icon: <FolderOpen className="size-5" />,
                  content: (
                    <div className="space-y-3">
                      <p className="text-sm text-current/80">
                        Bu item {variant} token ailesini kullaniyor. Hoverda icon yuzeyi, chevron ve
                        trigger yuzeyi birlikte hareket ediyor.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={variant}>badge</Badge>
                        <Button size="sm" variant={variant}>
                          Action
                        </Button>
                      </div>
                    </div>
                  ),
                }))}
              />
            </CardContent>
          </Card>

          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Badge Strip</CardTitle>
              <CardDescription>
                Inline kullanim ve outline/destructive farkini hizli gormek icin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">default</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="tertiary">tertiary</Badge>
                <Badge variant="outline">outline</Badge>
                <Badge variant="destructive">destructive</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" noBorder>
                  default noBorder
                </Badge>
                <Badge variant="secondary" noBorder>
                  secondary noBorder
                </Badge>
                <Badge variant="tertiary" noBorder>
                  tertiary noBorder
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="default" leftIcon={<Sparkles />}>
                  Default button
                </Button>
                <Button variant="secondary" leftIcon={<FolderOpen />}>
                  Secondary button
                </Button>
                <Button variant="tertiary" rightIcon={<MoreHorizontal />}>
                  Tertiary button
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
