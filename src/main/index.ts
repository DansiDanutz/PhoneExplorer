import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import type {
  KeyAction,
  PhonePlatform,
  ServerEvent,
  Settings,
} from '../shared/types';
import { DeviceManager } from './services/manager';

const isDev = !app.isPackaged;

if (process.env.PHONEEXPLORER_DATA_DIR) {
  app.setPath('userData', process.env.PHONEEXPLORER_DATA_DIR);
} else if (!app.isPackaged) {
  // Keep development state inside the repository so the sandbox never has to
  // touch the user's Application Support folder.
  app.setPath('userData', join(process.cwd(), '.data', 'electron-userdata'));
}

app.setName('PhoneExplorer');

const isAutomation =
  process.argv.includes('--screenshot') || process.env.PHONEEXPLORER_E2E === '1';
const gotLock = isAutomation ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let manager: DeviceManager | null = null;

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

const screenshotPath = argValue('--screenshot');
const screenshotDelay = Number(argValue('--screenshot-delay') ?? 1800);
const forceDemo = process.argv.includes('--demo');

function broadcast(event: ServerEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('phone:event', event);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#08090b',
    title: 'PhoneExplorer',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });

  window.once('ready-to-show', () => {
    if (!screenshotPath) window.show();
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const navigate = (view: string) => (): void => {
    mainWindow?.webContents.send('phone:navigate', view);
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'PhoneExplorer',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Install app file…',
          accelerator: 'CmdOrCtrl+O',
          click: () => void manager?.installFromFile(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Discover', accelerator: 'CmdOrCtrl+1', click: navigate('discover') },
        { label: 'Installed', accelerator: 'CmdOrCtrl+2', click: navigate('installed') },
        { label: 'Activity', accelerator: 'CmdOrCtrl+3', click: navigate('activity') },
        { type: 'separator' },
        { label: 'Refresh devices', accelerator: 'CmdOrCtrl+R', click: () => void manager?.refreshDevices() },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ role: 'front' as const }] : [])],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open-source research notes',
          click: () => void shell.openExternal('https://github.com/DansiDanutz/PhoneExplorer#readme'),
        },
        {
          label: 'Android platform-tools',
          click: () => void shell.openExternal('https://developer.android.com/tools/releases/platform-tools'),
        },
        {
          label: 'libimobiledevice',
          click: () => void shell.openExternal('https://libimobiledevice.org'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function wireManager(): DeviceManager {
  const instance = new DeviceManager({
    dataDir: app.getPath('userData'),
    version: app.getVersion(),
    getWindow: () => mainWindow,
    broadcast,
  });
  manager = instance;
  return instance;
}

function registerIpc(instance: DeviceManager): void {
  const handle = <T>(channel: string, fn: (...args: never[]) => Promise<T> | T): void => {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return await (fn as (...inner: unknown[]) => Promise<T> | T)(...args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ipc:${channel}]`, message);
        throw new Error(message);
      }
    });
  };

  handle('phone:state', () => instance.getState());
  handle('phone:refresh', () => instance.refreshDevices());
  handle('phone:select', (id: string) => instance.selectDevice(id));
  handle('phone:demo', (platform: PhonePlatform | null) => instance.useDemo(platform));
  handle('phone:preview:start', () => instance.startPreview());
  handle('phone:preview:stop', () => instance.stopPreview());
  handle('phone:tap', (x: number, y: number) => instance.tap(x, y));
  handle(
    'phone:swipe',
    (x1: number, y1: number, x2: number, y2: number, duration?: number) =>
      instance.swipe(x1, y1, x2, y2, duration),
  );
  handle('phone:press', (key: KeyAction) => instance.press(key));
  handle('phone:type', (text: string) => instance.typeText(text));
  handle('phone:store:open', (appId?: string) => instance.openStore(appId));
  handle('phone:store:search', (query: string) => instance.searchStore(query));
  handle('phone:app:install', (appId: string) => instance.installApp(appId));
  handle('phone:app:open', (packageId: string) => instance.openApp(packageId));
  handle('phone:app:install-file', () => instance.installFromFile());
  handle('phone:qr:show', (appId: string) => instance.showQr(appId));
  handle('phone:qr:hide', () => instance.hideQr());
  handle('phone:external', (url: string) => instance.openExternal(url));
  handle('phone:wifi', (address: string) => instance.connectWifi(address));
  handle('phone:setting', (key: keyof Settings, value: Settings[keyof Settings]) =>
    instance.updateSetting(key, value),
  );
  handle('phone:activity:clear', () => instance.clearActivity());
}

async function captureScreenshot(path: string, delayMs: number): Promise<void> {
  if (!mainWindow) return;
  await new Promise((resolve) => setTimeout(resolve, Math.max(200, delayMs)));
  const image = await mainWindow.webContents.capturePage();
  const target = path.startsWith('/') ? path : join(process.cwd(), path);
  await fs.mkdir(join(target, '..'), { recursive: true });
  await fs.writeFile(target, image.toPNG());
  console.log(`[screenshot] ${target}`);
  app.quit();
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  app.setAboutPanelOptions({
    applicationName: 'PhoneExplorer',
    applicationVersion: app.getVersion(),
    copyright: 'Stage 01 — a desktop bridge for your phone.',
  });

  mainWindow = createWindow();
  const instance = wireManager();
  registerIpc(instance);
  buildMenu();

  if (screenshotPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      void (async () => {
        await instance.init();
        if (forceDemo) await instance.useDemo('android');
        await captureScreenshot(screenshotPath, screenshotDelay);
      })();
    });
  } else {
    void instance.init();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      void manager?.init();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  manager?.dispose();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  manager?.dispose();
});
