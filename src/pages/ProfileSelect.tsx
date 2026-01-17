/**
 * ProfileSelect Page - Full-screen profile selection
 * Shown when user needs to pick a profile
 */

import { useNavigate } from 'react-router-dom';
import { ProfileSelector } from '@/components/profiles/ProfileSelector';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function ProfileSelect() {
  const navigate = useNavigate();
  const { user, signOut, isGuest } = useAuth();
  
  const handleProfileSelected = () => {
    // Navigate to home after profile selection
    navigate('/');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SV</span>
          </div>
          <span className="font-semibold">StreamVault</span>
        </div>
        
        {!isGuest && user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logga ut
            </Button>
          </div>
        )}
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <ProfileSelector 
          onProfileSelected={handleProfileSelected}
          showManagement={!isGuest}
        />
      </main>
      
      {/* Footer hint */}
      <footer className="p-4 text-center text-sm text-muted-foreground">
        {isGuest ? (
          <p>
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
              Logga in
            </Button>
            {' '}för att skapa och spara egna profiler
          </p>
        ) : (
          <p>Tryck på en profil för att börja titta</p>
        )}
      </footer>
    </div>
  );
}
