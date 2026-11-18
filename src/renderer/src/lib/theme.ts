export type StageTheme = 'default' | 'earth-orbital';

const STORAGE_KEY = 'phoneexplorer.stageTheme';

export function readStageTheme(): StageTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'earth-orbital'
      ? 'earth-orbital'
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
