#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeCandidates = [
  process.env.PHONEEXPLORER_BRIDGE_FILE,
  process.env.PHONEEXPLORER_DATA_DIR ? join(process.env.PHONEEXPLORER_DATA_DIR, 'mcp-bridge.json') : null,
  join(homedir(), 'Library', 'Application Support', 'PhoneExplorer', 'mcp-bridge.json'),
  join(homedir(), 'Library', 'Application Support', 'phoneexplorer', 'mcp-bridge.json'),
  join(here, '..', '.data', 'electron-userdata', 'mcp-bridge.json'),
].filter(Boolean);

let cached = null;

async function bridgeInfo() {
  for (const file of bridgeCandidates) {
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      if (data && typeof data.port === 'number' && typeof data.token === 'string') {
        cached = { ...data, file };
        return cached;
      }
    } catch {
      // The app may be writing the file; try the next candidate or retry.
    }
  }
  throw new Error(
    'PhoneExplorer bridge not found. Open PhoneExplorer first, then retry. Checked: ' +
      bridgeCandidates.join(', '),
  );
}

async function bridgeRequest(method, path, body) {
  const info = await bridgeInfo();
  const response = await fetch(`http://127.0.0.1:${info.port}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${info.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: 'Invalid bridge response.' }));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Bridge HTTP ${response.status}`);
  }
  return payload;
}

function textResult(value) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

function imageResult(dataUrl, caption) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('The bridge returned an invalid image.');
  const content = [{ type: 'image', data: match[2], mimeType: `image/${match[1]}` }];
  if (caption) content.unshift({ type: 'text', text: caption });
  return { content };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

