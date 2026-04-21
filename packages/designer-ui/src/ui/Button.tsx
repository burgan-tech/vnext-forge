import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';
import Loading, { type LoadingColor } from './Loading';

/** Sol/sağ ikon slot’unun görsel modu. */
export type ButtonIconSlotType = 'default' | 'accent' | 'splitaccent' | 'solid';

/** Dış kontur: `default` hafif yuvarlatılmış kare; `rounded` hap / tam yuvarlak hat. */
export type ButtonShape = 'default' | 'rounded';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'border border-primary-border bg-primary text-primary-foreground shadow-xs',
        success: 'border border-success-border bg-success text-success-foreground shadow-xs',
        info: 'border border-info-border bg-info text-info-foreground shadow-xs',
        warning: 'border border-warning-border bg-warning text-warning-foreground shadow-xs',
        destructive:
          'border border-destructive-border bg-destructive text-white shadow-xs focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline: 'border border-border bg-background shadow-xs',
        secondary:
          'border border-secondary-border bg-secondary text-secondary-foreground shadow-xs',
        tertiary: 'border border-tertiary-border bg-tertiary text-tertiary-foreground shadow-xs',
        muted: 'border border-muted-border bg-muted text-muted-foreground shadow-xs',
        ghost: 'border border-transparent',
        link: 'text-primary underline-offset-4',
      },
      size: {
        default: 'min-h-9',
        sm: 'min-h-8',
        lg: 'min-h-10',
        icon: 'size-9',
      },
      shape: {
        default: 'rounded-sm',
        rounded: 'rounded-full',
      },
      hoverable: {
        true: '',
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
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'hover:border-info-border-hover hover:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'hover:border-warning-border-hover hover:bg-warning-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'hover:border-destructive-border-hover hover:bg-destructive-hover',
      },
      {
        variant: 'outline',
        hoverable: true,
        className: 'hover:border-primary-border-hover hover:bg-outline-hover',
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
      {
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        variant: 'ghost',
        hoverable: true,
        className: 'hover:bg-ghost-hover',
      },
      {
        variant: 'link',
        hoverable: true,
        className: 'hover:text-link-hover hover:underline',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
      hoverable: true,
    },
  },
);

const buttonContentVariants = cva('', {
  variants: {
    size: {
      default: 'px-4 py-2',
      sm: 'gap-1.5 px-3 py-1.5',
      lg: 'px-6 py-2.5',
      icon: 'size-full',
    },
    layout: {
      default: 'inline-flex items-center justify-center gap-2',
      special:
        'flex w-full min-w-0 flex-row items-stretch gap-0 overflow-hidden rounded-[inherit] p-0',
    },
  },
  defaultVariants: {
    size: 'default',
    layout: 'default',
  },
});

/** Metin hücresi — split/accent düzeninde orta kolon */
const buttonLabelCellVariants = cva('flex min-w-0 flex-1 items-center', {
  variants: {
    size: {
      default: 'px-4 py-2',
      sm: 'px-3 py-1.5',
      lg: 'px-6 py-2.5',
      icon: 'size-full',
    },
    align: {
      center: 'justify-center',
      start: 'justify-start text-left',
    },
  },
  defaultVariants: {
    size: 'default',
    align: 'center',
  },
});

const buttonIconWrapperBaseClassName =
  'flex shrink-0 items-center justify-center transition-all duration-200 ease-out [&_svg]:shrink-0';

const buttonIconMotionVariants = cva('', {
  variants: {
    side: {
      left: '',
      right: '',
    },
    hoverable: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      side: 'left',
      hoverable: true,
      className: 'group-hover/button:-translate-y-px group-hover/button:shadow-sm',
    },
    {
      side: 'right',
      hoverable: true,
      className: 'group-hover/button:translate-x-0.5',
    },
  ],
  defaultVariants: {
    side: 'left',
    hoverable: true,
  },
});

