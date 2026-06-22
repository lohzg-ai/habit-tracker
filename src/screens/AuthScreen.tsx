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

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signUpDone, setSignUpDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async () => {
    setError(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }
      setLoading(true);
      const err = await resetPassword(email.trim());
      if (err) setError(err);
      else setResetSent(true);
      setLoading(false);
      return;
    }

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    if (mode === 'signin') {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } else {
      const err = await signUp(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        setSignUpDone(true);
      }
    }
    setLoading(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSignUpDone(false);
    setResetSent(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[webOuter, s.scroll]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={webInner}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.logo}>✨</Text>
              <Text style={s.appName}>HabitFlow</Text>
              <Text style={s.tagline}>Build habits that stick</Text>
            </View>

            {/* Mode tabs */}
            {mode !== 'forgot' && (
              <View style={s.tabs}>
                <Pressable
                  style={[s.tab, mode === 'signin' && s.tabActive]}
                  onPress={() => switchMode('signin')}
                >
                  <Text style={[s.tabLabel, mode === 'signin' && s.tabLabelActive]}>
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.tab, mode === 'signup' && s.tabActive]}
                  onPress={() => switchMode('signup')}
                >
                  <Text style={[s.tabLabel, mode === 'signup' && s.tabLabelActive]}>
                    Create account
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Sign-up confirmation */}
            {signUpDone ? (
              <View style={s.confirmBox}>
                <Text style={s.confirmIcon}>📬</Text>
                <Text style={s.confirmTitle}>Check your email</Text>
                <Text style={s.confirmBody}>
                  We sent a confirmation link to{' '}
                  <Text style={s.confirmEmail}>{email}</Text>.{'\n'}
                  Click the link, then come back here to sign in.
                </Text>
                <Pressable style={s.btn} onPress={() => switchMode('signin')}>
                  <Text style={s.btnLabel}>Back to sign in</Text>
                </Pressable>
              </View>
            ) : resetSent ? (
              <View style={s.confirmBox}>
                <Text style={s.confirmIcon}>📬</Text>
                <Text style={s.confirmTitle}>Check your email</Text>
                <Text style={s.confirmBody}>
                  If an account exists for{' '}
                  <Text style={s.confirmEmail}>{email}</Text>, we sent a password reset link.{'\n'}
                  Click it to set a new password.
                </Text>
                <Pressable style={s.btn} onPress={() => switchMode('signin')}>
                  <Text style={s.btnLabel}>Back to sign in</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {mode === 'forgot' && (
                  <View style={s.forgotHeader}>
                    <Text style={s.forgotTitle}>Reset your password</Text>
                    <Text style={s.forgotBody}>Enter your account email and we'll send you a reset link.</Text>
                  </View>
                )}

                {/* Form */}
                <View style={s.form}>
                  <Text style={s.fieldLabel}>Email</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />

                  {mode !== 'forgot' && (
                    <>
                      <Text style={[s.fieldLabel, { marginTop: 16 }]}>Password</Text>
                      <View style={s.passwordRow}>
                        <TextInput
                          style={[s.input, s.passwordInput]}
                          value={password}
                          onChangeText={setPassword}
                          placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                          placeholderTextColor="rgba(255,255,255,0.25)"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={submit}
                        />
                        <Pressable
                          style={s.eyeBtn}
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={8}
                        >
                          <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}

                  {mode === 'signin' && (
                    <Pressable onPress={() => switchMode('forgot')} hitSlop={8} style={s.forgotLinkRow}>
                      <Text style={s.forgotLink}>Forgot password?</Text>
                    </Pressable>
                  )}

                  {error ? <Text style={s.errorText}>{error}</Text> : null}

                  <Pressable
                    style={[s.btn, loading && s.btnDisabled]}
                    onPress={submit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.btnLabel}>
                        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                      </Text>
                    )}
                  </Pressable>

                  {mode === 'forgot' && (
                    <Pressable onPress={() => switchMode('signin')} hitSlop={8} style={{ marginTop: 18 }}>
                      <Text style={s.forgotLink}>Back to sign in</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
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
  appName: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.45)', fontSize: 15, marginTop: 6 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1E1B2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#6C63FF' },
  tabLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
  tabLabelActive: { color: '#fff' },

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

  errorText: {
    color: '#FF6584',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },

  confirmBox: { alignItems: 'center', paddingVertical: 12 },
  confirmIcon: { fontSize: 48, marginBottom: 16 },
  confirmTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  confirmBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  confirmEmail: { color: '#6C63FF', fontWeight: '600' },

  forgotHeader: { marginBottom: 24, alignItems: 'center' },
  forgotTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  forgotBody: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  forgotLinkRow: { alignSelf: 'flex-end', marginTop: 10 },
  forgotLink: { color: '#6C63FF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
