import { contextBridge, ipcRenderer } from 'electron';
import type {
  KeyAction,
  NewPhoneModel,
  PhoneAPI,
  PhonePlatform,
  ServerEvent,
  Settings,
} from '../shared/types';

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: PhoneAPI = {
  getState: () => invoke('phone:state'),
  refresh: () => invoke('phone:refresh'),
  selectDevice: (deviceId: string) => invoke('phone:select', deviceId),
  useDemo: (platform: PhonePlatform | null) => invoke('phone:demo', platform),
  selectDemoModel: (platform: PhonePlatform, modelId: string) =>
    invoke('phone:model:select', platform, modelId),
  setDefaultModel: (platform: PhonePlatform, modelId: string) =>
    invoke('phone:model:default', platform, modelId),
  addPhoneModel: (input: NewPhoneModel) => invoke('phone:model:add', input),
  deletePhoneModel: (modelId: string) => invoke('phone:model:delete', modelId),
  startPreview: () => invoke('phone:preview:start'),
  stopPreview: () => invoke('phone:preview:stop'),
  tap: (x: number, y: number) => invoke('phone:tap', x, y),
  longPress: (x: number, y: number, durationMs?: number) =>
    invoke('phone:longpress', x, y, durationMs),
  swipe: (x1: number, y1: number, x2: number, y2: number, durationMs?: number) =>
    invoke('phone:swipe', x1, y1, x2, y2, durationMs),
  scroll: (x: number, y: number, deltaX: number, deltaY: number) =>
    invoke('phone:scroll', x, y, deltaX, deltaY),
  pinch: (x: number, y: number, scale: number) => invoke('phone:pinch', x, y, scale),
  press: (key: KeyAction) => invoke('phone:press', key),
  typeText: (text: string) => invoke('phone:type', text),
  openStore: (appId?: string) => invoke('phone:store:open', appId),
  searchStore: (query: string) => invoke('phone:store:search', query),
  installApp: (appId: string) => invoke('phone:app:install', appId),
  openApp: (packageId: string) => invoke('phone:app:open', packageId),
  installFromFile: () => invoke('phone:app:install-file'),
  showQr: (appId: string) => invoke('phone:qr:show', appId),
  hideQr: () => invoke('phone:qr:hide'),
  openExternal: (url: string) => invoke('phone:external', url),
  connectWifi: (address: string) => invoke('phone:wifi', address),
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) =>
    invoke('phone:setting', key, value),
  clearActivity: () => invoke('phone:activity:clear'),
  subscribe: (listener: (event: ServerEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ServerEvent): void => {
      listener(payload);
    };
    ipcRenderer.on('phone:event', wrapped);
    return () => ipcRenderer.removeListener('phone:event', wrapped);
  },
  onNavigate: (listener: (view: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, view: string): void => {
      listener(view);
    };
    ipcRenderer.on('phone:navigate', wrapped);
    return () => ipcRenderer.removeListener('phone:navigate', wrapped);
  },
};

contextBridge.exposeInMainWorld('phone', api);
