import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TVModeProvider } from "@/contexts/TVModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { MultiScreenProvider } from "@/contexts/MultiScreenContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlaylistLoadingOverlay } from "@/components/loading/PlaylistLoadingOverlay";
import { useSettingsStore } from "@/data/stores/settingsStore";
import Home from "./pages/Home";
import LiveTV from "./pages/LiveTV";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import SeriesDetail from "./pages/SeriesDetail";
import Epg from "./pages/Epg";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import Recent from "./pages/Recent";
import Providers from "./pages/Providers";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import SyncBackup from "./pages/SyncBackup";
import ProfileSelect from "./pages/ProfileSelect";
import Health from "./pages/Health";
import PlaybackTestLab from "./pages/PlaybackTestLab";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

// Admin pages
import { AdminGuard } from "@/components/admin/AdminGuard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPremium from "./pages/admin/AdminPremium";
import AdminBugs from "./pages/admin/AdminBugs";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSettings from "./pages/admin/AdminSettings";

// Initialize settings on app load
function SettingsInitializer() {
  const { load, initialized } = useSettingsStore();
  
  useEffect(() => {
    if (!initialized) {
      load();
    }
  }, [load, initialized]);
  
  return null;
}

const queryClient = new QueryClient();

// No more ProtectedRoute - all routes accessible in guest mode
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/profiles" element={<ProfileSelect />} />
      <Route path="/" element={<Home />} />
      <Route path="/live" element={<LiveTV />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/series/:id" element={<SeriesDetail />} />
      <Route path="/epg" element={<Epg />} />
      <Route path="/search" element={<Search />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/recent" element={<Recent />} />
      <Route path="/providers" element={<Providers />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/sync" element={<SyncBackup />} />
      <Route path="/health" element={<Health />} />
      <Route path="/testlab" element={<PlaybackTestLab />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      
      {/* Admin routes - protected by AdminGuard */}
      <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
      <Route path="/admin/premium" element={<AdminGuard><AdminPremium /></AdminGuard>} />
      <Route path="/admin/bugs" element={<AdminGuard><AdminBugs /></AdminGuard>} />
      <Route path="/admin/audit" element={<AdminGuard><AdminAudit /></AdminGuard>} />
      <Route path="/admin/settings" element={<AdminGuard requireOwner><AdminSettings /></AdminGuard>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ProfileProvider>
        <MultiScreenProvider>
          <TVModeProvider>
            <LanguageProvider>
              <TooltipProvider>
                <SettingsInitializer />
                <Toaster />
                <Sonner />
                <PlaylistLoadingOverlay />
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </TooltipProvider>
            </LanguageProvider>
          </TVModeProvider>
        </MultiScreenProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