const tools = [
  {
    name: 'phone_status',
    description: 'Show the connected PhoneExplorer device, active device and screenshot folder.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_select_device',
    description: 'Select an active PhoneExplorer device by id. Use phone_status to list ids.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'phone_refresh',
    description: 'Refresh connected phones and return the updated device list.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_screenshot',
    description: 'Capture the active phone screen, save it to the dated Library folder, and return the image.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Short label for the Library item.' },
        caption: { type: 'string', description: 'One-line description for the Library item.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'phone_tap',
    description: 'Tap inside the active phone. x and y are normalized 0..1.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0, maximum: 1 },
        y: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['x', 'y'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'phone_swipe',
    description: 'Swipe inside the active phone. Coordinates are normalized 0..1.',
    inputSchema: {
      type: 'object',
      properties: {
        x1: { type: 'number', minimum: 0, maximum: 1 },
        y1: { type: 'number', minimum: 0, maximum: 1 },
        x2: { type: 'number', minimum: 0, maximum: 1 },
        y2: { type: 'number', minimum: 0, maximum: 1 },
        durationMs: { type: 'number', minimum: 100, maximum: 2000 },
      },
      required: ['x1', 'y1', 'x2', 'y2'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'phone_key',
    description: 'Press a hardware/navigation key: home, back, recents, power, wake, volume_up or volume_down.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: ['home', 'back', 'recents', 'power', 'wake', 'volume_up', 'volume_down'],
        },
      },
      required: ['key'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'phone_launch_app',
    description: 'Launch an installed Android package on the active phone.',
    inputSchema: {
      type: 'object',
      properties: { package: { type: 'string', description: 'Android package name.' } },
      required: ['package'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'phone_dump_ui',
    description: 'Return the active Android UI hierarchy for native controls. Unity apps may expose only one surface.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_list_screenshots',
    description: 'List screenshots in the PhoneExplorer Library with their ids, captions, dates and paths.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_get_screenshot',
    description: 'Return a Library screenshot image by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_create_artefact',
    description: 'Create a dated Artefacts document from selected Library screenshot ids. Up to 24 screens.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 24 },
      },
      required: ['ids'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'phone_get_artefact',
    description: 'Return the newest Artefacts document metadata and page titles without embedding images.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'phone_record_start',
    description: 'Start a phone recording with the same video + periodic screenshot pipeline as the app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'phone_record_stop',
    description: 'Stop the active phone recording, pull the video, extract frames and return Library screenshots metadata.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'phone_status':
      return textResult(await bridgeRequest('GET', '/v1/status'));
    case 'phone_select_device':
      return textResult(await bridgeRequest('POST', '/v1/select', args));
    case 'phone_refresh':
      return textResult(await bridgeRequest('POST', '/v1/refresh', {}));
    case 'phone_screenshot': {
      const payload = await bridgeRequest('POST', '/v1/screenshot', {
        label: args.label || 'MCP screenshot',
        caption: args.caption || 'Captured through MCP.',
      });
      return imageResult(payload.screenshot.image, `Saved ${payload.screenshot.id}`);
    }
    case 'phone_tap':
      return textResult(await bridgeRequest('POST', '/v1/tap', args));
    case 'phone_swipe':
      return textResult(await bridgeRequest('POST', '/v1/swipe', args));
    case 'phone_key':
      return textResult(await bridgeRequest('POST', '/v1/key', args));
    case 'phone_launch_app':
      return textResult(await bridgeRequest('POST', '/v1/open-app', args));
    case 'phone_dump_ui':
      return textResult(await bridgeRequest('POST', '/v1/ui', {}));
    case 'phone_list_screenshots': {
      const payload = await bridgeRequest('GET', '/v1/screenshots');
      return textResult({
        screenshots: payload.screenshots.map(({ thumbnail: _thumbnail, ...shot }) => shot),
      });
    }
    case 'phone_get_screenshot': {
      const payload = await bridgeRequest('GET', `/v1/screenshot-image?id=${encodeURIComponent(args.id)}`);
      return imageResult(payload.image, args.id);
    }
    case 'phone_create_artefact':
      return textResult(
        await bridgeRequest('POST', '/v1/artefacts', {
          title: args.title,
          subtitle: args.subtitle,
          ids: args.ids,
        }),
      );
    case 'phone_get_artefact':
      return textResult(await bridgeRequest('GET', '/v1/artefact'));
    case 'phone_record_start':
      return textResult(await bridgeRequest('POST', '/v1/record/start', {}));
    case 'phone_record_stop':
      return textResult(await bridgeRequest('POST', '/v1/record/stop', {}));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    return {
      protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'phoneexplorer', version: '0.1.0' },
    };
  }
  if (method === 'server/discover') return undefined;
  if (method === 'ping') return {};
  if (method === 'tools/list') {
    return {
      resultType: 'complete',
      tools,
      ttlMs: 0,
      cacheScope: 'private',
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'phoneexplorer', version: '0.1.0' } },
    };
  }
  if (method === 'tools/call') {
    try {
      const result = await callTool(params?.name, params?.arguments || {});
      return {
        ...result,
        resultType: 'complete',
        ttlMs: 0,
        cacheScope: 'private',
      };
    } catch (error) {
      return { ...errorResult(error), resultType: 'complete', ttlMs: 0, cacheScope: 'private' };
    }
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return undefined;
  if (id !== undefined) throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  return undefined;
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    process.stderr.write('mcp: invalid JSON input\n');
    return;
  }
  const isNotification = message.id === undefined;
  if (process.env.PHONEEXPLORER_MCP_DEBUG === '1') {
    process.stderr.write(`recv ${JSON.stringify({ id: message.id, method: message.method })}\n`);
  }
  void handle(message)
    .then((result) => {
      if (isNotification || result === undefined) return;
      if (process.env.PHONEEXPLORER_MCP_DEBUG === '1') {
        process.stderr.write(`send ${JSON.stringify({ id: message.id, method: message.method })}\n`);
      }
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
    })
    .catch((error) => {
      if (isNotification) return;
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: error.code || -32603, message: error.message || String(error) },
        }) + '\n',
      );
    });
});

process.stderr.write('phoneexplorer-mcp ready\n');
