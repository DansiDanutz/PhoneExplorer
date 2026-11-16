import { useEffect, useState } from 'react';
import type { CatalogApp } from '@shared/types';
import { usePhone } from './hooks/usePhone';
import { DeviceRail } from './components/DeviceRail';
import { Inspector, type InspectorTab } from './components/Inspector';
import { AppSheet, ConnectSheet, QrSheet, SettingsSheet } from './components/Modals';
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
  const [focusMode, setFocusMode] = useState(false);

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
      if (event.key === 'Escape' && focusMode && !connectOpen && !settingsOpen && !peekApp && !state?.qr) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, connectOpen, settingsOpen, peekApp, state?.qr]);

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
          />
        ) : null}

        <Stage
          state={state}
          frame={frame}
          frameAge={frameAge}
          actions={actions}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
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
        <SettingsSheet state={state} actions={actions} onClose={() => setSettingsOpen(false)} />
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
