import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ConsentFlags } from './ads';

const AppLovinMAXModule = require('react-native-applovin-max');
const AppLovinMAX = AppLovinMAXModule.default || AppLovinMAXModule;
const AdFormat = AppLovinMAXModule.AdFormat || AppLovinMAX.AdFormat;
const AdView = AppLovinMAXModule.AdView || AppLovinMAX.AdView;

const SDK_KEY = 'qnL2sJHf5VT2RFA26vgN2heXM-Lpfdo4FPKD_09zl9TnHlPVSmGcSRPIQKwcsZwKIWCJZ62BtOONX_7JNmPDX_';
const BANNER_ID = 'ccf472bfd1e7b554';
const INTERSTITIAL_ID = '3447e13237c71aa3';
const MREC_ID = 'feb46da04bd99e57';

let isInitialized = false;
const initCallbacks = new Set<(val: boolean) => void>();

export const initAppLovin = async (consent: ConsentFlags) => {
  if (AppLovinMAX && typeof AppLovinMAX.setHasUserConsent === 'function') {
    AppLovinMAX.setHasUserConsent(consent.hasUserConsent);
  }
  if (AppLovinMAX && typeof AppLovinMAX.setIsAgeRestrictedUser === 'function') {
    AppLovinMAX.setIsAgeRestrictedUser(consent.isAgeRestrictedUser);
  }
  if (AppLovinMAX && typeof AppLovinMAX.setDoNotSell === 'function') {
    AppLovinMAX.setDoNotSell(consent.doNotSell);
  }

  try {
    if (AppLovinMAX && typeof AppLovinMAX.initialize === 'function') {
      await AppLovinMAX.initialize(SDK_KEY);
      isInitialized = true;
      initCallbacks.forEach(cb => cb(true));
    }
  } catch (error) {
    // Silently fail to not disrupt user experience
  }
};

export const AppLovinBanner = () => {
  const [initialized, setInitialized] = useState(isInitialized);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInitialized) return;
    const cb = (val: boolean) => setInitialized(val);
    initCallbacks.add(cb);
    return () => {
      initCallbacks.delete(cb);
    };
  }, []);

  if (!initialized || !AdView || !AdFormat) return null;

  return (
    <View style={[styles.bannerWrap, !visible && { height: 0 }]}>
      <AdView
        adUnitId={BANNER_ID}
        adFormat={AdFormat.BANNER}
        style={styles.banner}
        onAdLoaded={() => setVisible(true)}
        onAdLoadFailed={() => setVisible(false)}
      />
    </View>
  );
};

export const AppLovinMrec = () => {
  const [initialized, setInitialized] = useState(isInitialized);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInitialized) return;
    const cb = (val: boolean) => setInitialized(val);
    initCallbacks.add(cb);
    return () => {
      initCallbacks.delete(cb);
    };
  }, []);

  if (!initialized || !AdView || !AdFormat) return null;

  return (
    <View style={[styles.mrecWrap, !visible && { height: 0, marginVertical: 0 }]}>
      <AdView
        adUnitId={MREC_ID}
        adFormat={AdFormat.MREC}
        style={styles.mrec}
        onAdLoaded={() => setVisible(true)}
        onAdLoadFailed={() => setVisible(false)}
      />
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

  const hiddenHandler = () => {
    closeHandlers.forEach((handler) => handler());
  };
  const displayFailedHandler = () => {
    closeHandlers.forEach((handler) => handler());
  };

  if (AppLovinMAX && typeof AppLovinMAX.addEventListener === 'function') {
    AppLovinMAX.addEventListener('OnInterstitialHiddenEvent', hiddenHandler);
    AppLovinMAX.addEventListener('OnInterstitialAdDisplayFailedEvent', displayFailedHandler);
  }

  return {
    load: () => {
      if (AppLovinMAX && typeof AppLovinMAX.loadInterstitial === 'function') {
        AppLovinMAX.loadInterstitial(INTERSTITIAL_ID);
      }
    },
    show: async () => {
      if (AppLovinMAX && typeof AppLovinMAX.isInterstitialReady === 'function') {
        const isReady = await AppLovinMAX.isInterstitialReady(INTERSTITIAL_ID);
        if (isReady) {
          AppLovinMAX.showInterstitial(INTERSTITIAL_ID, undefined, undefined);
        } else {
          AppLovinMAX.loadInterstitial(INTERSTITIAL_ID);
        }
      } else if (AppLovinMAX && typeof AppLovinMAX.showInterstitial === 'function') {
        AppLovinMAX.showInterstitial(INTERSTITIAL_ID, undefined, undefined);
      }
    },
    addAdEventListener: (_type, handler) => {
      closeHandlers.add(handler);
      return {
        remove: () => closeHandlers.delete(handler),
      };
    },
    removeAllListeners: () => {
      closeHandlers.clear();
      if (AppLovinMAX && typeof AppLovinMAX.removeEventListener === 'function') {
        AppLovinMAX.removeEventListener('OnInterstitialHiddenEvent', hiddenHandler);
        AppLovinMAX.removeEventListener('OnInterstitialAdDisplayFailedEvent', displayFailedHandler);
      }
    },
  };
};

const styles = StyleSheet.create({
  bannerWrap: {
    alignItems: 'center',
    width: '100%',
    height: 50,
    overflow: 'hidden',
  },
  banner: {
    width: '100%',
    height: 50,
  },
  mrecWrap: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
    height: 250,
    overflow: 'hidden',
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
