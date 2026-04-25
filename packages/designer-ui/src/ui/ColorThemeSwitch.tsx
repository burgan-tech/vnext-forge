import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '../lib/utils/cn.js';

export interface ColorThemeSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** `true` = açık tema (güneş), `false` = koyu tema (ay) */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Ekran okuyucu için; yoksa varsayılan kullanılır */
  'aria-label'?: string;
  offLabel?: string;
  onLabel?: string;
}

function useControllableChecked(
  checked: boolean | undefined,
  defaultChecked: boolean | undefined,
  onCheckedChange: ((checked: boolean) => void) | undefined,
): [boolean, (next: boolean) => void] {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = checked ?? uncontrolled;
  const setValue = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolled(next);
      }
      onCheckedChange?.(next);
    },
    [isControlled, onCheckedChange],
  );
  return [value, setValue];
}

const TRACK_CLASS = 'relative h-8 w-14 shrink-0 rounded-full p-1';
const THUMB_SIZE = 24;
const THUMB_PAD = 4;
/** w-14 = 56px; thumb 24px → travel 28px */
const THUMB_TRAVEL = 56 - THUMB_SIZE - THUMB_PAD * 2;

const spring = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.6 };

/** İkon kuyusu: tema token’ları + hafif derinlik (styles.css @theme ile uyumlu) */
function MoonSunIcon({
  checked,
  isHovered,
  isPressed,
  sunGradientId,
  moonGradientId,
}: {
  checked: boolean;
  isHovered: boolean;
  isPressed: boolean;
  sunGradientId: string;
  moonGradientId: string;
}) {
  return (
    <div
      className={cn(
        'relative flex size-14 items-center justify-center rounded-full border transition-transform duration-200',
        checked ? 'border-border bg-background' : 'border-transparent bg-chrome-item',
        isPressed && 'scale-[0.96]',
        !isPressed && isHovered && 'scale-[1.04]',
      )}
      style={{
        borderColor: checked
          ? 'var(--color-border)'
          : 'color-mix(in srgb, var(--color-chrome-foreground) 12%, var(--color-chrome))',
        boxShadow: checked
          ? 'inset 2px 2px 6px color-mix(in srgb, var(--color-foreground) 8%, transparent), inset -2px -2px 6px color-mix(in srgb, var(--color-background) 92%, white)'
          : 'inset 3px 3px 8px color-mix(in srgb, black 45%, transparent), inset -2px -2px 6px color-mix(in srgb, var(--color-chrome-foreground) 6%, transparent)',
      }}>
      <svg
        className="size-10 overflow-visible"
        viewBox="0 0 24 24"
        aria-hidden
        style={{
          filter: checked
            ? 'drop-shadow(0 1px 1px color-mix(in srgb, var(--color-foreground) 14%, transparent))'
            : undefined,
        }}>
        <defs>
          {/* Güneş: marka yeşil–teal (sayfadaki CTA ile aynı aile, düşük bağırmayan ton) */}
          <linearGradient id={sunGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-brand-glow)" />
            <stop offset="100%" stopColor="var(--color-brand-from)" />
          </linearGradient>
          {/* Ay: chrome / muted — koyu yüzeyde okunur hilal */}
          <linearGradient id={moonGradientId} x1="18%" y1="12%" x2="82%" y2="88%">
            <stop offset="0%" stopColor="var(--color-muted-border)" />
            <stop offset="42%" stopColor="var(--color-muted-foreground)" />
            <stop offset="100%" stopColor="var(--color-chrome-muted)" />
          </linearGradient>
        </defs>

        {/* Ay */}
        <motion.g
          initial={false}
          animate={{
            opacity: checked ? 0 : 1,
            scale: checked ? 0.65 : 1,
            rotate: checked ? -25 : 0,
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            transformOrigin: '12px 12px',
            filter: checked
              ? undefined
              : 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-info-border) 35%, transparent)) drop-shadow(0 1px 2px color-mix(in srgb, black 55%, transparent))',
          }}>
          <path
            d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
            fill={`url(#${moonGradientId})`}
            stroke="color-mix(in srgb, var(--color-chrome-foreground) 42%, transparent)"
            strokeWidth="0.5"
          />
        </motion.g>

        {/* Güneş — ışınlar + çekirdek (çekirdek üstte) */}
        <motion.g
          initial={false}
          animate={{
            opacity: checked ? 1 : 0,
            scale: checked ? 1 : 0.55,
            rotate: checked ? 0 : 20,
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '12px 12px' }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <g key={deg} transform={`translate(12,12) rotate(${deg})`}>
              <motion.rect
                x="-0.85"
                y="-10.8"
                width="1.7"
                height="4.2"
                rx="0.85"
                fill={`url(#${sunGradientId})`}
                stroke="color-mix(in srgb, var(--color-card) 45%, transparent)"
                strokeWidth="0.12"
                initial={false}
                animate={{
                  opacity: checked ? 1 : 0,
                  scaleY: checked ? 1 : 0.15,
                }}
                transition={{
                  duration: 0.35,
                  delay: checked ? i * 0.028 : 0,
                  ease: 'easeOut',
                }}
              />
            </g>
          ))}
          <circle
            cx="12"
            cy="12"
            r="4.2"
            fill={`url(#${sunGradientId})`}
            stroke="color-mix(in srgb, var(--color-card) 50%, transparent)"
            strokeWidth="0.25"
          />
        </motion.g>
      </svg>
    </div>
  );
}

