import React, { useEffect, useState } from 'react';
import type { ConsentFlags } from './ads';
import * as Admob from './ads';
import { AppLovinBanner, AppLovinMrec, createAppLovinInterstitial, initAppLovin } from './applovin';
import { getSimCountryCode } from './telephony/simCountry';

export type AdProvider = 'admob' | 'applovin';

export const AdEventType = {
  CLOSED: 'closed',
} as const;

type CloseEvent = typeof AdEventType.CLOSED;

type InterstitialController = {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (type: CloseEvent, handler: () => void) => { remove: () => void };
  removeAllListeners: () => void;
};

let provider: AdProvider = 'admob';
const listeners = new Set<() => void>();

const setProvider = (next: AdProvider) => {
  provider = next;
  listeners.forEach((listener) => listener());
};

export const getAdProvider = () => provider;

export const useAdProvider = () => {
  const [current, setCurrent] = useState<AdProvider>(provider);
  useEffect(() => {
    const listener = () => setCurrent(provider);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return current;
};

const APPLOVIN_COUNTRIES = new Set(['ru']);

const detectProvider = async () => {
  const sim = await getSimCountryCode();

  if (sim && APPLOVIN_COUNTRIES.has(sim)) {
    return 'applovin' as AdProvider;
  }

  return 'admob' as AdProvider;
};

export const initAds = async () => {
  try {
    const consent = await Admob.requestConsent();
    const nextProvider = await detectProvider();

    setProvider(nextProvider);

    if (nextProvider === 'applovin') {
      await initAppLovin(consent);
    } else {
      await Admob.initAds(consent);
    }

    return nextProvider;
  } catch (error) {
    throw error;
  }
};

export const createInterstitial = (): InterstitialController => {
  if (provider === 'applovin') {
    return createAppLovinInterstitial();
  }
  const interstitial = Admob.createInterstitial();
  return {
    load: () => interstitial.load(),
    show: () => interstitial.show(),
    addAdEventListener: (_type, handler) => interstitial.addAdEventListener(Admob.AdEventType.CLOSED, handler),
    removeAllListeners: () => interstitial.removeAllListeners(),
  };
};

export const Banner = (props: { width?: number }) => {
  const current = useAdProvider();
  if (current === 'applovin') return <AppLovinBanner />;
  return <Admob.Banner unitId={Admob.bannerUnitId} size={Admob.bannerSize} width={props.width} />;
};

export const NativeSlot = () => {
  const current = useAdProvider();
  if (current === 'applovin') return <AppLovinMrec />;
  return null;
};

export const bannerSize = Admob.bannerSize;
export const bannerUnitId = Admob.bannerUnitId;
export const nativeUnitId = Admob.nativeUnitId;
export const NativeAd = Admob.NativeAd;
export const NativeAdView = Admob.NativeAdView;
export const NativeMediaView = Admob.NativeMediaView;
export const NativeAsset = Admob.NativeAsset;
export const NativeAssetType = Admob.NativeAssetType;
