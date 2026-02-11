const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const moduleTemplate = (packageName) => `package ${packageName}

import android.content.SharedPreferences
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LegacyPrefsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LegacyPrefs"

  @ReactMethod
  fun getLegacyPrefs(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences("APP_PREFS", 0)
      if (prefs.all.isEmpty()) {
        promise.resolve(null)
        return
      }

      val map = Arguments.createMap()
      val city = prefs.getString("CITY", null)
      if (!city.isNullOrBlank()) {
        map.putString("city", city)
      }

      val longitude = readDouble(prefs, "LONGTITUDE")
      if (longitude != null && longitude.isFinite()) {
        map.putDouble("longitude", longitude)
      }

      val latitude = readDouble(prefs, "LATITUDE")
      if (latitude != null && latitude.isFinite()) {
        map.putDouble("latitude", latitude)
      }

      val citySaved = prefs.getString("CITY_SAVED", null)
      if (!citySaved.isNullOrBlank()) {
        map.putString("citySaved", citySaved)
      }

      if (map.toHashMap().isEmpty()) {
        promise.resolve(null)
      } else {
        promise.resolve(map)
      }
    } catch (e: Exception) {
      promise.reject("LEGACY_PREFS_ERROR", e)
    }
  }

  private fun readDouble(prefs: SharedPreferences, key: String): Double? {
    if (!prefs.contains(key)) return null
    val value = prefs.all[key] ?: return null
    return when (value) {
      is Long -> java.lang.Double.longBitsToDouble(value)
      is Int -> java.lang.Double.longBitsToDouble(value.toLong())
      is String -> {
        val asLong = value.toLongOrNull()
        if (asLong != null) {
          java.lang.Double.longBitsToDouble(asLong)
        } else {
          value.toDoubleOrNull()
        }
      }
      is Float -> value.toDouble()
      is Double -> value
      else -> null
    }
  }
}
`;

const packageTemplate = (packageName) => `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LegacyPrefsPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext) =
    listOf(LegacyPrefsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

const ensureLegacyPackage = (contents, packageName) => {
  if (contents.includes('LegacyPrefsPackage')) return contents;

  const importLine = `import ${packageName}.LegacyPrefsPackage`;
  const lines = contents.split('\n');
  const lastImportIndex = [...lines]
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith('import '))
    .pop();

  if (lastImportIndex) {
    lines.splice(lastImportIndex.index + 1, 0, importLine);
  } else {
    const packageIndex = lines.findIndex((line) => line.startsWith('package '));
    if (packageIndex >= 0) {
      lines.splice(packageIndex + 1, 0, '', importLine);
    }
  }

  contents = lines.join('\n');

  const packageBlock = 'PackageList(this).packages.apply {';
  if (contents.includes(packageBlock)) {
    contents = contents.replace(
      packageBlock,
      `${packageBlock}\n              add(LegacyPrefsPackage())`
    );
  }

  return contents;
};

const withLegacyPrefs = (config) => {
  const packageName = config.android?.package || 'com.crbee.mooncalendar';
  const packagePath = packageName.replace(/\./g, '/');

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const appRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(appRoot, 'app/src/main/java', packagePath);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'LegacyPrefsModule.kt'), moduleTemplate(packageName));
      fs.writeFileSync(path.join(targetDir, 'LegacyPrefsPackage.kt'), packageTemplate(packageName));
      return config;
    },
  ]);

  config = withMainApplication(config, (config) => {
    config.modResults.contents = ensureLegacyPackage(config.modResults.contents, packageName);
    return config;
  });

  return config;
};

module.exports = withLegacyPrefs;
