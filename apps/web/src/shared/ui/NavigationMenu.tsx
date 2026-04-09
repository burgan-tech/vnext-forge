import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@shared/lib/utils/Cn';

const navigationMenuTriggerStyle = cva(
  'group inline-flex h-10 w-max items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium shadow-sm outline-none transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  {
    variants: {
      variant: {
        default: 'border-primary-border-hover bg-primary-surface text-primary-text',
        secondary: 'border-secondary-border-hover bg-secondary-surface text-secondary-text',
        tertiary: 'border-tertiary-border-hover bg-tertiary-surface text-tertiary-text',
      },
      hoverable: {
        true: '',
        false: '',
      },
      noBorder: {
        true: 'border-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        hoverable: true,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

const navigationMenuContentVariants = cva(
  'top-0 left-0 w-full rounded-xl border p-2 pr-2.5 shadow-sm transition-all duration-200 ease-out md:absolute md:w-auto',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
      },
      noBorder: {
        true: 'border-0',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      noBorder: false,
    },
  },
);

const navigationMenuLinkVariants = cva(
  "flex flex-col gap-1 rounded-lg border p-3 text-sm outline-none transition-all duration-200 ease-out focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-current/70",
  {
    variants: {
      variant: {
        default: 'border-primary-border-hover bg-primary-surface text-primary-text shadow-sm',
        secondary: 'border-secondary-border-hover bg-secondary-surface text-secondary-text shadow-sm',
        tertiary: 'border-tertiary-border-hover bg-tertiary-surface text-tertiary-text shadow-sm',
      },
      hoverable: {
        true: '',
        false: '',
      },
      active: {
        true: '',
        false: '',
      },
      noBorder: {
        true: 'border-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        hoverable: true,
        active: false,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        active: false,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        active: false,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
      {
        variant: 'default',
        active: true,
        className: 'border-primary-border-hover bg-primary-hover',
      },
      {
        variant: 'secondary',
        active: true,
        className: 'border-secondary-border-hover bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        active: true,
        className: 'border-tertiary-border-hover bg-tertiary-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      active: false,
      noBorder: false,
    },
  },
);

function NavigationMenu({
  className,
  children,
  viewport = true,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root> & {
  viewport?: boolean;
}) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      data-viewport={viewport}
      className={cn(
        'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        className,
      )}
      {...props}>
      {children}
      {viewport && <NavigationMenuViewport />}
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn('relative', className)}
      {...props}
    />
  );
}

function NavigationMenuTrigger({
  className,
  children,
  variant,
  hoverable = true,
  noBorder = false,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger> &
  VariantProps<typeof navigationMenuTriggerStyle>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(
        navigationMenuTriggerStyle({
          variant,
          hoverable,
          noBorder,
        }),
        hoverable && 'hover:-translate-y-px',
        variant === 'default' && 'data-[state=open]:border-primary-border-hover data-[state=open]:bg-primary-hover',
        variant === 'secondary' && 'data-[state=open]:border-secondary-border-hover data-[state=open]:bg-secondary-hover',
        variant === 'tertiary' && 'data-[state=open]:border-tertiary-border-hover data-[state=open]:bg-tertiary-hover',
        'group',
        className,
      )}
      {...props}>
      {children}{' '}
      <ChevronDownIcon
        className={cn(
          'relative top-[1px] ml-1 size-3 transition-all duration-200 ease-out group-data-[state=open]:rotate-180',
          hoverable && 'group-hover:translate-x-0.5',
        )}
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  variant,
  noBorder = false,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content> &
  Pick<VariantProps<typeof navigationMenuContentVariants>, 'variant' | 'noBorder'>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52',
        'group-data-[viewport=false]/navigation-menu:data-[state=open]:animate-in group-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-out group-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0 group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0 group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none',
        navigationMenuContentVariants({ variant, noBorder }),
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  variant,
  noBorder = false,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport> &
  Pick<VariantProps<typeof navigationMenuContentVariants>, 'variant' | 'noBorder'>) {
  return (
    <div className={cn('absolute top-full left-0 isolate z-50 flex justify-center')}>
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          'origin-top-center data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden md:w-[var(--radix-navigation-menu-viewport-width)]',
          navigationMenuContentVariants({ variant, noBorder }),
          className,
        )}
        {...props}
      />
    </div>
  );
}

function NavigationMenuLink({
  className,
  variant,
  hoverable = true,
  noBorder = false,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link> &
  Pick<VariantProps<typeof navigationMenuLinkVariants>, 'variant' | 'hoverable' | 'noBorder'>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        navigationMenuLinkVariants({
          variant,
          hoverable,
          noBorder,
          active: props.active,
        }),
        hoverable && 'hover:-translate-y-px',
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
        className,
      )}
      {...props}>
      <div className="bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm shadow-md" />
    </NavigationMenuPrimitive.Indicator>
  );
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
