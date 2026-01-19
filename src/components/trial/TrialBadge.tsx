/**
 * TrialBadge - Shows trial status prominently in the UI
 * Displays remaining days in a visually appealing way
 */

import { Zap, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";

interface TrialBadgeProps {
  variant?: "compact" | "full";
  className?: string;
}

export function TrialBadge({ variant = "compact", className }: TrialBadgeProps) {
  const navigate = useNavigate();
  const { isPremium, isTrial, isTrialExpired, trialDaysRemaining, loading } = useEntitlements();
  
  // Don't show for premium users or while loading
  if (loading || isPremium) {
    return null;
  }
  
  // Trial expired - show warning badge
  if (isTrialExpired) {
    return (
      <button
        onClick={() => navigate("/settings")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-destructive/20 border border-destructive/50",
          "text-destructive font-medium text-sm",
          "hover:bg-destructive/30 transition-colors",
          "animate-pulse",
          className
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        <span>Trial utgången</span>
      </button>
    );
  }
  
  // Active trial - show remaining days
  if (isTrial && trialDaysRemaining !== undefined) {
    const isLow = trialDaysRemaining <= 2;
    
    if (variant === "compact") {
      return (
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
            "text-xs font-medium transition-all",
            isLow 
              ? "bg-warning/20 border border-warning/50 text-warning hover:bg-warning/30"
              : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20",
            className
          )}
        >
          <Zap className="w-3 h-3" />
          <span>{trialDaysRemaining}d kvar</span>
        </button>
      );
    }
    
    // Full variant
    return (
      <button
        onClick={() => navigate("/settings")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl",
          "text-sm font-medium transition-all",
          isLow 
            ? "bg-gradient-to-r from-warning/20 to-warning/10 border border-warning/40 text-warning"
            : "bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/30 text-primary",
          "hover:scale-[1.02] hover:shadow-md",
          className
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isLow ? "bg-warning/20" : "bg-primary/20"
        )}>
          <Zap className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="font-semibold">{trialDaysRemaining} dagar kvar</p>
          <p className="text-xs opacity-70">av din provperiod</p>
        </div>
      </button>
    );
  }
  
  return null;
}

export default TrialBadge;
