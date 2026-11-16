import { describe, expect, it } from 'vitest';
import {
  parseDevicectlDevices,
  parseIdbApps,
  parseIdbTargets,
  parseIdeviceInstallerList,
} from '../ios';

describe('iOS bridge parsers', () => {
  it('parses idb targets and filters simulators', () => {
    const raw = JSON.stringify([
      {
        udid: '00008110-000A',
        name: 'Dan’s iPhone',
        target_type: 'device',
        os_version: '18.2',
        model: 'iPhone17,1',
        state: 'connected',
      },
      { udid: 'SIM-1', name: 'iPhone 16', target_type: 'simulator', os_version: '18.2' },
    ]);
    const devices = parseIdbTargets(raw);
    expect(devices).toHaveLength(1);
    expect(devices[0].udid).toBe('00008110-000A');
    expect(devices[0].name).toBe('Dan’s iPhone');
    expect(devices[0].osVersion).toBe('iOS 18.2');
    expect(devices[0].model).toBe('iPhone 16 Pro');
  });

  it('returns an empty list for malformed idb output', () => {
    expect(parseIdbTargets('not json')).toEqual([]);
  });

  it('parses devicectl device JSON', () => {
    const raw = JSON.stringify({
      result: {
        devices: [
          {
            identifier: '00008120-001',
            hardwareProperties: { productType: 'iPhone16,1', marketingName: 'iPhone 15 Pro' },
            deviceProperties: { name: 'Studio iPhone', osVersionNumber: '17.5' },
            connectionProperties: { transportType: 'wired', paired: true },
          },
        ],
      },
    });
    const devices = parseDevicectlDevices(raw);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      udid: '00008120-001',
      name: 'Studio iPhone',
      model: 'iPhone 15 Pro',
      osVersion: 'iOS 17.5',
      connection: 'usb',
      state: 'online',
    });
  });

  it('parses idb app listings', () => {
    const raw = JSON.stringify([
      { bundle_id: 'com.spotify.client', name: 'Spotify', type: 'user', version: '9.0' },
      { bundle_id: 'com.apple.mobilesafari', name: 'Safari', type: 'system' },
    ]);
    expect(parseIdbApps(raw)).toEqual([
      { bundleId: 'com.spotify.client', name: 'Spotify', version: '9.0', system: false },
      { bundleId: 'com.apple.mobilesafari', name: 'Safari', version: null, system: true },
    ]);
  });

  it('parses ideviceinstaller CSV output', () => {
    const raw = [
      'CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName',
      'com.spotify.client, 9.0.1, Spotify',
      'notion.id, 2.1, Notion',
    ].join('\n');
    expect(parseIdeviceInstallerList(raw)).toEqual([
      { bundleId: 'com.spotify.client', name: 'Spotify', version: '9.0.1', system: false },
      { bundleId: 'notion.id', name: 'Notion', version: '2.1', system: false },
    ]);
  });
});
