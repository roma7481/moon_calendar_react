import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { getStoredCity, getStoredCustomCities, setStoredCity, setStoredCustomCities } from './storage';
import type { City } from '../data/content';

const MIGRATION_KEY = 'LEGACY_CITY_MIGRATION_DONE';
const LOC_DELIM = 'C#I#T#Y#';
const PARAM_DELIM = 'C#O#O#R#D#S';

type LegacyPrefs = {
  city?: string;
  longitude?: number;
  latitude?: number;
  citySaved?: string;
};

const isClose = (a: City, b: City) =>
  Math.abs(a.latitude - b.latitude) < 0.001 && Math.abs(a.longitude - b.longitude) < 0.001;

const normalizeCity = (name?: string, longitude?: number, latitude?: number): City | null => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { name: trimmed, longitude: Number(longitude), latitude: Number(latitude) };
};

const parseSavedLocations = (raw?: string): City[] => {
  if (!raw) return [];
  return raw
    .split(LOC_DELIM)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, lon, lat] = entry.split(PARAM_DELIM).map((part) => part.trim());
      const city = normalizeCity(name, Number(lon), Number(lat));
      return city;
    })
    .filter((city): city is City => !!city);
};

const mergeCities = (existing: City[], incoming: City[]) => {
  const merged = [...existing];
  for (const city of incoming) {
    if (!merged.some((item) => isClose(item, city))) {
      merged.push(city);
    }
  }
  return merged;
};

export const migrateLegacyCities = async () => {
  if (Platform.OS !== 'android') return false;
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done === 'true') return false;

  const module = (NativeModules as any)?.LegacyPrefs;
  if (!module?.getLegacyPrefs) {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    return false;
  }

  let data: LegacyPrefs | null = null;
  try {
    data = await module.getLegacyPrefs();
  } catch {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    return false;
  }

  if (!data) {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    return false;
  }

  const legacySelected = normalizeCity(data.city, data.longitude, data.latitude);
  const legacySaved = parseSavedLocations(data.citySaved);
  const existingCustom = await getStoredCustomCities();
  const existingCustomCities = existingCustom.map(({ id, ...city }) => city);
  const mergedCustom = mergeCities(existingCustomCities, legacySaved);

  if (mergedCustom.length !== existingCustomCities.length) {
    const mapped = mergedCustom.map((city, index) => ({
      id: existingCustom[index]?.id ?? `legacy-${Date.now()}-${index}`,
      ...city,
    }));
    await setStoredCustomCities(mapped);
  }

  const currentCity = await getStoredCity();
  if (!currentCity && legacySelected) {
    await setStoredCity(legacySelected);
  }

  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  return true;
};
