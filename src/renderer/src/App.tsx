import { useEffect, useRef, useState } from 'react';
import type { ArtefactSection, CatalogApp, PhonePlatform, Screenshot } from '@shared/types';
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
import { readStageTheme, themeOption, writeStageTheme, type StageTheme } from './lib/theme';

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

async function shrinkScreenshot(dataUrl: string, width = 520): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, width / Math.max(1, image.width));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
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
  const [stageTheme, setStageTheme] = useState<StageTheme>(readStageTheme);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingProcessing, setRecordingProcessing] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'manual' | 'auto' | null>(null);
  const autoCancel = useRef(false);
  const recordingRef = useRef(false);
  const recordingModeRef = useRef<'manual' | 'auto' | null>(null);

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

  const applyStageTheme = (next: StageTheme): void => {
    if (next === stageTheme) return;
    setStageTheme(next);
    writeStageTheme(next);
    const option = themeOption(next);
    actions.toast(
      'success',
      option ? `${option.name} applied` : 'Default theme restored',
      option ? 'The stage backdrop now uses this theme.' : 'The green stage glow is back.',
    );
  };

  useEffect(() => {
    if (!recording || recordingStartedAt <= 0) return;
    const tick = (): void => {
      setRecordingElapsed(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [recording, recordingStartedAt]);

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

  const startPhoneRecording = async (mode: 'manual' | 'auto'): Promise<void> => {
    if (!state || recording || recordingProcessing) return;
    const active = state.devices.find((candidate) => candidate.id === state.activeDeviceId) ?? null;
    if (!active || active.platform !== 'android' || active.isDemo) {
      actions.toast(
        'error',
        'Connect an Android phone',
        'Recording reads the real phone screen while you move through the app.',
      );
      return;
    }
    if (mode === 'auto') {
      const nodes = await actions.dumpAndroidUi();
      const packageName = nodes.find(
        (node) => node.packageName && !/launcher|systemui|android/i.test(node.packageName),
      )?.packageName;
      if (!packageName || !/nsus\.poker|ggpoker/i.test(packageName)) {
        actions.toast(
          'error',
          'Open GGPoker first',
          'Auto walkthrough is mapped to GGPoker. Open the app, then choose Auto again.',
        );
        return;
      }
    }
    try {
      const started = await actions.startPhoneRecording();
      autoCancel.current = false;
      recordingRef.current = true;
      recordingModeRef.current = mode;
      setRecordingMode(mode);
      setRecording(true);
      setRecordingStartedAt(started.startedAt);
      setRecordingElapsed(0);
      if (mode === 'auto') void runAutoWalkthrough();
    } catch (error) {
      actions.toast(
        'error',
        'Could not start recording',
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  async function runAutoWalkthrough(): Promise<void> {
    const steps: Array<{ x: number; y: number; label: string }> = [
      { x: 0.5, y: 0.95, label: 'Lobby' },
      { x: 0.312, y: 0.95, label: 'Tournaments' },
      { x: 0.5, y: 0.95, label: 'Lobby' },
      { x: 0.688, y: 0.95, label: 'Casino' },
      { x: 0.5, y: 0.95, label: 'Lobby' },
    ];
    try {
      for (const step of steps) {
        if (autoCancel.current) return;
        await actions.tap(step.x, step.y);
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        if (autoCancel.current) return;
      }
      if (!autoCancel.current) await stopPhoneRecording();
    } catch (error) {
      actions.toast(
        'error',
        'Auto walkthrough stopped',
        error instanceof Error ? error.message : String(error),
      );
      if (recordingRef.current) await stopPhoneRecording();
    }
  }

  const buildRecordingArtefact = async (
    shots: Screenshot[],
    videoPath: string,
  ): Promise<void> => {
    const sections: ArtefactSection[] = [];
    const seen: Array<Set<string>> = [];
    const direct = shots.filter((shot) => !shot.deviceName.startsWith('Video frame'));
    const candidates = direct.length >= 3 ? direct : shots;
    for (const shot of candidates.slice(0, 80)) {
      if (sections.length >= 24) break;
      const boxes = await actions.ocrScreenshot(shot.id);
      const tokens = new Set(
        boxes
          .flatMap((box) => box.text.toLowerCase().split(/\s+/))
          .map((token) => token.replace(/[^a-z0-9]/g, ''))
          .filter((token) => token.length > 1),
      );
      if (tokens.size > 0) {
        const duplicate = seen.some((previous) => {
          const union = new Set([...previous, ...tokens]);
          let intersection = 0;
          for (const token of tokens) if (previous.has(token)) intersection += 1;
          return union.size > 0 && intersection / union.size >= 0.88;
        });
        if (duplicate) continue;
        seen.push(tokens);
      }
      const rawImage = await actions.loadScreenshot(shot.id);
      if (!rawImage) continue;
      const image = await shrinkScreenshot(rawImage);
      const title =
        boxes
          .map((box) => box.text.trim())
          .filter(
            (text) =>
              text.length >= 4 &&
              !/^\d|^\d{1,2}:\d{2}|a\.m\.|p\.m\.|baterie|wi-fi|notification|^[$€£]/i.test(text),
          )
          .sort((a, b) => b.length - a.length)[0]
          ?.slice(0, 60) ?? `Phone view ${sections.length + 1}`;
      sections.push({
        id: shot.id,
        title,
        description:
          shot.caption ||
          `Recorded phone view captured at ${new Date(shot.createdAt).toLocaleTimeString()}.`,
        image,
      });
    }
    if (sections.length === 0) {
      actions.toast('error', 'No distinct phone screens', 'The recording did not produce usable screenshots.');
      return;
    }
    const doc = await actions.saveArtefact({
      title:
        recordingModeRef.current === 'auto'
          ? 'Auto phone — App Walkthrough'
          : 'Recorded phone — App Walkthrough',
      subtitle:
        recordingModeRef.current === 'auto'
          ? `An automatic, phone-only GGPoker walkthrough. ${sections.length} distinct screens selected from ${shots.length} live screenshots and video frames.${videoPath ? ' The source video is saved beside the recording library.' : ''}`
          : `A user-driven phone session. ${sections.length} distinct screens selected from ${shots.length} live screenshots and video frames.${videoPath ? ' The source video is saved beside the recording library.' : ''}`,
      deviceName: `${state?.devices.find((candidate) => candidate.id === state.activeDeviceId)?.name ?? 'Phone'} · Android`,
      sections,
      quiet: true,
    });
    if (!doc) return;
    setTab('artefacts');
    actions.toast('success', 'Artefact ready', `${sections.length} phone screens`);
  };

  const stopPhoneRecording = async (): Promise<void> => {
    autoCancel.current = true;
    if (!recordingRef.current || recordingProcessing) return;
    setRecordingProcessing(true);
    try {
      const result = await actions.stopPhoneRecording();
      recordingRef.current = false;
      setRecording(false);
      await buildRecordingArtefact(result.screenshots, result.videoPath);
    } catch (error) {
      actions.toast(
        'error',
        'Could not finish recording',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setRecordingProcessing(false);
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
            theme={stageTheme}
            onApplyTheme={applyStageTheme}
          />
        ) : null}

        <Stage
          state={state}
          theme={stageTheme}
          frame={frame}
          frameAge={frameAge}
          actions={actions}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onOpenGuide={() => setGuideOpen(true)}
          recording={recording}
          recordingProcessing={recordingProcessing}
          recordingElapsed={recordingElapsed}
          onStartManual={() => void startPhoneRecording('manual')}
          onStartAuto={() => void startPhoneRecording('auto')}
          onStopRecording={() => void stopPhoneRecording()}
        />

        {!focusMode ? (
          <Inspector
            state={state}
            actions={actions}
            tab={tab}
            onTab={setTab}
            onPeek={(app) => setPeekApp(app)}
            onRecord={() => void startPhoneRecording('manual')}
            onStop={() => void stopPhoneRecording()}
            recording={recording}
            recordingProcessing={recordingProcessing}
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

      {recording || recordingProcessing ? (
        <div className="walkthrough-hud recording-hud" role="status">
          <span className={`recording-dot ${recordingProcessing ? 'is-processing' : ''}`} />
          <div className="walkthrough-copy">
            <strong>
              {recordingProcessing
                ? 'Extracting screenshots from the recording…'
                : recordingMode === 'auto'
                  ? 'Auto walkthrough recording'
                  : 'Recording the phone'}
            </strong>
            <span>
              {recordingProcessing
                ? 'Video frames and live screenshots are being collected.'
                : recordingMode === 'auto'
                  ? 'Navigating GGPoker: Lobby → Tournaments → Casino · screenshots every 2 seconds'
                  : `${String(Math.floor(recordingElapsed / 60)).padStart(2, '0')}:${String(recordingElapsed % 60).padStart(2, '0')} · screenshots every 2 seconds · move through the app`}
            </span>
          </div>
          {recording ? (
            <button type="button" className="walkthrough-stop" onClick={() => void stopPhoneRecording()}>
              Stop recording
            </button>
          ) : (
            <span className="mini-spinner" />
          )}
        </div>
      ) : null}

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
