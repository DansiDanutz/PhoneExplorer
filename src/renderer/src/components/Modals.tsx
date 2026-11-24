import { useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AppState, CatalogApp, PhonePlatform, QrPayload } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { storeName } from '../lib/format';
import { Icon } from '../lib/icons';
import { AppTile, StoreGlyph } from './AppMark';

interface OverlayProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label: string;
}

export function Overlay({ children, onClose, className, label }: OverlayProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConnectProps {
  state: AppState;
  actions: PhoneActions;
  onClose: () => void;
}

export function ConnectSheet({ state, actions, onClose }: ConnectProps): ReactElement {
  const [webModels, setWebModels] = useState<string[]>([]);
  const [webModel, setWebModel] = useState('iPhone 13');
  useEffect(() => { void window.phone.webModels().then(setWebModels).catch(() => setWebError('Unable to load iPhone profiles.')); }, []);
  const [webUrl, setWebUrl] = useState('');
  const [opening, setOpening] = useState(false);
  const [webError, setWebError] = useState('');
  const [address, setAddress] = useState('');
  const adb = state.tools.find((tool) => tool.id === 'adb');
  const ios = state.tools.find((tool) => tool.id === 'ios');

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text).then(
      () => actions.toast('success', 'Copied', text),
      () => actions.toast('error', 'Clipboard unavailable'),
    );
  };

  const connect = (event: FormEvent): void => {
    event.preventDefault();
    if (!address.trim()) return;
    void actions.connectWifi(address.trim());
  };

  return (
    <Overlay onClose={onClose} className="modal-connect" label="Connect a device">
      <header className="modal-head">
        <div>
          <div className="eyebrow">DEVICE BRIDGE</div>
          <h2>Connect a phone</h2>
          <p>Two platforms, two bridges. Pick the one on your desk.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
      </header>

      <div className="connect-grid">
        <section className="connect-card" data-platform="android">
          <div className="connect-card-head">
            <span className="platform-orb android">
              <Icon name="android" size={20} />
            </span>
            <div>
              <h3>Android</h3>
              <span className="connect-sub">USB debugging · adb</span>
            </div>
            <span className={`status-dot ${adb?.found ? 'ok' : 'warn'}`} />
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <span>
                Enable <strong>Developer options</strong> — tap Build number seven times.
              </span>
            </li>
            <li>
              <span className="step-num">2</span>
              <span>
                Turn on <strong>USB debugging</strong>, then plug the phone in.
              </span>
            </li>
            <li>
              <span className="step-num">3</span>
              <span>
                Tap <strong>Allow</strong> on the USB debugging prompt.
              </span>
            </li>
          </ol>
          <div className={`tool-line ${adb?.found ? 'ok' : 'warn'}`}>
            <span className={`status-dot ${adb?.found ? 'ok' : 'warn'}`} />
            <span className="tool-line-label">{adb?.found ? 'adb detected' : 'adb not found'}</span>
            <span className="tool-line-path mono" title={adb?.path ?? ''}>
              {adb?.path ?? '—'}
            </span>
          </div>
          {!adb?.found ? (
            <div className="code-row">
              <code>brew install android-platform-tools</code>
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => copy('brew install android-platform-tools')}
                aria-label="Copy install command"
              >
                <Icon name="copy" size={14} />
              </button>
            </div>
          ) : null}
          <form className="wifi-form" onSubmit={connect}>
            <label htmlFor="wifi-address">Wireless debugging</label>
            <div className="wifi-row">
              <input
                id="wifi-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="192.168.1.42:5555"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-ghost btn-sm" disabled={!address.trim()}>
                Connect
              </button>
            </div>
            <span className="field-hint">
              Android 11+ pairs in Developer options; enter the IP:port shown there.
            </span>
          </form>
        </section>

        <section className="connect-card" data-platform="ios">
          <div className="connect-card-head">
            <span className="platform-orb ios">
              <Icon name="apple" size={19} />
            </span>
            <div>
              <h3>iPhone</h3>
              <span className="connect-sub">Trust · libimobiledevice / idb</span>
            </div>
            <span className={`status-dot ${ios?.found ? 'ok' : 'warn'}`} />
          </div>
          <form className="wifi-form" onSubmit={async event => {
            event.preventDefault(); setOpening(true); setWebError('');
            try { await window.phone.openWebPreview(webUrl, webModel); } catch (err) {
              setWebError(err instanceof Error ? err.message : String(err));
            } finally { setOpening(false); }
          }}>
            <label htmlFor="iphone-web-model">iPhone model</label>
            <select id="iphone-web-model" value={webModel} onChange={e => setWebModel(e.target.value)}>
              {webModels.map(name => <option key={name}>{name}</option>)}
            </select>
            <label htmlFor="iphone-web-preview">iPhone web preview</label>
            <div className="wifi-row">
              <input id="iphone-web-preview" type="url" required placeholder="https://example.com"
                value={webUrl} onChange={e => setWebUrl(e.target.value)} />
              <button className="btn btn-ghost btn-sm" disabled={opening || !webModels.length}>{opening ? 'Opening…' : 'Preview'}</button>
            </div>
            <span className="field-hint">Mobile WebKit with iPhone dimensions and touch. No phone required; Safari browser bars are not simulated.</span>
            {webError && <span role="alert">{webError}</span>}
          </form>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <span>
                Plug in, unlock the iPhone and tap <strong>Trust This Computer</strong>.
              </span>
            </li>
            <li>
              <span className="step-num">2</span>
              <span>
                Install the open-source bridge:{' '}
                <code>brew install libimobiledevice</code>.
              </span>
            </li>
            <li>
              <span className="step-num">3</span>
              <span>
                For touch and store links add <strong>idb</strong> —{' '}
                <code>brew tap facebook/fb &amp;&amp; brew install idb-companion</code>, then{' '}
                <code>pipx install fb-idb</code>.
              </span>
            </li>
          </ol>
          <div className={`tool-line ${ios?.found ? 'ok' : 'warn'}`}>
            <span className={`status-dot ${ios?.found ? 'ok' : 'warn'}`} />
            <span className="tool-line-label">
              {ios?.found ? `Bridge ready · ${ios.path}` : 'No iOS bridge found'}
            </span>
          </div>
          <div className="code-row">
            <code>brew install libimobiledevice</code>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => copy('brew install libimobiledevice')}
              aria-label="Copy install command"
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
          <p className="connect-note">
            Apple locks down the App Store: PhoneExplorer can show the QR code if a deep link is not
            available. Sideloading an IPA still needs a signed build.
          </p>
        </section>
      </div>

      <footer className="modal-foot">
        <div className="demo-cta">
          <span className="eyebrow">NO HARDWARE?</span>
          <div className="row gap-8">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void actions.useDemo('android');
                onClose();
              }}
            >
              <Icon name="android" size={14} />
              Pixel demo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void actions.useDemo('ios');
                onClose();
              }}
            >
              <Icon name="apple" size={13} />
              iPhone demo
            </button>
          </div>
        </div>
        <div className="row gap-8">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void actions.refresh()}
          >
            <Icon name="refresh" size={14} />
            Scan again
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </footer>
    </Overlay>
  );
}

