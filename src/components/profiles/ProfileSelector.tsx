/**
 * ProfileSelector - Select or create user profiles
 * Shows profile cards with avatars
 */

import { useState } from 'react';
import { Plus, Edit, Trash2, Check, User, Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useProfile, type UserProfile } from '@/contexts/ProfileContext';

interface ProfileSelectorProps {
  onProfileSelected?: () => void;
  showManagement?: boolean;
  className?: string;
}

export function ProfileSelector({ 
  onProfileSelected, 
  showManagement = false,
  className 
}: ProfileSelectorProps) {
  const { profiles, currentProfile, selectProfile, isLoading } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSelectProfile = async (profile: UserProfile) => {
    if (isEditing) return;
    
    const success = await selectProfile(profile.id);
    if (success && onProfileSelected) {
      onProfileSelected();
    }
  };
  
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Laddar profiler...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Vem tittar?</h2>
        <p className="text-muted-foreground">Välj din profil</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-6">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isSelected={currentProfile?.id === profile.id}
            isEditing={isEditing}
            onClick={() => handleSelectProfile(profile)}
          />
        ))}
        
        {/* Add profile button */}
        {profiles.length < 5 && showManagement && (
          <AddProfileCard />
        )}
      </div>
      
      {/* Management toggle */}
      {showManagement && profiles.length > 1 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => setIsEditing(!isEditing)}
            className="text-muted-foreground"
          >
            {isEditing ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Klar
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Hantera profiler
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============= Profile Card =============

interface ProfileCardProps {
  profile: UserProfile;
  isSelected: boolean;
  isEditing: boolean;
  onClick: () => void;
}

function ProfileCard({ profile, isSelected, isEditing, onClick }: ProfileCardProps) {
  const { deleteProfile } = useProfile();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (profile.is_default) return;
    
    setIsDeleting(true);
    await deleteProfile(profile.id);
    setIsDeleting(false);
  };
  
  return (
    <Card
      className={cn(
        'relative group cursor-pointer transition-all duration-200',
        'w-32 h-40 flex flex-col items-center justify-center gap-2',
        'hover:scale-105 hover:border-primary/50',
        isSelected && 'ring-2 ring-primary border-primary',
        isEditing && 'animate-wiggle'
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center text-3xl',
        profile.is_child 
          ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
          : 'bg-gradient-to-br from-primary to-primary/70'
      )}>
        {profile.avatar_url ? (
          <img 
            src={profile.avatar_url} 
            alt={profile.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          profile.is_child ? <Baby className="w-8 h-8 text-white" /> : <User className="w-8 h-8 text-white" />
        )}
      </div>
      
      {/* Name */}
      <span className="font-medium text-sm truncate max-w-full px-2">
        {profile.name}
      </span>
      
      {/* Child badge */}
      {profile.is_child && (
        <span className="absolute top-2 right-2 text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded-full">
          Barn
        </span>
      )}
      
      {/* Selected indicator */}
      {isSelected && !isEditing && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
      
      {/* Delete button (when editing) */}
      {isEditing && !profile.is_default && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </Card>
  );
}

// ============= Add Profile Card =============

function AddProfileCard() {
  const [showForm, setShowForm] = useState(false);
  
  if (showForm) {
    return <CreateProfileForm onClose={() => setShowForm(false)} />;
  }
  
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'w-32 h-40 flex flex-col items-center justify-center gap-2',
        'border-dashed hover:border-primary/50 hover:bg-accent/30'
      )}
      onClick={() => setShowForm(true)}
    >
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
        <Plus className="w-8 h-8 text-muted-foreground" />
      </div>
      <span className="text-sm text-muted-foreground">Lägg till</span>
    </Card>
  );
}

// ============= Create Profile Form (inline) =============

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CreateProfileFormProps {
  onClose: () => void;
}

function CreateProfileForm({ onClose }: CreateProfileFormProps) {
  const { createProfile } = useProfile();
  const [name, setName] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    const profile = await createProfile({
      name: name.trim(),
      is_child: isChild,
    });
    
    setIsSubmitting(false);
    if (profile) {
      onClose();
    }
  };
  
  return (
    <Card className="w-64 p-4 space-y-4">
      <h3 className="font-semibold">Ny profil</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Namn</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Profilnamn"
            autoFocus
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="is-child" className="cursor-pointer">
            Barnprofil
          </Label>
          <Switch
            id="is-child"
            checked={isChild}
            onCheckedChange={setIsChild}
          />
        </div>
        
        {isChild && (
          <p className="text-xs text-muted-foreground">
            Barnprofiler kan bara se barnvänligt innehåll
          </p>
        )}
        
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="ghost" 
            className="flex-1"
            onClick={onClose}
          >
            Avbryt
          </Button>
          <Button 
            type="submit" 
            className="flex-1"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Sparar...' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
