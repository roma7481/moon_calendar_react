import * as Cellular from 'expo-cellular';
import * as Localization from 'expo-localization';

export const getSimCountryCode = async (): Promise<string | null> => {
  const sim = Cellular.isoCountryCode;
  return sim ? String(sim).toLowerCase() : null;
};

export const getRegionCode = (): string | null => {
  const locales = Localization.getLocales();
  const region = locales?.[0]?.regionCode;
  return region ? String(region).toLowerCase() : null;
};
