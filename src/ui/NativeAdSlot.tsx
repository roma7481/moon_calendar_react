import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  NativeSlot,
  useAdProvider,
} from '../services/adProvider';
import { colors } from './theme';

type Props = {
  adUnitId: string;
};

const NativeAdSlot: React.FC<Props> = ({ adUnitId }) => {
  const provider = useAdProvider();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(true);
  const adRef = useRef<NativeAd | null>(null);

  useEffect(() => {
    if (provider === 'applovin') {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const loadAd = async () => {
      try {
        setLoading(true);
        const ad = await NativeAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: false,
        });
        if (isMounted) {
          adRef.current?.destroy();
          adRef.current = ad;
          setNativeAd(ad);
          setLoading(false);
        }
      } catch (err) {
        console.error('NativeAd load error:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadAd();

    return () => {
      isMounted = false;
      adRef.current?.destroy();
      adRef.current = null;
    };
  }, [adUnitId, provider]);

  if (provider === 'applovin') {
    return <NativeSlot />;
  }

  if (loading || !nativeAd) return null;

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.row}>
        {nativeAd.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.texts}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.title}>{nativeAd.headline}</Text>
          </NativeAsset>
          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.subtitle}>{nativeAd.body}</Text>
            </NativeAsset>
          ) : null}
        </View>
        <Text style={styles.adBadge}>Ad</Text>
      </View>
      {nativeAd.mediaContent ? <NativeMediaView style={styles.media} /> : null}
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Text style={styles.cta}>{(nativeAd.callToAction || 'Open').toUpperCase()}</Text>
      </NativeAsset>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff30',
    padding: 12,
    marginVertical: 10,
    backgroundColor: '#ffffff12',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  texts: { flex: 1 },
  title: {
    color: colors.white,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.whiteMuted,
    marginTop: 2,
  },
  adBadge: {
    color: colors.whiteMuted,
    borderWidth: 1,
    borderColor: '#ffffff30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 10,
    marginLeft: 8,
  },
  media: {
    marginTop: 8,
    width: '100%',
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cta: {
    marginTop: 8,
    color: colors.white,
    fontWeight: '700',
  },
});

export default NativeAdSlot;
