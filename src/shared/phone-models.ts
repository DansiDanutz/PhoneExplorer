import type { NewPhoneModel, PhoneModel, PhonePlatform } from './types';

export const DEFAULT_ANDROID_MODEL_ID = 'pixel-9-pro';
export const DEFAULT_IOS_MODEL_ID = 'iphone-16-pro';

/**
 * Demo profiles. These are hardware profiles, not emulators: they set the
 * name, OS, resolution and frame colour used by the interactive demo phone.
 * Screen content is rendered at the demo canvas size on every profile.
 */
export const BUILTIN_PHONE_MODELS: PhoneModel[] = [
  {
    id: 'pixel-9-pro',
    platform: 'android',
    name: 'Pixel 9 Pro',
    manufacturer: 'Google',
    osVersion: '16',
    screen: { width: 1280, height: 2856 },
    displayInches: 6.3,
    frameColor: '#b8b1a3',
    year: 2024,
    builtin: true,
  },
  {
    id: 'pixel-9',
    platform: 'android',
    name: 'Pixel 9',
    manufacturer: 'Google',
    osVersion: '16',
    screen: { width: 1080, height: 2424 },
    displayInches: 6.3,
    frameColor: '#373b3e',
    year: 2024,
    builtin: true,
  },
  {
    id: 'pixel-8a',
    platform: 'android',
    name: 'Pixel 8a',
    manufacturer: 'Google',
    osVersion: '15',
    screen: { width: 1080, height: 2400 },
    displayInches: 6.1,
    frameColor: '#7f9fae',
    year: 2024,
    builtin: true,
  },
  {
    id: 'galaxy-s25-ultra',
    platform: 'android',
    name: 'Galaxy S25 Ultra',
    manufacturer: 'Samsung',
    osVersion: '15',
    screen: { width: 1440, height: 3120 },
    displayInches: 6.9,
    frameColor: '#55585d',
    year: 2025,
    builtin: true,
  },
  {
    id: 'galaxy-s25',
    platform: 'android',
    name: 'Galaxy S25',
    manufacturer: 'Samsung',
    osVersion: '15',
    screen: { width: 1080, height: 2340 },
    displayInches: 6.2,
    frameColor: '#9fb4cc',
    year: 2025,
    builtin: true,
  },
  {
    id: 'galaxy-z-flip-6',
    platform: 'android',
    name: 'Galaxy Z Flip 6',
    manufacturer: 'Samsung',
    osVersion: '15',
    screen: { width: 1080, height: 2640 },
    displayInches: 6.7,
    frameColor: '#d8c9b6',
    year: 2024,
    builtin: true,
  },
  {
    id: 'oneplus-13',
    platform: 'android',
    name: 'OnePlus 13',
    manufacturer: 'OnePlus',
    osVersion: '15',
    screen: { width: 1440, height: 3168 },
    displayInches: 6.82,
    frameColor: '#2e4354',
    year: 2025,
    builtin: true,
  },
  {
    id: 'xiaomi-15',
    platform: 'android',
    name: 'Xiaomi 15',
    manufacturer: 'Xiaomi',
    osVersion: '15',
    screen: { width: 1200, height: 2670 },
    displayInches: 6.36,
    frameColor: '#a8a6a0',
    year: 2025,
    builtin: true,
  },
  {
    id: 'nothing-phone-3',
    platform: 'android',
    name: 'Nothing Phone (3)',
    manufacturer: 'Nothing',
    osVersion: '15',
    screen: { width: 1260, height: 2800 },
    displayInches: 6.67,
    frameColor: '#d9d7d1',
    year: 2025,
    builtin: true,
  },
  {
    id: 'iphone-16-pro',
    platform: 'ios',
    name: 'iPhone 16 Pro',
    manufacturer: 'Apple',
    osVersion: '26.1',
    screen: { width: 1206, height: 2622 },
    displayInches: 6.3,
    frameColor: '#a49d92',
    year: 2024,
    builtin: true,
  },
  {
    id: 'iphone-16-pro-max',
    platform: 'ios',
    name: 'iPhone 16 Pro Max',
    manufacturer: 'Apple',
    osVersion: '26.1',
    screen: { width: 1320, height: 2868 },
    displayInches: 6.9,
    frameColor: '#b99d80',
    year: 2024,
    builtin: true,
  },
  {
    id: 'iphone-16',
    platform: 'ios',
    name: 'iPhone 16',
    manufacturer: 'Apple',
    osVersion: '26.1',
    screen: { width: 1179, height: 2556 },
    displayInches: 6.1,
    frameColor: '#4b5fbf',
    year: 2024,
    builtin: true,
  },
  {
    id: 'iphone-16-plus',
    platform: 'ios',
    name: 'iPhone 16 Plus',
    manufacturer: 'Apple',
    osVersion: '26.1',
    screen: { width: 1290, height: 2796 },
    displayInches: 6.7,
    frameColor: '#e7c7c5',
    year: 2024,
    builtin: true,
  },
  {
    id: 'iphone-16e',
    platform: 'ios',
    name: 'iPhone 16e',
    manufacturer: 'Apple',
    osVersion: '26.1',
    screen: { width: 1170, height: 2532 },
    displayInches: 6.1,
    frameColor: '#e9e6df',
    year: 2025,
    builtin: true,
  },
  {
    id: 'iphone-15-pro',
    platform: 'ios',
    name: 'iPhone 15 Pro',
    manufacturer: 'Apple',
    osVersion: '26',
    screen: { width: 1179, height: 2556 },
    displayInches: 6.1,
    frameColor: '#5a7d80',
    year: 2023,
    builtin: true,
  },
  {
    id: 'iphone-15',
    platform: 'ios',
    name: 'iPhone 15',
    manufacturer: 'Apple',
    osVersion: '26',
    screen: { width: 1179, height: 2556 },
    displayInches: 6.1,
    frameColor: '#3d3e40',
    year: 2023,
    builtin: true,
  },
  {
    id: 'iphone-14',
    platform: 'ios',
    name: 'iPhone 14',
    manufacturer: 'Apple',
    osVersion: '26',
    screen: { width: 1170, height: 2532 },
    displayInches: 6.1,
    frameColor: '#7c90a8',
    year: 2022,
    builtin: true,
  },
  {
    id: 'iphone-13-mini',
    platform: 'ios',
    name: 'iPhone 13 mini',
    manufacturer: 'Apple',
    osVersion: '26',
    screen: { width: 1080, height: 2340 },
    displayInches: 5.4,
    frameColor: '#405e55',
    year: 2021,
    builtin: true,
  },
];

