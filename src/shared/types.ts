/**
 * Types shared between the Electron main process, the preload bridge and the
 * React renderer. Keep this module free of Node and DOM imports.
 */

export type PhonePlatform = 'android' | 'ios';
export type DeviceConnection = 'usb' | 'wifi' | 'virtual';
export type DeviceStatus = 'online' | 'unauthorized' | 'offline' | 'connecting' | 'error';

/** How input is injected into the active phone. */
export type ControlEngine = 'scrcpy' | 'adb' | 'idb' | 'demo';

export type Capability =
  | 'mirror'
  | 'input'
  | 'store'
  | 'launch'
  | 'installFile'
  | 'installedApps';

export interface DeviceCapabilities {
  mirror: boolean;
  input: boolean;
  store: boolean;
  launch: boolean;
  installFile: boolean;
  installedApps: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  platform: PhonePlatform;
  osVersion: string;
  connection: DeviceConnection;
  status: DeviceStatus;
  serial: string;
  resolution: { width: number; height: number } | null;
  battery: number | null;
  isDemo: boolean;
  /** Present on demo devices: the selected hardware profile. */
  modelId?: string;
  frameColor?: string;
  displayInches?: number;
  controlEngine?: ControlEngine;
  capabilities: DeviceCapabilities;
  /** Short, user-facing explanation when something is degraded. */
  hint: string | null;
}

export type MarkName =
  | 'music'
  | 'camera'
  | 'chat'
  | 'plane'
  | 'play'
  | 'pin'
  | 'film'
  | 'owl'
  | 'game'
  | 'note'
  | 'home'
  | 'car'
  | 'mail'
  | 'hash'
  | 'x'
  | 'grid'
  | 'gear'
  | 'clock'
  | 'cloud'
  | 'phone'
  | 'compass'
  | 'calendar';

export type DemoScene =
  | 'music'
  | 'social'
  | 'chat'
  | 'video'
  | 'maps'
  | 'learning'
  | 'notes'
  | 'travel'
  | 'mail'
  | 'workspace'
  | 'ride';

export interface CatalogApp {
  id: string;
  name: string;
  publisher: string;
  category: string;
  tagline: string;
  description: string;
  color: string;
  ink: string;
  mark: MarkName;
  androidPackage: string;
  iosAppId: string;
  iosBundleId: string;
  rating: number;
  installs: string;
  size: string;
  scene: DemoScene;
}

export interface InstalledApp {
  appId: string | null;
  name: string;
  packageId: string;
  version: string | null;
  system: boolean;
}

export type ActivityLevel = 'info' | 'success' | 'warn' | 'error' | 'device';

export interface ActivityItem {
  id: string;
  ts: number;
  level: ActivityLevel;
  message: string;
  detail?: string;
}

export interface PreviewState {
  active: boolean;
  fps: number;
  paused: boolean;
  seq: number;
  lastFrameAt: number | null;
  width: number | null;
  height: number | null;
}

export interface ToolStatus {
  id: string;
  label: string;
  found: boolean;
  path: string | null;
  hint: string | null;
  url: string | null;
}

export type InstallPhase = 'queued' | 'downloading' | 'installing' | 'done' | 'failed';

export interface InstallProgress {
  appId: string;
  phase: InstallPhase;
  progress: number;
  message: string;
}

export interface PhoneScreen {
  width: number;
  height: number;
}

/** A demo hardware profile, either built in or created by the user. */
export interface PhoneModel {
  id: string;
  platform: PhonePlatform;
  name: string;
  manufacturer: string;
  osVersion: string;
  screen: PhoneScreen;
  displayInches: number;
  frameColor: string;
  year: number;
  builtin: boolean;
}

export type NewPhoneModel = Omit<PhoneModel, 'id' | 'builtin' | 'year'>;

export interface Settings {
  fps: number;
  quality: number;
  autoPreview: boolean;
  adbPath: string;
  demoPlatform: PhonePlatform;
  reduceMotion: boolean;
  invertScroll: boolean;
  customModels: PhoneModel[];
  defaultAndroidModelId: string;
  defaultIosModelId: string;
}

export interface AppState {
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  installed: InstalledApp[];
  catalog: CatalogApp[];
  models: PhoneModel[];
  defaultModels: { android: string; ios: string };
  activity: ActivityItem[];
  preview: PreviewState;
  installs: Record<string, InstallProgress>;
  tools: ToolStatus[];
  settings: Settings;
  version: string;
  platform: string;
  qr: QrPayload | null;
}

export type KeyAction =
  | 'home'
  | 'back'
  | 'recents'
  | 'power'
  | 'wake'
  | 'volume_up'
  | 'volume_down';

export interface FramePayload {
  deviceId: string;
  mime: string;
  data: string;
  width: number;
  height: number;
  seq: number;
  /** Hotspots are only emitted by the built-in demo device. */
  hotspots?: Hotspot[];
}

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action?: string;
  value?: string;
}

export type ServerEvent =
  | { type: 'state'; state: AppState }
  | { type: 'frame'; frame: FramePayload }
  | { type: 'activity'; item: ActivityItem }
  | { type: 'install'; progress: InstallProgress }
  | { type: 'toast'; tone: 'success' | 'error' | 'info'; title: string; body?: string }
  | { type: 'preview'; active: boolean; reason?: string };

export interface PhoneAPI {
  getState(): Promise<AppState>;
  refresh(): Promise<AppState>;
  selectDevice(deviceId: string): Promise<AppState>;
  useDemo(platform: PhonePlatform | null): Promise<AppState>;
  selectDemoModel(platform: PhonePlatform, modelId: string): Promise<AppState>;
  setDefaultModel(platform: PhonePlatform, modelId: string): Promise<AppState>;
  addPhoneModel(input: NewPhoneModel): Promise<AppState>;
  deletePhoneModel(modelId: string): Promise<AppState>;
  startPreview(): Promise<AppState>;
  stopPreview(): Promise<AppState>;
  tap(x: number, y: number): Promise<void>;
  longPress(x: number, y: number, durationMs?: number): Promise<void>;
  swipe(x1: number, y1: number, x2: number, y2: number, durationMs?: number): Promise<void>;
  scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void>;
  pinch(x: number, y: number, scale: number): Promise<void>;
  press(key: KeyAction): Promise<void>;
  typeText(text: string): Promise<void>;
  openStore(appId?: string): Promise<void>;
  searchStore(query: string): Promise<void>;
  installApp(appId: string): Promise<void>;
  openApp(packageId: string): Promise<void>;
  installFromFile(): Promise<void>;
  showQr(appId: string): Promise<void>;
  hideQr(): Promise<void>;
  openExternal(url: string): Promise<void>;
  connectWifi(address: string): Promise<AppState>;
  updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<AppState>;
  clearActivity(): Promise<void>;
  subscribe(listener: (event: ServerEvent) => void): () => void;
  onNavigate(listener: (view: string) => void): () => void;
}

export interface QrPayload {
  appId: string;
  title: string;
  subtitle: string;
  dataUrl: string;
  url: string;
}
