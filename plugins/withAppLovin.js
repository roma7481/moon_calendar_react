const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const withAppLovinAndroid = (config, sdkKey) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application?.[0];
    if (!mainApplication) return config;

    let metaData = mainApplication['meta-data'] || [];
    const hasKey = metaData.some((item) => item?.$?.['android:name'] === 'applovin.sdk.key');

    if (!hasKey && sdkKey) {
      metaData.push({
        $: {
          'android:name': 'applovin.sdk.key',
          'android:value': sdkKey,
        },
      });
      mainApplication['meta-data'] = metaData;
    }

    return config;
  });
};

const withAppLovinIOS = (config, sdkKey) => {
  return withInfoPlist(config, (config) => {
    config.modResults.AppLovinSdkKey = sdkKey;
    return config;
  });
};

const withAppLovin = (config, props = {}) => {
  const sdkKey = props.androidSdkKey || props.sdkKey;
  config = withAppLovinAndroid(config, sdkKey);
  config = withAppLovinIOS(config, sdkKey);
  return config;
};

module.exports = withAppLovin;
