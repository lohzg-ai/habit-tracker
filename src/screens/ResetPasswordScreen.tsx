import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { webOuter, webInner } from '../utils/responsive';

/** Shown when the user follows a "reset password" email link — lets them set a new password. */
export function ResetPasswordScreen() {
  const { updatePassword, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const err = await updatePassword(password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[webOuter, s.scroll]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={webInner}>
            <View style={s.header}>
              <Text style={s.logo}>🔐</Text>
              <Text style={s.appName}>Set a new password</Text>
              <Text style={s.tagline}>Choose a new password for your account.</Text>
            </View>

            <View style={s.form}>
              <Text style={s.fieldLabel}>New password</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, s.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>

              <Text style={[s.fieldLabel, { marginTop: 16 }]}>Confirm new password</Text>
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor="rgba(255,255,255,0.25)"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submit}
              />

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnLabel}>Update password</Text>}
              </Pressable>

              <Pressable onPress={cancelPasswordRecovery} hitSlop={8} style={{ marginTop: 18 }}>
                <Text style={s.cancelLink}>Cancel and back to sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0B1A' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 52 },
  appName: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 8, letterSpacing: -0.5, textAlign: 'center' },
  tagline: { color: 'rgba(255,255,255,0.45)', fontSize: 15, marginTop: 6, textAlign: 'center' },

  form: {},
  fieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#1E1B2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  eyeIcon: { fontSize: 18 },

  errorText: { color: '#FF6584', fontSize: 13, marginTop: 12, textAlign: 'center' },

  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cancelLink: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
});