const buttonIconVariants = cva(buttonIconWrapperBaseClassName, {
  variants: {
    buttonShape: {
      default: 'rounded-sm',
      rounded: 'rounded-full',
    },
    buttonSize: {
      sm: 'h-7 w-7 [&_svg:not([class*=\'size-\'])]:size-3.5',
      default: 'h-8 w-8 [&_svg:not([class*=\'size-\'])]:size-4',
      lg: 'h-9 w-9 [&_svg:not([class*=\'size-\'])]:size-[1.125rem]',
      icon: 'size-full min-h-0 min-w-0 [&_svg:not([class*=\'size-\'])]:size-4',
    },
    variant: {
      default: 'bg-primary-muted-hover text-primary-icon',
      success: 'bg-success text-primary-icon',
      info: 'bg-info text-primary-icon',
      warning: 'bg-warning text-primary-icon',
      destructive: 'bg-destructive/15 text-primary-icon',
      outline: 'bg-muted text-primary-icon',
      secondary: 'bg-secondary text-primary-icon',
      tertiary: 'bg-tertiary-muted-hover text-primary-icon',
      muted: 'bg-muted text-primary-icon',
      ghost: 'bg-muted text-primary-icon',
      link: 'bg-transparent text-primary-icon',
    },
    hoverable: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      hoverable: true,
      className: 'group-hover/button:bg-primary-border-hover',
    },
    {
      variant: 'success',
      hoverable: true,
      className: 'group-hover/button:bg-success-hover',
    },
    {
      variant: 'info',
      hoverable: true,
      className: 'group-hover/button:bg-info-hover',
    },
    {
      variant: 'warning',
      hoverable: true,
      className: 'group-hover/button:bg-warning-hover',
    },
    {
      variant: 'destructive',
      hoverable: true,
      className: 'group-hover/button:bg-destructive/25',
    },
    {
      variant: 'outline',
      hoverable: true,
      className: 'group-hover/button:bg-muted-hover',
    },
    {
      variant: 'secondary',
      hoverable: true,
      className: 'group-hover/button:bg-secondary-hover',
    },
    {
      variant: 'tertiary',
      hoverable: true,
      className: 'group-hover/button:bg-tertiary-hover',
    },
    {
      variant: 'muted',
      hoverable: true,
      className: 'group-hover/button:bg-muted-hover',
    },
    {
      variant: 'ghost',
      hoverable: true,
      className: 'group-hover/button:bg-muted-hover',
    },
  ],
  defaultVariants: {
    buttonShape: 'default',
    buttonSize: 'default',
    variant: 'default',
    hoverable: true,
  },
});

/** En soldaki / en sağdaki dikey accent çubuğu */
const accentBarVariants = cva('shrink-0 self-stretch', {
  variants: {
    variant: {
      default: 'bg-primary-icon',
      success: 'bg-success-icon',
      info: 'bg-info-icon',
      warning: 'bg-warning-icon',
      destructive: 'bg-destructive',
      outline: 'bg-primary-icon',
      secondary: 'bg-secondary-icon',
      tertiary: 'bg-tertiary-icon',
      muted: 'bg-muted-icon',
      ghost: 'bg-muted-foreground',
      link: 'bg-primary-icon',
    },
    buttonSize: {
      sm: 'w-1',
      default: 'w-1.5',
      lg: 'w-2',
      icon: 'w-1.5',
    },
    buttonShape: {
      default: '',
      rounded: '',
    },
    side: {
      left: '',
      right: '',
    },
  },
  compoundVariants: [
    { side: 'left', buttonShape: 'default', className: 'rounded-l-sm' },
    { side: 'left', buttonShape: 'rounded', className: 'rounded-l-full' },
    { side: 'right', buttonShape: 'default', className: 'rounded-r-sm' },
    { side: 'right', buttonShape: 'rounded', className: 'rounded-r-full' },
  ],
  defaultVariants: {
    variant: 'default',
    buttonSize: 'default',
    buttonShape: 'default',
    side: 'left',
  },
});

