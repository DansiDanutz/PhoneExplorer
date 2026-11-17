import type { CatalogApp } from './types';

/**
 * A small, hand-picked catalog. Store metadata is intentionally kept on the
 * desktop side so we can deep-link into the real store and detect installs by
 * package / bundle id. Icons are original monograms, not third-party artwork.
 */
export const CATALOG: CatalogApp[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    publisher: 'Spotify AB',
    category: 'Music',
    tagline: 'Music for every moment',
    description:
      'Play millions of songs and podcasts. Your library, playlists and recommendations follow you onto the phone.',
    color: '#1ed760',
    ink: '#06210f',
    mark: 'music',
    androidPackage: 'com.spotify.music',
    iosAppId: '324684580',
    iosBundleId: 'com.spotify.client',
    rating: 4.7,
    installs: '1B+',
    size: '84 MB',
    scene: 'music',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    publisher: 'Meta Platforms, Inc.',
    category: 'Social',
    tagline: 'Share moments with your people',
    description:
      'A feed, stories and reels in one place. The demo shows a feed layout so you can judge the screen at a glance.',
    color: '#f24e6a',
    ink: '#2a0710',
    mark: 'camera',
    androidPackage: 'com.instagram.android',
    iosAppId: '389801252',
    iosBundleId: 'com.burbn.instagram',
    rating: 4.5,
    installs: '5B+',
    size: '78 MB',
    scene: 'social',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    publisher: 'WhatsApp LLC',
    category: 'Social',
    tagline: 'Simple, reliable messaging',
    description:
      'Message friends and family across platforms with end-to-end encryption, voice notes and calls.',
    color: '#25d366',
    ink: '#06210f',
    mark: 'chat',
    androidPackage: 'com.whatsapp',
    iosAppId: '310633997',
    iosBundleId: 'net.whatsapp.WhatsApp',
    rating: 4.6,
    installs: '5B+',
    size: '62 MB',
    scene: 'chat',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    publisher: 'Telegram FZ-LLC',
    category: 'Social',
    tagline: 'Fast and secure messaging',
    description:
      'Cloud-based chats, channels and groups with a focus on speed. Great for testing notification layouts.',
    color: '#2aabee',
    ink: '#031a28',
    mark: 'plane',
    androidPackage: 'org.telegram.messenger',
    iosAppId: '686449807',
    iosBundleId: 'ph.telegra.Telegraph',
    rating: 4.6,
    installs: '1B+',
    size: '58 MB',
    scene: 'chat',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    publisher: 'Google LLC',
    category: 'Entertainment',
    tagline: 'Watch, listen, discover',
    description:
      'The world’s video library, with shorts, subscriptions and a full-screen player to check on the mirrored display.',
    color: '#ff2b3a',
    ink: '#2a0206',
    mark: 'play',
    androidPackage: 'com.google.android.youtube',
    iosAppId: '544007664',
    iosBundleId: 'com.google.ios.youtube',
    rating: 4.5,
    installs: '10B+',
    size: '142 MB',
    scene: 'video',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    publisher: 'Google LLC',
    category: 'Travel',
    tagline: 'Navigate your world',
    description:
      'Turn-by-turn navigation, local discovery and live traffic. A good stress test for map rendering and touch input.',
    color: '#34a853',
    ink: '#06210f',
    mark: 'pin',
    androidPackage: 'com.google.android.apps.maps',
    iosAppId: '585027354',
    iosBundleId: 'com.google.Maps',
    rating: 4.4,
    installs: '10B+',
    size: '188 MB',
    scene: 'maps',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    publisher: 'Netflix, Inc.',
    category: 'Entertainment',
    tagline: 'Watch shows and films',
    description:
      'Stream series and movies. The demo puts a player and a continue-watching rail on the phone screen.',
    color: '#e50914',
    ink: '#220204',
    mark: 'film',
    androidPackage: 'com.netflix.mediaclient',
    iosAppId: '363590051',
    iosBundleId: 'com.netflix.Netflix',
    rating: 4.3,
    installs: '1B+',
    size: '96 MB',
    scene: 'video',
  },
  {
    id: 'duolingo',
    name: 'Duolingo',
    publisher: 'Duolingo',
    category: 'Education',
    tagline: 'The fun way to learn',
    description:
      'Bite-sized language lessons with streaks and leagues. A colourful, card-heavy screen for visual checks.',
    color: '#58cc02',
    ink: '#0a2202',
    mark: 'owl',
    androidPackage: 'com.duolingo',
    iosAppId: '570060128',
    iosBundleId: 'com.duolingo.DuolingoMobile',
    rating: 4.7,
    installs: '500M+',
    size: '112 MB',
    scene: 'learning',
  },
  {
    id: 'notion',
    name: 'Notion',
    publisher: 'Notion Labs, Inc.',
    category: 'Productivity',
    tagline: 'One workspace, every idea',
    description:
      'Notes, docs, databases and projects. The demo page shows a document layout with a sidebar and checklist.',
    color: '#f4f1ea',
    ink: '#1a1a1a',
    mark: 'note',
    androidPackage: 'notion.id',
    iosAppId: '1232780281',
    iosBundleId: 'notion.id',
    rating: 4.4,
    installs: '10M+',
    size: '68 MB',
    scene: 'notes',
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    publisher: 'Airbnb, Inc.',
    category: 'Travel',
    tagline: 'Find a place to belong',
    description:
      'Stays and experiences around the world. A photography-led screen with search and a booking card.',
    color: '#ff5a5f',
    ink: '#2a0809',
    mark: 'home',
    androidPackage: 'com.airbnb.android',
    iosAppId: '401626263',
    iosBundleId: 'com.airbnb.Airbnb',
    rating: 4.6,
    installs: '100M+',
    size: '124 MB',
    scene: 'travel',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    publisher: 'Google LLC',
    category: 'Productivity',
    tagline: 'Email that gets it',
    description:
      'Google’s mail client with smart replies and unified inboxes. A dense list layout to test text legibility.',
    color: '#ea4335',
    ink: '#2a0604',
    mark: 'mail',
    androidPackage: 'com.google.android.gm',
    iosAppId: '422689480',
    iosBundleId: 'com.google.Gmail',
    rating: 4.3,
    installs: '10B+',
    size: '96 MB',
    scene: 'mail',
  },
  {
    id: 'slack',
    name: 'Slack',
    publisher: 'Slack Technologies',
    category: 'Productivity',
    tagline: 'Where work happens',
    description:
      'Channels, huddles and DMs. Use it to check how a busy workspace reads on a phone-sized screen.',
    color: '#7c3aed',
    ink: '#f7f2ff',
    mark: 'hash',
    androidPackage: 'com.Slack',
    iosAppId: '618783545',
    iosBundleId: 'com.tinyspeck.chatlyio',
    rating: 4.4,
    installs: '50M+',
    size: '104 MB',
    scene: 'workspace',
  },
  {
    id: 'x',
    name: 'X',
    publisher: 'X Corp.',
    category: 'Social',
    tagline: 'What’s happening now',
    description:
      'The real-time public conversation. A timeline screen with media cards for checking scroll performance.',
    color: '#e7e9ea',
    ink: '#0a0a0a',
    mark: 'x',
    androidPackage: 'com.twitter.android',
    iosAppId: '333903271',
    iosBundleId: 'com.atebits.Tweetie2',
    rating: 4.0,
    installs: '1B+',
    size: '72 MB',
    scene: 'social',
  },
  {
    id: 'uber',
    name: 'Uber',
    publisher: 'Uber Technologies, Inc.',
    category: 'Travel',
    tagline: 'Go anywhere, get anything',
    description:
      'Request a ride and track it live. The demo shows a map-led screen with a bottom sheet and fare card.',
    color: '#a6ff00',
    ink: '#0a1000',
    mark: 'car',
    androidPackage: 'com.ubercab',
    iosAppId: '368677368',
    iosBundleId: 'com.ubercab.UberClient',
    rating: 4.2,
    installs: '500M+',
    size: '132 MB',
    scene: 'ride',
  },
  {
    id: 'ggpoker',
    name: 'GGPoker',
    publisher: 'NSUS Limited',
    category: 'Games',
    tagline: 'PlayGG · Real online poker',
    description:
      'The official GGPoker mobile app (PlayGG in Romania). This opens the official Google Play listing or App Store page; the poker table in the demo is only a simulated preview. 18+.',
    color: '#c8ff3d',
    ink: '#0b1407',
    mark: 'game',
    androidPackage: 'com.nsus.poker.prodggpcom',
    iosAppId: '1504833971',
    iosBundleId: 'com.nsus.ggpcom',
    rating: 4.4,
    installs: '10M+',
    size: '120 MB',
    scene: 'poker',
  },
];

