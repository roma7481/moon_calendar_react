import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LAUNCHES: 'RATE_US_LAUNCHES',
  DONT_SHOW: 'RATE_US_DONT_SHOW',
};

const MIN_LAUNCHES = 8;
const REMIND_LAUNCHES = 8;

const getLaunchCount = async () => {
  const value = await AsyncStorage.getItem(KEYS.LAUNCHES);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const setLaunchCount = async (count: number) => {
  await AsyncStorage.setItem(KEYS.LAUNCHES, String(count));
};

export const getDoNotShowAgain = async () => {
  const value = await AsyncStorage.getItem(KEYS.DONT_SHOW);
  return value === 'true';
};

export const setDoNotShowAgain = async (value: boolean) => {
  await AsyncStorage.setItem(KEYS.DONT_SHOW, String(value));
};

export const recordLaunchAndShouldShow = async () => {
  const doNotShow = await getDoNotShowAgain();
  if (doNotShow) return { shouldShow: false, launches: 0 };
  const launches = (await getLaunchCount()) + 1;
  await setLaunchCount(launches);
  return { shouldShow: launches === MIN_LAUNCHES, launches };
};

export const remindLater = async () => {
  const launches = await getLaunchCount();
  const next = Math.max(0, launches - REMIND_LAUNCHES);
  await setLaunchCount(next);
};

