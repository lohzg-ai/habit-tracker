import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';

type Props = { onPress: () => void };

export function ProfileAvatarButton({ onPress }: Props) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();

  const initials = profile.displayName
    ? profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={[s.btn, { top: insets.top + 10 }]}
      hitSlop={8}
    >
      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={s.img} />
      ) : (
        <View style={s.initialsCircle}>
          <Text style={s.initialsText}>{initials}</Text>
        </View>
      )}
      {/* Online / active indicator dot */}
      <View style={s.dot} />
    </Pressable>
  );
}

const SIZE = 36;
const s = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    width: SIZE,
    height: SIZE,
  },
  img: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  initialsCircle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(108,99,255,0.4)',
  },
  initialsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#43D9B8',
    borderWidth: 2,
    borderColor: '#0D0B1A',
  },
});
