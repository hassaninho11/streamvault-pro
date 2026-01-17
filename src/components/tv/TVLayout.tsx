import { ReactNode, useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  Tv, 
  Calendar, 
  Search, 
  Settings, 
  Star, 
  Clock, 
  Zap,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/app";
import { useTVMode } from "@/contexts/TVModeContext";
import { useFocusManager } from "@/hooks/useFocusManager";
import { useAuth } from "@/hooks/useAuth";

interface TVLayoutProps {
  children: ReactNode;
}

import { Film, MonitorPlay } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Hem" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Filmer" },
  { to: "/series", icon: MonitorPlay, label: "Serier" },
  { to: "/epg", icon: Calendar, label: "Guide" },
  { to: "/search", icon: Search, label: "Sök" },
  { to: "/favorites", icon: Star, label: "Favoriter" },
  { to: "/recent", icon: Clock, label: "Senaste" },
  { to: "/settings", icon: Settings, label: "Inställningar" },
];

export function TVLayout({ children }: TVLayoutProps) {
  const { isTVMode } = useTVMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { isGuest, user } = useAuth();
  const [sidebarFocused, setSidebarFocused] = useState(false);

  const { focusedId, focusElement, registerFocusable, unregisterFocusable } = useFocusManager('tv-layout', {
    group: 'sidebar',
    rememberLastFocus: true,
    onBack: () => {
      if (location.pathname !== '/') {
        navigate(-1);
      }
    }
  });

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent, to: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(to);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarFocused(false);
      // Focus first element in main content
      const mainContent = document.querySelector('[data-tv-main] [data-focusable]');
      if (mainContent instanceof HTMLElement) {
        mainContent.focus();
      }
    }
  }, [navigate]);

  if (!isTVMode) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden tv-mode">
      {/* TV Sidebar - Always visible, sticky */}
      <aside 
        className={cn(
          "w-80 bg-sidebar border-r-2 border-sidebar-border flex flex-col transition-all duration-200",
          sidebarFocused && "w-96"
        )}
        onFocus={() => setSidebarFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSidebarFocused(false);
          }
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-4 px-6 h-24 border-b border-sidebar-border">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
            <Zap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-sidebar-foreground">{APP_CONFIG.name}</h1>
            <p className="text-sm text-muted-foreground">
              {isGuest ? 'Guest Mode' : user?.email?.split('@')[0]}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-focusable
                tabIndex={0}
                ref={(el) => {
                  if (el) registerFocusable(`nav-${item.to}`, el, index, 0);
                  else unregisterFocusable(`nav-${item.to}`);
                }}
                onKeyDown={(e) => handleNavKeyDown(e, item.to)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-150",
                  "text-lg font-medium",
                  "focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                  "hover:bg-muted",
                  isActive 
                    ? "bg-primary/20 text-primary border-l-4 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-7 h-7" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-5 h-5 text-primary" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Status Bar */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
            <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {isGuest ? 'Local Mode' : 'Synced'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        data-tv-main
        className="flex-1 overflow-y-auto scrollbar-hide"
      >
        {children}
      </main>
    </div>
  );
}
