import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelLogoProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
  xl: "w-20 h-20 text-lg",
};

export function ChannelLogo({ src, name, size = "md", className }: ChannelLogoProps) {
  const initials = name
    .split(/[\s-]+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <div
        className={cn(
          "rounded-lg overflow-hidden bg-muted flex items-center justify-center",
          sizeClasses[size],
          className
        )}
      >
        <img
          src={src}
          alt={name}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement!.innerHTML = `<span class="font-semibold text-muted-foreground">${initials}</span>`;
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center font-semibold text-muted-foreground",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

interface LiveIndicatorProps {
  className?: string;
}

export function LiveIndicator({ className }: LiveIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
      </span>
      <span className="text-xs font-medium text-destructive uppercase tracking-wide">Live</span>
    </div>
  );
}

interface IconBadgeProps {
  icon: LucideIcon;
  label?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
}

const badgeVariants = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function IconBadge({ icon: Icon, label, variant = "default", className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        badgeVariants[variant],
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label && <span>{label}</span>}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const spinnerSizes = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-3",
};

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full border-muted border-t-primary animate-spin",
        spinnerSizes[size],
        className
      )}
    />
  );
}

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({ progress, size = 40, strokeWidth = 4, className }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn("transform -rotate-90", className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-300"
      />
    </svg>
  );
}
