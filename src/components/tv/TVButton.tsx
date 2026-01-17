import { forwardRef, ReactNode, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useTVMode } from '@/contexts/TVModeContext';

interface TVButtonProps {
  children: ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

const tvSizeClasses = {
  sm: 'px-6 py-3 text-base',
  md: 'px-8 py-4 text-lg',
  lg: 'px-10 py-5 text-xl',
};

const variantClasses = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

export const TVButton = forwardRef<HTMLButtonElement, TVButtonProps>(
  ({ 
    children, 
    onClick, 
    onSelect,
    className, 
    variant = 'primary',
    size = 'md',
    disabled = false,
    icon
  }, ref) => {
    const { isTVMode } = useTVMode();

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.();
        onClick?.();
      }
    };

    return (
      <button
        ref={ref}
        tabIndex={disabled ? -1 : 0}
        data-focusable
        onClick={onClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-3 rounded-xl font-semibold transition-all duration-150",
          "focus:outline-none",
          
          // Size based on TV mode
          isTVMode ? tvSizeClasses[size] : sizeClasses[size],
          
          // Variant
          variantClasses[variant],
          
          // Focus styles - stronger in TV mode
          isTVMode 
            ? "focus:ring-4 focus:ring-primary/50 focus:scale-105 focus:shadow-glow"
            : "focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          
          // Disabled
          disabled && "opacity-50 cursor-not-allowed",
          
          className
        )}
      >
        {icon}
        {children}
      </button>
    );
  }
);

TVButton.displayName = 'TVButton';
