import { useEffect, useState } from 'react';
import type { ArtefactSection, CatalogApp, PhonePlatform } from '@shared/types';
import { usePhone } from './hooks/usePhone';
import { DeviceRail } from './components/DeviceRail';
import { Inspector, type InspectorTab } from './components/Inspector';
import { AppSheet, ConnectSheet, QrSheet, SettingsSheet } from './components/Modals';
import { ModelsSheet } from './components/ModelsSheet';
import { GesturesSheet } from './components/GesturesSheet';
import { Stage } from './components/Stage';
import { TitleBar } from './components/TitleBar';
import { Toasts } from './components/Toasts';
import { Icon } from './lib/icons';

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

function BootScreen(): React.ReactElement {
  return (
    <div className="boot">
      <div className="boot-mark">
        <Icon name="smartphone" size={26} />
        <span className="boot-ring" />
      </div>
      <h1>PhoneExplorer</h1>
      <p>Starting the device bridge…</p>
      <div className="boot-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function StatusBar({
  ready,
  deviceLabel,
  frameLabel,
  fps,
  version,
  platform,
}: {
  ready: number;
  deviceLabel: string;
  frameLabel: string;
  fps: number;
  version: string;
  platform: string;
}): React.ReactElement {
  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        <span className={`status-dot ${ready > 0 ? 'ok' : 'warn'}`} />
        <span className="mono-label">
          {ready > 0 ? 'BRIDGE ONLINE' : 'BRIDGE IDLE'}
        </span>
        <span className="statusbar-sep" />
        <span className="mono-label">{ready}/2 TOOLS</span>
      </div>
      <div className="statusbar-center mono-label" title={deviceLabel}>
        {deviceLabel}
      </div>
      <div className="statusbar-group">
        <span className="mono-label">{frameLabel}</span>
        <span className="statusbar-sep" />
        <span className="mono-label">{fps} FPS</span>
        <span className="statusbar-sep" />
        <span className="mono-label">
          {platform === 'darwin' ? 'MACOS' : platform.toUpperCase()} · V{version}
        </span>
      </div>
    </footer>
  );
}

