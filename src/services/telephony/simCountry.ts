import * as Cellular from 'expo-cellular';

export const getSimCountryCode = async (): Promise<string | null> => {
  const sim = Cellular.isoCountryCode;
  return sim ? String(sim).toLowerCase() : null;
};
