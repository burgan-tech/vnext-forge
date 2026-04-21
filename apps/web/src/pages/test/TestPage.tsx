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
  Input,
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
              Variants, hover, and border behavior for button, card, checkbox, dialog, dropdown
              menu, accordion, alert, and badge — test them on a single page.
            </p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {surfaceVariants.map((variant) => (
            <Card key={variant} variant={variant} hoverable className="gap-4">
              <CardHeader>
                <CardTitle className="capitalize">{variant} Card</CardTitle>
                <CardDescription>
                  Surface, border, and icon tone are easy to inspect from this card.
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
                      The variant family is reflected in body and icon tone here.
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
              <CardDescription>Test variant and border behavior together.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {surfaceVariants.map((variant) => (
                <div
                  key={variant}
                  className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium capitalize">{variant}</p>
                    <p className="text-muted-foreground text-xs">
                      Hover, checked, and noBorder behavior
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
              <CardDescription>Text, icon, and hover balance for each variant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="default">
                <Bell />
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>
                  Uses the primary surface and semantic icon color.
                </AlertDescription>
              </Alert>
              <Alert variant="secondary">
                <Sparkles />
                <AlertTitle>Secondary Alert</AlertTitle>
                <AlertDescription>
                  The secondary surface is softer but stays visible.
                </AlertDescription>
              </Alert>
              <Alert variant="tertiary">
                <CheckCircle2 />
                <AlertTitle>Tertiary Alert</AlertTitle>
                <AlertDescription>
                  Success-like emphasis without being destructive.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Destructive Alert</AlertTitle>
                <AlertDescription>
                  Reserved for critical actions and error surfaces.
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
                Test content surface, close button hover, and footer actions.
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
                        Dialog content and close button now use the shared semantic token structure.
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
                            You can check hoverable and border structure here.
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
                Open content, item, and checkbox-item variants from this block.
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
                Trigger hover, left-icon motion, and chevron behavior are visible here.
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
                        This item uses the {variant} token family. On hover the icon surface,
                        chevron, and trigger surface move together.
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
                Quickly compare inline usage and outline vs. destructive.
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
