import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mediq.app',
  appName: 'MediQ',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true
    }
  },
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'checkout.razorpay.com',
      'api.razorpay.com',
      '*.razorpay.com',
      'https://*.razorpay.com'
    ]
  },
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
};

export default config;