/** Accent çubuğunun yanındaki ikon — arka plan yok, sadece semantik ikon rengi */
const accentIconBesideBarVariants = cva(
  'flex min-h-0 shrink-0 items-center justify-center self-stretch',
  {
    variants: {
      variant: {
        default: 'text-primary-icon',
        success: 'text-primary-icon',
        info: 'text-primary-icon',
        warning: 'text-primary-icon',
        destructive: 'text-primary-icon',
        outline: 'text-primary-icon',
        secondary: 'text-primary-icon',
        tertiary: 'text-primary-icon',
        muted: 'text-primary-icon',
        ghost: 'text-primary-icon',
        link: 'text-primary-icon',
      },
    buttonSize: {
      sm: 'px-1.5 [&_svg:not([class*=\'size-\'])]:size-3.5',
      default: 'px-2 [&_svg:not([class*=\'size-\'])]:size-4',
      lg: 'px-2.5 [&_svg:not([class*=\'size-\'])]:size-[1.125rem]',
      icon: 'px-2 [&_svg:not([class*=\'size-\'])]:size-4',
    },
  },
  defaultVariants: {
    variant: 'default',
    buttonSize: 'default',
  },
  },
);

/** Split: ikon kolonu — yüzey + ayırıcı çizgi */
const splitAccentCellVariants = cva(
  'flex shrink-0 items-center justify-center self-stretch border-border [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary-muted-hover text-primary-icon',
        success: 'bg-success-foreground text-primary-icon',
        info: 'bg-info text-primary-icon',
        warning: 'bg-warning text-primary-icon',
        destructive: 'bg-destructive-hover text-destructive-foreground',
        outline: 'bg-muted text-primary-icon',
        secondary: 'bg-secondary text-primary-icon',
        tertiary: 'bg-tertiary-muted-hover text-primary-icon',
        muted: 'bg-muted text-primary-icon',
        ghost: 'bg-muted text-primary-icon',
        link: 'bg-muted text-primary-icon',
      },
      buttonSize: {
        sm: 'w-8 min-w-8 [&_svg:not([class*=\'size-\'])]:size-3.5',
        default: 'w-9 min-w-9 [&_svg:not([class*=\'size-\'])]:size-4',
        lg: 'w-10 min-w-10 [&_svg:not([class*=\'size-\'])]:size-[1.125rem]',
        icon: 'size-full min-h-0 min-w-0 [&_svg:not([class*=\'size-\'])]:size-4',
      },
      buttonShape: {
        default: '',
        rounded: '',
      },
      side: {
        left: 'border-r',
        right: 'border-l',
      },
      hoverable: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { side: 'left', buttonShape: 'default', className: 'rounded-l-sm' },
      { side: 'left', buttonShape: 'rounded', className: 'rounded-l-full' },
      { side: 'right', buttonShape: 'default', className: 'rounded-r-sm' },
      { side: 'right', buttonShape: 'rounded', className: 'rounded-r-full' },
      {
        variant: 'default',
        hoverable: true,
        className: 'group-hover/button:bg-primary-border-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'group-hover/button:bg-success-hover group-hover/button:text-primary-icon',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'group-hover/button:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'group-hover/button:bg-warning-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'group-hover/button:bg-destructive-muted-hover',
      },
      {
        variant: 'outline',
        hoverable: true,
        className: 'group-hover/button:bg-muted-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'group-hover/button:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'group-hover/button:bg-tertiary-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'group-hover/button:bg-muted-hover',
      },
      {
        variant: 'ghost',
        hoverable: true,
        className: 'group-hover/button:bg-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      buttonSize: 'default',
      buttonShape: 'default',
      side: 'left',
      hoverable: true,
    },
  },
);

