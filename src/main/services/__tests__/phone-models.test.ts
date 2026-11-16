import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PHONE_MODELS,
  DEFAULT_ANDROID_MODEL_ID,
  DEFAULT_IOS_MODEL_ID,
  defaultPhoneModel,
  findBuiltinPhoneModel,
  isBuiltinPhoneModel,
  makeCustomModel,
  modelsForPlatform,
  searchPhoneModels,
} from '../../../shared/phone-models';
import { DemoDevice } from '../demo';

describe('phone model catalog', () => {
  it('has unique ids and both platforms', () => {
    const ids = new Set(BUILTIN_PHONE_MODELS.map((model) => model.id));
    expect(ids.size).toBe(BUILTIN_PHONE_MODELS.length);
    expect(BUILTIN_PHONE_MODELS.filter((model) => model.platform === 'android').length).toBeGreaterThan(5);
    expect(BUILTIN_PHONE_MODELS.filter((model) => model.platform === 'ios').length).toBeGreaterThan(5);
    for (const model of BUILTIN_PHONE_MODELS) {
      expect(model.builtin).toBe(true);
      expect(model.screen.width).toBeGreaterThan(300);
      expect(model.screen.height).toBeGreaterThan(400);
      expect(model.frameColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has a valid default for each platform', () => {
    const android = defaultPhoneModel('android');
    const ios = defaultPhoneModel('ios');
    expect(android.id).toBe(DEFAULT_ANDROID_MODEL_ID);
    expect(ios.id).toBe(DEFAULT_IOS_MODEL_ID);
    expect(android.platform).toBe('android');
    expect(ios.platform).toBe('ios');
    expect(isBuiltinPhoneModel(DEFAULT_ANDROID_MODEL_ID)).toBe(true);
    expect(findBuiltinPhoneModel('nope')).toBeNull();
  });

  it('filters by platform and searches name, brand and size', () => {
    expect(modelsForPlatform(BUILTIN_PHONE_MODELS, 'ios').every((model) => model.platform === 'ios')).toBe(true);
    expect(searchPhoneModels(BUILTIN_PHONE_MODELS, 'galaxy').length).toBe(3);
    expect(searchPhoneModels(BUILTIN_PHONE_MODELS, 'apple').length).toBeGreaterThan(5);
    expect(searchPhoneModels(BUILTIN_PHONE_MODELS, '6.9').some((model) => model.id === 'galaxy-s25-ultra')).toBe(true);
    expect(searchPhoneModels(BUILTIN_PHONE_MODELS, 'zzzz')).toEqual([]);
  });

  it('creates stable custom ids and avoids collisions', () => {
    const input = {
      platform: 'android' as const,
      name: 'Aurora X',
      manufacturer: 'Northstar',
      osVersion: '17',
      screen: { width: 1200, height: 2600 },
      displayInches: 6.4,
      frameColor: '#123456',
    };
    const first = makeCustomModel(input, BUILTIN_PHONE_MODELS, 1_000);
    expect(first.id).toBe('custom-android-aurora-x');
    expect(first.builtin).toBe(false);
    const second = makeCustomModel(input, [...BUILTIN_PHONE_MODELS, first], 2_000);
    expect(second.id).not.toBe(first.id);
  });

  it('carries a selected profile into the demo device', () => {
    const model = findBuiltinPhoneModel('galaxy-s25-ultra');
    expect(model).not.toBeNull();
    const device = new DemoDevice('android', model!);
    const info = device.info();
    expect(info.name).toBe('Galaxy S25 Ultra');
    expect(info.modelId).toBe('galaxy-s25-ultra');
    expect(info.resolution).toEqual({ width: 1440, height: 3120 });
    expect(info.displayInches).toBe(6.9);
    expect(info.frameColor).toBe('#55585d');

    device.setModel(defaultPhoneModel('android'));
    expect(device.info().name).toBe('Pixel 9 Pro');
    expect(device.render().svg).toContain('<svg');
  });
});
