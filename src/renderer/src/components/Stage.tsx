import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import type { AppState, FramePayload } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { storeName } from '../lib/format';
import { Icon } from '../lib/icons';
import { PhoneFrame } from './PhoneFrame';
import { themeOption, type StageTheme } from '../lib/theme';

interface StageProps {
  state: AppState;
  frame: FramePayload | null;
  frameAge: number;
  actions: PhoneActions;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenGuide: () => void;
  recording: boolean;
  recordingProcessing: boolean;
  recordingElapsed: number;
  onStartManual: () => void;
  onStartAuto: () => void;
  onStopRecording: () => void;
  theme: StageTheme;
}

function ThemeBackdrop({ theme }: { theme: StageTheme }): ReactElement | null {
  const option = themeOption(theme);
  if (!option) return null;
  return (
    <div
      className="stage-theme"
      aria-hidden="true"
      style={{
        backgroundImage: `url(${option.image})`,
        backgroundPosition: option.objectPosition,
      }}
    />
  );
}

export function Stage({
  state,
  frame,
  frameAge,
  actions,
  focusMode,
  onToggleFocus,
  onOpenGuide,
  recording,
  recordingProcessing,
  recordingElapsed,
  onStartManual,
  onStartAuto,
  onStopRecording,
  theme,
}: StageProps): ReactElement {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [text, setText] = useState('');
  const [viewerZoom, setViewerZoom] = useState(1);
  const device = state.devices.find((candidate) => candidate.id === state.activeDeviceId) ?? null;
  const liveFrame = frame && frame.deviceId === device?.id ? frame : null;
  const demoZoom = Boolean(device?.isDemo) && viewerZoom > 1.01;

  useEffect(() => {
    setViewerZoom(1);
  }, [device?.id, device?.modelId]);

  const handlePinch = (x: number, y: number, scale: number): void => {
    if (device?.isDemo) {
      setViewerZoom((current) => Math.max(1, Math.min(2.2, current * scale)));
      return;
    }
    void actions.pinch(x, y, scale);
  };
  const multiTouch = device?.controlEngine === 'scrcpy';
  const controlLabel = !device?.capabilities.input
    ? 'VIEW ONLY'
    : device.isDemo
      ? 'DEMO INPUT'
      : multiTouch
        ? 'MULTI-TOUCH'
        : device.controlEngine === 'idb'
          ? 'IDB TOUCH'
          : 'ADB TOUCH';
  const gestureHint = !device?.capabilities.input
    ? 'VIEW ONLY'
    : multiTouch
      ? 'TAP · DRAG · WHEEL/ARROWS · PINCH'
      : device.isDemo
        ? 'TAP · SWIPE · WHEEL/ARROWS'
        : 'TAP · DRAG · WHEEL/ARROWS';

  if (!device) {
    return (
      <section className={`stage ${theme === 'earth-orbital' ? 'has-theme' : ''}`}>
        <ThemeBackdrop theme={theme} />
        <div className="stage-empty">
          <span className="stage-empty-icon">
            <Icon name="device" size={28} />
          </span>
          <h2>No phone selected</h2>
          <p>Connect an Android phone or iPhone over USB, or explore the built-in demo.</p>
          <div className="row gap-10">
            <button type="button" className="btn btn-primary" onClick={() => actions.useDemo('android')}>
              Android demo
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => actions.useDemo('ios')}>
              iPhone demo
            </button>
          </div>
        </div>
      </section>
    );
  }

  const saveFrame = (): void => {
    if (!liveFrame) return;
    const url =
      liveFrame.mime === 'image/svg+xml'
        ? liveFrame.data
        : `data:${liveFrame.mime};base64,${liveFrame.data}`;
    const extension = liveFrame.mime === 'image/svg+xml' ? 'svg' : 'jpg';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${device.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${extension}`;
    anchor.click();
    actions.toast('success', 'Frame saved', 'Your browser saved it to Downloads.');
  };

  const submitText = (event: FormEvent): void => {
    event.preventDefault();
    if (!text.trim()) return;
    void actions.typeText(text);
    setText('');
  };

  return (
    <section className={`stage ${theme === 'earth-orbital' ? 'has-theme' : ''}`}>
      <ThemeBackdrop theme={theme} />
      <div className="stage-top">
        <div className="stage-title">
          <div className="eyebrow">
            <span className={`live-dot ${state.preview.active ? 'is-live' : ''}`} />
            {state.preview.active ? 'LIVE PREVIEW' : 'PREVIEW PAUSED'}
            {device.isDemo ? <span className="eyebrow-tag">DEMO</span> : null}
          </div>
          <h1>{device.name}</h1>
          <div className="device-meta">
            <span className="pill pill-platform" data-platform={device.platform}>
              <Icon name={device.platform === 'ios' ? 'apple' : 'android'} size={12} />
              {device.platform === 'ios' ? 'iOS' : 'Android'}
            </span>
            <span>{device.osVersion}</span>
            <span className="meta-sep" />
            <span className="capitalize">{device.connection}</span>
            {device.resolution ? (
              <>
                <span className="meta-sep" />
                <span className="mono-sm">
                  {device.resolution.width} × {device.resolution.height}
                </span>
              </>
            ) : null}
            {device.displayInches ? (
              <>
                <span className="meta-sep" />
                <span>{device.displayInches}&quot;</span>
              </>
            ) : null}
            {device.battery !== null ? (
              <>
                <span className="meta-sep" />
                <span className="battery-inline">
                  <Icon name="battery" size={13} />
                  {device.battery}%
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="stage-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => actions.openStore()}
            title={`Open ${storeName(device.platform)} on the phone`}
          >
            <Icon name="store" size={16} />
            Open {storeName(device.platform)}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={saveFrame}
            disabled={!liveFrame}
            title="Save current frame"
            aria-label="Save current frame"
          >
            <Icon name="download" size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleFocus}
            title={focusMode ? 'Exit focus mode (Esc)' : 'Focus mode'}
            aria-label={focusMode ? 'Exit focus mode' : 'Focus mode'}
            data-artefact-id="focus"
            data-artefact-label="Focus mode"
            data-artefact-kind="overlay"
            data-artefact-description="Hide both rails and give the phone the entire workspace."
          >
            <Icon name={focusMode ? 'minimize' : 'maximize'} size={17} />
          </button>
        </div>
      </div>

      <div className={`stage-canvas ${demoZoom ? 'is-zoomed' : ''}`}>
        <div className="stage-grid" aria-hidden="true" />
        <div className="stage-glow" data-platform={device.platform} aria-hidden="true" />
        <div className="stage-floor" aria-hidden="true" />
        <div
          className="stage-phone-zoom"
          style={{ transform: `scale(${viewerZoom})` }}
        >
          <PhoneFrame
            device={device}
            frame={liveFrame}
            previewActive={state.preview.active}
            onTap={(x, y) => void actions.tap(x, y)}
            onLongPress={(x, y) => void actions.longPress(x, y)}
            onSwipe={(x1, y1, x2, y2) => void actions.swipe(x1, y1, x2, y2)}
            onScroll={(x, y, dx, dy) => void actions.scroll(x, y, dx, dy)}
            onPinch={handlePinch}
            onPress={(key) => void actions.press(key)}
            onCaptureScreenshot={(request) => void actions.captureScreenshot(request)}
            recording={recording}
            recordingProcessing={recordingProcessing}
            recordingElapsed={recordingElapsed}
            onStartManual={onStartManual}
            onStartAuto={onStartAuto}
            onStopRecording={onStopRecording}
            onStartPreview={() => void actions.startPreview()}
          />
        </div>
      </div>

      <div className="control-wrap">
        <div className="control-pill">
          <div className="control-group">
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('back')}
              title="Back"
              aria-label="Back"
            >
              <Icon name="chevron-left" size={19} />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('home')}
              title="Home"
              aria-label="Home"
            >
              <Icon name="home" size={18} />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('recents')}
              title="Recent apps"
              aria-label="Recent apps"
            >
              <Icon name="recents" size={18} />
            </button>
          </div>
          <span className="control-divider" />
          <div className="control-group">
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('volume_down')}
              title="Volume down"
              aria-label="Volume down"
            >
              <Icon name="volume" size={18} />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('volume_up')}
              title="Volume up"
              aria-label="Volume up"
            >
              <Icon name="volume" size={18} className="flip-x" />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => void actions.press('power')}
              title="Power"
              aria-label="Power"
            >
              <Icon name="power" size={18} />
            </button>
          </div>
          <span className="control-divider" />
          <div className="control-group">
            <button
              type="button"
              className="control-btn"
              onClick={() => handlePinch(0.5, 0.5, 0.74)}
              title="Pinch to zoom out"
              aria-label="Pinch to zoom out"
            >
              <Icon name="zoom-out" size={18} />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => handlePinch(0.5, 0.5, 1.35)}
              title="Pinch to zoom in"
              aria-label="Pinch to zoom in"
            >
              <Icon name="zoom-in" size={18} />
            </button>
          </div>
          <span className="control-divider" />
          <button
            type="button"
            className={`control-btn ${keyboardOpen ? 'is-active' : ''}`}
            onClick={() => setKeyboardOpen((open) => !open)}
            title="Type to the phone"
            aria-label="Type to the phone"
            aria-expanded={keyboardOpen}
          >
            <Icon name="keyboard" size={19} />
          </button>
          <button
            type="button"
            className="control-btn"
            onClick={onOpenGuide}
            title="Gesture guide"
            aria-label="Gesture guide"
            data-artefact-id="guide"
            data-artefact-label="Control guide"
            data-artefact-kind="overlay"
            data-artefact-description="How mouse, keyboard and touch gestures map onto the phone."
          >
            <Icon name="info" size={18} />
          </button>
        </div>

        {keyboardOpen ? (
          <form className="type-bar" onSubmit={submitText}>
            <Icon name="keyboard" size={16} className="type-icon" />
            <input
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                device.platform === 'ios'
                  ? 'Text input needs a WebDriverAgent session'
                  : `Type to ${device.name}…`
              }
              aria-label="Text to send to the phone"
            />
            <span className="type-hint">↵ send</span>
            <button type="submit" className="btn btn-ghost btn-sm" disabled={!text.trim()}>
              Send
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => setKeyboardOpen(false)}
              aria-label="Close keyboard"
            >
              <Icon name="x" size={15} />
            </button>
          </form>
        ) : null}
      </div>

      <div className="stage-foot">
        <div className="foot-left">
          <span className={`live-dot small ${state.preview.active ? 'is-live' : ''}`} />
          <span className="mono-label">
            {state.preview.active ? 'STREAMING' : 'PAUSED'}
          </span>
          <span className="foot-sep" />
          <span className="mono-label">
            {liveFrame ? `FRAME ${liveFrame.seq}` : 'NO FRAME'}
          </span>
          {liveFrame ? (
            <>
              <span className="foot-sep" />
              <span className="mono-label">
                {frameAge > 0 && frameAge < 1000 ? 'JUST NOW' : `${Math.round(frameAge / 1000)}S AGO`}
              </span>
            </>
          ) : null}
          {state.preview.active ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => void actions.stopPreview()}
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              className="link-btn"
              onClick={() => void actions.startPreview()}
            >
              Resume
            </button>
          )}
        </div>
        <div className="foot-right">
          <span className="mono-label">{gestureHint}</span>
          <span className="foot-sep" />
          <button
            type="button"
            className={`mono-label control-state ${multiTouch ? 'is-native' : ''} ${demoZoom ? 'is-zoom' : ''}`}
            onClick={() => setViewerZoom(1)}
            title={demoZoom ? 'Reset demo zoom' : undefined}
          >
            {demoZoom ? `DEMO ZOOM ${viewerZoom.toFixed(1)}×` : controlLabel}
          </button>
          <span className="foot-sep" />
          <span className="mono-label">{state.settings.fps} FPS TARGET</span>
        </div>
      </div>
    </section>
  );
}
