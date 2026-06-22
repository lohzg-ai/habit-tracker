import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Habit } from '../types';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowList: true,
    }),
  });
}

export const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleHabitReminder = async (habit: Habit): Promise<void> => {
  if (Platform.OS === 'web' || !habit.reminder?.enabled) return;
  const identifier = `habit_${habit.id}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: 'Time to work on your habit!',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: habit.reminder.hour,
      minute: habit.reminder.minute,
    },
  });
};

export const cancelHabitReminder = async (habitId: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(`habit_${habitId}`).catch(() => {});
};

export const scheduleReminders = async () => {
  if (Platform.OS === 'web') return;
  const schedule = [
    { hour: 8, title: 'Morning habits! 🌅', body: 'Start your day with your habits.' },
    { hour: 14, title: 'Afternoon check-in 🎯', body: 'How are your habits going today?' },
    { hour: 20, title: 'Evening wind-down 🌙', body: "Don't forget to log your habits!" },
  ];
  for (const s of schedule) {
    await Notifications.scheduleNotificationAsync({
      content: { title: s.title, body: s.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: s.hour,
        minute: 0,
      },
    });
  }
};

export const cancelAllReminders = () => {
  if (Platform.OS === 'web') return;
  Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
};

/**
 * Registers this device for remote push (server-triggered AI coaching pushes) and
 * returns the Expo push token, or null on web/no-permission/no EAS project configured.
 * Requires `expo.extra.eas.projectId` in app.json (set via `eas init`).
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  const granted = await requestPermissions();
  if (!granted) return null;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[notifications] No EAS projectId configured — run `eas init` to enable push notifications.');
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] getExpoPushTokenAsync failed', err);
    return null;
  }
};

export const fmt12h = (hour: number, minute: number): string => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
};
