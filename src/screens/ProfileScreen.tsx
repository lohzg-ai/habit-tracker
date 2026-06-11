import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { supabase } from '../lib/supabase';
import { webInner, webOuter } from '../utils/responsive';

const TIMEOUT_OPTIONS: { label: string; value: number | null }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '2 hr', value: 120 },
  { label: 'Never', value: null },
];

type Props = { onClose: () => void };

export function ProfileScreen({ onClose }: Props) {
  const { user, signOut } = useAuth();
  const { profile, updateProfile, pickAndUploadAvatar } = useUserProfile();

  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const initials = profile.displayName
    ? profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    await updateProfile({ displayName: displayName.trim() || null });
    setSaving(false);
    setSaveMsg('Profile saved ✓');
    setTimeout(() => setSaveMsg(null), 2500);
  };

  // ── Avatar pick ───────────────────────────────────────────────────────────
  const handlePickAvatar = async () => {
    setAvatarUploading(true);
    await pickAndUploadAvatar();
    setAvatarUploading(false);
  };

  // ── Password change ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!newPassword) {
      setPwMsg({ text: 'Enter a new password.', ok: false });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: 'Password must be at least 6 characters.', ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Passwords do not match.', ok: false });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwMsg({ text: error.message, ok: false });
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ text: 'Password updated ✓', ok: true });
      setTimeout(() => setPwMsg(null), 2500);
    }
  };

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      return;
    }
    // Close modal first so session-cleared re-render isn't blocked by an open modal
    onClose();
    await signOut();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.flex, webOuter]}>
          <View style={[s.flex, webInner]}>

            {/* Header */}
            <View style={s.header}>
              <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </Pressable>
              <Text style={s.headerTitle}>Profile</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView
              contentContainerStyle={s.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              {/* Avatar */}
              <View style={s.avatarSection}>
                <Pressable onPress={handlePickAvatar} style={s.avatarWrap} disabled={avatarUploading}>
                  {profile.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
                  ) : (
                    <View style={s.avatarInitials}>
                      <Text style={s.avatarInitialsText}>{initials}</Text>
                    </View>
                  )}
                  <View style={s.avatarEditBadge}>
                    {avatarUploading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.avatarEditIcon}>📷</Text>}
                  </View>
                </Pressable>
                <Text style={s.avatarHint}>Tap to change photo</Text>
                {user?.email ? <Text style={s.emailText}>{user.email}</Text> : null}
              </View>

              {/* Display name */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>DISPLAY NAME</Text>
                <TextInput
                  style={s.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveProfile}
                />
                <Pressable
                  style={[s.saveBtn, saving && s.btnDisabled]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveBtnText}>Save name</Text>}
                </Pressable>
                {saveMsg ? <Text style={s.successText}>{saveMsg}</Text> : null}
              </View>

              {/* Session timeout */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>AUTO SIGN-OUT AFTER INACTIVITY</Text>
                <View style={s.chipRow}>
                  {TIMEOUT_OPTIONS.map((opt) => {
                    const active = profile.inactivityTimeoutMins === opt.value;
                    return (
                      <Pressable
                        key={String(opt.value)}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => updateProfile({ inactivityTimeoutMins: opt.value })}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.hintText}>
                  {profile.inactivityTimeoutMins === null
                    ? 'Session will not expire automatically.'
                    : `You will be signed out after ${profile.inactivityTimeoutMins} minutes of inactivity.`}
                </Text>
              </View>

              {/* Change password */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>CHANGE PASSWORD</Text>
                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, s.passwordInput]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showNewPw}
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                  <Pressable style={s.eyeBtn} onPress={() => setShowNewPw((v) => !v)} hitSlop={8}>
                    <Text style={s.eyeIcon}>{showNewPw ? '🙈' : '👁️'}</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[s.input, { marginTop: 10 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showNewPw}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleChangePassword}
                />
                {pwMsg ? (
                  <Text style={[s.pwMsg, { color: pwMsg.ok ? '#43D9B8' : '#FF6584' }]}>
                    {pwMsg.text}
                  </Text>
                ) : null}
                <Pressable
                  style={[s.saveBtn, pwSaving && s.btnDisabled]}
                  onPress={handleChangePassword}
                  disabled={pwSaving}
                >
                  {pwSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveBtnText}>Update password</Text>}
                </Pressable>
              </View>

              {/* Logout */}
              <View style={s.section}>
                {confirmingSignOut ? (
                  <View style={s.confirmBox}>
                    <Text style={s.confirmText}>Sign out of your account?</Text>
                    <View style={s.confirmBtnRow}>
                      <Pressable style={s.confirmCancelBtn} onPress={() => setConfirmingSignOut(false)}>
                        <Text style={s.confirmCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={s.logoutBtn} onPress={handleLogout}>
                        <Text style={s.logoutText}>Sign out</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={s.logoutBtn} onPress={handleLogout}>
                    <Text style={s.logoutText}>Sign out</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 90;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0B1A' },
  kav: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 18 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#6C63FF',
  },
  avatarInitials: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(108,99,255,0.4)',
  },
  avatarInitialsText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E1B2E',
    borderWidth: 2,
    borderColor: '#0D0B1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 14 },
  avatarHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 4 },
  emailText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 },

  section: { marginTop: 24 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },

  input: {
    backgroundColor: '#1E1B2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 13 },
  eyeIcon: { fontSize: 18 },

  saveBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  successText: { color: '#43D9B8', fontSize: 13, textAlign: 'center', marginTop: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  hintText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 10, lineHeight: 17 },

  pwMsg: { fontSize: 13, marginTop: 8 },

  logoutBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,100,132,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,100,132,0.08)',
  },
  logoutText: { color: '#FF6584', fontSize: 15, fontWeight: '700' },

  confirmBox: {
    backgroundColor: '#1E1B2E',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,100,132,0.2)',
  },
  confirmText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 14, textAlign: 'center' },
  confirmBtnRow: { flexDirection: 'row', gap: 10 },
  confirmCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmCancelText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '600' },
});
