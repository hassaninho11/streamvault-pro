import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncEngine, SyncStrategy } from "@/data/stores/syncEngine";
import { entitlementsService } from "@/services/EntitlementsService";
import { bugReportService } from "@/services/BugReportService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: (clearLocalData?: boolean) => Promise<void>;
  syncData: (strategy: SyncStrategy) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle sync when user logs in
        if (event === 'SIGNED_IN' && session?.user) {
          // Start auto-sync
          setTimeout(() => {
            syncEngine.startAutoSync(session.user.id);
          }, 0);
          // Update last seen for DAU/MAU tracking
          bugReportService.updateLastSeen();
        } else if (event === 'SIGNED_OUT') {
          syncEngine.stopAutoSync();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        syncEngine.startAutoSync(session.user.id);
        // Update last seen for DAU/MAU tracking
        bugReportService.updateLastSeen();
      }
    });

    return () => {
      subscription.unsubscribe();
      syncEngine.stopAutoSync();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    // Transfer trial to new account
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await entitlementsService.transferTrialToAccount(data.user.id);
      }
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    return { error };
  };

  const signOut = async (clearLocalData = false) => {
    syncEngine.stopAutoSync();
    await supabase.auth.signOut();
    
    if (clearLocalData) {
      const { localStore } = await import('@/data/stores/localStore');
      await localStore.clearAll();
    }
  };

  const syncData = useCallback(async (strategy: SyncStrategy) => {
    if (user) {
      await syncEngine.sync(user.id, strategy);
    }
  }, [user]);

  const isGuest = !user && !loading;
  const isAuthenticated = !!user && !loading;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuest,
        isAuthenticated,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        syncData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
