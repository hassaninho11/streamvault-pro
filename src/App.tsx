import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TVModeProvider } from "@/contexts/TVModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { MultiScreenProvider } from "@/contexts/MultiScreenContext";
import { PlaylistLoadingOverlay } from "@/components/loading/PlaylistLoadingOverlay";
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
import NotFound from "./pages/NotFound";

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
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PlaylistLoadingOverlay />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </TVModeProvider>
        </MultiScreenProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
