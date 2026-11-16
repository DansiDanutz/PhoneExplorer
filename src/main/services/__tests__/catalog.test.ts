import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_BY_ID,
  findAppByPackage,
  searchCatalog,
  storeLink,
} from '../../../shared/catalog';
import { DemoDevice } from '../demo';

describe('catalog and store links', () => {
  it('has unique ids and valid store identifiers', () => {
    const ids = new Set(CATALOG.map((app) => app.id));
    expect(ids.size).toBe(CATALOG.length);
    for (const app of CATALOG) {
      expect(app.androidPackage).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i);
      expect(app.iosAppId).toMatch(/^\d+$/);
      expect(app.iosBundleId.length).toBeGreaterThan(3);
    }
  });

  it('finds apps by either platform id', () => {
    expect(findAppByPackage('com.spotify.music')?.id).toBe('spotify');
    expect(findAppByPackage('com.spotify.client')?.id).toBe('spotify');
    expect(findAppByPackage('com.not.a.real.app')).toBeNull();
  });

  it('searches name, publisher, category and tagline', () => {
    expect(searchCatalog('spotify').map((app) => app.id)).toContain('spotify');
    expect(searchCatalog('music').map((app) => app.id)).toContain('spotify');
    expect(searchCatalog('Meta Platforms').map((app) => app.id)).toContain('instagram');
    expect(searchCatalog('zzzz')).toHaveLength(0);
  });

  it('builds Android app, search and home links', () => {
    expect(storeLink({ platform: 'android', appId: 'spotify' })).toEqual({
      deep: 'market://details?id=com.spotify.music',
      web: 'https://play.google.com/store/apps/details?id=com.spotify.music',
    });
    expect(storeLink({ platform: 'android', query: 'note app' }).deep).toBe(
      'market://search?q=note%20app',
    );
    expect(storeLink({ platform: 'android' }).deep).toBe('market://');
  });

  it('builds iOS app, search and home links', () => {
    expect(storeLink({ platform: 'ios', appId: 'spotify' }).deep).toBe(
      'itms-apps://apps.apple.com/app/id324684580',
    );
    expect(storeLink({ platform: 'ios', query: 'spotify' }).deep).toBe(
      'itms-apps://itunes.apple.com/search?term=spotify&entity=software',
    );
    expect(storeLink({ platform: 'ios' }).web).toBe('https://apps.apple.com');
  });
});

describe('demo install state machine', () => {
  it('installs, exposes the app on home and launches it', () => {
    const device = new DemoDevice('android');
    const start = 1_000_000;
    expect(device.isInstalled('spotify')).toBe(false);
    expect(device.startInstall('spotify', start)).toBe(true);

    const midway = device.tick(start + 400);
    expect(midway.install?.phase).toBe('downloading');
    expect(midway.completedAppId).toBeUndefined();

    const done = device.tick(start + 4000);
    expect(done.completedAppId).toBe('spotify');
    expect(device.isInstalled('spotify')).toBe(true);
    expect(device.openApp('spotify')).toBe(true);

    const frame = device.render(start + 4100);
    expect(frame.svg).toContain('Midnight City');
    expect(frame.hotspots.some((spot) => spot.label === 'Back to home screen')).toBe(true);
  });

  it('does not launch an app that is not installed', () => {
    const device = new DemoDevice('ios');
    expect(device.isInstalled('slack')).toBe(false);
    expect(device.openApp('slack')).toBe(false);
    expect(device.openPackage('com.tinyspeck.chatlyio')).toBe(false);
  });

  it('searches the simulated store and can show no results', () => {
    const device = new DemoDevice('android');
    device.search('duolingo');
    const state = device.render(2_000_000);
    expect(state.svg).toContain('Results for');
    expect(state.svg).toContain('Duolingo');

    device.search('zzzz');
    const empty = device.render(2_000_100);
    expect(empty.svg).toContain('No results for');
  });

  it('keeps an install running when the user browses the store', () => {
    const device = new DemoDevice('android');
    const start = 3_000_000;
    device.startInstall('netflix', start);
    device.openStore();
    device.tick(start + 500);
    const done = device.tick(start + 10_000);
    expect(done.completedAppId).toBe('netflix');
    expect(device.isInstalled('netflix')).toBe(true);
    expect(CATALOG_BY_ID.netflix.scene).toBe('video');
  });
});
