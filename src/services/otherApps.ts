import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

export type OtherApp = {
  name: string;
  link: string;
  imageLink: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const memoryCache = new Map<string, { ts: number; data: OtherApp[] }>();

const cacheKey = (locale: string, platform: string) => `OTHER_APPS_${locale}_${platform}`;

const sanitize = (input: any): OtherApp | null => {
  if (!input) return null;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const link = typeof input.link === 'string' ? input.link.trim() : '';
  const imageLink = typeof input.imageLink === 'string' ? input.imageLink.trim() : '';
  if (!name || !link || !imageLink) return null;
  if (!/^https:\/\//i.test(imageLink)) return null;
  return { name, link, imageLink };
};

const readCache = async (key: string) => {
  const memory = memoryCache.get(key);
  if (memory && Date.now() - memory.ts < CACHE_TTL_MS) return memory.data;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { ts: number; data: OtherApp[] };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, data: OtherApp[]) => {
  const payload = { ts: Date.now(), data };
  memoryCache.set(key, payload);
  await AsyncStorage.setItem(key, JSON.stringify(payload));
};

export const getOtherApps = async (locale: string) => {
  const platform = Platform.OS;
  const key = cacheKey(locale, platform);
  const cached = await readCache(key);
  if (cached) return cached;

  try {
    const ref = firestore().collection(locale).doc('other_apps').collection(platform);
    const snap = await ref.get();
    const apps: OtherApp[] = [];
    snap.forEach((doc) => {
      const item = sanitize(doc.data());
      if (item) apps.push(item);
    });
    await writeCache(key, apps);
    return apps;
  } catch (err) {
    return [];
  }
};