/** Solid (ör. trash): ikon beyaz / açık, arka plan semantik dolgu, hover’da koyulaşma */
const solidIconSlotVariants = cva(
  'flex shrink-0 items-center justify-center transition-all duration-200 ease-out [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary-icon text-white group-hover/button:bg-slate-800 dark:group-hover/button:bg-slate-700',
        success: 'bg-success-icon text-white group-hover/button:bg-success-foreground',
        info: 'bg-info-icon text-white group-hover/button:bg-info-foreground',
        warning: 'bg-warning-icon text-white group-hover/button:bg-warning-foreground',
        destructive: 'bg-destructive-hover text-destructive-foreground',
        outline:
          'bg-primary-icon text-white group-hover/button:bg-slate-800 dark:group-hover/button:bg-slate-700',
        secondary:
          'bg-secondary-icon text-white group-hover/button:bg-secondary-foreground dark:group-hover/button:bg-slate-600',
        tertiary:
          'bg-tertiary-icon text-white group-hover/button:bg-tertiary-foreground dark:group-hover/button:bg-slate-600',
        muted: 'bg-muted-icon text-white group-hover/button:bg-muted-foreground',
        ghost: 'bg-foreground text-background group-hover/button:bg-foreground/90',
        link: 'bg-primary-icon text-white group-hover/button:bg-slate-800',
      },
      buttonSize: {
        sm: 'h-7 w-7 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:max-h-3 [&_svg]:max-w-3',
        default: 'h-8 w-8 [&_svg:not([class*=\'size-\'])]:size-4',
        lg: 'h-9 w-9 [&_svg:not([class*=\'size-\'])]:size-[1.125rem]',
        icon: 'size-full min-h-0 min-w-0 [&_svg:not([class*=\'size-\'])]:size-4',
      },
      side: {
        left: '',
        right: '',
        solo: '',
      },
      buttonShape: {
        default: '',
        rounded: '',
      },
      hoverable: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'destructive',
        hoverable: true,
        className: 'group-hover/button:bg-destructive',
      },
      {
        side: 'left',
        buttonShape: 'default',
        className: 'rounded-l-sm rounded-r-none',
      },
      {
        side: 'left',
        buttonShape: 'rounded',
        className: 'rounded-l-full rounded-r-none',
      },
      {
        side: 'right',
        buttonShape: 'default',
        className: 'rounded-r-sm rounded-l-none',
      },
      {
        side: 'right',
        buttonShape: 'rounded',
        className: 'rounded-r-full rounded-l-none',
      },
      {
        side: 'solo',
        buttonShape: 'default',
        className: 'rounded-sm',
      },
      {
        side: 'solo',
        buttonShape: 'rounded',
        className: 'rounded-full',
      },
    ],
    defaultVariants: {
      variant: 'default',
      buttonSize: 'default',
      side: 'solo',
      buttonShape: 'default',
      hoverable: true,
    },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

function renderIconSlot(
  icon: React.ReactNode,
  type: ButtonIconSlotType,
  iconVariant: ButtonVariant,
  side: 'left' | 'right',
  hoverable: boolean,
  buttonSize: ButtonSize,
  buttonShape: ButtonShape,
  solidSide: 'left' | 'right' | 'solo',
): React.ReactNode {
  if (type === 'default') {
    return (
      <span
        className={cn(
          buttonIconVariants({
            variant: iconVariant,
            hoverable,
            buttonSize,
            buttonShape,
          }),
          buttonIconMotionVariants({ side, hoverable }),
        )}>
        {icon}
      </span>
    );
  }

  if (type === 'accent') {
    const bar = (
      <span
        aria-hidden
        className={accentBarVariants({
          variant: iconVariant,
          buttonSize,
          side,
          buttonShape,
        })}
      />
    );
    const beside = (
      <span className={accentIconBesideBarVariants({ variant: iconVariant, buttonSize })}>{icon}</span>
    );
    if (side === 'left') {
      return (
        <>
          {bar}
          {beside}
        </>
      );
    }
    return (
      <>
        {beside}
        {bar}
      </>
    );
  }

  if (type === 'splitaccent') {
    return (
      <span
        className={cn(
          splitAccentCellVariants({
            variant: iconVariant,
            buttonSize,
            side,
            hoverable,
            buttonShape,
          }),
          buttonIconMotionVariants({ side, hoverable }),
        )}>
        {icon}
      </span>
    );
  }

  /* solid */
  return (
    <span
      className={cn(
        solidIconSlotVariants({
          variant: iconVariant,
          buttonSize,
          hoverable,
          side: solidSide,
          buttonShape,
        }),
        buttonIconMotionVariants({ side, hoverable }),
      )}>
      {icon}
    </span>
  );
}

