import orbitalImage from '../assets/themes/earth-beyond-the-orbital-window.png';
import auroraImage from '../assets/themes/aurora-drift.png';
import emberImage from '../assets/themes/ember-horizon.png';

export type StageTheme = 'default' | 'earth-orbital' | 'aurora-drift' | 'ember-horizon';

export interface StageThemeOption {
  id: Exclude<StageTheme, 'default'>;
  name: string;
  subtitle: string;
  badge: string;
  image: string;
  objectPosition: string;
}

export const STAGE_THEMES: StageThemeOption[] = [
  {
    id: 'earth-orbital',
    name: 'Earth Beyond the Orbital Window',
    subtitle: 'Orbital · deep space',
    badge: 'Theme 01',
    image: orbitalImage,
    objectPosition: 'center 62%',
  },
  {
    id: 'aurora-drift',
    name: 'Aurora Drift',
    subtitle: 'Aurora · polar sky',
    badge: 'Theme 02',
    image: auroraImage,
    objectPosition: 'center 48%',
  },
  {
    id: 'ember-horizon',
    name: 'Ember Horizon',
    subtitle: 'Ember · dusk horizon',
    badge: 'Theme 03',
    image: emberImage,
    objectPosition: 'center 55%',
  },
];

const STORAGE_KEY = 'phoneexplorer.stageTheme';

export function themeOption(theme: StageTheme): StageThemeOption | null {
  return STAGE_THEMES.find((option) => option.id === theme) ?? null;
}

export function readStageTheme(): StageTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return STAGE_THEMES.some((option) => option.id === stored)
      ? (stored as StageTheme)
      : 'default';
  } catch {
    return 'default';
  }
}

export function writeStageTheme(theme: StageTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // A locked-down renderer should still be able to switch themes for this session.
  }
}