export default function App(): React.ReactElement {
  const { state, frame, toasts, dismissToast, actions, frameAge } = usePhone();
  const [tab, setTab] = useState<InspectorTab>('discover');
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [peekApp, setPeekApp] = useState<CatalogApp | null>(null);
  const [modelsFor, setModelsFor] = useState<PhonePlatform | null>(null);
  const [modelsReturnToSettings, setModelsReturnToSettings] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [walkthroughRunning, setWalkthroughRunning] = useState(false);

  const openModels = (platform: PhonePlatform): void => {
    setModelsReturnToSettings(settingsOpen);
    setSettingsOpen(false);
    setConnectOpen(false);
    setModelsFor(platform);
  };

  const closeModels = (): void => {
    setModelsFor(null);
    if (modelsReturnToSettings) {
      setModelsReturnToSettings(false);
      setSettingsOpen(true);
    }
  };

  useEffect(() => {
    return window.phone.onNavigate((view) => {
      if (view === 'discover' || view === 'installed' || view === 'activity') {
        setTab(view);
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey;
      if (modelsFor || settingsOpen || connectOpen || peekApp || guideOpen || state?.qr) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = Boolean(
        target?.closest('input, textarea, select, [contenteditable]'),
      );
      if (!mod && !event.altKey && !typing && event.key.startsWith('Arrow')) {
        event.preventDefault();
        if (event.key === 'ArrowLeft') void actions.swipe(0.82, 0.5, 0.18, 0.5);
        else if (event.key === 'ArrowRight') void actions.swipe(0.18, 0.5, 0.82, 0.5);
        else if (event.key === 'ArrowUp') void actions.scroll(0.5, 0.5, 0, -240);
        else if (event.key === 'ArrowDown') void actions.scroll(0.5, 0.5, 0, 240);
        return;
      }
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setTab('discover');
        window.setTimeout(() => {
          document.querySelector<HTMLInputElement>('.search-box input')?.focus();
        }, 40);
        return;
      }
      if (mod && event.key === '1') {
        event.preventDefault();
        setTab('discover');
      }
      if (mod && event.key === '2') {
        event.preventDefault();
        setTab('installed');
      }
      if (mod && event.key === '3') {
        event.preventDefault();
        setTab('activity');
      }
      if (mod && event.key === '4') {
        event.preventDefault();
        setTab('library');
      }
      if (mod && event.key === '5') {
        event.preventDefault();
        setTab('artefacts');
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.dispatchEvent(new Event('phone:capture-screenshot'));
      }
      if (event.key === 'Escape' && focusMode && !connectOpen && !settingsOpen && !peekApp && !modelsFor && !guideOpen && !state?.qr) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, focusMode, connectOpen, settingsOpen, peekApp, modelsFor, guideOpen, state?.qr]);

  const setInspectorSearch = (value: string): void => {
    const input = document.querySelector<HTMLInputElement>('.search-box input');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const clickChip = (label: string): void => {
    const chip = Array.from(document.querySelectorAll<HTMLElement>('.chips .chip')).find(
      (item) => item.textContent?.trim() === label,
    );
    chip?.click();
  };

  const runWalkthrough = async (): Promise<void> => {
    if (!state || walkthroughRunning) return;
    setWalkthroughRunning(true);
    const sections: ArtefactSection[] = [];
    const capture = async (id: string, title: string, description: string): Promise<void> => {
      await wait(520);
      const shot = await actions.captureScreenshot({
        fullWindow: true,
        quiet: true,
        label: title,
        caption: description,
        group: 'walkthrough',
      });
      if (!shot) return;
      const image = await actions.loadScreenshot(shot.id);
      if (image) sections.push({ id, title, description, image });
    };
    const reset = (): void => {
      setSettingsOpen(false);
      setConnectOpen(false);
      setModelsFor(null);
      setGuideOpen(false);
      setPeekApp(null);
      setFocusMode(false);
    };

    try {
      reset();
      void actions.hideQr();
      setTab('discover');
      await capture(
        'discover',
        'Discover',
        'The curated storefront. Category chips filter 15 launch-ready apps; each row can open its detail sheet, official store listing or install flow.',
      );

      setInspectorSearch('GGPoker');
      await capture(
        'search',
        'Search',
        'The catalog search matches names, publishers, categories and taglines. “PlayGG” finds the same official GGPoker listing as “GGPoker”.',
      );
      setInspectorSearch('');

      clickChip('Games');
      await capture(
        'category',
        'Category filter',
        'Category chips narrow the catalog without a round trip to the phone. Games is the newest category, holding the poker entry.',
      );
      clickChip('All');

      setTab('installed');
      await capture(
        'installed',
        'Installed',
        'A live package inventory read from the phone. Every app can be launched here, and “Install file” sideloads an APK or IPA.',
      );

      setTab('activity');
      await capture(
        'activity',
        'Activity',
        'A chronological bridge log. Discovery, install polling, mirror frames and input commands all report here with a timestamp and detail.',
      );

      setTab('library');
      await capture(
        'library',
        'Library',
        'Every screenshot captured so far. The walkthrough saves each view here before the document is assembled, so the raw evidence stays browsable.',
      );

      await wait(600);
      document.querySelector<HTMLButtonElement>('.shot-card')?.click();
      await capture(
        'library-viewer',
        'Screenshot viewer',
        'A full-resolution view of any capture, with Reveal, Delete and Done actions. This is the same evidence used to build the document.',
      );
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await wait(250);

      setSettingsOpen(true);
      await capture(
        'settings',
        'Settings',
        'Capture rate, JPEG quality, adb path and demo defaults live here. Reverse scroll and reduced motion make the mirror easier to control.',
      );
      setSettingsOpen(false);

      setConnectOpen(true);
      await capture(
        'connect',
        'Connect a phone',
        'The connection sheet handles USB and Wi-Fi Android devices plus iPhone pairing. It explains which bridge tools are missing before you connect.',
      );
      setConnectOpen(false);

      setModelsFor('android');
      await capture(
        'models',
        'Phone models',
        'Demo hardware profiles are searchable and editable. Custom models can be saved and one Android and one iPhone can be marked as the defaults.',
      );
      const addModel = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Add model',
      );
      addModel?.click();
      await capture(
        'model-form',
        'Custom phone model',
        'The add-model form captures name, OS, screen size, body colour and display size, then stores the profile locally and can make it the default demo phone.',
      );
      setModelsFor(null);

      setGuideOpen(true);
      await capture(
        'guide',
        'Control guide',
        'The gesture reference explains how mouse clicks, drags, wheels, arrow keys, right-click and Ctrl/⌘ + wheel map onto real phone gestures.',
      );
      setGuideOpen(false);

      const featured = state.catalog.find((app) => app.id === 'ggpoker') ?? state.catalog[0];
      if (featured) {
        setPeekApp(featured);
        await capture(
          'app-detail',
          `${featured.name} detail`,
          `The app sheet for ${featured.name}: publisher, ratings, install state and the official store handoff. On a real phone the store completes the download.`,
        );
        setPeekApp(null);
      }

      await actions.showQr('ggpoker');
      await capture(
        'qr',
        'Store QR handoff',
        'A QR code opens the same official listing on a phone that is not connected over USB. This is the no-cable path into the mobile store.',
      );
      await actions.hideQr();

      setFocusMode(true);
      await capture(
        'focus',
        'Focus mode',
        'Focus mode removes the rails and inspector so the mirrored phone gets the entire window. Escape returns to the full workspace.',
      );
      setFocusMode(false);

      const doc = await actions.saveArtefact({
        title: 'PhoneExplorer — App Walkthrough',
        subtitle:
          'A guided tour of the workspace, captured tab by tab and overlay by overlay. Each page pairs the live screen with a short explanation of what it does.',
        deviceName: device ? `${device.name} · ${device.platform === 'ios' ? 'iPhone' : 'Android'}` : 'PhoneExplorer',
        sections,
        quiet: true,
      });
      if (!doc) throw new Error('The document could not be saved.');

      setWalkthroughRunning(false);
      setTab('artefacts');
      await wait(900);
      const cover = await actions.captureScreenshot({
        fullWindow: true,
        quiet: true,
        label: 'Artefacts',
        caption:
          'The finished Pages-style document in the new Artefacts tab. Each page has a screenshot, a short explanation and a page number.',
        group: 'walkthrough',
      });
      if (cover) {
        const image = await actions.loadScreenshot(cover.id);
        if (image) {
          sections.push({
            id: 'artefacts',
            title: 'Artefacts',
            description:
              'The finished Pages-style document in the new Artefacts tab. Each page has a screenshot, a short explanation and a page number.',
            image,
          });
          await actions.saveArtefact({
            title: doc.title,
            subtitle: doc.subtitle,
            deviceName: doc.deviceName,
            sections,
            quiet: true,
          });
        }
      }
      actions.toast('success', 'Walkthrough complete', `${sections.length} views captured`);
    } catch (error) {
      actions.toast(
        'error',
        'Walkthrough failed',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      reset();
      setWalkthroughRunning(false);
    }
  };

  if (!state) return <BootScreen />;

  const device = state.devices.find((candidate) => candidate.id === state.activeDeviceId) ?? null;
  const toolsReady = state.tools.filter((tool) => tool.found).length;
  const liveFrame = frame && frame.deviceId === device?.id ? frame : null;
  const rootClass = [
    'app',
    state.settings.reduceMotion ? 'reduce-motion' : '',
    focusMode ? 'is-focus' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} data-platform={device?.platform ?? 'android'}>
      <TitleBar
        state={state}
        actions={actions}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenConnect={() => setConnectOpen(true)}
      />

      <main className="workspace">
        {!focusMode ? (
          <DeviceRail
            state={state}
            actions={actions}
            onOpenConnect={() => setConnectOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenModels={openModels}
          />
        ) : null}

        <Stage
          state={state}
          frame={frame}
          frameAge={frameAge}
          actions={actions}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onOpenGuide={() => setGuideOpen(true)}
        />

        {!focusMode ? (
          <Inspector
            state={state}
            actions={actions}
            tab={tab}
            onTab={setTab}
            onPeek={(app) => setPeekApp(app)}
            onWalkthrough={() => void runWalkthrough()}
            walkthroughRunning={walkthroughRunning}
          />
        ) : null}
      </main>

      <StatusBar
        ready={toolsReady}
        deviceLabel={device ? `${device.name.toUpperCase()} · ${device.serial}` : 'NO DEVICE SELECTED'}
        frameLabel={liveFrame ? `${liveFrame.width}×${liveFrame.height} · #${liveFrame.seq}` : 'NO FRAME'}
        fps={state.settings.fps}
        version={state.version}
        platform={state.platform}
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />

      {connectOpen ? (
        <ConnectSheet state={state} actions={actions} onClose={() => setConnectOpen(false)} />
      ) : null}
      {settingsOpen ? (
        <SettingsSheet
          state={state}
          actions={actions}
          onClose={() => setSettingsOpen(false)}
          onOpenModels={openModels}
        />
      ) : null}
      {modelsFor ? (
        <ModelsSheet
          initialPlatform={modelsFor}
          state={state}
          actions={actions}
          onClose={closeModels}
        />
      ) : null}
      {guideOpen ? (
        <GesturesSheet state={state} onClose={() => setGuideOpen(false)} />
      ) : null}
      {state.qr ? (
        <QrSheet qr={state.qr} actions={actions} onClose={() => void actions.hideQr()} />
      ) : null}
      {peekApp ? (
        <AppSheet
          app={peekApp}
          state={state}
          actions={actions}
          onClose={() => setPeekApp(null)}
        />
      ) : null}

      {focusMode ? (
        <button type="button" className="focus-exit" onClick={() => setFocusMode(false)}>
          <Icon name="minimize" size={14} />
          Exit focus · Esc
        </button>
      ) : null}
    </div>
  );
}