function ColorThemeSwitch({
  className,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled,
  offLabel = 'Off',
  onLabel = 'On',
  'aria-label': ariaLabel = 'Açık ve koyu renk teması arasında geçiş',
  onClick,
  onKeyDown,
  style: styleProp,
  ...rest
}: ColorThemeSwitchProps) {
  const reactId = React.useId();
  const safeId = reactId.replace(/:/g, '');
  const sunGradientId = `cts-sun-${safeId}`;
  const moonGradientId = `cts-moon-${safeId}`;
  const [checked, setChecked] = useControllableChecked(checkedProp, defaultChecked, onCheckedChange);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const toggle = React.useCallback(() => {
    if (disabled) return;
    setChecked(!checked);
  }, [checked, disabled, setChecked]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented && !disabled) {
      toggle();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      data-slot="color-theme-switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-state={checked ? 'on' : 'off'}
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-border p-4 outline-none transition-colors duration-500 ease-out',
        'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'cursor-pointer',
        checked ? 'bg-muted text-foreground' : 'bg-chrome text-chrome-foreground',
        className,
      )}
      style={{
        borderColor: checked
          ? 'var(--color-border)'
          : 'color-mix(in srgb, var(--color-chrome-foreground) 14%, var(--color-chrome))',
        ...styleProp,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}>
      <MoonSunIcon
        checked={checked}
        isHovered={isHovered}
        isPressed={isPressed}
        sunGradientId={sunGradientId}
        moonGradientId={moonGradientId}
      />

      <div className="flex items-center gap-2">
        <div
          className={cn(TRACK_CLASS, 'overflow-hidden')}
          style={{
            /* On: pastel success — Create kartı / success-surface ile aynı dil, düşük doygunluk */
            background: checked
              ? 'linear-gradient(180deg, var(--color-success-surface) 0%, var(--color-success) 100%)'
              : 'var(--color-chrome)',
            boxShadow: checked
              ? 'inset 0 1px 0 color-mix(in srgb, white 55%, transparent), 0 1px 2px color-mix(in srgb, var(--color-foreground) 5%, transparent)'
              : 'inset 3px 3px 6px color-mix(in srgb, black 50%, transparent), inset -2px -2px 5px color-mix(in srgb, var(--color-chrome-foreground) 5%, transparent)',
          }}>
          <motion.span
            className="absolute top-1 left-1 z-[1] block rounded-full"
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              background: checked
                ? 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-success-hover) 100%)'
                : 'linear-gradient(180deg, var(--color-primary-muted) 0%, var(--color-muted-foreground) 100%)',
              boxShadow: checked
                ? '0 1px 3px color-mix(in srgb, var(--color-foreground) 10%, transparent), inset 0 1px 0 color-mix(in srgb, white 70%, transparent), 0 0 0 1px var(--color-success-border)'
                : '0 3px 8px color-mix(in srgb, black 45%, transparent), inset 0 1px 0 color-mix(in srgb, white 35%, transparent)',
            }}
            initial={false}
            animate={{
              x: checked ? THUMB_TRAVEL : 0,
              scale: isPressed ? 0.94 : isHovered ? 1.03 : 1,
            }}
            transition={spring}
          />
          <span className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-between px-2 text-xs font-medium tracking-wide select-none">
            <motion.span
              className={cn(
                checked ? 'text-success-foreground' : 'text-transparent',
              )}
              initial={false}
              animate={{
                opacity: checked ? 1 : 0,
                x: checked ? 0 : -4,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}>
              {onLabel}
            </motion.span>
            <motion.span
              className={cn(!checked ? 'text-chrome-muted' : 'text-transparent')}
              initial={false}
              animate={{
                opacity: checked ? 0 : 1,
                x: checked ? 4 : 0,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}>
              {offLabel}
            </motion.span>
          </span>
        </div>
      </div>
    </button>
  );
}

export { ColorThemeSwitch };
