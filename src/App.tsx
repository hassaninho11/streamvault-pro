import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TVModeProvider } from "@/contexts/TVModeContext";
import Home from "./pages/Home";
import LiveTV from "./pages/LiveTV";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import Epg from "./pages/Epg";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import Recent from "./pages/Recent";
import Providers from "./pages/Providers";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import SyncBackup from "./pages/SyncBackup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// No more ProtectedRoute - all routes accessible in guest mode
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Home />} />
      <Route path="/live" element={<LiveTV />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/epg" element={<Epg />} />
      <Route path="/search" element={<Search />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/recent" element={<Recent />} />
      <Route path="/providers" element={<Providers />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/sync" element={<SyncBackup />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TVModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </TVModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
