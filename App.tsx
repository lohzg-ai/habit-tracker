import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HabitsProvider, useHabits } from './src/context/HabitsContext';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { DevScreen } from './src/screens/DevScreen';

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

function Root() {
  const { data, loading } = useHabits();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0B1A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6C63FF', fontSize: 24 }}>✨</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }
  return data.onboardingComplete ? <MainTabs /> : <OnboardingScreen />;
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
          <HabitsProvider>
            <StatusBar style="light" />
            <Root />
          </HabitsProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
