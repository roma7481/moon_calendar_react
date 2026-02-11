import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentDebugGeography,
  NativeAd,
  NativeAdView,
  NativeMediaView,
  NativeAsset,
  NativeAssetType,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

const BANNER_ID = 'ca-app-pub-1763151471947181/4488525419';
const INTERSTITIAL_ID = 'ca-app-pub-1763151471947181/6101909117';
const NATIVE_ID = 'ca-app-pub-1763151471947181/9567480902';

export type ConsentFlags = {
  hasUserConsent: boolean;
  isAgeRestrictedUser: boolean;
  doNotSell: boolean;
};

export const requestConsent = async (): Promise<ConsentFlags> => {
  await AdsConsent.requestInfoUpdate({
    debugGeography: __DEV__ ? AdsConsentDebugGeography.EEA : AdsConsentDebugGeography.DISABLED,
  });

  const info = await AdsConsent.getConsentInfo();
  const needsConsent = info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN;

  if (needsConsent) {
    try {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    } catch (e) {
      console.error('AdsConsent error:', e);
    }
  }

  const { canRequestAds } = await AdsConsent.getConsentInfo();
  return {
    hasUserConsent: !!canRequestAds,
    isAgeRestrictedUser: false,
    doNotSell: false,
  };
};

export const initAds = async (consent?: ConsentFlags) => {
  const flags = consent ?? (await requestConsent());
  await mobileAds().setRequestConfiguration({
    tagForChildDirectedTreatment: flags.isAgeRestrictedUser,
    tagForUnderAgeOfConsent: flags.isAgeRestrictedUser,
    maxAdContentRating: MaxAdContentRating.PG,
  });
  await mobileAds().initialize();
};

export const createInterstitial = () => InterstitialAd.createForAdRequest(INTERSTITIAL_ID);

export const Banner = BannerAd;
export const bannerSize = BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
export const bannerUnitId = BANNER_ID;
export const nativeUnitId = NATIVE_ID;
export { NativeAd, NativeAdView, NativeMediaView, NativeAsset, NativeAssetType, AdEventType };
