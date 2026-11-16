#!/usr/bin/env node
/**
 * A tiny adb stand-in used by the end-to-end test. It implements just enough of
 * the platform-tools surface for PhoneExplorer's Android bridge, so the real
 * discovery / mirror / install-detection / launch path can be exercised without
 * hardware.
 */
import { appendFileSync, existsSync, readFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const logFile = process.env.FAKE_ADB_LOG ?? join(root, '.data', 'fake-adb-log.jsonl');
const marker = process.env.FAKE_ADB_MARKER ?? join(root, '.data', 'fake-installed');
const screen = process.env.FAKE_ADB_SCREEN ?? join(root, '.data', 'fake-screen.png');

const raw = process.argv.slice(2);
appendFileSync(logFile, `${JSON.stringify({ at: Date.now(), args: raw })}\n`);

const serialIndex = raw.indexOf('-s');
const serial = serialIndex >= 0 ? raw[serialIndex + 1] : null;
const args = serialIndex >= 0 ? [...raw.slice(0, serialIndex), ...raw.slice(serialIndex + 2)] : raw;
const command = args.join(' ');

function out(value) {
  writeSync(1, value);
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const thirdParty = new Set(['com.fake.notes']);
if (existsSync(marker)) {
  for (const line of readFileSync(marker, 'utf8').split('\n')) {
    const pkg = line.trim();
    if (pkg) thirdParty.add(pkg);
  }
}
const systemPackages = [
  'com.android.settings',
  'com.android.camera2',
  'com.google.android.youtube',
  'com.google.android.apps.maps',
  'com.google.android.gm',
  'com.android.chrome',
];
const all = [...systemPackages, ...thirdParty];

if (command === 'start-server' || command === 'devices -l' || command === 'devices') {
  if (command.startsWith('devices')) {
    out(`List of devices attached\nFAKE123\tdevice product:husky model:Pixel_9_Pro device:husky transport_id:7\n\n`);
  }
  process.exit(0);
}

if (command.startsWith('connect ')) {
  out(`connected to ${command.slice(8)}\n`);
  process.exit(0);
}

if (!serial) {
  if (command === 'version') {
    out('Android Debug Bridge version 1.0.41\n');
    process.exit(0);
  }
  fail('fake-adb: expected -s <serial>');
}

if (command === 'shell getprop') {
  out(
    [
      '[ro.product.marketname]: [Pixel 9 Pro]',
      '[ro.product.model]: [Pixel_9_Pro]',
      '[ro.build.version.release]: [16]',
      '[ro.build.version.sdk]: [36]',
      '[ro.product.manufacturer]: [Google]',
    ].join('\n') + '\n',
  );
  process.exit(0);
}

if (command === 'shell wm size') {
  out('Physical size: 1080x2400\n');
  process.exit(0);
}

if (command === 'shell dumpsys battery') {
  out('Current Battery Service state:\n  AC powered: false\n  USB powered: true\n  level: 74\n  status: 2\n');
  process.exit(0);
}

if (command.includes('shell pm list packages')) {
  const list = command.endsWith('-3') ? [...thirdParty] : all;
  out(`${list.map((pkg) => `package:${pkg}`).join('\n')}\n`);
  process.exit(0);
}

if (command.includes('shell monkey')) {
  out('Events injected: 1\n## Network stats: elapsed time=24ms\n');
  process.exit(0);
}

if (command.includes('shell am start')) {
  out('Starting: Intent { act=android.intent.action.VIEW }\n');
  process.exit(0);
}

if (command.includes('shell input ')) {
  out('');
  process.exit(0);
}

if (command.includes('exec-out screencap') || command.includes('shell screencap')) {
  if (existsSync(screen)) {
    writeSync(1, readFileSync(screen));
    process.exit(0);
  }
  fail('fake-adb: missing screen fixture');
}

if (command.includes('shell rm ')) {
  out('');
  process.exit(0);
}

if (command.startsWith('install ')) {
  out('Success\n');
  process.exit(0);
}

out('');
process.exit(0);
