import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export interface IosDeviceDetails {
  udid: string;
  name: string;
  model: string;
  osVersion: string;
  resolution: { width: number; height: number } | null;
  battery: number | null;
  connection: 'usb' | 'wifi';
  state: string;
}

export interface IosApp {
  bundleId: string;
  name: string;
  version: string | null;
  system: boolean;
}

const IDB_CANDIDATES = [
  '/opt/homebrew/bin/idb',
  '/usr/local/bin/idb',
  join(homedir(), '.local/bin/idb'),
  join(homedir(), 'Library/Python/3.9/bin/idb'),
];

const TOOL_CANDIDATES: Record<string, string[]> = {
  idevice_id: ['/opt/homebrew/bin/idevice_id', '/usr/local/bin/idevice_id'],
  ideviceinfo: ['/opt/homebrew/bin/ideviceinfo', '/usr/local/bin/ideviceinfo'],
  idevicescreenshot: [
    '/opt/homebrew/bin/idevicescreenshot',
    '/usr/local/bin/idevicescreenshot',
  ],
  ideviceinstaller: [
    '/opt/homebrew/bin/ideviceinstaller',
    '/usr/local/bin/ideviceinstaller',
  ],
  sips: ['/usr/bin/sips'],
};

/** iPhone hardware identifiers → marketing names (best effort, extends over time). */
const IPHONE_NAMES: Record<string, string> = {
  'iPhone12,1': 'iPhone 11',
  'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE (2nd gen)',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,2': 'iPhone 13 Pro',
  'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,4': 'iPhone 13 mini',
  'iPhone14,5': 'iPhone 13',
  'iPhone14,6': 'iPhone SE (3rd gen)',
  'iPhone14,7': 'iPhone 14',
  'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro',
  'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15',
  'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro',
  'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro',
  'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,3': 'iPhone 16',
  'iPhone17,4': 'iPhone 16 Plus',
  'iPhone17,5': 'iPhone 16e',
};

export class IosBridge {
  private idbPath: string | null = null;
  private tools = new Map<string, string | null>();
  private devicectl: string | null = null;
  private probed = false;

  probe(): void {
    if (this.probed) return;
    this.probed = true;
    this.idbPath =
      IDB_CANDIDATES.find((candidate) => existsSync(candidate)) ??
      whichSync('idb');
    for (const [tool, candidates] of Object.entries(TOOL_CANDIDATES)) {
      this.tools.set(tool, candidates.find((c) => existsSync(c)) ?? whichSync(tool));
    }
    const xcrun = whichSync('xcrun');
    if (xcrun) {
      try {
        this.devicectl = execFileSyncSafe(xcrun, ['--find', 'devicectl']);
      } catch {
        this.devicectl = null;
      }
    }
  }

  get hasIdb(): boolean {
    this.probe();
    return Boolean(this.idbPath);
  }

  get hasDevicectl(): boolean {
    this.probe();
    return Boolean(this.devicectl);
  }

  get hasLibimobiledevice(): boolean {
    this.probe();
    return Boolean(this.tool('idevice_id') && this.tool('ideviceinfo'));
  }

  get canList(): boolean {
    return this.hasIdb || this.hasLibimobiledevice || this.hasDevicectl;
  }

  get canScreenshot(): boolean {
    return this.hasIdb || Boolean(this.tool('idevicescreenshot'));
  }

  get canLaunch(): boolean {
    return this.hasIdb || this.hasDevicectl;
  }

  get canOpenUrl(): boolean {
    return this.hasIdb;
  }

  get canTap(): boolean {
    return this.hasIdb;
  }

  get canInstall(): boolean {
    return Boolean(this.tool('ideviceinstaller')) || this.hasDevicectl;
  }

  private tool(name: string): string | null {
    this.probe();
    return this.tools.get(name) ?? null;
  }

