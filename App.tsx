import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { HabitsProvider, useHabits } from './src/context/HabitsContext';
import { UserProfileProvider, useUserProfile } from './src/context/UserProfileContext';
import { useInactivityTimer } from './src/hooks/useInactivityTimer';

import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { DevScreen } from './src/screens/DevScreen';
import { ProfileModalProvider } from './src/context/ProfileModalContext';

const Tab = createBottomTabNavigator();

const TAB_ICON: Record<string, string> = {
  Today: '☀️',
  Habits: '📋',
  History: '📅',
  Stats: '📊',
  Dev: '🛠',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] ?? '•'}</Text>
        ),
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarStyle: {
          backgroundColor: '#1A1726',
          borderTopColor: 'rgba(255,255,255,0.06)',
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      {__DEV__ && <Tab.Screen name="Dev" component={DevScreen} />}
    </Tab.Navigator>
  );
}

/** Wraps the authenticated app: detects inactivity, owns the profile modal. */
function AuthenticatedApp() {
  const { signOut } = useAuth();
  const { data, loading } = useHabits();
  const { profile } = useUserProfile();

  // Inactivity timer — calls signOut() after user-configured timeout
  const panHandlers = useInactivityTimer(profile.inactivityTimeoutMins, signOut);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0B1A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6C63FF', fontSize: 24 }}>✨</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!data.onboardingComplete) {
    return <OnboardingScreen />;
  }

  return (
    // The outer View with panHandlers captures every touch to reset the inactivity timer
    <View style={{ flex: 1 }} {...panHandlers}>
      <MainTabs />
    </View>
  );
}

/** Auth gate: shows spinner → auth screen → app based on session state. */
function AuthGate() {
  const { session, user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0B1A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (!session || !user) {
    return <AuthScreen />;
  }

  // key={user.id} forces full remount of all providers on account switch
  return (
    <UserProfileProvider key={user.id} userId={user.id}>
      <HabitsProvider key={user.id} userId={user.id}>
        <ProfileModalProvider>
          <AuthenticatedApp />
        </ProfileModalProvider>
      </HabitsProvider>
    </UserProfileProvider>
  );
}

type ErrState = { error: Error | null };
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrState> {
  state: ErrState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>App Error</Text>
          <ScrollView>
            <Text style={eb.msg}>{this.state.error.message}</Text>
            <Text style={eb.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0B1A', padding: 20, paddingTop: 60 },
  title: { color: '#FF6584', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  msg: { color: '#fff', fontSize: 14, marginBottom: 12 },
  stack: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
});

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <AuthProvider>
            <StatusBar style="light" />
            <AuthGate />
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
