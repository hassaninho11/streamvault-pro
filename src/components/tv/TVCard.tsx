import { forwardRef, ReactNode, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useTVMode } from '@/contexts/TVModeContext';

interface TVCardProps {
  children: ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'highlight' | 'active';
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'p-4 min-h-[80px]',
  md: 'p-5 min-h-[100px]',
  lg: 'p-6 min-h-[140px]',
  xl: 'p-8 min-h-[180px]',
};

const tvSizeClasses = {
  sm: 'p-5 min-h-[100px]',
  md: 'p-6 min-h-[130px]',
  lg: 'p-8 min-h-[180px]',
  xl: 'p-10 min-h-[220px]',
};

export const TVCard = forwardRef<HTMLDivElement, TVCardProps>(
  ({ 
    children, 
    onClick, 
    onSelect,
    className, 
    size = 'md', 
    variant = 'default',
    disabled = false
  }, ref) => {
    const { isTVMode } = useTVMode();

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.();
        onClick?.();
      }
    };

    const handleClick = () => {
      if (disabled) return;
      onClick?.();
    };

    return (
      <div
        ref={ref}
        tabIndex={disabled ? -1 : 0}
        role="button"
        data-focusable
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles
          "rounded-xl bg-card border border-border cursor-pointer transition-all duration-150",
          "focus:outline-none",
          
          // Size based on TV mode
          isTVMode ? tvSizeClasses[size] : sizeClasses[size],
          
          // Variant styles
          variant === 'default' && "hover:bg-muted hover:border-muted-foreground/30",
          variant === 'highlight' && "bg-primary/10 border-primary/30 hover:bg-primary/20",
          variant === 'active' && "bg-primary/20 border-primary ring-2 ring-primary",
          
          // Focus styles - stronger in TV mode
          isTVMode 
            ? "focus:ring-4 focus:ring-primary focus:scale-[1.02] focus:shadow-glow-lg focus:border-primary"
            : "focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          
          // Disabled
          disabled && "opacity-50 cursor-not-allowed",
          
          className
        )}
      >
        {children}
      </div>
    );
  }
);

TVCard.displayName = 'TVCard';