  private async run(
    bin: string,
    args: string[],
    timeout = 20_000,
  ): Promise<{ stdout: string; stderr: string }> {
    return await new Promise((resolve, reject) => {
      execFile(
        bin,
        args,
        { timeout, maxBuffer: 24 * 1024 * 1024, encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(String(stderr || error.message).trim()));
            return;
          }
          resolve({ stdout: String(stdout), stderr: String(stderr) });
        },
      );
    });
  }

  async listDevices(): Promise<IosDeviceDetails[]> {
    if (this.hasIdb && this.idbPath) {
      try {
        const { stdout } = await this.run(this.idbPath, ['list-targets', '--json'], 20_000);
        return parseIdbTargets(stdout);
      } catch {
        // fall through
      }
    }
    if (this.hasLibimobiledevice) {
      const ids = await this.listWithLibimobiledevice();
      if (ids.length) return ids;
    }
    if (this.hasDevicectl && this.devicectl) {
      try {
        return await this.listWithDevicectl();
      } catch {
        // ignore
      }
    }
    return [];
  }

  private async listWithLibimobiledevice(): Promise<IosDeviceDetails[]> {
    const bin = this.tool('idevice_id');
    if (!bin) return [];
    let out = '';
    try {
      out = (await this.run(bin, ['-l'], 12_000)).stdout;
    } catch {
      return [];
    }
    const udids = out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const results = await Promise.all(
      udids.map(async (udid) => this.describeWithLibimobiledevice(udid)),
    );
    return results.filter((item): item is IosDeviceDetails => item !== null);
  }

  private async describeWithLibimobiledevice(udid: string): Promise<IosDeviceDetails | null> {
    const info = this.tool('ideviceinfo');
    if (!info) return null;
    const read = async (key: string): Promise<string> => {
      try {
        return (await this.run(info, ['-u', udid, '-k', key], 8_000)).stdout.trim();
      } catch {
        return '';
      }
    };
    const [productType, osVersion, deviceName, batteryRaw, linkType] = await Promise.all([
      read('ProductType'),
      read('ProductVersion'),
      read('DeviceName'),
      read('BatteryCurrentCapacity'),
      read('ConnectionType'),
    ]);
    if (!productType && !deviceName) return null;
    const battery = Number(batteryRaw);
    return {
      udid,
      name: deviceName || IPHONE_NAMES[productType] || 'iPhone',
      model: IPHONE_NAMES[productType] || productType || 'iPhone',
      osVersion: osVersion ? `iOS ${osVersion}` : 'iOS',
      resolution: null,
      battery: Number.isFinite(battery) && battery >= 0 && battery <= 100 ? battery : null,
      connection: /network|wifi/i.test(linkType) ? 'wifi' : 'usb',
      state: 'online',
    };
  }

  private async listWithDevicectl(): Promise<IosDeviceDetails[]> {
    if (!this.devicectl) return [];
    const outPath = join(tmpdir(), `phoneexplorer-devicectl-${process.pid}.json`);
    try {
      await this.run(
        this.devicectl,
        ['list', 'devices', '--json-output', outPath, '--quiet'],
        25_000,
      );
      const raw = await fs.readFile(outPath, 'utf8');
      return parseDevicectlDevices(raw);
    } finally {
      void fs.unlink(outPath).catch(() => undefined);
    }
  }

  async screenshot(udid: string): Promise<Buffer> {
    const dir = await fs.mkdtemp(join(tmpdir(), 'phoneexplorer-ios-'));
    try {
      if (this.hasIdb && this.idbPath) {
        const png = join(dir, 'screen.png');
        await this.run(this.idbPath, ['screenshot', png, '--udid', udid], 25_000);
        return await fs.readFile(png);
      }
      const shot = this.tool('idevicescreenshot');
      const sips = this.tool('sips');
      if (!shot || !sips) {
        throw new Error(
          'iOS screenshots need idb or libimobiledevice. Run: brew install libimobiledevice',
        );
      }
      const tiff = join(dir, 'screen.tiff');
      const png = join(dir, 'screen.png');
      await this.run(shot, ['-u', udid, tiff], 25_000);
      await this.run(sips, ['-s', 'format', 'png', tiff, '--out', png], 20_000);
      return await fs.readFile(png);
    } finally {
      void fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async installedApps(udid: string): Promise<IosApp[]> {
    if (this.hasIdb && this.idbPath) {
      try {
        const { stdout } = await this.run(
          this.idbPath,
          ['list-apps', '--udid', udid, '--json'],
          30_000,
        );
        return parseIdbApps(stdout);
      } catch {
        // fall through
      }
    }
    const installer = this.tool('ideviceinstaller');
    if (installer) {
      const { stdout } = await this.run(installer, ['-u', udid, '-l'], 30_000);
      return parseIdeviceInstallerList(stdout);
    }
    return [];
  }

  async openUrl(udid: string, url: string): Promise<void> {
    if (!this.idbPath) {
      throw new Error('Opening a store link on iPhone needs idb (brew tap facebook/fb && brew install idb-companion, then pipx install fb-idb).');
    }
    await this.run(this.idbPath, ['open-url', url, '--udid', udid], 20_000);
  }

  async launch(udid: string, bundleId: string): Promise<string> {
    if (this.idbPath) {
      const { stdout } = await this.run(
        this.idbPath,
        ['launch', bundleId, '--udid', udid],
        25_000,
      );
      return stdout.trim();
    }
    if (this.devicectl) {
      await this.run(
        this.devicectl,
        ['device', 'process', 'launch', '--device', udid, bundleId],
        30_000,
      );
      return `Launched ${bundleId}`;
    }
    throw new Error('Launching an iPhone app needs idb or Xcode 15+ (devicectl).');
  }

  async tap(udid: string, x: number, y: number): Promise<void> {
    if (!this.idbPath) throw new Error('Touch input on iPhone needs idb.');
    await this.run(this.idbPath, ['ui', 'tap', String(Math.round(x)), String(Math.round(y)), '--udid', udid], 15_000);
  }

  async swipe(
    udid: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs = 300,
  ): Promise<void> {
    if (!this.idbPath) throw new Error('Touch input on iPhone needs idb.');
    await this.run(
      this.idbPath,
      [
        'ui',
        'swipe',
        String(Math.round(x1)),
        String(Math.round(y1)),
        String(Math.round(x2)),
        String(Math.round(y2)),
        '--duration',
        String(durationMs / 1000),
        '--udid',
        udid,
      ],
      15_000,
    );
  }

  async install(udid: string, ipaPath: string): Promise<string> {
    const installer = this.tool('ideviceinstaller');
    if (installer) {
      const { stdout } = await this.run(installer, ['-u', udid, '-i', ipaPath], 180_000);
      return stdout.trim() || 'Installed';
    }
    if (this.devicectl) {
      await this.run(
        this.devicectl,
        ['device', 'install', 'app', '--device', udid, ipaPath],
        180_000,
      );
      return 'Installed';
    }
    throw new Error('Installing an IPA needs libimobiledevice or Xcode 15+.');
  }
}

function whichSync(command: string): string | null {
  const paths = (process.env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of paths) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function execFileSyncSafe(bin: string, args: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
  return execFileSync(bin, args, { encoding: 'utf8', timeout: 10_000 }).trim() || '';
}

export function parseIdbTargets(raw: string): IosDeviceDetails[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const rows = Array.isArray(data) ? data : [];
  const result: IosDeviceDetails[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const targetType = String(r.target_type ?? r.targetType ?? 'device');
    if (targetType.includes('simulator')) continue;
    const udid = String(r.udid ?? r.identifier ?? '');
    if (!udid) continue;
    const os = String(r.os_version ?? r.osVersion ?? '');
    const model = String(r.model ?? r.hardware_model ?? r.product_type ?? 'iPhone');
    result.push({
      udid,
      name: String(r.name ?? IPHONE_NAMES[model] ?? 'iPhone'),
      model: IPHONE_NAMES[model] ?? model,
      osVersion: os ? (os.toLowerCase().startsWith('ios') ? os : `iOS ${os}`) : 'iOS',
      resolution: null,
      battery: null,
      connection: String(r.connection_type ?? r.transport ?? '').toLowerCase().includes('wifi')
        ? 'wifi'
        : 'usb',
      state: 'online',
    });
  }
  return result;
}

export function parseDevicectlDevices(raw: string): IosDeviceDetails[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const root = data as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const devices = Array.isArray(result.devices) ? result.devices : [];
  const out: IosDeviceDetails[] = [];
  for (const row of devices) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const hardware = (r.hardwareProperties ?? {}) as Record<string, unknown>;
    const props = (r.deviceProperties ?? {}) as Record<string, unknown>;
    const conn = (r.connectionProperties ?? {}) as Record<string, unknown>;
    const udid = String(r.identifier ?? hardware.udid ?? '');
    if (!udid) continue;
    const productType = String(hardware.productType ?? hardware.productTypeName ?? '');
    const name = String(props.name ?? hardware.marketingName ?? IPHONE_NAMES[productType] ?? 'iPhone');
    const os = String(props.osVersionNumber ?? '');
    const paired = conn.paired !== false;
    out.push({
      udid,
      name,
      model: IPHONE_NAMES[productType] ?? String(hardware.marketingName ?? productType ?? 'iPhone'),
      osVersion: os ? `iOS ${os}` : 'iOS',
      resolution: null,
      battery: null,
      connection: String(conn.transportType ?? '').toLowerCase().includes('wifi') ? 'wifi' : 'usb',
      state: paired ? 'online' : 'unauthorized',
    });
  }
  return out;
}

export function parseIdbApps(raw: string): IosApp[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>).apps)
      ? ((data as Record<string, unknown>).apps as unknown[])
      : [];
  const out: IosApp[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const bundleId = String(r.bundle_id ?? r.bundleId ?? r.CFBundleIdentifier ?? '');
    if (!bundleId) continue;
    out.push({
      bundleId,
      name: String(r.name ?? r.CFBundleDisplayName ?? bundleId),
      version: r.version ? String(r.version) : null,
      system: String(r.type ?? '').toLowerCase() === 'system',
    });
  }
  return out;
}

export function parseIdeviceInstallerList(raw: string): IosApp[] {
  const out: IosApp[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^CFBundleIdentifier/i.test(trimmed)) continue;
    const parts = trimmed.split(',').map((p) => p.trim());
    if (!parts[0]) continue;
    out.push({
      bundleId: parts[0],
      name: parts[2] || parts[0],
      version: parts[1] || null,
      system: false,
    });
  }
  return out;
}