interface SettingsProps {
  state: AppState;
  actions: PhoneActions;
  onClose: () => void;
  onOpenModels: (platform: PhonePlatform) => void;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}): ReactElement {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function SettingsSheet({
  state,
  actions,
  onClose,
  onOpenModels,
}: SettingsProps): ReactElement {
  const [adbPath, setAdbPath] = useState(state.settings.adbPath);
  const [savedPath, setSavedPath] = useState(state.settings.adbPath);
  const defaultAndroid = state.models.find(
    (model) => model.id === state.defaultModels.android,
  );
  const defaultIos = state.models.find((model) => model.id === state.defaultModels.ios);

  useEffect(() => {
    setAdbPath(state.settings.adbPath);
    setSavedPath(state.settings.adbPath);
  }, [state.settings.adbPath]);

  const savePath = (): void => {
    if (adbPath === savedPath) return;
    setSavedPath(adbPath);
    void actions.updateSetting('adbPath', adbPath.trim());
  };

  return (
    <Overlay onClose={onClose} className="modal-settings" label="Settings">
      <header className="modal-head sheet-head">
        <div>
          <div className="eyebrow">PREFERENCES</div>
          <h2>Settings</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
      </header>

      <div className="settings-scroll">
        <section className="settings-group">
          <div className="settings-title">
            <Icon name="monitor" size={15} />
            Mirror
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Frame rate</span>
              <small>How often a fresh frame is captured.</small>
            </div>
            <div className="range-wrap">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={state.settings.fps}
                onChange={(event) => void actions.updateSetting('fps', Number(event.target.value))}
                aria-label="Frame rate"
              />
              <span className="range-value mono">{state.settings.fps} fps</span>
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>JPEG quality</span>
              <small>Lower is faster over IPC; higher is crisper.</small>
            </div>
            <div className="range-wrap">
              <input
                type="range"
                min={40}
                max={95}
                step={5}
                value={state.settings.quality}
                onChange={(event) => void actions.updateSetting('quality', Number(event.target.value))}
                aria-label="JPEG quality"
              />
              <span className="range-value mono">{state.settings.quality}</span>
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Start preview on connect</span>
              <small>Begin streaming as soon as a device is selected.</small>
            </div>
            <Toggle
              checked={state.settings.autoPreview}
              onChange={(next) => void actions.updateSetting('autoPreview', next)}
              label="Start preview automatically"
            />
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Reduce motion</span>
              <small>Disable ambient glows and entrance animation.</small>
            </div>
            <Toggle
              checked={state.settings.reduceMotion}
              onChange={(next) => void actions.updateSetting('reduceMotion', next)}
              label="Reduce motion"
            />
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Reverse scroll</span>
              <small>Flip wheel and ↑/↓ scrolling if it feels backwards.</small>
            </div>
            <Toggle
              checked={state.settings.invertScroll}
              onChange={(next) => void actions.updateSetting('invertScroll', next)}
              label="Reverse scroll"
            />
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-title">
            <Icon name="smartphone" size={15} />
            Demo lab
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Default Android model</span>
              <small>
                {defaultAndroid
                  ? `${defaultAndroid.manufacturer} · ${defaultAndroid.screen.width}×${defaultAndroid.screen.height}`
                  : 'Not set'}
              </small>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenModels('android')}
            >
              <span className="setting-model-name">{defaultAndroid?.name ?? 'Choose'}</span>
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Default iPhone model</span>
              <small>
                {defaultIos
                  ? `${defaultIos.manufacturer} · ${defaultIos.screen.width}×${defaultIos.screen.height}`
                  : 'Not set'}
              </small>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenModels('ios')}
            >
              <span className="setting-model-name">{defaultIos?.name ?? 'Choose'}</span>
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Startup demo</span>
              <small>Which demo tab opens when there is no physical device.</small>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={state.settings.demoPlatform === 'android' ? 'is-active' : ''}
                onClick={() => void actions.updateSetting('demoPlatform', 'android')}
              >
                Android
              </button>
              <button
                type="button"
                className={state.settings.demoPlatform === 'ios' ? 'is-active' : ''}
                onClick={() => void actions.updateSetting('demoPlatform', 'ios')}
              >
                iPhone
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-copy">
              <span>Custom models</span>
              <small>
                {state.settings.customModels.length} saved · add a profile with its own screen and
                frame colour.
              </small>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenModels(state.settings.demoPlatform)}
            >
              Manage
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-title">
            <Icon name="terminal" size={15} />
            Toolchain
          </div>
          {state.tools.map((tool) => (
            <div className="tool-card" key={tool.id}>
              <div className="tool-card-head">
                <span className={`status-dot ${tool.found ? 'ok' : 'warn'}`} />
                <strong>{tool.label}</strong>
                <span className={`tool-badge ${tool.found ? 'ok' : 'warn'}`}>
                  {tool.found ? 'READY' : 'MISSING'}
                </span>
              </div>
              {tool.path ? <div className="tool-path mono">{tool.path}</div> : null}
              {tool.hint ? <p className="tool-hint">{tool.hint}</p> : null}
              {tool.url ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void actions.openExternal(tool.url as string)}
                >
                  Open documentation <Icon name="external" size={12} />
                </button>
              ) : null}
            </div>
          ))}
          <div className="setting-row path-row">
            <div className="setting-copy">
              <span>Custom adb path</span>
              <small>Leave blank to auto-detect from PATH and common SDK folders.</small>
            </div>
          </div>
          <div className="path-input-row">
            <input
              value={adbPath}
              onChange={(event) => setAdbPath(event.target.value)}
              onBlur={savePath}
              onKeyDown={(event) => {
                if (event.key === 'Enter') savePath();
              }}
              placeholder={state.tools.find((tool) => tool.id === 'adb')?.path ?? '/opt/homebrew/bin/adb'}
              spellCheck={false}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={savePath}>
              Save
            </button>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-title">
            <Icon name="info" size={15} />
            About
          </div>
          <div className="about-card">
            <div className="about-mark">
              <Icon name="smartphone" size={18} />
            </div>
            <div>
              <strong>PhoneExplorer</strong>
              <p>
                Stage 01 · v{state.version} · {state.platform === 'darwin' ? 'macOS' : state.platform}
              </p>
            </div>
          </div>
          <p className="about-copy">
            Built on Electron, adb and libimobiledevice. The store stays on the phone: installs are
            real downloads, not desktop-side side-loads.
          </p>
          <div className="row gap-8 wrap">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void actions.openExternal('https://github.com/DansiDanutz/PhoneExplorer')}
            >
              <Icon name="external" size={13} />
              Repository
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void actions.openExternal('https://github.com/Genymobile/scrcpy')}
            >
              <Icon name="external" size={13} />
              scrcpy
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void actions.openExternal('https://libimobiledevice.org')}
            >
              <Icon name="external" size={13} />
              libimobiledevice
            </button>
          </div>
        </section>
      </div>

      <footer className="modal-foot sheet-foot">
        <span className="mono-label">SETTINGS SAVE AUTOMATICALLY</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Done
        </button>
      </footer>
    </Overlay>
  );
}

