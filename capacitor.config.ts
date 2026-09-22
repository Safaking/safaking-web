import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.safaking.app',
  appName: 'SafaKing',
  // The app loads the live site (server.url — it is SSR with API routes), so
  // the bundled folder holds only what must work without the internet: the
  // "no connection" screen. Bundling public/ made the APK 40 MB.
  webDir: 'native-shell',
  // Lets the server tell app visits apart in logs and analytics.
  appendUserAgent: 'SafaKingApp',
  backgroundColor: '#2D060E',
  server: {
    url: 'https://www.safaking.in',
    cleartext: false,
    // Shown instead of the WebView's own error page when the site cannot load.
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
