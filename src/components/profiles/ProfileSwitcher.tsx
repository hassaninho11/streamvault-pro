/**
 * ProfileSwitcher - Compact profile switcher for header/navigation
 * Dropdown to quickly switch between profiles
 */

import { User, Baby, ChevronDown, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useProfile, type UserProfile } from '@/contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';

interface ProfileSwitcherProps {
  onManageClick?: () => void;
  className?: string;
}

export function ProfileSwitcher({ onManageClick, className }: ProfileSwitcherProps) {
  const { profiles, currentProfile, selectProfile } = useProfile();
  const navigate = useNavigate();
  
  const handleSelectProfile = async (profile: UserProfile) => {
    await selectProfile(profile.id);
  };
  
  const handleManage = () => {
    if (onManageClick) {
      onManageClick();
    } else {
      navigate('/settings?tab=profiles');
    }
  };
  
  if (!currentProfile) return null;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={cn('flex items-center gap-2 px-2', className)}
        >
          <ProfileAvatar profile={currentProfile} size="sm" />
          <span className="hidden sm:inline font-medium">
            {currentProfile.name}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        {/* Profile list */}
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => handleSelectProfile(profile)}
            className={cn(
              'flex items-center gap-3 cursor-pointer',
              currentProfile?.id === profile.id && 'bg-accent'
            )}
          >
            <ProfileAvatar profile={profile} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{profile.name}</div>
              {profile.is_child && (
                <div className="text-xs text-muted-foreground">Barnprofil</div>
              )}
            </div>
            {currentProfile?.id === profile.id && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Manage profiles */}
        <DropdownMenuItem onClick={handleManage} className="cursor-pointer">
          <Users className="w-4 h-4 mr-2" />
          Hantera profiler
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============= Profile Avatar =============

interface ProfileAvatarProps {
  profile: UserProfile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProfileAvatar({ profile, size = 'md', className }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-3xl',
  };
  
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {profile.avatar_url && (
        <AvatarImage src={profile.avatar_url} alt={profile.name} />
      )}
      <AvatarFallback
        className={cn(
          profile.is_child 
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' 
            : 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
        )}
      >
        {profile.is_child ? (
          <Baby className={cn(size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-10 h-10')} />
        ) : (
          <User className={cn(size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-10 h-10')} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