interface AppSheetProps {
  app: CatalogApp;
  state: AppState;
  actions: PhoneActions;
  onClose: () => void;
}

export function AppSheet({ app, state, actions, onClose }: AppSheetProps): ReactElement {
  const device = state.devices.find((candidate) => candidate.id === state.activeDeviceId) ?? null;
  const platform = device?.platform ?? 'android';
  const installed = state.installed.some((item) => item.appId === app.id);
  const progress = state.installs[app.id];
  const busy = progress && progress.phase !== 'done' && progress.phase !== 'failed';
  const packageId = platform === 'ios' ? app.iosBundleId : app.androidPackage;

  return (
    <Overlay onClose={onClose} className="modal-app" label={`${app.name} details`}>
      <div className="app-sheet-hero" style={{ background: `linear-gradient(135deg, ${app.color}, ${app.color}22)` }}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
        <div className="app-sheet-icon">
          <AppTile app={app} size={78} />
        </div>
        <div className="app-sheet-title">
          <span className="app-sheet-category">{app.category}</span>
          <h2 style={{ color: app.ink }}>{app.name}</h2>
          <p style={{ color: app.ink }}>{app.publisher}</p>
        </div>
      </div>
      <div className="app-sheet-body">
        <div className="app-sheet-stats">
          <div>
            <span className="stat-value">★ {app.rating.toFixed(1)}</span>
            <span className="stat-label">{app.installs} installs</span>
          </div>
          <div>
            <span className="stat-value">{app.size}</span>
            <span className="stat-label">{app.category}</span>
          </div>
          <div>
            <span className="stat-value">4+</span>
            <span className="stat-label">Age rating</span>
          </div>
        </div>
        <p className="app-sheet-tagline">{app.tagline}</p>
        <p className="app-sheet-copy">{app.description}</p>
        <div className="app-sheet-meta">
          <span className="detail-label">Store</span>
          <span>{storeName(platform)}</span>
          <span className="detail-label">Package</span>
          <span className="mono">{packageId}</span>
        </div>
        <div className="app-sheet-actions">
          {installed || progress?.phase === 'done' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void actions.openApp(packageId);
                onClose();
              }}
            >
              <Icon name="play" size={14} />
              Open on {device?.name ?? 'phone'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => {
                void actions.installApp(app.id);
                onClose();
              }}
            >
              {busy ? <span className="mini-spinner dark" /> : <Icon name="download" size={15} />}
              {busy ? progress?.message ?? 'Installing…' : `Get on ${storeName(platform)}`}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void actions.openStore(app.id);
              onClose();
            }}
          >
            <Icon name="external" size={14} />
            Store page
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void actions.showQr(app.id);
              onClose();
            }}
          >
            <Icon name="qr" size={15} />
            QR code
          </button>
        </div>
        <p className="app-sheet-note">
          Icons are original monograms. Store metadata is for demonstration; the real listing lives
          on the phone.
        </p>
      </div>
    </Overlay>
  );
}

