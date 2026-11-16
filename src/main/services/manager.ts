import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { app, dialog, nativeImage, shell, type BrowserWindow } from 'electron';
import QRCode from 'qrcode';
import {
  APP_CATEGORIES,
  CATALOG,
  CATALOG_BY_ID,
  findAppByPackage,
  storeLink,
} from '../../shared/catalog';
import type {
  ActivityItem,
  ActivityLevel,
  AppState,
  CatalogApp,
  DeviceInfo,
  FramePayload,
  InstallProgress,
  InstalledApp,
  KeyAction,
  PhonePlatform,
  QrPayload,
  ServerEvent,
  Settings,
  ToolStatus,
} from '../../shared/types';
import {
  BUILTIN_PHONE_MODELS,
  DEFAULT_ANDROID_MODEL_ID,
  DEFAULT_IOS_MODEL_ID,
  defaultPhoneModel,
  makeCustomModel,
} from '../../shared/phone-models';
import type { NewPhoneModel, PhoneModel } from '../../shared/types';
import { AdbClient, AdbError, prettyPackageName } from './adb';
import { ScrcpyControl } from './scrcpy-control';
import { DemoDevice, DEMO_HEIGHT, DEMO_WIDTH } from './demo';
import { IosBridge } from './ios';

const DEFAULT_SETTINGS: Settings = {
  fps: 5,
  quality: 78,
  autoPreview: true,
  adbPath: '',
  demoPlatform: 'android',
  reduceMotion: false,
  customModels: [],
  defaultAndroidModelId: DEFAULT_ANDROID_MODEL_ID,
  defaultIosModelId: DEFAULT_IOS_MODEL_ID,
};

const KEYCODES: Record<KeyAction, number> = {
  home: 3,
  back: 4,
  recents: 187,
  power: 26,
  wake: 224,
  volume_up: 24,
  volume_down: 25,
};

export interface ManagerOptions {
  dataDir: string;
  version: string;
  getWindow: () => BrowserWindow | null;
  broadcast: (event: ServerEvent) => void;
}

export class DeviceManager {
  private readonly adb: AdbClient;
  private readonly ios = new IosBridge();
  private readonly demos: Record<PhonePlatform, DemoDevice> = {
    android: new DemoDevice('android', defaultPhoneModel('android')),
    ios: new DemoDevice('ios', defaultPhoneModel('ios')),
  };

  private devices: DeviceInfo[] = [];
  private activeId: string | null = null;
  private installed: InstalledApp[] = [];
  private activity: ActivityItem[] = [];
  private previewActive = false;
  private previewSeq = 0;
  private lastFrameAt: number | null = null;
  private frameSize: { width: number; height: number } | null = null;
  private installs: Record<string, InstallProgress> = {};
  private tools: ToolStatus[] = [];
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private qr: QrPayload | null = null;

  private engineTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private installedTimer: NodeJS.Timeout | null = null;
  private installWatch: NodeJS.Timeout | null = null;
  private realBusy = false;
  private installedBusy = false;
  private installedSignature = '';
  private realErrors = 0;
  private lastDemoHash = '';
  private lastMinute = '';
  private lastInstallEmit = new Map<string, number>();
  private activitySeq = 0;
  private lastDeviceSignature = '';
  private pendingInstall: { deviceId: string; appId: string; startedAt: number } | null = null;
  private iosPointSizes = new Map<string, { width: number; height: number }>();
  private androidControl: ScrcpyControl | null = null;
  private controlAttemptSerial: string | null = null;
  private demoGestureNotices = new Map<string, number>();

  constructor(private readonly options: ManagerOptions) {
    this.adb = new AdbClient(() => this.settings.adbPath);
  }

  async init(): Promise<void> {
    await this.loadSettings();
    // Apply persisted demo models before discovery builds the device list.
    this.applyDefaultModels();
    // The adb client resolves its binary at construction time; re-resolve now
    // that persisted settings (including a custom path) are available.
    this.adb.refreshPath();
    this.detectTools();
    await this.refreshDevices({ initial: true });
    this.syncControlSession();
    this.log('info', 'PhoneExplorer ready. Looking for devices…');
    if (!this.activeId) {
      await this.selectDevice(`demo-${this.settings.demoPlatform}`);
    }
    this.emitState();
    this.engineTimer = setInterval(() => void this.engineTick(), 120);
    this.pollTimer = setInterval(() => void this.refreshDevices(), 9000);
    this.installedTimer = setInterval(() => void this.pollInstalled(), 6000);
    if (this.settings.autoPreview) void this.startPreview();
  }

