import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import type { ApplicationError } from '@shared/lib/errors/appError';
import { cn } from '@shared/lib/utils/cn';

type StateMessageVariant = 'loading' | 'error' | 'empty';
type StateMessageTone = 'default' | 'muted';

interface StateMessageProps {
  variant: StateMessageVariant;
  message: string;
  error?: ApplicationError | null;
  tone?: StateMessageTone;
  className?: string;
}

const iconMap = {
  loading: LoaderCircle,
  error: AlertTriangle,
  empty: Inbox,
} satisfies Record<StateMessageVariant, typeof LoaderCircle>;

const toneClassMap: Record<StateMessageTone, string> = {
  default: 'border-appBorderColor-300 bg-appCardBackground',
  muted: 'border-appBorderColor-200 bg-appHover-50',
};

const textClassMap: Record<StateMessageVariant, string> = {
  loading: 'text-appText',
  error: 'text-appError',
  empty: 'text-appText',
};

const iconClassMap: Record<StateMessageVariant, string> = {
  loading: 'text-appButton-600 animate-spin',
  error: 'text-appError',
  empty: 'text-appText',
};

const StateMessage = ({ variant, message, error, tone = 'default', className }: StateMessageProps) => {
  const Icon = iconMap[variant];
  const resolvedMessage = variant === 'error' ? error?.message ?? message : message;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm',
        toneClassMap[tone],
        textClassMap[variant],
        className,
      )}>
      <Icon className={cn('h-4 w-4 shrink-0', iconClassMap[variant])} />
      <p>{resolvedMessage}</p>
    </div>
  );
};

export default StateMessage;
