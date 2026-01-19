import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  Home, 
  Tv, 
  Film,
  MonitorPlay,
  Calendar, 
  Search, 
  Settings, 
  Star, 
  Clock, 
  Plus,
  Menu,
  X,
  Zap,
  LogOut,
  Users,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app";
import { useAuth } from "@/hooks/useAuth";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";
import { useProfile } from "@/contexts/ProfileContext";
import { CategoryFilter } from "./CategoryFilter";

interface AppLayoutProps {
  children: ReactNode;
}

// Navigation items - Sök is global (top bar only), not in nav
const navItems = [
  { to: "/", icon: Home, label: "Hem" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Filmer" },
  { to: "/series", icon: MonitorPlay, label: "Serier" },
  { to: "/epg", icon: Calendar, label: "Guide" },
  { to: "/favorites", icon: Star, label: "Favoriter" },
  { to: "/recent", icon: Clock, label: "Senaste" },
];

const bottomNavItems = [
  { to: "/providers", icon: Plus, label: "Leverantörer" },
  { to: "/health", icon: Activity, label: "Health" },
  { to: "/settings", icon: Settings, label: "Inställningar" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentProfile, isChildProfile } = useProfile();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">{APP_CONFIG.name}</span>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <NavLink to="/search">
              <Search className="w-5 h-5" />
            </NavLink>
          </Button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-50 lg:z-0 h-full w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-sidebar-foreground">{APP_CONFIG.name}</h1>
                <p className="text-xs text-muted-foreground">IPTV Player</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "nav-item",
                    isActive && "active"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Category Filter */}
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <CategoryFilter />
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "nav-item",
                    isActive && "active"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Profile Switcher */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Profil</span>
                {isChildProfile && (
                  <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded-full">Barn</span>
                )}
              </div>
              <ProfileSwitcher />
            </div>

            {/* User & Logout */}
            {user && (
              <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="w-4 h-4" />
                  Logga ut
                </Button>
              </div>
            )}

            {/* Trial Banner */}
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Free Trial</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {APP_CONFIG.subscription.trialDays} days remaining
              </p>
              <Button size="sm" variant="premium" className="w-full">
                Upgrade • {APP_CONFIG.subscription.pricePerYear} {APP_CONFIG.subscription.currency}/year
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