const BUILTIN_IDS = new Set(BUILTIN_PHONE_MODELS.map((model) => model.id));

export function isBuiltinPhoneModel(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

export function defaultPhoneModel(platform: PhonePlatform): PhoneModel {
  const id = platform === 'ios' ? DEFAULT_IOS_MODEL_ID : DEFAULT_ANDROID_MODEL_ID;
  return BUILTIN_PHONE_MODELS.find((model) => model.id === id) as PhoneModel;
}

export function findBuiltinPhoneModel(id: string): PhoneModel | null {
  return BUILTIN_PHONE_MODELS.find((model) => model.id === id) ?? null;
}

export function modelsForPlatform(models: PhoneModel[], platform: PhonePlatform): PhoneModel[] {
  return models.filter((model) => model.platform === platform);
}

export function searchPhoneModels(models: PhoneModel[], query: string): PhoneModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  return models.filter((model) =>
    [
      model.name,
      model.manufacturer,
      model.osVersion,
      `${model.screen.width}x${model.screen.height}`,
      `${model.displayInches}`,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

export function makeCustomModel(
  input: NewPhoneModel,
  existing: PhoneModel[],
  now = Date.now(),
): PhoneModel {
  const base = `${input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)}`;
  let id = `custom-${input.platform}-${base || 'phone'}`;
  if (existing.some((model) => model.id === id)) id = `${id}-${now.toString(36).slice(-4)}`;
  return {
    ...input,
    id,
    builtin: false,
    year: new Date(now).getFullYear(),
  };
}