  dispose(): void {
    void this.androidControl?.stop();
    this.androidControl = null;
    for (const timer of [
      this.engineTimer,
      this.pollTimer,
      this.installedTimer,
      this.installWatch,
    ]) {
      if (timer) clearInterval(timer);
    }
    this.engineTimer = null;
    this.pollTimer = null;
    this.installedTimer = null;
    this.installWatch = null;
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  getState(): AppState {
    return {
      devices: this.devices,
      activeDeviceId: this.activeId,
      installed: this.installed,
      catalog: CATALOG,
      models: this.allModels(),
      defaultModels: {
        android: this.settings.defaultAndroidModelId,
        ios: this.settings.defaultIosModelId,
      },
      activity: this.activity,
      preview: {
        active: this.previewActive,
        fps: this.settings.fps,
        paused: false,
        seq: this.previewSeq,
        lastFrameAt: this.lastFrameAt,
        width: this.frameSize?.width ?? null,
        height: this.frameSize?.height ?? null,
      },
      installs: this.installs,
      tools: this.tools,
      settings: this.settings,
      version: this.options.version,
      platform: process.platform,
      qr: this.qr,
    };
  }

  private emitState(): void {
    this.options.broadcast({ type: 'state', state: this.getState() });
  }

  private emitInstall(progress: InstallProgress): void {
    this.installs = { ...this.installs, [progress.appId]: progress };
    this.options.broadcast({ type: 'install', progress });
  }

  private log(level: ActivityLevel, message: string, detail?: string): void {
    const item: ActivityItem = {
      id: `a${Date.now().toString(36)}${(this.activitySeq++).toString(36)}`,
      ts: Date.now(),
      level,
      message,
      detail,
    };
    this.activity = [item, ...this.activity].slice(0, 250);
    this.options.broadcast({ type: 'activity', item });
  }

  private toast(tone: 'success' | 'error' | 'info', title: string, body?: string): void {
    this.options.broadcast({ type: 'toast', tone, title, body });
  }

  private get activeDevice(): DeviceInfo | null {
    return this.devices.find((device) => device.id === this.activeId) ?? null;
  }

  private get activeDemo(): DemoDevice | null {
    if (this.activeId === 'demo-android') return this.demos.android;
    if (this.activeId === 'demo-ios') return this.demos.ios;
    return null;
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  private get settingsPath(): string {
    return join(this.options.dataDir, 'settings.json');
  }

  private async loadSettings(): Promise<void> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const customModels = Array.isArray(parsed.customModels)
        ? parsed.customModels
            .filter((model): model is PhoneModel => isStoredModel(model))
            .slice(0, 40)
            .map((model) => ({
              ...model,
              builtin: false,
              year: Number(model.year) || new Date().getFullYear(),
            }))
        : [];
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        fps: clamp(Number(parsed.fps ?? DEFAULT_SETTINGS.fps), 1, 10),
        quality: clamp(Number(parsed.quality ?? DEFAULT_SETTINGS.quality), 40, 95),
        demoPlatform: parsed.demoPlatform === 'ios' ? 'ios' : 'android',
        customModels,
        defaultAndroidModelId:
          typeof parsed.defaultAndroidModelId === 'string'
            ? parsed.defaultAndroidModelId
            : DEFAULT_ANDROID_MODEL_ID,
        defaultIosModelId:
          typeof parsed.defaultIosModelId === 'string'
            ? parsed.defaultIosModelId
            : DEFAULT_IOS_MODEL_ID,
      };
      const available = [...BUILTIN_PHONE_MODELS, ...customModels];
      if (
        !available.some(
          (model) =>
            model.id === this.settings.defaultAndroidModelId &&
            model.platform === 'android',
        )
      ) {
        this.settings.defaultAndroidModelId = DEFAULT_ANDROID_MODEL_ID;
      }
      if (
        !available.some(
          (model) =>
            model.id === this.settings.defaultIosModelId && model.platform === 'ios',
        )
      ) {
        this.settings.defaultIosModelId = DEFAULT_IOS_MODEL_ID;
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await fs.mkdir(this.options.dataDir, { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      this.log('warn', 'Could not save settings', error instanceof Error ? error.message : String(error));
    }
  }

  // -------------------------------------------------------------------------
  // Demo hardware profiles
  // -------------------------------------------------------------------------

  private allModels(): PhoneModel[] {
    return [
      ...BUILTIN_PHONE_MODELS,
      ...this.settings.customModels.filter((model) => !model.builtin),
    ];
  }

  private modelById(modelId: string, platform: PhonePlatform): PhoneModel | null {
    return (
      this.allModels().find((model) => model.id === modelId && model.platform === platform) ??
      null
    );
  }

  private defaultModelFor(platform: PhonePlatform): PhoneModel {
    const modelId =
      platform === 'ios'
        ? this.settings.defaultIosModelId
        : this.settings.defaultAndroidModelId;
    return this.modelById(modelId, platform) ?? defaultPhoneModel(platform);
  }

  private applyDefaultModels(): void {
    this.demos.android.setModel(this.defaultModelFor('android'));
    this.demos.ios.setModel(this.defaultModelFor('ios'));
  }

  private syncDemoInfo(platform: PhonePlatform): void {
    const info = this.demos[platform].info();
    const index = this.devices.findIndex((device) => device.id === info.id);
    if (index >= 0) this.devices[index] = info;
    else if (this.devices.length > 0) this.devices.push(info);
    this.lastDeviceSignature = '';
  }

  async selectDemoModel(platform: PhonePlatform, modelId: string): Promise<AppState> {
    const model = this.modelById(modelId, platform);
    if (!model) throw new Error('That phone model is not available for this platform.');
    this.demos[platform].setModel(model);
    this.installs = {};
    this.syncDemoInfo(platform);
    this.log(
      'device',
      `Demo ${platform === 'ios' ? 'iPhone' : 'Android'} is now ${model.name}`,
      `${model.manufacturer} · ${model.osVersion} · ${model.screen.width}×${model.screen.height}`,
    );
    const demoId = `demo-${platform}`;
    if (this.activeId !== demoId) {
      await this.selectDevice(demoId);
    } else {
      this.lastDemoHash = '';
      if (this.previewActive) this.sendDemoFrame(true);
      this.emitState();
    }
    return this.getState();
  }

  async setDefaultModel(platform: PhonePlatform, modelId: string): Promise<AppState> {
    const model = this.modelById(modelId, platform);
    if (!model) throw new Error('That phone model is not available for this platform.');
    const key = platform === 'ios' ? 'defaultIosModelId' : 'defaultAndroidModelId';
    this.settings = { ...this.settings, [key]: modelId };
    await this.saveSettings();
    this.log(
      'success',
      `Default ${platform === 'ios' ? 'iPhone' : 'Android'} demo: ${model.name}`,
      'Used whenever the demo lab starts on this platform.',
    );
    this.toast(
      'success',
      `Default ${platform === 'ios' ? 'iPhone' : 'Android'} updated`,
      model.name,
    );
    this.emitState();
    return this.getState();
  }

  async addPhoneModel(input: NewPhoneModel): Promise<AppState> {
    if (this.settings.customModels.length >= 40) {
      throw new Error('You can save up to 40 custom phone models.');
    }
    const normalized = normalizeNewModel(input);
    const model = makeCustomModel(normalized, this.allModels());
    this.settings = {
      ...this.settings,
      customModels: [...this.settings.customModels, model],
      ...(model.platform === 'ios'
        ? { defaultIosModelId: model.id }
        : { defaultAndroidModelId: model.id }),
    };
    this.demos[model.platform].setModel(model);
    this.syncDemoInfo(model.platform);
    await this.saveSettings();
    if (this.activeId === `demo-${model.platform}`) {
      this.installs = {};
      this.lastDemoHash = '';
      if (this.previewActive) this.sendDemoFrame(true);
    }
    this.log('device', `Custom model added: ${model.name}`, `${model.manufacturer} · ${model.osVersion}`);
    this.toast(
      'success',
      `${model.name} added`,
      `Saved as the default ${model.platform === 'ios' ? 'iPhone' : 'Android'} demo.`,
    );
    this.emitState();
    return this.getState();
  }

  async deletePhoneModel(modelId: string): Promise<AppState> {
    const model = this.settings.customModels.find((candidate) => candidate.id === modelId);
    if (!model) throw new Error('Only custom phone models can be deleted.');
    const platform = model.platform;
    this.settings = {
      ...this.settings,
      customModels: this.settings.customModels.filter((candidate) => candidate.id !== modelId),
      ...(platform === 'ios'
        ? {
            defaultIosModelId:
              this.settings.defaultIosModelId === modelId
                ? DEFAULT_IOS_MODEL_ID
                : this.settings.defaultIosModelId,
          }
        : {
            defaultAndroidModelId:
              this.settings.defaultAndroidModelId === modelId
                ? DEFAULT_ANDROID_MODEL_ID
                : this.settings.defaultAndroidModelId,
          }),
    };
    if (this.demos[platform].info().modelId === modelId) {
      this.demos[platform].setModel(this.defaultModelFor(platform));
      this.installs = {};
      this.syncDemoInfo(platform);
      this.lastDemoHash = '';
      if (this.activeId === `demo-${platform}` && this.previewActive) this.sendDemoFrame(true);
    }
    await this.saveSettings();
    this.log('warn', `Custom model removed: ${model.name}`);
    this.toast('info', `${model.name} removed`);
    this.emitState();
    return this.getState();
  }

  async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<AppState> {
    if (key === 'fps') value = clamp(Number(value), 1, 10) as Settings[K];
    if (key === 'quality') value = clamp(Number(value), 40, 95) as Settings[K];
    this.settings = { ...this.settings, [key]: value };
    if (key === 'adbPath') {
      this.adb.refreshPath();
      this.detectTools();
      await this.refreshDevices();
    }
    await this.saveSettings();
    if (key === 'demoPlatform' && this.activeDemo) {
      await this.selectDevice(`demo-${value as PhonePlatform}`);
    }
    this.emitState();
    return this.getState();
  }

  // -------------------------------------------------------------------------
  // Device discovery
  // -------------------------------------------------------------------------

  private detectTools(): void {
    const adb = this.adb.path;
    this.ios.probe();
    const iosFound = this.ios.canList;
    const iosBridge = this.ios.hasIdb
      ? 'idb'
      : this.ios.hasDevicectl
        ? 'devicectl'
        : this.ios.hasLibimobiledevice
          ? 'libimobiledevice'
          : null;
    const tools: ToolStatus[] = [
      {
        id: 'adb',
        label: 'Android platform-tools',
        found: Boolean(adb),
        path: adb,
        hint: adb
          ? null
          : 'Install with “brew install android-platform-tools”, or set the adb path in Settings.',
        url: 'https://developer.android.com/tools/releases/platform-tools',
      },
      {
        id: 'ios',
        label: 'iOS device bridge',
        found: iosFound,
        path: iosBridge,
        hint: iosFound
          ? null
          : 'Install “brew install libimobiledevice” (plus idb for touch and store links), or Xcode 15+ for devicectl.',
        url: 'https://libimobiledevice.org',
      },
    ];
    this.tools = tools;
  }

  async refreshDevices(options: { initial?: boolean } = {}): Promise<AppState> {
    const previousRealCount = this.devices.filter((device) => !device.isDemo).length;
    const previousActive = this.activeId;
    const real: DeviceInfo[] = [];

    if (this.adb.path) {
      try {
        await this.adb.startServer();
        const raw = await this.adb.listDevices();
        for (const entry of raw) {
          const id = `android:${entry.serial}`;
          if (entry.state === 'unauthorized') {
            real.push(this.androidPlaceholder(entry.serial, 'unauthorized'));
            continue;
          }
          if (entry.state !== 'device') {
            real.push(this.androidPlaceholder(entry.serial, 'offline'));
            continue;
          }
          try {
            const details = await this.adb.details(entry.serial);
            real.push({
              id,
              name: cleanModel(details.model),
              model: cleanModel(details.model),
              platform: 'android',
              osVersion: details.osVersion,
              connection: entry.serial.includes(':') ? 'wifi' : 'usb',
              status: 'online',
              serial: entry.serial,
              resolution: details.resolution,
              battery: details.battery,
              isDemo: false,
              controlEngine: 'adb',
              capabilities: {
                mirror: true,
                input: true,
                store: true,
                launch: true,
                installFile: true,
                installedApps: true,
              },
              hint: null,
            });
          } catch (error) {
            real.push({
              ...this.androidPlaceholder(entry.serial, 'error'),
              hint: error instanceof Error ? error.message : 'Could not read device details.',
            });
          }
        }
      } catch (error) {
        this.log('warn', 'Android discovery failed', messageOf(error));
      }
    }

    if (this.ios.canList) {
      try {
        const list = await this.ios.listDevices();
        for (const device of list) {
          const resolution = this.iosPointSizes.get(device.udid) ?? device.resolution;
          real.push({
            id: `ios:${device.udid}`,
            name: device.name,
            model: device.model,
            platform: 'ios',
            osVersion: device.osVersion.replace(/^iOS\s+/i, ''),
            connection: device.connection,
            status: device.state === 'unauthorized' ? 'unauthorized' : 'online',
            serial: device.udid,
            resolution,
            battery: device.battery,
            isDemo: false,
            controlEngine: this.ios.canTap ? 'idb' : undefined,
            capabilities: {
              mirror: this.ios.canScreenshot,
              input: this.ios.canTap,
              store: this.ios.canOpenUrl,
              launch: this.ios.canLaunch,
              installFile: this.ios.canInstall,
              installedApps: this.ios.hasIdb || this.ios.canInstall,
            },
            hint:
              device.state === 'unauthorized'
                ? 'Unlock the iPhone and tap Trust.'
                : this.ios.canTap
                  ? null
                  : 'Install idb to enable touch and store deep links.',
          });
        }
      } catch (error) {
        this.log('warn', 'iOS discovery failed', messageOf(error));
      }
    }

    const demoDevices = [this.demos.android.info(), this.demos.ios.info()];
    this.devices = [...real, ...demoDevices];

    const activeStillThere = this.devices.some(
      (device) => device.id === this.activeId && device.status === 'online',
    );

    if (!activeStillThere) {
      const wasDemo = previousActive?.startsWith('demo-');
      const next =
        (wasDemo ? real.find((device) => device.status === 'online') : null) ??
        real.find((device) => device.status === 'online') ??
        this.devices.find((device) => device.isDemo) ??
        null;
      if (next) {
        this.activeId = next.id;
        this.installed = [];
        void this.refreshInstalled();
        if (this.previewActive) void this.startPreview(true);
      } else {
        this.activeId = null;
      }
    }

    this.syncControlSession();

    if (previousRealCount === 0 && real.length > 0 && previousActive?.startsWith('demo-')) {
      const first = real.find((device) => device.status === 'online');
      if (first) {
        this.log('device', `${first.name} connected`, `${first.osVersion} · ${first.connection.toUpperCase()}`);
        this.toast('success', `${first.name} connected`, 'Switched to the physical device.');
        await this.selectDevice(first.id);
      }
    }

    const signature = JSON.stringify(
      this.devices.map((device) => [device.id, device.status, device.battery, device.name]),
    );
    if (signature !== this.lastDeviceSignature || options.initial) {
      this.lastDeviceSignature = signature;
      this.detectTools();
      this.emitState();
    }
    return this.getState();
  }

  private androidPlaceholder(serial: string, status: 'unauthorized' | 'offline' | 'error'): DeviceInfo {
    return {
      id: `android:${serial}`,
      name: status === 'unauthorized' ? 'Unauthorized Android' : 'Android device',
      model: 'Android',
      platform: 'android',
      osVersion: 'Android',
      connection: serial.includes(':') ? 'wifi' : 'usb',
      status,
      serial,
      resolution: null,
      battery: null,
      isDemo: false,
      capabilities: {
        mirror: false,
        input: false,
        store: false,
        launch: false,
        installFile: false,
        installedApps: false,
      },
      hint:
        status === 'unauthorized'
          ? 'Unlock the phone and tap “Allow” on the USB debugging prompt.'
          : status === 'offline'
            ? 'The device is offline. Reconnect the cable or run “adb reconnect”.'
            : 'The device could not be read. Check USB debugging.',
    };
  }

  async selectDevice(deviceId: string): Promise<AppState> {
    const device = this.devices.find((candidate) => candidate.id === deviceId);
    if (!device) return this.getState();
    if (device.status !== 'online') {
      this.toast('error', `${device.name} is ${device.status}`, device.hint ?? undefined);
      return this.getState();
    }
    if (this.previewActive) await this.stopPreview();
    await this.stopControlSession();
    this.activeId = device.id;
    this.installed = [];
    this.installedSignature = '';
    this.qr = null;
    this.installs = {};
    this.pendingInstall = null;
    if (this.installWatch) clearInterval(this.installWatch);
    this.installWatch = null;
    if (device.isDemo) {
      this.settings = { ...this.settings, demoPlatform: device.platform };
      void this.saveSettings();
      this.log('device', `Demo ${device.name} selected`, 'Simulated locally — no phone required.');
    } else {
      this.log('device', `${device.name} selected`, `${device.osVersion} · ${device.connection.toUpperCase()}`);
    }
    await this.refreshInstalled();
    this.emitState();
    if (this.settings.autoPreview && device.capabilities.mirror) {
      await this.startPreview();
    }
    this.syncControlSession();
    return this.getState();
  }

  async useDemo(platform: PhonePlatform | null): Promise<AppState> {
    if (platform) return this.selectDevice(`demo-${platform}`);
    const real = this.devices.find((device) => !device.isDemo && device.status === 'online');
    if (real) return this.selectDevice(real.id);
    this.toast('info', 'No physical device found', 'Connect a phone over USB or Wi-Fi to switch.');
    return this.getState();
  }

  // -------------------------------------------------------------------------
  // Installed apps
  // -------------------------------------------------------------------------

  private async refreshInstalled(): Promise<void> {
    if (this.installedBusy) return;
    const device = this.activeDevice;
    if (!device) return;
    this.installedBusy = true;
    try {
      if (device.isDemo) {
        const demo = this.activeDemo;
        if (!demo) return;
        this.installed = demo.installedIds().map((id) => this.catalogInstalled(id, false));
      } else if (device.platform === 'android') {
        const { all, thirdParty } = await this.adb.installedPackages(device.serial);
        const known: InstalledApp[] = [];
        const knownPackages = new Set<string>();
        for (const app of CATALOG) {
          if (all.has(app.androidPackage)) {
            known.push(this.catalogInstalled(app.id, !thirdParty.has(app.androidPackage)));
            knownPackages.add(app.androidPackage);
          }
        }
        const unknown = [...thirdParty]
          .filter((pkg) => !knownPackages.has(pkg))
          .sort()
          .slice(0, 80)
          .map<InstalledApp>((pkg) => ({
            appId: null,
            name: prettyPackageName(pkg),
            packageId: pkg,
            version: null,
            system: false,
          }));
        this.installed = [...known, ...unknown];
      } else {
        const apps = await this.ios.installedApps(device.serial);
        const known: InstalledApp[] = [];
        const seen = new Set<string>();
        for (const app of apps) {
          const catalog = findAppByPackage(app.bundleId);
          if (catalog) {
            known.push({
              appId: catalog.id,
              name: catalog.name,
              packageId: app.bundleId,
              version: app.version,
              system: app.system,
            });
            seen.add(app.bundleId);
          }
        }
        const unknown = apps
          .filter((app) => !seen.has(app.bundleId) && !app.system)
          .slice(0, 80)
          .map<InstalledApp>((app) => ({
            appId: null,
            name: app.name,
            packageId: app.bundleId,
            version: app.version,
            system: app.system,
          }));
        this.installed = [...known, ...unknown];
      }
      const signature = JSON.stringify(
        this.installed.map((item) => [item.appId, item.packageId, item.system]),
      );
      if (signature !== this.installedSignature) {
        this.installedSignature = signature;
        this.emitState();
      }
      this.checkPendingInstall();
    } catch (error) {
      this.log('warn', 'Could not read installed apps', messageOf(error));
    } finally {
      this.installedBusy = false;
    }
  }

  private catalogInstalled(appId: string, system: boolean): InstalledApp {
    const app = CATALOG_BY_ID[appId];
    const device = this.activeDevice;
    return {
      appId,
      name: app.name,
      packageId: device?.platform === 'ios' ? app.iosBundleId : app.androidPackage,
      version: null,
      system,
    };
  }

  private async pollInstalled(): Promise<void> {
    const device = this.activeDevice;
    if (!device || device.status !== 'online') return;
    await this.refreshInstalled();
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  async startPreview(restart = false): Promise<AppState> {
    const device = this.activeDevice;
    if (!device) {
      this.toast('error', 'No device selected');
      return this.getState();
    }
    if (!device.capabilities.mirror) {
      this.toast('error', 'Mirroring is unavailable', device.hint ?? undefined);
      return this.getState();
    }
    if (this.previewActive && !restart) return this.getState();
    this.previewActive = true;
    this.realErrors = 0;
    this.lastFrameAt = null;
    this.lastDemoHash = '';
    this.frameSize = null;
    this.emitState();
    if (device.isDemo) {
      this.sendDemoFrame(true);
    } else {
      void this.captureReal(device);
    }
    return this.getState();
  }

  async stopPreview(): Promise<AppState> {
    this.previewActive = false;
    this.frameSize = null;
    this.emitState();
    return this.getState();
  }

  private async engineTick(): Promise<void> {
    const now = Date.now();
    const demo = this.activeDemo;
    if (demo) {
      const tick = demo.tick(now);
      if (tick.install && !tick.completedAppId) {
        const last = this.lastInstallEmit.get(tick.install.appId) ?? 0;
        if (tick.install.progress - last > 0.008) {
          this.lastInstallEmit.set(tick.install.appId, tick.install.progress);
          this.emitInstall({
            appId: tick.install.appId,
            phase: tick.install.phase,
            progress: tick.install.progress,
            message:
              tick.install.phase === 'downloading'
                ? 'Downloading from the store'
                : 'Installing on the demo phone',
          });
        }
      }
      if (tick.completedAppId) {
        const app = CATALOG_BY_ID[tick.completedAppId];
        this.lastInstallEmit.delete(tick.completedAppId);
        this.emitInstall({
          appId: tick.completedAppId,
          phase: 'done',
          progress: 1,
          message: 'Installed on the demo phone',
        });
        this.log('success', `${app.name} installed`, 'Demo device · package added to the launcher');
        this.toast('success', `${app.name} installed`, 'Tap Open to launch it on the demo phone.');
        await this.refreshInstalled();
      }
      if (this.previewActive) {
        const minute = new Date(now).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        });
        const heartbeat = now - (this.lastFrameAt ?? 0) > 1000;
        const installing = Boolean(demo.installState());
        const progressTick = installing && now - (this.lastFrameAt ?? 0) > 150;
        if (heartbeat || minute !== this.lastMinute || (tick.changed && progressTick)) {
          this.lastMinute = minute;
          // Force a resend even when nothing changed: a renderer that attached
          // after the previous frame must still receive a first paint.
          this.sendDemoFrame(true);
        } else if (tick.changed) {
          this.sendDemoFrame(false);
        }
      }
      return;
    }

    if (!this.previewActive) return;
    const device = this.activeDevice;
    if (!device || device.status !== 'online') return;
    const interval = 1000 / Math.max(1, this.settings.fps);
    if (!this.realBusy && now - (this.lastFrameAt ?? 0) >= interval) {
      await this.captureReal(device);
    }
  }

  private sendDemoFrame(force: boolean): void {
    const demo = this.activeDemo;
    if (!demo) return;
    const rendered = demo.render();
    const hash = `${rendered.svg.length}:${rendered.hotspots.length}:${rendered.svg.slice(-160)}`;
    if (!force && hash === this.lastDemoHash) return;
    this.lastDemoHash = hash;
    this.previewSeq += 1;
    this.lastFrameAt = Date.now();
    this.frameSize = { width: rendered.width, height: rendered.height };
    const frame: FramePayload = {
      deviceId: demo.id,
      mime: 'image/svg+xml',
      data: `data:image/svg+xml;base64,${Buffer.from(rendered.svg, 'utf8').toString('base64')}`,
      width: rendered.width,
      height: rendered.height,
      seq: this.previewSeq,
      hotspots: rendered.hotspots,
    };
    this.options.broadcast({ type: 'frame', frame });
  }

  private async captureReal(device: DeviceInfo): Promise<void> {
    if (this.realBusy) return;
    this.realBusy = true;
    try {
      let buffer: Buffer;
      if (device.platform === 'android') {
        buffer = await this.adb.screenshot(device.serial);
      } else {
        buffer = await this.ios.screenshot(device.serial);
      }
      const image = nativeImage.createFromBuffer(buffer, { scaleFactor: 1 });
      if (image.isEmpty()) throw new Error('The screenshot could not be decoded.');
      const size = image.getSize();
      if (device.platform === 'ios' && !this.iosPointSizes.has(device.serial)) {
        const scale = size.width % 3 === 0 ? 3 : 2;
        const points = {
          width: Math.round(size.width / scale),
          height: Math.round(size.height / scale),
        };
        this.iosPointSizes.set(device.serial, points);
        device.resolution = points;
        this.emitState();
      }
      let output = image;
      if (size.width > 760) {
        output = image.resize({ width: 720, quality: 'good' });
      }
      const jpeg = output.toJPEG(this.settings.quality);
      this.previewSeq += 1;
      this.lastFrameAt = Date.now();
      this.realErrors = 0;
      this.frameSize = size;
      const frame: FramePayload = {
        deviceId: device.id,
        mime: 'image/jpeg',
        data: jpeg.toString('base64'),
        width: size.width,
        height: size.height,
        seq: this.previewSeq,
      };
      this.options.broadcast({ type: 'frame', frame });
    } catch (error) {
      this.realErrors += 1;
      this.lastFrameAt = Date.now();
      if (this.realErrors === 1) {
        this.log('warn', 'Mirror frame failed', messageOf(error));
      }
      if (this.realErrors >= 4) {
        this.previewActive = false;
        this.options.broadcast({
          type: 'preview',
          active: false,
          reason: messageOf(error),
        });
        this.log('error', 'Preview stopped', messageOf(error));
        this.emitState();
      }
    } finally {
      this.realBusy = false;
    }
  }

  // -------------------------------------------------------------------------
  // Native control session
  // -------------------------------------------------------------------------

  private scrcpyServerPath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'scrcpy-server')
      : join(app.getAppPath(), 'vendor', 'scrcpy-server');
  }

  private demoGestureNotice(kind: string, title: string, body: string): void {
    const now = Date.now();
    if (now - (this.demoGestureNotices.get(kind) ?? 0) < 2500) return;
    this.demoGestureNotices.set(kind, now);
    this.toast('info', title, body);
  }

  private setControlEngine(deviceId: string, engine: 'scrcpy' | 'adb' | 'idb' | 'demo'): void {
    const device = this.devices.find((candidate) => candidate.id === deviceId);
    if (device && device.controlEngine !== engine) {
      device.controlEngine = engine;
      this.emitState();
    }
  }

  private async stopControlSession(): Promise<void> {
    this.controlAttemptSerial = null;
    const session = this.androidControl;
    this.androidControl = null;
    if (session) {
      const device = this.devices.find(
        (candidate) => !candidate.isDemo && candidate.serial === session.deviceSerial,
      );
      if (device) this.setControlEngine(device.id, 'adb');
      await session.stop().catch(() => undefined);
    }
  }

  private syncControlSession(): void {
    const device = this.activeDevice;
    if (!device || device.isDemo || device.platform !== 'android' || device.status !== 'online') {
      void this.stopControlSession();
      return;
    }
    if (this.controlAttemptSerial === device.serial && this.androidControl) {
      if (this.androidControl.ready) this.setControlEngine(device.id, 'scrcpy');
      return;
    }
    // A failed session is not retried every poll; re-selecting the device is
    // the explicit retry.
    this.controlAttemptSerial = device.serial;
    const session = this.androidControl ?? new ScrcpyControl({
      serverPath: this.scrcpyServerPath(),
      onLog: (message) => {
        if (/error|fail|exception|denied/i.test(message)) {
          this.log('warn', 'scrcpy control', message);
        }
      },
      onExit: () => {
        if (this.activeId === device.id) this.setControlEngine(device.id, 'adb');
      },
    });
    this.androidControl = session;
    const width = device.resolution?.width ?? 1080;
    const height = device.resolution?.height ?? 2400;
    void session
      .start(device.serial, width, height)
      .then(() => {
        if (this.activeId !== device.id || this.androidControl !== session) {
          void session.stop();
          return;
        }
        this.setControlEngine(device.id, 'scrcpy');
        this.log(
          'success',
          'Multi-touch control ready',
          'scrcpy 3.3.3 · two-finger pinch enabled; single touch stays on adb',
        );
      })
      .catch((error) => {
        if (this.androidControl !== session || this.activeId !== device.id) return;
        this.setControlEngine(device.id, 'adb');
        this.log(
          'warn',
          'Multi-touch control unavailable',
          `${messageOf(error)} · basic adb touch remains active`,
        );
      });
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private gestureSize(device: DeviceInfo): { width: number; height: number } {
    // scrcpy coordinates are device pixels. The preview frame may be resized
    // (720 px wide) or rotated, so never use its pixel dimensions here.
    let width = device.resolution?.width ?? this.frameSize?.width ?? 1080;
    let height = device.resolution?.height ?? this.frameSize?.height ?? 2400;
    if (this.frameSize && this.frameSize.width > this.frameSize.height && width < height) {
      [width, height] = [height, width];
    }
    return { width, height };
  }

  private inputSize(device: DeviceInfo): { width: number; height: number } {
    if (device.platform === 'ios') {
      const points = this.iosPointSizes.get(device.serial);
      if (points) {
        if (this.frameSize && this.frameSize.width > this.frameSize.height && points.width < points.height) {
          return { width: points.height, height: points.width };
        }
        return points;
      }
      if (this.frameSize) {
        return {
          width: Math.round(this.frameSize.width / 3),
          height: Math.round(this.frameSize.height / 3),
        };
      }
    }
    return this.gestureSize(device);
  }

  private toDevicePoint(
    nx: number,
    ny: number,
  ): { x: number; y: number } {
    const device = this.activeDevice;
    if (!device) return { x: 0, y: 0 };
    if (device.isDemo) {
      return { x: clamp(nx, 0, 1) * DEMO_WIDTH, y: clamp(ny, 0, 1) * DEMO_HEIGHT };
    }
    let width = device.resolution?.width ?? this.frameSize?.width ?? 1080;
    let height = device.resolution?.height ?? this.frameSize?.height ?? 1920;
    if (device.platform === 'ios') {
      const points = this.iosPointSizes.get(device.serial);
      if (points) {
        width = points.width;
        height = points.height;
      } else if (this.frameSize) {
        width = Math.round(this.frameSize.width / 3);
        height = Math.round(this.frameSize.height / 3);
      }
    }
    // If the phone is rotated, the screen resolution is swapped relative to
    // the portrait value reported by the platform.
    if (this.frameSize && this.frameSize.width > this.frameSize.height && width < height) {
      [width, height] = [height, width];
    }
    return { x: clamp(nx, 0, 1) * width, y: clamp(ny, 0, 1) * height };
  }

  async tap(nx: number, ny: number): Promise<void> {
    const device = this.activeDevice;
    if (!device || !device.capabilities.input) {
      this.toast('error', 'Touch is unavailable', device?.hint ?? 'Select an interactive device first.');
      return;
    }
    const point = this.toDevicePoint(nx, ny);
    try {
      if (device.isDemo) {
        const demo = this.activeDemo;
        if (demo?.tap(point.x, point.y)) this.sendDemoFrame(true);
      } else if (device.platform === 'android') {
        // Single touch stays on adb: it is the proven path on every device.
        // scrcpy is reserved for the gestures adb cannot express (pinch).
        await this.adb.tap(device.serial, point.x, point.y);
      } else {
        await this.ios.tap(device.serial, point.x, point.y);
      }
    } catch (error) {
      this.log('error', 'Tap failed', messageOf(error));
      this.toast('error', 'Tap failed', messageOf(error));
    }
  }

  async longPress(nx: number, ny: number, durationMs = 700): Promise<void> {
    const device = this.activeDevice;
    if (!device || !device.capabilities.input) return;
    if (device.isDemo) {
      this.demoGestureNotice(
        'longpress',
        'Long-press is not simulated',
        'The demo screen is static; connect a phone for native gestures.',
      );
      return;
    }
    const point = this.toDevicePoint(nx, ny);
    try {
      if (device.platform === 'android') {
        await this.adb.swipe(device.serial, point.x, point.y, point.x, point.y, durationMs);
      } else {
        await this.ios.swipe(device.serial, point.x, point.y, point.x, point.y, durationMs);
      }
    } catch (error) {
      this.log('error', 'Long press failed', messageOf(error));
      this.toast('error', 'Long press failed', messageOf(error));
    }
  }

  async scroll(nx: number, ny: number, deltaX: number, deltaY: number): Promise<void> {
    const device = this.activeDevice;
    if (!device || !device.capabilities.input) return;
    if (device.isDemo) {
      this.demoGestureNotice(
        'scroll',
        'Demo screens are static',
        'Scroll and pinch run on the real phone; the demo has no scrollable surface.',
      );
      return;
    }
    const size = this.inputSize(device);
    const point = this.toDevicePoint(nx, ny);
    try {
      const distance = clamp(Math.max(Math.abs(deltaX), Math.abs(deltaY)) * 0.8, 50, 420);
      let x1 = point.x;
      let y1 = point.y;
      let x2 = point.x;
      let y2 = point.y;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        const direction = deltaY >= 0 ? 1 : -1;
        y1 = clamp(point.y + (direction * distance) / 2, 1, size.height - 2);
        y2 = clamp(point.y - (direction * distance) / 2, 1, size.height - 2);
      } else {
        const direction = deltaX >= 0 ? 1 : -1;
        x1 = clamp(point.x + (direction * distance) / 2, 1, size.width - 2);
        x2 = clamp(point.x - (direction * distance) / 2, 1, size.width - 2);
      }
      if (device.platform === 'android') {
        await this.adb.swipe(device.serial, x1, y1, x2, y2, 180);
      } else {
        await this.ios.swipe(device.serial, x1, y1, x2, y2, 180);
      }
    } catch (error) {
      this.log('error', 'Scroll failed', messageOf(error));
      this.toast('error', 'Scroll failed', messageOf(error));
    }
  }

  async pinch(nx: number, ny: number, scale: number): Promise<void> {
    const device = this.activeDevice;
    if (!device) return;
    if (device.isDemo) {
      this.demoGestureNotice(
        'pinch',
        'Pinch is not simulated',
        'Multi-touch pinch runs on a real Android phone through scrcpy.',
      );
      return;
    }
    if (device.platform !== 'android') {
      this.toast(
        'info',
        'Pinch needs Android multi-touch',
        'The iPhone bridge injects single touch only; pinch requires WebDriverAgent.',
      );
      return;
    }
    if (!this.androidControl?.ready) {
      this.toast(
        'error',
        'Multi-touch control is not ready',
        'Check Activity for the scrcpy session, then re-select the phone to retry.',
      );
      return;
    }
    const point = this.toDevicePoint(nx, ny);
    const size = this.gestureSize(device);
    try {
      await this.androidControl.pinch(
        point.x,
        point.y,
        clamp(scale, 0.25, 4),
        size.width,
        size.height,
      );
    } catch (error) {
      this.log('error', 'Pinch failed', messageOf(error));
      this.toast('error', 'Pinch failed', messageOf(error));
    }
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs = 320,
  ): Promise<void> {
    const device = this.activeDevice;
    if (!device || !device.capabilities.input) return;
    const start = this.toDevicePoint(x1, y1);
    const end = this.toDevicePoint(x2, y2);
    try {
      if (device.isDemo) {
        this.log('info', 'Swipe simulated', 'Demo content has no scroll physics yet.');
      } else if (device.platform === 'android') {
        await this.adb.swipe(device.serial, start.x, start.y, end.x, end.y, durationMs);
      } else {
        await this.ios.swipe(device.serial, start.x, start.y, end.x, end.y, durationMs);
      }
    } catch (error) {
      this.log('error', 'Swipe failed', messageOf(error));
      this.toast('error', 'Swipe failed', messageOf(error));
    }
  }

  async press(key: KeyAction): Promise<void> {
    const device = this.activeDevice;
    if (!device) return;
    if (device.isDemo) {
      const demo = this.activeDemo;
      if (demo?.press(key)) this.sendDemoFrame(true);
      return;
    }
    if (device.platform === 'ios') {
      const size = this.inputSize(device);
      try {
        if (key === 'home') {
          // Modern iPhones expose Home as an upward swipe from the bottom edge.
          await this.ios.swipe(
            device.serial,
            size.width / 2,
            size.height * 0.985,
            size.width / 2,
            size.height * 0.58,
            220,
          );
        } else if (key === 'back') {
          // There is no hardware Back; the system gesture is a left-edge swipe.
          await this.ios.swipe(
            device.serial,
            Math.max(2, size.width * 0.015),
            size.height / 2,
            size.width * 0.42,
            size.height / 2,
            200,
          );
        } else {
          this.toast('info', 'Not available on iPhone', 'iOS does not expose hardware buttons to this bridge.');
        }
      } catch (error) {
        this.toast('error', 'iPhone gesture failed', messageOf(error));
      }
      return;
    }
    try {
      await this.adb.key(device.serial, KEYCODES[key]);
    } catch (error) {
      this.toast('error', 'Key press failed', messageOf(error));
    }
  }

  async typeText(text: string): Promise<void> {
    const device = this.activeDevice;
    if (!device) return;
    if (device.isDemo) {
      this.toast('info', 'Keyboard input is visual only in the demo');
      return;
    }
    if (device.platform === 'ios') {
      this.toast('info', 'iOS typing needs a WebDriverAgent session', 'Not part of stage 01.');
      return;
    }
    if (/[^\x00-\x7F]/.test(text)) {
      this.toast('info', 'ASCII only over adb', 'Android’s input command cannot type non-ASCII characters.');
    }
    try {
      await this.adb.typeText(device.serial, text);
    } catch (error) {
      this.toast('error', 'Typing failed', messageOf(error));
    }
  }

  // -------------------------------------------------------------------------
  // Store and apps
  // -------------------------------------------------------------------------

  async openStore(appId?: string): Promise<void> {
    const device = this.activeDevice;
    if (!device) {
      this.toast('error', 'No device selected');
      return;
    }
    const target = device.platform;
    if (device.isDemo) {
      const demo = this.activeDemo;
      if (appId && demo) demo.openDetail(appId);
      else demo?.openStore();
      this.sendDemoFrame(true);
      this.log('info', appId ? `Opened ${CATALOG_BY_ID[appId]?.name ?? 'app'} in the demo store` : 'Opened the demo store');
      return;
    }
    const link = storeLink({ platform: target, appId });
    try {
      await this.openUrlOnDevice(device, link.deep, link.web);
      if (appId) {
        const app = CATALOG_BY_ID[appId];
        this.log('info', `Opened ${app.name} on the ${target === 'ios' ? 'App Store' : 'Play Store'}`, link.web);
      } else {
        this.log('info', `Opened the ${target === 'ios' ? 'App Store' : 'Play Store'} on ${device.name}`);
      }
    } catch (error) {
      this.log('warn', 'Could not open the store directly', messageOf(error));
      await this.showQr(appId ?? '');
    }
  }

  async searchStore(query: string): Promise<void> {
    const trimmed = query.trim();
    const device = this.activeDevice;
    if (!device) return;
    if (device.isDemo) {
      const demo = this.activeDemo;
      demo?.search(trimmed);
      this.sendDemoFrame(true);
      this.log('info', `Searched the demo store for “${trimmed}”`);
      return;
    }
    const link = storeLink({ platform: device.platform, query: trimmed });
    try {
      await this.openUrlOnDevice(device, link.deep, link.web);
      this.log('info', `Searching the ${device.platform === 'ios' ? 'App Store' : 'Play Store'} for “${trimmed}”`);
    } catch (error) {
      this.log('warn', 'Store search failed', messageOf(error));
      await this.showQr('');
    }
  }

  private async openUrlOnDevice(device: DeviceInfo, deep: string, web: string): Promise<void> {
    if (device.platform === 'android') {
      try {
        await this.adb.openUrl(device.serial, deep);
      } catch {
        await this.adb.openUrl(device.serial, web);
      }
      return;
    }
    if (!this.ios.canOpenUrl) {
      throw new Error('idb is required to open a URL on iPhone.');
    }
    try {
      await this.ios.openUrl(device.serial, deep);
    } catch {
      await this.ios.openUrl(device.serial, web);
    }
  }

  async installApp(appId: string): Promise<void> {
    const app = CATALOG_BY_ID[appId];
    const device = this.activeDevice;
    if (!app || !device) return;

    if (device.isDemo) {
      const demo = this.activeDemo;
      if (!demo) return;
      if (demo.isInstalled(appId)) {
        demo.openApp(appId);
        this.sendDemoFrame(true);
        return;
      }
      if (demo.startInstall(appId)) {
        this.emitInstall({ appId, phase: 'downloading', progress: 0.02, message: 'Starting demo download' });
        this.log('info', `${app.name} · downloading on the demo phone`, `${app.size} · demo store`);
        this.sendDemoFrame(true);
      }
      return;
    }

    if (!device.capabilities.store) {
      await this.showQr(appId);
      this.log('warn', `Can’t open the App Store automatically`, device.hint ?? undefined);
      return;
    }

    this.pendingInstall = { deviceId: device.id, appId, startedAt: Date.now() };
    this.emitInstall({
      appId,
      phase: 'queued',
      progress: 0.1,
      message: 'Finish the install on your phone',
    });
    this.log('info', `Opened ${app.name} in the ${device.platform === 'ios' ? 'App Store' : 'Play Store'}`, 'Waiting for the install to complete on the phone.');
    this.startInstallWatch();
    await this.openStore(appId);
  }

  private startInstallWatch(): void {
    if (this.installWatch) clearInterval(this.installWatch);
    this.installWatch = setInterval(() => void this.checkPendingInstall(true), 1600);
  }

  private async checkPendingInstall(active = false): Promise<void> {
    const pending = this.pendingInstall;
    if (!pending) return;
    const device = this.activeDevice;
    if (!device || device.id !== pending.deviceId) {
      this.pendingInstall = null;
      if (this.installWatch) clearInterval(this.installWatch);
      this.installWatch = null;
      return;
    }
    if (!device.isDemo && !active) {
      // The periodic installed list already refreshed; inspect it first.
      const app = CATALOG_BY_ID[pending.appId];
      const hit = this.installed.find(
        (item) =>
          item.appId === pending.appId ||
          item.packageId === app.androidPackage ||
          item.packageId === app.iosBundleId,
      );
      if (hit) {
        this.finishInstall(app, device);
        return;
      }
    }
    if (active) {
      try {
        let found = false;
        const app = CATALOG_BY_ID[pending.appId];
        if (device.platform === 'android') {
          const { all } = await this.adb.installedPackages(device.serial);
          found = all.has(app.androidPackage);
        } else {
          const apps = await this.ios.installedApps(device.serial);
          found = apps.some((item) => item.bundleId === app.iosBundleId);
        }
        if (found) {
          this.finishInstall(app, device);
          return;
        }
      } catch {
        // The store may still be foregrounded; retry next tick.
      }
    }
    if (Date.now() - pending.startedAt > 300_000) {
      this.pendingInstall = null;
      if (this.installWatch) clearInterval(this.installWatch);
      this.installWatch = null;
      this.emitInstall({
        appId: pending.appId,
        phase: 'failed',
        progress: 0,
        message: 'Timed out waiting for the install',
      });
      this.log('warn', `${CATALOG_BY_ID[pending.appId].name} was not installed`, 'Finish the download in the store, then refresh.');
    }
  }

  private finishInstall(app: CatalogApp, device: DeviceInfo): void {
    this.pendingInstall = null;
    if (this.installWatch) clearInterval(this.installWatch);
    this.installWatch = null;
    this.emitInstall({ appId: app.id, phase: 'done', progress: 1, message: `Installed on ${device.name}` });
    this.log('success', `${app.name} installed on ${device.name}`);
    this.toast('success', `${app.name} is installed`, 'Open it from the Installed tab or the phone screen.');
    void this.refreshInstalled();
  }

  async openApp(packageId: string): Promise<void> {
    const device = this.activeDevice;
    if (!device) return;
    const catalog =
      CATALOG.find((app) => app.id === packageId) ?? findAppByPackage(packageId);
    const target =
      catalog && device.platform === 'ios' ? catalog.iosBundleId : (catalog?.androidPackage ?? packageId);
    try {
      if (device.isDemo) {
        const demo = this.activeDemo;
        if (!demo) return;
        const opened = catalog ? demo.openApp(catalog.id) : demo.openPackage(packageId);
        if (!opened) {
          this.toast('info', 'Not installed yet', 'Install it from the store first.');
          return;
        }
        this.sendDemoFrame(true);
        this.log('success', `${catalog?.name ?? packageId} opened`, 'Demo device');
        return;
      }
      if (device.platform === 'android') {
        await this.adb.launch(device.serial, target);
      } else {
        await this.ios.launch(device.serial, target);
      }
      this.log('success', `${catalog?.name ?? packageId} launched`, device.name);
    } catch (error) {
      this.toast('error', 'Could not launch app', messageOf(error));
      this.log('error', `Launch failed for ${catalog?.name ?? packageId}`, messageOf(error));
    }
  }

  async installFromFile(): Promise<void> {
    const device = this.activeDevice;
    const window = this.options.getWindow();
    if (!device) return;
    if (device.isDemo) {
      this.toast('info', 'Demo devices don’t accept files', 'Connect a real phone to sideload.');
      return;
    }
    const filters =
      device.platform === 'android'
        ? [{ name: 'Android package', extensions: ['apk'] }]
        : [{ name: 'iOS app', extensions: ['ipa'] }];
    const options = {
      title: device.platform === 'android' ? 'Install an APK' : 'Install an IPA',
      properties: ['openFile' as const],
      filters,
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return;
    const file = result.filePaths[0];
    this.log('info', `Installing ${file.split('/').pop()}`, device.name);
    try {
      if (device.platform === 'android') {
        const message = await this.adb.install(device.serial, file);
        this.log('success', 'APK installed', message);
      } else {
        const message = await this.ios.install(device.serial, file);
        this.log('success', 'IPA installed', message);
      }
      this.toast('success', 'App installed', 'The Installed tab has been refreshed.');
      await this.refreshInstalled();
    } catch (error) {
      this.toast('error', 'Install failed', messageOf(error));
      this.log('error', 'Install failed', messageOf(error));
    }
  }

  // -------------------------------------------------------------------------
  // QR, Wi-Fi, misc
  // -------------------------------------------------------------------------

  async showQr(appId: string): Promise<void> {
    const device = this.activeDevice;
    const platform = device?.platform ?? 'android';
    const app = appId ? CATALOG_BY_ID[appId] : null;
    const link = storeLink({ platform, appId: app?.id });
    const url = app ? link.web : platform === 'ios' ? 'https://apps.apple.com' : 'https://play.google.com/store/apps';
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      width: 420,
      color: { dark: '#0b0c0f', light: '#ffffff' },
    });
    this.qr = {
      appId: app?.id ?? '',
      title: app ? `Get ${app.name}` : 'Open the store',
      subtitle: `Scan with your ${platform === 'ios' ? 'iPhone' : 'Android'} camera`,
      dataUrl,
      url,
    };
    this.emitState();
  }

  async hideQr(): Promise<void> {
    this.qr = null;
    this.emitState();
  }

  async connectWifi(address: string): Promise<AppState> {
    const target = address.trim();
    if (!target) return this.getState();
    if (!this.adb.path) {
      this.toast('error', 'adb not found', 'Install Android platform-tools first.');
      return this.getState();
    }
    try {
      const message = await this.adb.connect(target);
      this.log('success', 'Wi-Fi connection requested', message);
      await new Promise((resolve) => setTimeout(resolve, 800));
      await this.refreshDevices();
      this.toast('success', 'Connected', 'Checking for the device…');
    } catch (error) {
      this.toast('error', 'Wi-Fi connection failed', messageOf(error));
      this.log('error', 'Wi-Fi connection failed', messageOf(error));
    }
    return this.getState();
  }

  async openExternal(url: string): Promise<void> {
    if (!/^https?:\/\//.test(url)) return;
    await shell.openExternal(url);
  }

  async clearActivity(): Promise<void> {
    this.activity = [];
    this.emitState();
  }

  getCatalogCategories(): string[] {
    return APP_CATEGORIES;
  }

  /** Used by the screenshot harness and for late-joining renderers. */
  replayLastFrame(): void {
    // Frames are intentionally not cached; the engine sends a fresh one within
    // one interval of a renderer subscribing.
  }

  async openDataFolder(): Promise<void> {
    await shell.openPath(this.options.dataDir);
  }

  getDataPath(): string {
    return app.getPath('userData');
  }

  hasTool(id: string): boolean {
    return this.tools.find((tool) => tool.id === id)?.found ?? false;
  }

}

