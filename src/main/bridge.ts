import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { AppState, ArtefactSection, KeyAction, Screenshot } from '../shared/types';
import type { DeviceManager } from './services/manager';

const KEY_ACTIONS = new Set<KeyAction>([
  'home',
  'back',
  'recents',
  'power',
  'wake',
  'volume_up',
  'volume_down',
]);

const PACKAGE_RE = /^[A-Za-z0-9_.]+$/;

interface BridgeOptions {
  manager: DeviceManager;
}

export interface BridgeHandle {
  port: number;
  file: string;
  close: () => Promise<void>;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function fail(res: ServerResponse, status: number, message: string): void {
  json(res, status, { ok: false, error: message });
}

async function body(req: IncomingMessage, limit = 2 * 1024 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  if (total === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim().slice(0, max);
}

function number(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a number between ${min} and ${max}.`);
  }
  return value;
}

async function summarizeState(state: AppState, manager: DeviceManager): Promise<Record<string, unknown>> {
  const active = state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
  return {
    ok: true,
    app: 'PhoneExplorer',
    version: state.version,
    pid: process.pid,
    activeDevice: active
      ? {
          id: active.id,
          name: active.name,
          serial: active.serial,
          platform: active.platform,
          isDemo: active.isDemo,
          resolution: active.resolution,
        }
      : null,
    devices: state.devices.map((device) => ({
      id: device.id,
      name: device.name,
      serial: device.serial,
      platform: device.platform,
      isDemo: device.isDemo,
    })),
    screenshotFolder: await manager.getScreenshotsFolder(),
  };
}

function artSummary(doc: Awaited<ReturnType<DeviceManager['getArtefact']>>): unknown {
  if (!doc) return null;
  return {
    ...doc,
    sections: doc.sections.map(({ image: _image, ...rest }) => rest),
  };
}

async function screenshotPayload(shot: Screenshot, manager: DeviceManager): Promise<Record<string, unknown>> {
  const image = await manager.loadScreenshot(shot.id);
  return {
    ...shot,
    image,
  };
}

async function makeArtefact(
  manager: DeviceManager,
  input: Record<string, unknown>,
): Promise<unknown> {
  const ids = Array.isArray(input.ids)
    ? input.ids.filter((id): id is string => typeof id === 'string').slice(0, 24)
    : [];
  if (ids.length === 0) throw new Error('ids must contain at least one screenshot id.');
  const all = await manager.listScreenshots();
  const chosen = ids
    .map((id) => all.find((shot) => shot.id === id))
    .filter((shot): shot is Screenshot => Boolean(shot));
  if (chosen.length === 0) throw new Error('No matching screenshots were found.');
  const sections: ArtefactSection[] = [];
  for (const shot of chosen) {
    const image = await manager.loadScreenshot(shot.id);
    const boxes = await manager.ocrScreenshot(shot.id).catch(() => []);
    const title =
      boxes
        .map((box) => box.text.trim())
        .filter(
          (value) =>
            value.length >= 4 &&
            !/^\d|^\d{1,2}:\d{2}|a\.m\.|p\.m\.|baterie|wi-fi|notification|^[$€£]/i.test(value),
        )
        .sort((a, b) => b.length - a.length)[0]
        ?.slice(0, 60) ??
      shot.caption?.slice(0, 60) ??
      shot.deviceName ??
      'Library screenshot';
    sections.push({
      id: shot.id,
      title,
      description:
        shot.caption ??
        `Selected from the Library · ${new Date(shot.createdAt).toLocaleString()}`,
      image,
    });
  }
  const doc = await manager.saveArtefact({
    title: typeof input.title === 'string' && input.title.trim()
      ? input.title.trim().slice(0, 120)
      : `Selected screens · ${new Date().toLocaleDateString()}`,
    subtitle:
      typeof input.subtitle === 'string' && input.subtitle.trim()
        ? input.subtitle.trim().slice(0, 300)
        : `${sections.length} screenshots selected through the MCP bridge.`,
    deviceName: 'MCP · Screenshot Library',
    sections,
    quiet: true,
  });
  return artSummary(doc);
}

function route(
  pathname: string,
): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized;
}

export async function startMcpBridge({ manager }: BridgeOptions): Promise<BridgeHandle> {
  const token = randomBytes(32).toString('hex');
  const file = join(app.getPath('userData'), 'mcp-bridge.json');
  let server: Server;
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const origin = req.socket.remoteAddress ?? '';
      if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(origin)) {
        fail(res, 403, 'Loopback connections only.');
        return;
      }
      const auth = req.headers.authorization ?? '';
      const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-phoneexplorer-token'] ?? '');
      if (supplied !== token) {
        fail(res, 401, 'Missing or invalid bridge token.');
        return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const path = route(url.pathname);
      const method = req.method ?? 'GET';

      if (method === 'GET' && path === '/v1/health') {
        json(res, 200, { ok: true, app: 'PhoneExplorer', version: app.getVersion() });
        return;
      }
      if (method === 'GET' && path === '/v1/status') {
        json(res, 200, await summarizeState(manager.getState(), manager));
        return;
      }
      if (method === 'GET' && path === '/v1/devices') {
        json(res, 200, { ok: true, devices: manager.getState().devices });
        return;
      }
      if (method === 'GET' && path === '/v1/screenshots') {
        const shots = await manager.listScreenshots();
        json(res, 200, {
          ok: true,
          screenshots: shots.map((shot) => ({
            id: shot.id,
            name: shot.name,
            createdAt: shot.createdAt,
            width: shot.width,
            height: shot.height,
            deviceName: shot.deviceName,
            caption: shot.caption,
            group: shot.group,
            thumbnail: shot.thumbnail,
          })),
        });
        return;
      }
      if (method === 'GET' && path === '/v1/screenshot-image') {
        const id = url.searchParams.get('id') ?? '';
        const shot = (await manager.listScreenshots()).find((item) => item.id === id);
        if (!shot) {
          fail(res, 404, 'Screenshot not found.');
          return;
        }
        const image = await manager.loadScreenshot(id);
        json(res, 200, { ok: true, id, image });
        return;
      }
      if (method === 'GET' && path === '/v1/artefact') {
        json(res, 200, { ok: true, artefact: artSummary(await manager.getArtefact()) });
        return;
      }

      if (method !== 'POST') {
        fail(res, 405, 'Method not allowed.');
        return;
      }
      const input = await body(req);

      if (path === '/v1/select') {
        const id = text(input.id, 'id', 200);
        const state = await manager.selectDevice(id);
        json(res, 200, await summarizeState(state, manager));
        return;
      }
      if (path === '/v1/refresh') {
        const state = await manager.refreshDevices();
        json(res, 200, await summarizeState(state, manager));
        return;
      }
      if (path === '/v1/screenshot') {
        const shot = await manager.capturePhoneScreen({
          label: typeof input.label === 'string' ? input.label : 'MCP screenshot',
          caption: typeof input.caption === 'string' ? input.caption : 'Captured through the MCP bridge.',
          group: 'mcp',
          quiet: true,
        });
        json(res, 200, { ok: true, screenshot: await screenshotPayload(shot, manager) });
        return;
      }
      if (path === '/v1/tap') {
        await manager.tap(number(input.x, 'x', 0, 1), number(input.y, 'y', 0, 1));
        json(res, 200, { ok: true });
        return;
      }
      if (path === '/v1/swipe') {
        await manager.swipe(
          number(input.x1, 'x1', 0, 1),
          number(input.y1, 'y1', 0, 1),
          number(input.x2, 'x2', 0, 1),
          number(input.y2, 'y2', 0, 1),
          typeof input.durationMs === 'number'
            ? Math.max(100, Math.min(2000, Math.round(input.durationMs)))
            : 320,
        );
        json(res, 200, { ok: true });
        return;
      }
      if (path === '/v1/key') {
        const key = text(input.key, 'key', 20) as KeyAction;
        if (!KEY_ACTIONS.has(key)) throw new Error('Unsupported key.');
        await manager.press(key);
        json(res, 200, { ok: true });
        return;
      }
      if (path === '/v1/open-app') {
        const packageName = text(input.package, 'package', 200);
        if (!PACKAGE_RE.test(packageName)) throw new Error('Invalid Android package name.');
        await manager.openApp(packageName);
        json(res, 200, { ok: true });
        return;
      }
      if (path === '/v1/ui') {
        json(res, 200, { ok: true, nodes: await manager.dumpAndroidUi() });
        return;
      }
      if (path === '/v1/record/start') {
        json(res, 200, { ok: true, recording: await manager.startPhoneRecording() });
        return;
      }
      if (path === '/v1/record/stop') {
        const result = await manager.stopPhoneRecording();
        json(res, 200, {
          ok: true,
          recording: {
            ...result,
            screenshots: result.screenshots.map(({ thumbnail: _thumbnail, ...shot }) => shot),
          },
        });
        return;
      }
      if (path === '/v1/artefacts') {
        json(res, 200, { ok: true, artefact: await makeArtefact(manager, input) });
        return;
      }
      fail(res, 404, 'Unknown bridge endpoint.');
    } catch (error) {
      fail(res, 500, error instanceof Error ? error.message : String(error));
    }
  };
  server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind the MCP bridge.');
  const record = {
    app: 'PhoneExplorer',
    version: app.getVersion(),
    pid: process.pid,
    port: address.port,
    token,
    createdAt: Date.now(),
    file,
  };
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, file);
  console.error(`[mcp-bridge] listening on 127.0.0.1:${address.port}`);

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(file, { force: true }).catch(() => undefined);
  };
  return { port: address.port, file, close };
}
