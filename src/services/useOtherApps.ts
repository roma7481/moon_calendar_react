import { useCallback, useEffect, useState } from 'react';
import { getOtherApps, OtherApp } from './otherApps';

export const useOtherApps = (locale: string) => {
  const [apps, setApps] = useState<OtherApp[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOtherApps(locale);
      if (!data.length && locale !== 'en') {
        const fallback = await getOtherApps('en');
        setApps(fallback);
      } else {
        setApps(data);
      }
    } catch {
      if (locale !== 'en') {
        try {
          const fallback = await getOtherApps('en');
          setApps(fallback);
        } catch {
          setApps([]);
        }
      } else {
        setApps([]);
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  return { apps, loading, reload: load };
};
