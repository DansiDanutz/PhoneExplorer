import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppState,
  ArtefactDocument,
  ArtefactInput,
  FramePayload,
  KeyAction,
  NewPhoneModel,
  PhonePlatform,
  Screenshot,
  ScreenshotRequest,
  Settings,
} from '@shared/types';

export interface ToastItem {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

let toastSeq = 0;

export interface PhoneActions {
  refresh: () => Promise<void>;
  selectDevice: (id: string) => Promise<void>;
  useDemo: (platform: PhonePlatform | null) => Promise<void>;
  selectDemoModel: (platform: PhonePlatform, modelId: string) => Promise<void>;
  setDefaultModel: (platform: PhonePlatform, modelId: string) => Promise<void>;
  addPhoneModel: (input: NewPhoneModel) => Promise<void>;
  deletePhoneModel: (modelId: string) => Promise<void>;
  startPreview: () => Promise<void>;
  stopPreview: () => Promise<void>;
  tap: (x: number, y: number) => Promise<void>;
  longPress: (x: number, y: number) => Promise<void>;
  swipe: (x1: number, y1: number, x2: number, y2: number) => Promise<void>;
  scroll: (x: number, y: number, deltaX: number, deltaY: number) => Promise<void>;
  pinch: (x: number, y: number, scale: number) => Promise<void>;
  press: (key: KeyAction) => Promise<void>;
  typeText: (text: string) => Promise<void>;
  captureScreenshot: (request: ScreenshotRequest) => Promise<Screenshot | null>;
  saveArtefact: (input: ArtefactInput) => Promise<ArtefactDocument | null>;
  getArtefact: () => Promise<ArtefactDocument | null>;
  openArtefact: () => Promise<void>;
  revealArtefact: () => Promise<void>;
  listScreenshots: () => Promise<Screenshot[]>;
  getScreenshotsFolder: () => Promise<string>;
  loadScreenshot: (id: string) => Promise<string>;
  deleteScreenshot: (id: string) => Promise<void>;
  revealScreenshot: (id: string) => Promise<void>;
  revealScreenshotsFolder: () => Promise<void>;
  openStore: (appId?: string) => Promise<void>;
  searchStore: (query: string) => Promise<void>;
  installApp: (appId: string) => Promise<void>;
  openApp: (packageId: string) => Promise<void>;
  installFromFile: () => Promise<void>;
  showQr: (appId: string) => Promise<void>;
  hideQr: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  connectWifi: (address: string) => Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  clearActivity: () => Promise<void>;
  toast: (tone: ToastItem['tone'], title: string, body?: string) => void;
}

export function usePhone(): {
  state: AppState | null;
  frame: FramePayload | null;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  actions: PhoneActions;
  frameAge: number;
} {
  const [state, setState] = useState<AppState | null>(null);
  const [frame, setFrame] = useState<FramePayload | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [frameAge, setFrameAge] = useState(0);
  const lastFrameRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (tone: ToastItem['tone'], title: string, body?: string) => {
      const id = `t${toastSeq++}`;
      setToasts((items) => [...items.slice(-2), { id, tone, title, body }]);
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
      }, 5200);
    },
    [],
  );

  useEffect(() => {
    const off = window.phone.subscribe((event) => {
      switch (event.type) {
        case 'state':
          setState(event.state);
          break;
        case 'frame':
          lastFrameRef.current = Date.now();
          setFrame(event.frame);
          break;
        case 'toast':
          pushToast(event.tone, event.title, event.body);
          break;
        case 'activity':
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  activity: [event.item, ...prev.activity].slice(0, 250),
                }
              : prev,
          );
          break;
        case 'install':
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  installs: { ...prev.installs, [event.progress.appId]: event.progress },
                }
              : prev,
          );
          break;
        case 'preview':
          if (!event.active) {
            setState((prev) =>
              prev ? { ...prev, preview: { ...prev.preview, active: false } } : prev,
            );
          }
          break;
        default:
          break;
      }
    });

    void window.phone
      .getState()
      .then((initial) => setState(initial))
      .catch((error: unknown) => {
        pushToast('error', 'Could not reach the device bridge', String(error));
      });

    return off;
  }, [pushToast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrameAge(lastFrameRef.current ? Date.now() - lastFrameRef.current : 0);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const fail = useCallback(
    (title: string) =>
      (error: unknown): void => {
        pushToast('error', title, error instanceof Error ? error.message : String(error));
      },
    [pushToast],
  );

  const apply = useCallback(async (promise: Promise<AppState>, label: string) => {
    try {
      const next = await promise;
      setState(next);
    } catch (error) {
      pushToast('error', label, error instanceof Error ? error.message : String(error));
    }
  }, [pushToast]);

  const actions: PhoneActions = {
    refresh: () => apply(window.phone.refresh(), 'Could not refresh devices'),
    selectDevice: async (id) => {
      setFrame(null);
      setToasts([]);
      await apply(window.phone.selectDevice(id), 'Could not select device');
    },
    useDemo: async (platform) => {
      setFrame(null);
      setToasts([]);
      await apply(window.phone.useDemo(platform), 'Could not switch to the demo');
    },
    selectDemoModel: async (platform, modelId) => {
      setFrame(null);
      setToasts([]);
      await apply(
        window.phone.selectDemoModel(platform, modelId),
        'Could not change the demo model',
      );
    },
    setDefaultModel: (platform, modelId) =>
      apply(
        window.phone.setDefaultModel(platform, modelId),
        'Could not save the default model',
      ),
    addPhoneModel: (input) =>
      apply(window.phone.addPhoneModel(input), 'Could not add the phone model'),
    deletePhoneModel: (modelId) =>
      apply(window.phone.deletePhoneModel(modelId), 'Could not delete the phone model'),
    startPreview: () => apply(window.phone.startPreview(), 'Could not start the preview'),
    stopPreview: () => apply(window.phone.stopPreview(), 'Could not stop the preview'),
    tap: (x, y) => window.phone.tap(x, y).catch(fail('Tap failed')),
    longPress: (x, y) => window.phone.longPress(x, y).catch(fail('Long press failed')),
    swipe: (x1, y1, x2, y2) =>
      window.phone.swipe(x1, y1, x2, y2).catch(fail('Swipe failed')),
    scroll: (x, y, deltaX, deltaY) =>
      window.phone.scroll(x, y, deltaX, deltaY).catch(fail('Scroll failed')),
    pinch: (x, y, scale) =>
      window.phone.pinch(x, y, scale).catch(fail('Pinch failed')),
    press: (key) => window.phone.press(key).catch(fail('Key press failed')),
    typeText: (text) => window.phone.typeText(text).catch(fail('Typing failed')),
    captureScreenshot: async (request) => {
      try {
        const shot = await window.phone.captureScreenshot(request);
        window.dispatchEvent(new Event('phone:screenshot'));
        return shot;
      } catch (error) {
        fail('Screenshot failed')(error);
        return null;
      }
    },
    saveArtefact: async (input) => {
      try {
        const doc = await window.phone.saveArtefact(input);
        window.dispatchEvent(new Event('phone:artefact'));
        return doc;
      } catch (error) {
        fail('Could not save the Artefacts document')(error);
        return null;
      }
    },
    getArtefact: async () => {
      try {
        return await window.phone.getArtefact();
      } catch (error) {
        fail('Could not load Artefacts')(error);
        return null;
      }
    },
    openArtefact: () => window.phone.openArtefact().catch(fail('Could not open Artefacts')),
    revealArtefact: () =>
      window.phone.revealArtefact().catch(fail('Could not reveal Artefacts')),
    listScreenshots: async () => {
      try {
        return await window.phone.listScreenshots();
      } catch (error) {
        fail('Could not load screenshots')(error);
        return [];
      }
    },
    getScreenshotsFolder: async () => {
      try {
        return await window.phone.getScreenshotsFolder();
      } catch (error) {
        fail('Could not find the screenshot folder')(error);
        return '';
      }
    },
    loadScreenshot: async (id) => {
      try {
        return await window.phone.loadScreenshot(id);
      } catch (error) {
        fail('Could not open screenshot')(error);
        return '';
      }
    },
    deleteScreenshot: async (id) => {
      try {
        await window.phone.deleteScreenshot(id);
        window.dispatchEvent(new Event('phone:screenshot'));
        pushToast('info', 'Screenshot deleted');
      } catch (error) {
        fail('Could not delete screenshot')(error);
      }
    },
    revealScreenshot: (id) =>
      window.phone.revealScreenshot(id).catch(fail('Could not reveal screenshot')),
    revealScreenshotsFolder: () =>
      window.phone.revealScreenshotsFolder().catch(fail('Could not open the folder')),
    openStore: (appId) => window.phone.openStore(appId).catch(fail('Could not open the store')),
    searchStore: (query) => window.phone.searchStore(query).catch(fail('Store search failed')),
    installApp: (appId) => window.phone.installApp(appId).catch(fail('Install failed')),
    openApp: (packageId) => window.phone.openApp(packageId).catch(fail('Could not open the app')),
    installFromFile: () =>
      window.phone.installFromFile().catch(fail('Could not install the file')),
    showQr: (appId) => window.phone.showQr(appId).catch(fail('Could not build the QR code')),
    hideQr: () => window.phone.hideQr().catch(fail('Could not close the QR code')),
    openExternal: (url) => window.phone.openExternal(url).catch(fail('Could not open the link')),
    connectWifi: (address) =>
      window.phone.connectWifi(address).then(setState).catch(fail('Wi-Fi connection failed')),
    updateSetting: async (key, value) => {
      try {
        const next = await window.phone.updateSetting(key, value);
        setState(next);
      } catch (error) {
        pushToast('error', 'Could not save the setting', error instanceof Error ? error.message : String(error));
      }
    },
    clearActivity: () => window.phone.clearActivity().catch(fail('Could not clear activity')),
    toast: pushToast,
  };

  return { state, frame, toasts, dismissToast, actions, frameAge };
}