function messageOf(error: unknown): string {
  if (error instanceof AdbError) return error.message || 'adb error';
  return error instanceof Error ? error.message : String(error);
}

function isStoredModel(value: unknown): value is PhoneModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<PhoneModel>;
  const screen = model.screen as { width?: unknown; height?: unknown } | undefined;
  return (
    typeof model.id === 'string' &&
    model.id.startsWith('custom-') &&
    (model.platform === 'android' || model.platform === 'ios') &&
    typeof model.name === 'string' &&
    model.name.trim().length > 0 &&
    typeof model.manufacturer === 'string' &&
    typeof model.osVersion === 'string' &&
    typeof model.frameColor === 'string' &&
    /^#[0-9a-f]{6}$/i.test(model.frameColor) &&
    typeof model.displayInches === 'number' &&
    model.displayInches > 2 &&
    model.displayInches < 15 &&
    Boolean(screen) &&
    Number.isFinite(Number(screen?.width)) &&
    Number.isFinite(Number(screen?.height)) &&
    Number(screen?.width) >= 200 &&
    Number(screen?.width) <= 6000 &&
    Number(screen?.height) >= 200 &&
    Number(screen?.height) <= 6000
  );
}

function normalizeNewModel(input: NewPhoneModel): NewPhoneModel {
  const platform: PhonePlatform = input.platform === 'ios' ? 'ios' : 'android';
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
  const manufacturer = String(input.manufacturer ?? '').trim().slice(0, 32);
  const osVersion = String(input.osVersion ?? '').trim().slice(0, 20);
  const width = Math.round(Number(input.screen?.width));
  const height = Math.round(Number(input.screen?.height));
  const displayInches = Number(input.displayInches);
  const frameColor = /^#[0-9a-f]{6}$/i.test(String(input.frameColor))
    ? String(input.frameColor)
    : '#8b8f96';
  if (!name) throw new Error('Give the phone model a name.');
  if (!Number.isFinite(width) || width < 320 || width > 5000) {
    throw new Error('Screen width must be between 320 and 5000 pixels.');
  }
  if (!Number.isFinite(height) || height < 480 || height > 5000) {
    throw new Error('Screen height must be between 480 and 5000 pixels.');
  }
  if (!Number.isFinite(displayInches) || displayInches < 3 || displayInches > 12) {
    throw new Error('Screen size must be between 3 and 12 inches.');
  }
  return {
    platform,
    name,
    manufacturer: manufacturer || (platform === 'ios' ? 'Apple' : 'Custom'),
    osVersion: osVersion || (platform === 'ios' ? '26' : '16'),
    screen: { width, height },
    displayInches: Math.round(displayInches * 100) / 100,
    frameColor,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cleanModel(model: string): string {
  return model.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Android device';
}
