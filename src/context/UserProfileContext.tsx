import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { UserProfile } from '../types';
import { db } from '../lib/db';

type UserProfileContextType = {
  profile: UserProfile;
  profileLoading: boolean;
  updateProfile: (changes: Partial<UserProfile>) => Promise<void>;
  pickAndUploadAvatar: () => Promise<void>;
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: null,
  avatarUrl: null,
  inactivityTimeoutMins: 30,
};

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export const useUserProfile = () => {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
};

export const UserProfileProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
}> = ({ children, userId }) => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    db.fetchProfile(userId)
      .then((p) => { if (p) setProfile(p); })
      .finally(() => setProfileLoading(false));
  }, [userId]);

  const updateProfile = useCallback(
    async (changes: Partial<UserProfile>) => {
      const next = { ...profile, ...changes };
      setProfile(next); // optimistic
      await db.updateProfile(userId, changes);
    },
    [profile, userId],
  );

  const pickAndUploadAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    // Optimistic preview
    setProfile((p) => ({ ...p, avatarUrl: uri }));

    const publicUrl = await db.uploadAvatar(userId, uri);
    if (publicUrl) {
      setProfile((p) => ({ ...p, avatarUrl: publicUrl }));
      await db.updateProfile(userId, { avatarUrl: publicUrl });
    } else {
      // Revert if upload failed
      setProfile((p) => ({ ...p, avatarUrl: profile.avatarUrl }));
    }
  }, [userId, profile.avatarUrl]);

  return (
    <UserProfileContext.Provider value={{ profile, profileLoading, updateProfile, pickAndUploadAvatar }}>
      {children}
    </UserProfileContext.Provider>
  );
};