function Button({
  className,
  variant,
  size,
  shape = 'default',
  asChild = false,
  loading = false,
  hoverable = true,
  noBorder = false,
  noIconHover = false,
  leftIcon,
  rightIcon,
  leftIconComponent,
  rightIconComponent,
  leftIconVariant,
  rightIconVariant,
  leftIconType = 'default',
  rightIconType = 'default',
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    noBorder?: boolean;
    noIconHover?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    leftIconComponent?: React.ReactNode;
    rightIconComponent?: React.ReactNode;
    leftIconVariant?: VariantProps<typeof buttonVariants>['variant'];
    rightIconVariant?: VariantProps<typeof buttonVariants>['variant'];
    leftIconType?: ButtonIconSlotType;
    rightIconType?: ButtonIconSlotType;
  }) {
  const Comp = asChild ? Slot : 'button';
  const loadingColor: LoadingColor =
    variant === 'destructive'
      ? 'white'
      : variant === 'success'
        ? 'success'
        : variant === 'info'
          ? 'info'
          : variant === 'warning'
            ? 'warning'
            : 'primary';
  const resolvedVariant = variant ?? 'default';
  const resolvedSize = size ?? 'default';
  const resolvedShape = shape ?? 'default';
  const iconHoverable = Boolean(hoverable) && !noIconHover;

  const leftResolvedType: ButtonIconSlotType = leftIconType;
  const rightResolvedType: ButtonIconSlotType = rightIconType;

  const leftIconSemantic = leftIconVariant ?? resolvedVariant;
  const rightIconSemantic = rightIconVariant ?? resolvedVariant;

  const loadingSpinner = (
    <Loading
      config={{
        variant: 'dots',
        size: 'sm',
        showText: false,
        color: loadingColor,
      }}
      className="flex-row"
    />
  );

  const leftVisualNode: React.ReactNode = loading
    ? loadingSpinner
    : leftIconComponent
      ? leftIconComponent
      : leftIcon;

  const hasLeftVisual = Boolean(leftVisualNode) && !leftIconComponent;
  const hasRightVisual = Boolean(rightIcon) && !rightIconComponent;

  const useSpecialLayout =
    !leftIconComponent &&
    !rightIconComponent &&
    (leftResolvedType !== 'default' || rightResolvedType !== 'default') &&
    (hasLeftVisual || hasRightVisual || loading);

  const solidLeftSide: 'left' | 'right' | 'solo' = useSpecialLayout ? 'left' : 'solo';
  const solidRightSide: 'left' | 'right' | 'solo' = useSpecialLayout ? 'right' : 'solo';

  const leadingVisual =
    leftIconComponent ? (
      leftIconComponent
    ) : loading || leftIcon ? (
      renderIconSlot(
        loading ? loadingSpinner : leftIcon!,
        leftResolvedType,
        leftIconSemantic,
        'left',
        iconHoverable,
        resolvedSize,
        resolvedShape,
        leftResolvedType === 'solid' ? solidLeftSide : 'solo',
      )
    ) : null;

  const trailingVisual = rightIconComponent
    ? rightIconComponent
    : rightIcon
      ? renderIconSlot(
          rightIcon,
          rightResolvedType,
          rightIconSemantic,
          'right',
          iconHoverable,
          resolvedSize,
          resolvedShape,
          rightResolvedType === 'solid' ? solidRightSide : 'solo',
        )
      : null;

  const content = useSpecialLayout ? (
    <span className={cn(buttonContentVariants({ layout: 'special' }))}>
      {leadingVisual}
      <span
        className={cn(buttonLabelCellVariants({ size: resolvedSize, align: 'center' }))}>
        {children}
      </span>
      {trailingVisual}
    </span>
  ) : (
    <span className={cn(buttonContentVariants({ size: resolvedSize, layout: 'default' }))}>
      {leadingVisual}
      {children}
      {trailingVisual}
    </span>
  );

  const rootClassName = cn(
    buttonVariants({ variant, size, hoverable, shape: resolvedShape }),
    useSpecialLayout && 'overflow-hidden p-0',
    noBorder && 'border-0',
    className,
  );

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-loading={loading ? 'true' : 'false'}
        aria-busy={loading}
        className={rootClassName}
        {...props}>
        {content}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? 'true' : 'false'}
      aria-busy={loading}
      className={rootClassName}
      disabled={disabled || loading}
      {...props}>
      {content}
    </Comp>
  );
}

export { Button, buttonVariants };
