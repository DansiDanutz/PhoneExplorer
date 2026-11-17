import type { ReactElement } from 'react';
import type { AppState } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { Icon } from '../lib/icons';

interface TitleBarProps {
  state: AppState;
  actions: PhoneActions;
  onOpenSettings: () => void;
  onOpenConnect: () => void;
}

export function TitleBar({
  state,
  actions,
  onOpenSettings,
  onOpenConnect,
}: TitleBarProps): ReactElement {
  const real = state.devices.filter((device) => !device.isDemo);
  const online = real.filter((device) => device.status === 'online').length;
  const active = state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
  const toolsReady = state.tools.filter((tool) => tool.found).length;
  const isMac = state.platform === 'darwin';
  return (
    <header className={`titlebar ${isMac ? 'is-mac' : ''}`}>
      <div className="titlebar-left">
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-mark-inner">
            <Icon name="smartphone" size={13} />
          </span>
        </span>
        <span className="brand-name">PhoneExplorer</span>
        <span className="brand-stage">STAGE 01</span>
      </div>

      <div className="titlebar-center">
        <button type="button" className="status-pill" onClick={onOpenConnect}>
          <span className={`status-dot ${active ? 'ok' : 'idle'}`} />
          {active?.isDemo
            ? `Demo · ${active.name}`
            : online > 0
              ? `${online} device${online === 1 ? '' : 's'} connected`
              : 'No phone connected'}
          <Icon name="chevron-down" size={12} />
        </button>
      </div>

      <div className="titlebar-right">
        <button
          type="button"
          className={`tool-chip ${toolsReady === state.tools.length ? 'ok' : 'warn'}`}
          onClick={onOpenSettings}
          title={state.tools.map((tool) => `${tool.label}: ${tool.found ? tool.path : 'missing'}`).join('\n')}
        >
          <span className={`status-dot ${toolsReady === state.tools.length ? 'ok' : 'warn'}`} />
          {toolsReady}/{state.tools.length} tools
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => void actions.refresh()}
          title="Refresh devices (⌘R)"
          aria-label="Refresh devices"
        >
          <Icon name="refresh" size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          data-artefact-id="settings"
          data-artefact-label="Settings"
          data-artefact-kind="overlay"
          data-artefact-description="Capture rate, quality, adb path, defaults and input preferences."
        >
          <Icon name="settings" size={16} />
        </button>
      </div>
    </header>
  );
}
