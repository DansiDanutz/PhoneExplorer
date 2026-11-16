import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

export interface RawAdbDevice {
  serial: string;
  state: string;
  model: string | null;
  transportId: string | null;
}

export interface AndroidDeviceDetails {
  model: string;
  osVersion: string;
  sdk: string;
  resolution: { width: number; height: number } | null;
  battery: number | null;
}

export interface ExecResult {
  stdout: Buffer;
  stderr: string;
  code: number;
}

const ADB_CANDIDATES = [
  '/opt/homebrew/bin/adb',
  '/usr/local/bin/adb',
  join(homedir(), 'Library/Android/sdk/platform-tools/adb'),
  join(homedir(), 'Android/Sdk/platform-tools/adb'),
  join(homedir(), 'AppData/Local/Android/Sdk/platform-tools/adb.exe'),
  '/usr/bin/adb',
];

function adbOnPath(): string | null {
  const name = process.platform === 'win32' ? 'adb.exe' : 'adb';
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export class AdbError extends Error {
  constructor(
    message: string,
    public readonly stderr = '',
    public readonly code = 1,
  ) {
    super(message);
    this.name = 'AdbError';
  }
}

/**
 * Thin, dependency-free wrapper around the Android platform tools. We shell out
 * to the user's adb instead of shipping a binary, so the app stays small and
 * works with whatever SDK / device pairing the user already has.
 */
export class AdbClient {
  private resolved: string | null = null;

  constructor(private readonly customPath: () => string) {
    this.resolved = this.detect();
  }

  get path(): string | null {
    if (!this.resolved) this.resolved = this.detect();
    return this.resolved;
  }

  refreshPath(): string | null {
    this.resolved = this.detect();
    return this.resolved;
  }

  private detect(): string | null {
    const custom = this.customPath().trim();
    if (custom && existsSync(custom)) return custom;
    for (const candidate of ADB_CANDIDATES) {
      if (existsSync(candidate)) return candidate;
    }
    return adbOnPath();
  }

  async run(args: string[], timeout = 20_000): Promise<ExecResult> {
    const bin = this.path;
    if (!bin) {
      throw new AdbError(
        'adb was not found. Install Android platform-tools or set the adb path in Settings.',
      );
    }
    return await new Promise<ExecResult>((resolve, reject) => {
      execFile(
        bin,
        args,
        { timeout, maxBuffer: 48 * 1024 * 1024, encoding: 'buffer' },
        (error, stdout, stderr) => {
          const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '');
          const err = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr ?? '');
          if (error) {
            const e = error as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
            if (e.killed) {
              reject(new AdbError(`adb timed out after ${timeout}ms`, err, 124));
              return;
            }
            // Many adb commands exit non-zero with useful output; keep it.
            reject(new AdbError(err.trim() || e.message, err, typeof e.code === 'number' ? e.code : 1));
            return;
          }
          resolve({ stdout: out, stderr: err, code: 0 });
        },
      );
    });
  }

  async text(serial: string, args: string[], timeout?: number): Promise<string> {
    const res = await this.run(['-s', serial, ...args], timeout);
    return res.stdout.toString('utf8').replace(/\r\n/g, '\n');
  }

  async startServer(): Promise<void> {
    try {
      await this.run(['start-server'], 10_000);
    } catch {
      // adb prints "daemon not running" on stderr with exit 0 on most setups.
    }
  }

  async listDevices(): Promise<RawAdbDevice[]> {
    const out = await this.textRaw(['devices', '-l']);
    const lines = out.split('\n').slice(1);
    const devices: RawAdbDevice[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const serial = parts[0];
      const state = parts[1] ?? 'unknown';
      if (!serial) continue;
      const meta: Record<string, string> = {};
      for (const part of parts.slice(2)) {
        const idx = part.indexOf(':');
        if (idx > 0) meta[part.slice(0, idx)] = part.slice(idx + 1);
      }
      devices.push({
        serial,
        state,
        model: meta.model ?? null,
        transportId: meta.transport_id ?? null,
      });
    }
    return devices;
  }

  private async textRaw(args: string[]): Promise<string> {
    const bin = this.path;
    if (!bin) throw new AdbError('adb was not found');
    return await new Promise<string>((resolve, reject) => {
      execFile(
        bin,
        args,
        { timeout: 12_000, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new AdbError(String(stderr || error.message)));
            return;
          }
          resolve(String(stdout).replace(/\r\n/g, '\n'));
        },
      );
    });
  }

  async details(serial: string): Promise<AndroidDeviceDetails> {
    const props = await this.safeText(serial, ['shell', 'getprop'], 8_000);
    const map = parseGetprop(props);
    const model =
      map['ro.product.marketname'] ||
      map['ro.product.vendor.marketname'] ||
      map['ro.product.model'] ||
      map['ro.product.name'] ||
      'Android device';
    const osVersion = map['ro.build.version.release'] || 'Android';
    const sdk = map['ro.build.version.sdk'] || '';
    let resolution: AndroidDeviceDetails['resolution'] = null;
    try {
      const wm = await this.text(serial, ['shell', 'wm', 'size'], 6_000);
      resolution = parseWmSize(wm);
    } catch {
      // Some devices restrict wm; keep null.
    }
    let battery: number | null = null;
    try {
      const dump = await this.text(serial, ['shell', 'dumpsys', 'battery'], 6_000);
      const m = /level:\s*(\d+)/.exec(dump);
      if (m) battery = Math.max(0, Math.min(100, Number(m[1])));
    } catch {
      // ignore
    }
    return { model, osVersion, sdk, resolution, battery };
  }

  private async safeText(
    serial: string,
    args: string[],
    timeout: number,
  ): Promise<string> {
    try {
      return await this.text(serial, args, timeout);
    } catch (error) {
      if (error instanceof AdbError) return '';
      throw error;
    }
  }

  async installedPackages(serial: string): Promise<{ all: Set<string>; thirdParty: Set<string> }> {
    const allOut = await this.text(serial, ['shell', 'pm', 'list', 'packages'], 15_000);
    const all = parsePackageList(allOut);
    let thirdParty = new Set<string>();
    try {
      const tpOut = await this.text(serial, ['shell', 'pm', 'list', 'packages', '-3'], 15_000);
      thirdParty = parsePackageList(tpOut);
    } catch {
      thirdParty = all;
    }
    return { all, thirdParty };
  }

  async launch(serial: string, packageId: string): Promise<string> {
    try {
      const out = await this.text(
        serial,
        ['shell', 'monkey', '-p', packageId, '-c', 'android.intent.category.LAUNCHER', '1'],
        15_000,
      );
      if (/No activities found|monkey aborted|crash/i.test(out)) {
        throw new AdbError(out.trim());
      }
      return out.trim();
    } catch {
      const resolved = await this.text(
        serial,
        ['shell', 'cmd', 'package', 'resolve-activity', '--brief', packageId],
        10_000,
      );
      const component = resolved
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[\w.]+\/[\w.$]+$/.test(line))
        .pop();
      if (!component) {
        throw new AdbError(
          `No launchable activity found for ${packageId}. The app may be disabled or have no launcher icon.`,
        );
      }
      await this.text(serial, ['shell', 'am', 'start', '-n', component], 15_000);
      return `Started ${component}`;
    }
  }

  async openUrl(serial: string, url: string): Promise<void> {
    const out = await this.text(
      serial,
      ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url],
      15_000,
    );
    if (/Error:|Exception|not found/i.test(out) && !/Starting:/i.test(out)) {
      throw new AdbError(out.trim());
    }
  }

  async tap(serial: string, x: number, y: number): Promise<void> {
    await this.text(serial, ['shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))], 10_000);
  }

  async swipe(
    serial: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs = 300,
  ): Promise<void> {
    await this.text(
      serial,
      [
        'shell',
        'input',
        'swipe',
        String(Math.round(x1)),
        String(Math.round(y1)),
        String(Math.round(x2)),
        String(Math.round(y2)),
        String(Math.round(durationMs)),
      ],
      10_000,
    );
  }

  async key(serial: string, keyCode: number): Promise<void> {
    await this.text(serial, ['shell', 'input', 'keyevent', String(keyCode)], 10_000);
  }

  async typeText(serial: string, text: string): Promise<void> {
    // `input text` is ASCII-only. Replace spaces with %s and escape shell chars.
    const encoded = text
      .replace(/\s/g, '%s')
      .replace(/([\\()&|;<>*?!$`"'#])/g, '\\$1');
    await this.text(serial, ['shell', 'input', 'text', encoded], 15_000);
  }

  async screenshot(serial: string): Promise<Buffer> {
    try {
      const res = await this.run(['-s', serial, 'exec-out', 'screencap', '-p'], 15_000);
      const buf = res.stdout;
      if (isPng(buf)) return buf;
    } catch {
      // fall through to the pull-based path
    }
    const remote = `/sdcard/phoneexplorer-${Date.now()}.png`;
    const local = join(tmpdir(), `phoneexplorer-${Date.now()}.png`);
    await this.text(serial, ['shell', 'screencap', '-p', remote], 15_000);
    try {
      await this.run(['-s', serial, 'pull', remote, local], 25_000);
      const buf = await fs.readFile(local);
      if (isPng(buf)) return buf;
    } finally {
      void fs.unlink(local).catch(() => undefined);
      void this.text(serial, ['shell', 'rm', '-f', remote], 8_000).catch(() => undefined);
    }
    throw new AdbError('The device returned an empty screenshot.');
  }

  async install(serial: string, apkPath: string): Promise<string> {
    const res = await this.run(['-s', serial, 'install', '-r', '-g', apkPath], 180_000);
    const out = `${res.stdout.toString('utf8')}\n${res.stderr}`.trim();
    if (/Failure|INSTALL_FAILED/i.test(out)) {
      throw new AdbError(out);
    }
    return out.split('\n').filter(Boolean).pop() ?? 'Installed';
  }

  async connect(address: string): Promise<string> {
    const target = address.includes(':') ? address : `${address}:5555`;
    const res = await this.run(['connect', target], 20_000);
    const out = `${res.stdout.toString('utf8')}${res.stderr}`.trim();
    if (/failed|unable|cannot/i.test(out)) {
      throw new AdbError(out);
    }
    return out;
  }

  async disconnect(serial: string): Promise<void> {
    try {
      await this.run(['disconnect', serial], 8_000);
    } catch {
      // ignore
    }
  }
}

export function parseGetprop(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(line.trim());
    if (m) map[m[1]] = m[2];
  }
  return map;
}

export function parseWmSize(raw: string): { width: number; height: number } | null {
  const override = /Override size:\s*(\d+)x(\d+)/i.exec(raw);
  const physical = /Physical size:\s*(\d+)x(\d+)/i.exec(raw);
  const match = override ?? physical;
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

export function parsePackageList(raw: string): Set<string> {
  const set = new Set<string>();
  for (const line of raw.split('\n')) {
    const m = /^package:(.+)$/.exec(line.trim());
    if (m) set.add(m[1].trim());
  }
  return set;
}

export function isPng(buf: Buffer): boolean {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

export function prettyPackageName(packageId: string): string {
  const last = packageId.split('.').filter(Boolean).pop() ?? packageId;
  return last
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
