import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID_KEY = 'DAILY_REMINDER_ID';
const ANDROID_CHANNEL_ID = 'daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const getStoredReminderId = async () => AsyncStorage.getItem(REMINDER_ID_KEY);

const setStoredReminderId = async (id: string) => {
  await AsyncStorage.setItem(REMINDER_ID_KEY, id);
};

const clearStoredReminderId = async () => {
  await AsyncStorage.removeItem(REMINDER_ID_KEY);
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9DD1',
  });
};

export const ensureNotificationPermissions = async (): Promise<boolean> => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
};

export const hasNotificationPermission = async (): Promise<boolean> => {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
};

export const cancelDailyReminder = async () => {
  const existingId = await getStoredReminderId();
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }
  await clearStoredReminderId();
};

export const scheduleDailyReminder = async (minutes: number, title: string, body: string) => {
  await ensureAndroidChannel();
  await cancelDailyReminder();

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: 'daily-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  await setStoredReminderId(id);
  return id;
};
