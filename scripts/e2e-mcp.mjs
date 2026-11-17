import { _electron as electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = join(root, '.data', 'mcp-e2e');
await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });
const env = { ...process.env, PHONEEXPLORER_E2E: '1', PHONEEXPLORER_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
let child;
try {
  await app.firstWindow();
  const bridgeFile = join(dataDir, 'mcp-bridge.json');
  for (let i = 0; i < 40; i += 1) {
    try {
      await readFile(bridgeFile);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  child = spawn(process.execPath, [join(root, 'mcp', 'server.mjs')], {
    env: { ...process.env, PHONEEXPLORER_BRIDGE_FILE: bridgeFile },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  });
  const request = (id, method, params) =>
    new Promise((resolve) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const init = await request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {} });
  if (!init.result?.serverInfo?.name) throw new Error('MCP initialize failed');
  const listed = await request(2, 'tools/list', {});
  const names = listed.result.tools.map((tool) => tool.name);
  for (const needed of ['phone_status', 'phone_screenshot', 'phone_tap', 'phone_create_artefact']) {
    if (!names.includes(needed)) throw new Error(`missing MCP tool ${needed}`);
  }
  const status = await request(3, 'tools/call', { name: 'phone_status', arguments: {} });
  if (status.result?.isError) throw new Error(status.result.content[0].text);
  console.log(`MCP_E2E_OK tools=${names.length}`);
} finally {
  child?.kill('SIGTERM');
  await app.close();
}