export const CATALOG_BY_ID: Record<string, CatalogApp> = Object.fromEntries(
  CATALOG.map((app) => [app.id, app]),
);

export const APP_CATEGORIES = [
  'All',
  ...Array.from(new Set(CATALOG.map((app) => app.category))).sort(),
];

export function findAppByPackage(packageId: string): CatalogApp | null {
  return (
    CATALOG.find(
      (app) => app.androidPackage === packageId || app.iosBundleId === packageId,
    ) ?? null
  );
}

export function searchCatalog(query: string): CatalogApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG;
  return CATALOG.filter((app) =>
    [app.name, app.publisher, app.category, app.tagline]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

export interface StoreTarget {
  platform: 'android' | 'ios';
  appId?: string;
  query?: string;
}

/** Deep links use the platform scheme first; web URLs are the fallback. */
export function storeLink(target: StoreTarget): { deep: string; web: string } {
  if (target.appId) {
    const app = CATALOG_BY_ID[target.appId];
    if (!app) throw new Error(`Unknown app: ${target.appId}`);
    if (target.platform === 'ios') {
      return {
        deep: `itms-apps://apps.apple.com/app/id${app.iosAppId}`,
        web: `https://apps.apple.com/app/id${app.iosAppId}`,
      };
    }
    if (app.storeQuery) {
      const term = encodeURIComponent(app.storeQuery);
      return {
        deep: `market://search?q=${term}`,
        web: `https://play.google.com/store/search?q=${term}&c=apps`,
      };
    }
    return {
      deep: `market://details?id=${app.androidPackage}`,
      web: `https://play.google.com/store/apps/details?id=${app.androidPackage}`,
    };
  }

  if (!target.query?.trim()) {
    if (target.platform === 'ios') {
      return { deep: 'itms-apps://apps.apple.com', web: 'https://apps.apple.com' };
    }
    return { deep: 'market://', web: 'https://play.google.com/store/apps' };
  }

  const term = encodeURIComponent(target.query.trim());
  if (target.platform === 'ios') {
    return {
      deep: `itms-apps://itunes.apple.com/search?term=${term}&entity=software`,
      web: `https://apps.apple.com/us/search?term=${term}`,
    };
  }
  return {
    deep: `market://search?q=${term}`,
    web: `https://play.google.com/store/search?q=${term}&c=apps`,
  };
}
