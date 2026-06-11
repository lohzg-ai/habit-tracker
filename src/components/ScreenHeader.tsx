import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useProfileModal } from '../context/ProfileModalContext';

type Props = {
  title: string;
  subtitle?: string;
  /** Extra header content rendered below the title row (e.g. month nav, stats chips). */
  children?: React.ReactNode;
};

/**
 * Shared screen header: title + optional subtitle on the left, profile avatar on the right.
 * Drop this inside the screen's webInner wrapper in place of the existing SafeAreaView header.
 * Already handles SafeAreaView edges={['top']}.
 */
export function ScreenHeader({ title, subtitle, children }: Props) {
  const { openProfile } = useProfileModal();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const initials = profile.displayName
    ? profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.row}>
        <View style={s.titleArea}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        <Pressable onPress={openProfile} style={s.avatarBtn} hitSlop={10}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={s.onlineDot} />
        </Pressable>
      </View>

      {children ? <View style={s.childrenArea}>{children}</View> : null}
    </SafeAreaView>
  );
}

const AVATAR = 36;

const s = StyleSheet.create({
  safe: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  titleArea: { flex: 1, paddingRight: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },

  avatarBtn: { width: AVATAR, height: AVATAR },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  avatarCircle: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#43D9B8',
    borderWidth: 2,
    borderColor: '#1A1726',
  },
  childrenArea: { marginTop: 4 },
});
