/**
 * ProfileContext - Multi-profile management
 * Handles profile selection, creation, and switching
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ============= Types =============

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_child: boolean;
  max_rating: 'all' | 'pg' | 'pg13' | 'r';
  is_default: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileData {
  name: string;
  avatar_url?: string;
  is_child: boolean;
  max_rating?: 'all' | 'pg' | 'pg13' | 'r';
  pin?: string;
}

export interface ProfileContextType {
  // Current state
  profiles: UserProfile[];
  currentProfile: UserProfile | null;
  isLoading: boolean;
  isProfileLocked: boolean;
  
  // Actions
  loadProfiles: () => Promise<void>;
  selectProfile: (profileId: string, pin?: string) => Promise<boolean>;
  createProfile: (data: CreateProfileData) => Promise<UserProfile | null>;
  updateProfile: (id: string, updates: Partial<CreateProfileData>) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  lockProfile: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  
  // Profile checks
  isChildProfile: boolean;
  canAccessContent: (rating: string) => boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

// ============= Avatar options =============

export const AVATAR_OPTIONS = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg',
];

export const DEFAULT_AVATARS = {
  adult: '👤',
  child: '🧒',
};

// ============= Rating hierarchy =============

const RATING_HIERARCHY: Record<string, number> = {
  'all': 0,
  'pg': 1,
  'pg13': 2,
  'r': 3,
};

// ============= Provider =============

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  
  // Load profiles from database
  const loadProfiles = useCallback(async () => {
    if (!user || isGuest) {
      // Guest mode: create a virtual default profile
      const guestProfile: UserProfile = {
        id: 'guest-profile',
        user_id: 'guest',
        name: 'Gäst',
        avatar_url: null,
        is_child: false,
        max_rating: 'all',
        is_default: true,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfiles([guestProfile]);
      setCurrentProfile(guestProfile);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Map to typed profiles
      const typedProfiles: UserProfile[] = (data || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        avatar_url: p.avatar_url,
        is_child: p.is_child,
        max_rating: (p.max_rating as 'all' | 'pg' | 'pg13' | 'r') || 'all',
        is_default: p.is_default,
        settings: (p.settings as Record<string, unknown>) || {},
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      
      setProfiles(typedProfiles);
      
      // If no profiles exist, create default
      if (typedProfiles.length === 0) {
        const defaultProfile = await createDefaultProfile(user.id);
        if (defaultProfile) {
          setProfiles([defaultProfile]);
          setCurrentProfile(defaultProfile);
        }
      } else {
        // Select last used or default profile
        const lastProfileId = localStorage.getItem(`lastProfile_${user.id}`);
        const profile = typedProfiles.find(p => p.id === lastProfileId) 
          || typedProfiles.find(p => p.is_default)
          || typedProfiles[0];
        
        if (profile) {
          setCurrentProfile(profile);
        }
      }
    } catch (error) {
      console.error('[ProfileContext] Error loading profiles:', error);
      toast.error('Kunde inte ladda profiler');
    } finally {
      setIsLoading(false);
    }
  }, [user, isGuest]);
  
  // Create default profile for new users
  const createDefaultProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          name: 'Huvudprofil',
          is_default: true,
          is_child: false,
          max_rating: 'all',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        avatar_url: data.avatar_url,
        is_child: data.is_child,
        max_rating: data.max_rating as 'all' | 'pg' | 'pg13' | 'r',
        is_default: data.is_default,
        settings: (data.settings as Record<string, unknown>) || {},
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      console.error('[ProfileContext] Error creating default profile:', error);
      return null;
    }
  };
  
  // Select a profile
  const selectProfile = useCallback(async (profileId: string, pin?: string): Promise<boolean> => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return false;
    
    // TODO: Check PIN if profile is locked
    // For now, just select
    setCurrentProfile(profile);
    setIsProfileLocked(false);
    
    // Remember selection
    if (user) {
      localStorage.setItem(`lastProfile_${user.id}`, profileId);
    }
    
    return true;
  }, [profiles, user]);
  
  // Create new profile
  const createProfile = useCallback(async (data: CreateProfileData): Promise<UserProfile | null> => {
    if (!user || isGuest) {
      toast.error('Logga in för att skapa profiler');
      return null;
    }
    
    // Limit to 5 profiles
    if (profiles.length >= 5) {
      toast.error('Max 5 profiler tillåtna');
      return null;
    }
    
    try {
      const { data: newProfile, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          name: data.name,
          avatar_url: data.avatar_url || null,
          is_child: data.is_child,
          max_rating: data.is_child ? 'pg' : (data.max_rating || 'all'),
          is_default: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const typedProfile: UserProfile = {
        id: newProfile.id,
        user_id: newProfile.user_id,
        name: newProfile.name,
        avatar_url: newProfile.avatar_url,
        is_child: newProfile.is_child,
        max_rating: newProfile.max_rating as 'all' | 'pg' | 'pg13' | 'r',
        is_default: newProfile.is_default,
        settings: (newProfile.settings as Record<string, unknown>) || {},
        created_at: newProfile.created_at,
        updated_at: newProfile.updated_at,
      };
      
      setProfiles(prev => [...prev, typedProfile]);
      toast.success(`Profil "${data.name}" skapad`);
      
      return typedProfile;
    } catch (error) {
      console.error('[ProfileContext] Error creating profile:', error);
      toast.error('Kunde inte skapa profil');
      return null;
    }
  }, [user, isGuest, profiles.length]);
  
  // Update profile
  const updateProfile = useCallback(async (id: string, updates: Partial<CreateProfileData>): Promise<boolean> => {
    if (!user || isGuest) return false;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: updates.name,
          avatar_url: updates.avatar_url,
          is_child: updates.is_child,
          max_rating: updates.max_rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setProfiles(prev => prev.map(p => 
        p.id === id 
          ? { ...p, ...updates, updated_at: new Date().toISOString() } 
          : p
      ));
      
      // Update current profile if it was the one edited
      if (currentProfile?.id === id) {
        setCurrentProfile(prev => prev ? { ...prev, ...updates } : null);
      }
      
      toast.success('Profil uppdaterad');
      return true;
    } catch (error) {
      console.error('[ProfileContext] Error updating profile:', error);
      toast.error('Kunde inte uppdatera profil');
      return false;
    }
  }, [user, isGuest, currentProfile]);
  
  // Delete profile
  const deleteProfile = useCallback(async (id: string): Promise<boolean> => {
    if (!user || isGuest) return false;
    
    const profile = profiles.find(p => p.id === id);
    if (!profile || profile.is_default) {
      toast.error('Kan inte ta bort huvudprofil');
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setProfiles(prev => prev.filter(p => p.id !== id));
      
      // If deleted current profile, switch to default
      if (currentProfile?.id === id) {
        const defaultProfile = profiles.find(p => p.is_default && p.id !== id);
        if (defaultProfile) {
          setCurrentProfile(defaultProfile);
        }
      }
      
      toast.success('Profil borttagen');
      return true;
    } catch (error) {
      console.error('[ProfileContext] Error deleting profile:', error);
      toast.error('Kunde inte ta bort profil');
      return false;
    }
  }, [user, isGuest, profiles, currentProfile]);
  
  // Lock current profile (require PIN to switch to adult profile)
  const lockProfile = useCallback(() => {
    setIsProfileLocked(true);
  }, []);
  
  // Unlock with PIN
  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    // TODO: Verify PIN against stored hash
    // For now, just unlock
    setIsProfileLocked(false);
    return true;
  }, []);
  
  // Check if content can be accessed based on rating
  const canAccessContent = useCallback((rating: string): boolean => {
    if (!currentProfile) return true;
    
    const contentLevel = RATING_HIERARCHY[rating.toLowerCase()] ?? 0;
    const profileLevel = RATING_HIERARCHY[currentProfile.max_rating] ?? 3;
    
    return contentLevel <= profileLevel;
  }, [currentProfile]);
  
  // Load profiles on mount and when user changes
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);
  
  const value: ProfileContextType = {
    profiles,
    currentProfile,
    isLoading,
    isProfileLocked,
    loadProfiles,
    selectProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    lockProfile,
    unlockWithPin,
    isChildProfile: currentProfile?.is_child || false,
    canAccessContent,
  };
  
  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// ============= Hook =============

export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
