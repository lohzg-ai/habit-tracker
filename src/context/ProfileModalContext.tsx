import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from 'react-native';
import { ProfileScreen } from '../screens/ProfileScreen';

type ProfileModalContextType = { openProfile: () => void };

const ProfileModalContext = createContext<ProfileModalContextType | null>(null);

export const useProfileModal = () => {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) throw new Error('useProfileModal must be used within ProfileModalProvider');
  return ctx;
};

/** Owns the profile modal. Wrap inside the authenticated subtree so UserProfileContext is available. */
export const ProfileModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const openProfile = useCallback(() => setVisible(true), []);
  const closeProfile = useCallback(() => setVisible(false), []);

  return (
    <ProfileModalContext.Provider value={{ openProfile }}>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProfile}
      >
        <ProfileScreen onClose={closeProfile} />
      </Modal>
    </ProfileModalContext.Provider>
  );
};
