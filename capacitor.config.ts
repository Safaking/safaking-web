import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.safaking.app',
  appName: 'SafaKing',
  // Required by the CLI but unused — server.url below loads the live site
  // instead of a bundled static export (this app is SSR with API routes).
  webDir: 'public',
  server: {
    url: 'https://www.safaking.in',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
