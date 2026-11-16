import { _electron as electron } from 'playwright-core';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFakeScreen } from './fixture-screen.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const runId = Date.now().toString(36);
const dataDir = join(root, '.data', `real-e2e-${runId}`);
const logFile = join(root, '.data', `fake-adb-${runId}.jsonl`);
const marker = join(root, '.data', `fake-installed-${runId}`);

await mkdir(shots, { recursive: true });
writeFakeScreen(join(root, '.data', 'fake-screen.png'));
await mkdir(dataDir, { recursive: true });
await rm(logFile, { force: true });
await rm(marker, { force: true });
await writeFile(
  join(dataDir, 'settings.json'),
  JSON.stringify(
    {
      fps: 4,
      quality: 78,
      autoPreview: true,
      adbPath: join(root, 'scripts', 'fake-adb.mjs'),
      demoPlatform: 'android',
      reduceMotion: true,
    },
    null,
    2,
  ),
);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = dataDir;
env.FAKE_ADB_LOG = logFile;
env.FAKE_ADB_MARKER = marker;
env.FAKE_ADB_SCREEN = join(root, '.data', 'fake-screen.png');

const app = await electron.launch({
  args: ['.', '--no-sandbox', '--disable-gpu'],
  env,
  timeout: 60_000,
});

const errors = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  app.process().stderr?.on('data', (d) => {
    const text = String(d);
    if (/error|failed/i.test(text) && !/GPU|ANGLE|Vulkan|EGL/.test(text)) {
      console.log('[main:err]', text.trim());
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[renderer]', m.text());
  });
  await page.waitForSelector('.app', { timeout: 30_000 });
  await page.waitForTimeout(4500);
  const diagnostic = await page.evaluate(async () => {
    const s = await window.phone.getState();
    return {
      active: s.activeDeviceId,
      preview: s.preview,
      devices: s.devices.map((d) => ({ id: d.id, status: d.status, name: d.name })),
      activity: s.activity.slice(0, 6).map((a) => `${a.message} :: ${a.detail ?? ''}`),
      toasts: [...document.querySelectorAll('.toast-copy strong')].map((n) => n.textContent),
      img: Boolean(document.querySelector('.phone-image')),
      placeholder: document.querySelector('.placeholder-title')?.textContent,
    };
  });
  console.log('DIAG', JSON.stringify(diagnostic, null, 2));
  await page.screenshot({ path: join(shots, '10a-real-diagnostic.png') });
  await page.waitForSelector('.phone-image', { timeout: 25_000 });
  await page.locator('.device-card', { hasText: 'Pixel 9 Pro' }).waitFor({ timeout: 15_000 });

  const title = await page.locator('.stage h1').textContent();
  if (!title?.includes('Pixel 9 Pro')) throw new Error(`unexpected title: ${title}`);
  const meta = await page.locator('.device-meta').textContent();
  if (!meta?.includes('Android') || !meta.includes('16') || !meta.includes('1080') || !meta.includes('2400')) {
    throw new Error(`unexpected meta: ${meta}`);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(shots, '10-real-device.png') });

  // Get Spotify: the desktop opens the store on the device and arms the watcher.
  const spotifyRow = page.locator('.app-row').filter({ hasText: 'Spotify' }).first();
  await spotifyRow.locator('.get-btn').click();
  await page.getByText('Waiting for the store').waitFor({ timeout: 8_000 });
  await page.screenshot({ path: join(shots, '11-real-waiting.png') });

  // The phone installs it: flip the marker, then wait for detection.
  await writeFile(marker, 'com.spotify.music\n', 'utf8');
  await spotifyRow.locator('.get-btn.is-open').waitFor({ timeout: 12_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shots, '12-real-installed.png') });

  // Launch it.
  await spotifyRow.locator('.get-btn.is-open').click();
  await page.waitForTimeout(600);

  // Gestures: wheel scroll, long-press, right-click, middle-click and pinch.
  const phone = await page.locator('.phone-screen').boundingBox();
  if (!phone) throw new Error('phone screen has no box');
  const cx = phone.x + phone.width / 2;
  const cy = phone.y + phone.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(350);
  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await page.mouse.click(cx, cy, { button: 'right' });
  await page.waitForTimeout(200);
  await page.mouse.click(cx, cy, { button: 'middle' });
  await page.waitForTimeout(250);
  await page.locator('.control-btn[aria-label="Pinch to zoom in"]').click();
  await page.waitForTimeout(350);
  const pinchToast = await page.locator('.toast-copy strong').last().textContent();
  if (!pinchToast?.includes('Multi-touch control is not ready')) {
    throw new Error(`unexpected pinch toast: ${pinchToast}`);
  }
  await page.screenshot({ path: join(shots, '13-controls.png') });

  // Store deep links and search.
  await page.locator('.stage-actions .btn-primary').click();
  await page.locator('.search-box input').fill('Notion');
  await page.locator('.search-box input').press('Enter');
  await page.waitForTimeout(600);

  const log = await readFile(logFile, 'utf8');
  const calls = log
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line).args.join(' '));
  const required = [
    'devices -l',
    'exec-out screencap -p',
    'shell am start -a android.intent.action.VIEW -d market://details?id=com.spotify.music',
    'shell monkey -p com.spotify.music -c android.intent.category.LAUNCHER 1',
    'shell am start -a android.intent.action.VIEW -d market://search?q=Notion',
  ];
  for (const needle of required) {
    if (!calls.some((call) => call.includes(needle))) {
      throw new Error(`missing adb call: ${needle}\n\n${calls.join('\n')}`);
    }
  }
  if (!calls.some((call) => call.includes('shell input swipe') && call.endsWith(' 180'))) {
    throw new Error(`scroll did not reach adb\n${calls.join('\n')}`);
  }
  if (!calls.some((call) => call.includes('shell input swipe') && call.endsWith(' 700'))) {
    throw new Error(`long press did not reach adb\n${calls.join('\n')}`);
  }
  if (!calls.some((call) => call.includes('shell input keyevent 4'))) {
    throw new Error(`right-click back did not reach adb\n${calls.join('\n')}`);
  }
  if (!calls.some((call) => call.includes('shell input keyevent 3'))) {
    throw new Error(`middle-click home did not reach adb\n${calls.join('\n')}`);
  }
  if (errors.length) throw new Error(`renderer errors: ${errors.join('; ')}`);

  console.log('REAL_E2E_OK');
  console.log(`adb calls: ${calls.length}`);
  console.log(calls.slice(-8).join('\n'));
} finally {
  await app.close();
}
