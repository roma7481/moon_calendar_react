import AsyncStorage from '@react-native-async-storage/async-storage';
import type { City } from '../data/content';

const KEYS = {
  CITY: 'CITY',
  LONGTITUDE: 'LONGTITUDE',
  LATITUDE: 'LATITUDE',
  CITY_SAVED: 'CITY_SAVED',
  LANGUAGE: 'LANGUAGE',
  NOTIFICATIONS_ENABLED: 'NOTIFICATIONS_ENABLED',
  NOTIFICATION_TIME: 'NOTIFICATION_TIME',
  TEXT_SIZE: 'TEXT_SIZE',
  PREMIUM: 'is_premium',
  THEME: 'APP_THEME',
  CUSTOM_CITIES: 'CUSTOM_CITIES',
};

export const getStoredCity = async (): Promise<City | null> => {
  const [name, latitude, longitude] = await Promise.all([
    AsyncStorage.getItem(KEYS.CITY),
    AsyncStorage.getItem(KEYS.LATITUDE),
    AsyncStorage.getItem(KEYS.LONGTITUDE),
  ]);

  if (!name || !latitude || !longitude) {
    return null;
  }

  return {
    name,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
};

export const setStoredCity = async (city: City) => {
  await Promise.all([
    AsyncStorage.setItem(KEYS.CITY, city.name),
    AsyncStorage.setItem(KEYS.LATITUDE, String(city.latitude)),
    AsyncStorage.setItem(KEYS.LONGTITUDE, String(city.longitude)),
    AsyncStorage.setItem(KEYS.CITY_SAVED, 'true'),
  ]);
};

export const getStoredLanguage = async (): Promise<'en' | 'ru' | 'ja' | null> => {
  const value = await AsyncStorage.getItem(KEYS.LANGUAGE);
  if (value === 'en' || value === 'ru' || value === 'ja') return value;
  return null;
};

export const setStoredLanguage = async (language: 'en' | 'ru' | 'ja') => {
  await AsyncStorage.setItem(KEYS.LANGUAGE, language);
};

export const getStoredNotifications = async (): Promise<{ enabled: boolean; minutes: number }> => {
  const [enabledValue, timeValue] = await Promise.all([
    AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED),
    AsyncStorage.getItem(KEYS.NOTIFICATION_TIME),
  ]);

  const enabled = enabledValue === 'true';
  const minutes = timeValue ? Number(timeValue) : 9 * 60;

  return { enabled, minutes: Number.isNaN(minutes) ? 9 * 60 : minutes };
};

export const setStoredNotifications = async (enabled: boolean, minutes: number) => {
  await Promise.all([
    AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, String(enabled)),
    AsyncStorage.setItem(KEYS.NOTIFICATION_TIME, String(minutes)),
  ]);
};

export const getStoredTextSize = async (): Promise<'small' | 'medium' | 'large' | null> => {
  const value = await AsyncStorage.getItem(KEYS.TEXT_SIZE);
  if (value === 'small' || value === 'medium' || value === 'large') return value;
  return null;
};

export const setStoredTextSize = async (size: 'small' | 'medium' | 'large') => {
  await AsyncStorage.setItem(KEYS.TEXT_SIZE, size);
};

export const getStoredPremium = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(KEYS.PREMIUM);
  return value === 'true';
};

export const setStoredPremium = async (isPremium: boolean) => {
  await AsyncStorage.setItem(KEYS.PREMIUM, String(isPremium));
};

export const getStoredTheme = async (): Promise<
  'blue-day' | 'deep-blue-night' | 'raspberry' | 'dreamland' | 'amethyst' | null
> => {
  const value = await AsyncStorage.getItem(KEYS.THEME);
  if (
    value === 'blue-day' ||
    value === 'deep-blue-night' ||
    value === 'raspberry' ||
    value === 'dreamland' ||
    value === 'amethyst'
  )
    return value;
  return null;
};

export const setStoredTheme = async (
  theme: 'blue-day' | 'deep-blue-night' | 'raspberry' | 'dreamland' | 'amethyst'
) => {
  await AsyncStorage.setItem(KEYS.THEME, theme);
};

export type StoredCustomCity = City & { id: string };

const parseCity = (input: any): City | null => {
  if (!input?.name) return null;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { name: String(input.name), latitude, longitude };
};

export const getStoredCustomCities = async (): Promise<StoredCustomCity[]> => {
  const value = await AsyncStorage.getItem(KEYS.CUSTOM_CITIES);
  if (value) {
    try {
      const parsed = JSON.parse(value) as StoredCustomCity[];
      return (parsed || []).filter((city) => parseCity(city)).map((city) => ({
        id: city.id ?? `custom-${Date.now()}`,
        name: city.name,
        latitude: Number(city.latitude),
        longitude: Number(city.longitude),
      }));
    } catch {
      return [];
    }
  }

  const legacy = await AsyncStorage.getItem('CUSTOM_CITY');
  if (!legacy) return [];
  try {
    const parsed = JSON.parse(legacy);
    const city = parseCity(parsed);
    if (!city) return [];
    const migrated = [{ ...city, id: `custom-${Date.now()}` }];
    await AsyncStorage.setItem(KEYS.CUSTOM_CITIES, JSON.stringify(migrated));
    await AsyncStorage.removeItem('CUSTOM_CITY');
    return migrated;
  } catch {
    return [];
  }
};

export const setStoredCustomCities = async (cities: StoredCustomCity[]) => {
  await AsyncStorage.setItem(KEYS.CUSTOM_CITIES, JSON.stringify(cities));
};