interface QrProps {
  qr: QrPayload;
  actions: PhoneActions;
  onClose: () => void;
}

export function QrSheet({ qr, actions, onClose }: QrProps): ReactElement {
  return (
    <Overlay onClose={onClose} className="modal-qr" label="Scan QR code">
      <header className="modal-head">
        <div>
          <div className="eyebrow">HANDOFF</div>
          <h2>{qr.title}</h2>
          <p>{qr.subtitle}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
      </header>
      <div className="qr-frame">
        <img src={qr.dataUrl} alt="Store QR code" width={260} height={260} />
        <span className="qr-corner tl" />
        <span className="qr-corner tr" />
        <span className="qr-corner bl" />
        <span className="qr-corner br" />
      </div>
      <p className="qr-copy">
        Point the phone camera at the code to open the listing. Use this when the App Store deep
        link isn’t available.
      </p>
      <div className="qr-url mono">{qr.url}</div>
      <footer className="modal-foot">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void navigator.clipboard.writeText(qr.url).then(
              () => actions.toast('success', 'Link copied'),
              () => actions.toast('error', 'Clipboard unavailable'),
            );
          }}
        >
          <Icon name="copy" size={14} />
          Copy link
        </button>
        <div className="row gap-8">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void actions.openExternal(qr.url)}
          >
            <Icon name="external" size={14} />
            Open on desktop
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </footer>
    </Overlay>
  );
}

export function StoreBadge({ platform, name }: { platform: 'android' | 'ios'; name?: string }): ReactElement {
  return (
    <span className="store-badge">
      <StoreGlyph platform={platform} size={18} />
      {name ?? storeName(platform)}
    </span>
  );
}
