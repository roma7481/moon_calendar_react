import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ConsentFlags } from './ads';

const AppLovinMAX: any = (() => {
  try {
    const mod = require('react-native-applovin-max');
    return mod.default || mod;
  } catch {
    return null;
  }
})();

const SDK_KEY = 'qnL2sJHf5VT2RFA26vgN2heXM-Lpfdo4FPKD_09zl9TnHlPVSmGcSRPIQKwcsZwKIWCJZ62BtOONX_7JNmPDX_';
const BANNER_ID = 'ccf472bfd1e7b554';
const INTERSTITIAL_ID = '3447e13237c71aa3';
const MREC_ID = 'feb46da04bd99e57';

export const initAppLovin = async (consent: ConsentFlags) => {
  console.log('[AppLovin] Initializing... AppLovinMAX exists:', !!AppLovinMAX);
  if (AppLovinMAX) {
    console.log('[AppLovin] Members:', Object.keys(AppLovinMAX));
  }
  if (!AppLovinMAX) return;
  if (typeof AppLovinMAX.setHasUserConsent === 'function') {
    AppLovinMAX.setHasUserConsent(consent.hasUserConsent);
  }
  if (typeof AppLovinMAX.setIsAgeRestrictedUser === 'function') {
    AppLovinMAX.setIsAgeRestrictedUser(consent.isAgeRestrictedUser);
  }
  if (typeof AppLovinMAX.setDoNotSell === 'function') {
    AppLovinMAX.setDoNotSell(consent.doNotSell);
  }
  if (typeof AppLovinMAX.initialize === 'function') {
    console.log('[AppLovin] Calling initialize with key:', SDK_KEY.slice(0, 10) + '...');
    return new Promise<void>((resolve) => {
      AppLovinMAX.initialize(SDK_KEY, (configuration: any) => {
        console.log('[AppLovin] Initialization complete. Configuration:', configuration);
        resolve();
      });
    });
  }
};

export const AppLovinBanner = () => {
  if (!AppLovinMAX?.AdView || !AppLovinMAX?.MaxAdFormat) return null;
  return (
    <View style={styles.bannerWrap}>
      <AppLovinMAX.AdView adUnitId={BANNER_ID} adFormat={AppLovinMAX.MaxAdFormat.BANNER} style={styles.banner} />
    </View>
  );
};

export const AppLovinMrec = () => {
  if (!AppLovinMAX?.AdView || !AppLovinMAX?.MaxAdFormat) return null;
  return (
    <View style={styles.mrecWrap}>
      <AppLovinMAX.AdView adUnitId={MREC_ID} adFormat={AppLovinMAX.MaxAdFormat.MREC} style={styles.mrec} />
    </View>
  );
};

export type AppLovinInterstitial = {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (type: 'closed', handler: () => void) => { remove: () => void };
  removeAllListeners: () => void;
};

export const createAppLovinInterstitial = (): AppLovinInterstitial => {
  const closeHandlers = new Set<() => void>();
  let removeHiddenListener: (() => void) | null = null;

  if (AppLovinMAX?.addInterstitialHiddenEventListener) {
    const sub = AppLovinMAX.addInterstitialHiddenEventListener(() => {
      closeHandlers.forEach((handler) => handler());
    });
    removeHiddenListener = () => sub?.remove?.();
  }

  return {
    load: () => {
      AppLovinMAX?.loadInterstitial?.(INTERSTITIAL_ID);
    },
    show: async () => {
      await AppLovinMAX?.showInterstitial?.(INTERSTITIAL_ID);
    },
    addAdEventListener: (_type, handler) => {
      closeHandlers.add(handler);
      return {
        remove: () => closeHandlers.delete(handler),
      };
    },
    removeAllListeners: () => {
      closeHandlers.clear();
      removeHiddenListener?.();
    },
  };
};

const styles = StyleSheet.create({
  bannerWrap: {
    alignItems: 'center',
    width: '100%',
  },
  banner: {
    width: '100%',
    height: 50,
  },
  mrecWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  mrec: {
    width: 300,
    height: 250,
  },
});

export const applovinUnitIds = {
  banner: BANNER_ID,
  interstitial: INTERSTITIAL_ID,
  mrec: MREC_ID,
};
