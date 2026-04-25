import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '../lib/utils/cn.js';

export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'bounce' | 'wave' | 'custom';
export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';
export type LoadingColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  | 'info'
  | 'warning'
  | 'destructive'
  | 'white'
  | 'muted';

export interface LoadingConfig {
  variant?: LoadingVariant;
  size?: LoadingSize;
  color?: LoadingColor;
  text?: string;
  showText?: boolean;
  customIcon?: ComponentType<{ size?: number; className?: string }>;
  fullScreen?: boolean;
  overlay?: boolean;
}

interface LoadingProps {
  config?: LoadingConfig;
  className?: string;
}

const sizeConfig: Record<LoadingSize, { icon: number; text: string; container: string }> = {
  sm: { icon: 16, text: 'text-sm', container: 'gap-2' },
  md: { icon: 24, text: 'text-base', container: 'gap-3' },
  lg: { icon: 32, text: 'text-lg', container: 'gap-4' },
  xl: { icon: 48, text: 'text-xl', container: 'gap-6' },
};

const animatedSizeConfig: Record<
  LoadingSize,
  { dot: string; pulse: string; bounce: string; waveWidth: string; waveHeight: string }
> = {
  sm: {
    dot: 'h-1.5 w-1.5',
    pulse: 'h-4 w-4',
    bounce: 'h-2 w-2',
    waveWidth: 'w-0.5',
    waveHeight: 'h-4',
  },
  md: {
    dot: 'h-2 w-2',
    pulse: 'h-5 w-5',
    bounce: 'h-2.5 w-2.5',
    waveWidth: 'w-0.5',
    waveHeight: 'h-5',
  },
  lg: {
    dot: 'h-2.5 w-2.5',
    pulse: 'h-6 w-6',
    bounce: 'h-3 w-3',
    waveWidth: 'w-1',
    waveHeight: 'h-6',
  },
  xl: {
    dot: 'h-3 w-3',
    pulse: 'h-8 w-8',
    bounce: 'h-3.5 w-3.5',
    waveWidth: 'w-1',
    waveHeight: 'h-8',
  },
};

const colorConfig: Record<LoadingColor, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  success: 'text-success-icon',
  info: 'text-info-icon',
  warning: 'text-warning-icon',
  destructive: 'text-destructive',
  white: 'text-white',
  muted: 'text-muted-foreground',
};

const defaultConfig: Required<Omit<LoadingConfig, 'customIcon'>> = {
  variant: 'spinner',
  size: 'md',
  color: 'primary',
  text: 'Loading...',
  showText: true,
  fullScreen: false,
  overlay: false,
};

const Loading = ({ config, className = '' }: LoadingProps) => {
  const mergedConfig: LoadingConfig = {
    ...defaultConfig,
    ...config,
  };

  const currentSize = sizeConfig[mergedConfig.size ?? defaultConfig.size];
  const currentAnimatedSize = animatedSizeConfig[mergedConfig.size ?? defaultConfig.size];
  const currentColor = colorConfig[mergedConfig.color ?? defaultConfig.color];

  const renderSpinner = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={currentColor}>
      {mergedConfig.customIcon ? (
        <mergedConfig.customIcon size={currentSize.icon} />
      ) : (
        <Loader2 size={currentSize.icon} />
      )}
    </motion.div>
  );

  const renderDots = () => (
    <div className="flex items-center space-x-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`${currentAnimatedSize.dot} rounded-full ${currentColor.replace('text-', 'bg-')}`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: index * 0.2 }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <motion.div
      className={`${currentAnimatedSize.pulse} rounded-full ${currentColor.replace('text-', 'bg-')}`}
      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );

  const renderBounce = () => (
    <div className="flex items-center space-x-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`${currentAnimatedSize.bounce} rounded-full ${currentColor.replace('text-', 'bg-')}`}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: index * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );

  const renderWave = () => (
    <div className="flex items-center space-x-1">
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.div
          key={index}
          className={`${currentAnimatedSize.waveHeight} ${currentAnimatedSize.waveWidth} rounded-full ${currentColor.replace('text-', 'bg-')}`}
          animate={{ scaleY: [1, 2, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );

  const renderCustom = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      className={currentColor}>
      {mergedConfig.customIcon ? (
        <mergedConfig.customIcon size={currentSize.icon} />
      ) : (
        <Zap size={currentSize.icon} />
      )}
    </motion.div>
  );

  const renderLoadingAnimation = () => {
    switch (mergedConfig.variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'bounce':
        return renderBounce();
      case 'wave':
        return renderWave();
      case 'custom':
        return renderCustom();
      default:
        return renderSpinner();
    }
  };

  const loadingContent = (
    <div
      className={cn('flex flex-col items-center justify-center', currentSize.container, className)}>
      {renderLoadingAnimation()}
      {mergedConfig.showText && mergedConfig.text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`${currentSize.text} ${currentColor} font-medium`}>
          {mergedConfig.text}
        </motion.p>
      )}
    </div>
  );

  if (mergedConfig.fullScreen) {
    return (
      <div className="bg-primary/65 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
        {loadingContent}
      </div>
    );
  }

  if (mergedConfig.overlay) {
    return (
      <div className="bg-primary/45 absolute inset-0 z-40 flex items-center justify-center rounded-[inherit] backdrop-blur-sm">
        {loadingContent}
      </div>
    );
  }

  return loadingContent;
};

export const LoadingFullScreen = (props: Omit<LoadingProps, 'config'>) => (
  <Loading {...props} config={{ fullScreen: true, size: 'lg' }} />
);

export default Loading;
