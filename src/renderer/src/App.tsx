import { useEffect, useState } from 'react';
import type { CatalogApp, PhonePlatform } from '@shared/types';
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
      const target = event.target as HTMLElement | null;
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
