import * as Localization from 'expo-localization';
import type { AppLocale } from '../data/content';

export const resolveLocale = (): AppLocale => {
  const locales = Localization.getLocales();
  if (locales?.some((locale) => locale.languageCode === 'ja')) {
    return 'ja';
  }
  if (locales?.some((locale) => locale.languageCode === 'ru')) {
    return 'ru';
  }
  if (Localization.locale?.toLowerCase().startsWith('ja')) {
    return 'ja';
  }
  if (Localization.locale?.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};
