import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Assurance',
  slug: 'assurance-mobile',
  scheme: 'assurance-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.assurance.mobile',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.assurance.mobile',
    allowBackup: false,
    permissions: [],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
  },
  plugins: ['expo-router', 'expo-secure-store'],
};

export default config;
