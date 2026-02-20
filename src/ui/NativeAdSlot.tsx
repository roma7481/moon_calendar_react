import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
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
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : (
            <View style={[styles.icon, { backgroundColor: colors.glass }]} />
          )}
        </View>

        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.title} numberOfLines={1}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>AD</Text>
            </View>
          </View>

          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.subtitle} numberOfLines={2}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          ) : null}
        </View>
      </View>

      {nativeAd.mediaContent ? (
        <View style={styles.mediaContainer}>
          <NativeMediaView style={styles.media} />
        </View>
      ) : null}

      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <View style={styles.ctaButton}>
          <Text style={styles.ctaText}>
            {(nativeAd.callToAction || 'Learn More').toUpperCase()}
          </Text>
        </View>
      </NativeAsset>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    marginVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  iconWrapper: {
    marginRight: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  texts: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  subtitle: {
    color: colors.whiteSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  adBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  adBadgeText: {
    color: colors.whiteMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  mediaContainer: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  media: {
    width: '100%',
    aspectRatio: 1.77, // Standard 16:9 aspect ratio
  },
  ctaButton: {
    backgroundColor: colors.jade,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.jade,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default NativeAdSlot;
