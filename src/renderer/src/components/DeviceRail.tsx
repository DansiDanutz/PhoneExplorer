import type { ReactElement } from 'react';
import type { AppState, DeviceInfo } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { truncate } from '../lib/format';
import { Icon } from '../lib/icons';

interface DeviceRailProps {
  state: AppState;
  actions: PhoneActions;
  onOpenConnect: () => void;
  onOpenSettings: () => void;
  onOpenModels: (platform: 'android' | 'ios') => void;
}

function DeviceCard({
  device,
  active,
  onSelect,
}: {
  device: DeviceInfo;
  active: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`device-card ${active ? 'is-active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="device-card-icon" data-platform={device.platform}>
        <Icon name={device.platform === 'ios' ? 'apple' : 'android'} size={19} />
      </span>
      <span className="device-card-copy">
        <span className="device-card-name">{device.name}</span>
        <span className="device-card-meta">
          {device.platform === 'ios' ? 'iOS' : 'Android'} {device.osVersion}{' '}
          <span className="dot-sep" /> {device.connection === 'virtual' ? 'Demo' : device.connection.toUpperCase()}
        </span>
        {device.status !== 'online' && device.hint ? (
          <span className="device-card-hint">{device.hint}</span>
        ) : null}
      </span>
      <span className={`status-dot ${device.status === 'online' ? 'ok' : device.status === 'unauthorized' ? 'warn' : 'idle'}`} />
    </button>
  );
}

export function DeviceRail({
  state,
  actions,
  onOpenConnect,
  onOpenSettings,
  onOpenModels,
}: DeviceRailProps): ReactElement {
  const real = state.devices.filter((device) => !device.isDemo);
  const active = state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
  const toolsReady = state.tools.filter((tool) => tool.found).length;
  const allReady = toolsReady === state.tools.length;
  const demoInfo = (platform: 'android' | 'ios'): DeviceInfo | null =>
    state.devices.find((device) => device.id === `demo-${platform}`) ?? null;
  const demoModel = (platform: 'android' | 'ios') => {
    const info = demoInfo(platform);
    return (
      state.models.find((model) => model.id === info?.modelId) ??
      state.models.find((model) => model.id === state.defaultModels[platform]) ??
      null
    );
  };
  const activeDemoPlatform = active?.isDemo ? active.platform : state.settings.demoPlatform;

  return (
    <aside className="rail">
      <div className="rail-scroll">
        <div className="rail-section">
          <div className="rail-heading">
            <span>Devices</span>
            <span className="count">{real.filter((device) => device.status === 'online').length}</span>
            <button
              type="button"
              className="icon-btn icon-btn-sm rail-heading-action"
              onClick={onOpenConnect}
              title="Connect a device"
              aria-label="Connect a device"
            >
              <Icon name="plus" size={15} />
            </button>
          </div>

          <div className="device-list">
            {real.length === 0 ? (
              <button type="button" className="no-device" onClick={onOpenConnect}>
                <span className="no-device-icon">
                  <Icon name="usb" size={20} />
                </span>
                <span className="no-device-title">No phone connected</span>
                <span className="no-device-copy">
                  Plug in an Android phone or iPhone, or connect over Wi-Fi.
                </span>
                <span className="no-device-action">
                  Connect a device <Icon name="arrow-right" size={13} />
                </span>
              </button>
            ) : (
              real.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  active={device.id === state.activeDeviceId}
                  onSelect={() => void actions.selectDevice(device.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="rail-section">
          <div className="rail-heading">
            <span>Demo lab</span>
            <button
              type="button"
              className="rail-heading-link"
              onClick={() => onOpenModels(activeDemoPlatform)}
            >
              Models <Icon name="sliders" size={12} />
            </button>
          </div>
          <div className="demo-list">
            {(['android', 'ios'] as const).map((platform) => {
              const model = demoModel(platform);
              if (!model) return null;
              const isActive = state.activeDeviceId === `demo-${platform}`;
              const isDefault = state.defaultModels[platform] === model.id;
              return (
                <div className={`demo-card ${isActive ? 'is-active' : ''}`} key={platform}>
                  <button
                    type="button"
                    className="demo-card-pick"
                    onClick={() => void actions.useDemo(platform)}
                    aria-pressed={isActive}
                  >
                    <span className="demo-platform" data-platform={platform}>
                      <Icon name={platform === 'ios' ? 'apple' : 'android'} size={16} />
                    </span>
                    <span className="demo-card-copy">
                      <span className="demo-card-name">{truncate(model.name, 22)}</span>
                      <span className="demo-card-meta">
                        {platform === 'ios' ? 'iOS' : 'Android'} {model.osVersion}
                        <span className="dot-sep" />
                        {model.displayInches}&quot;
                        {isDefault || !model.builtin ? (
                          <>
                            <span className="dot-sep" />
                            <span className={isDefault ? 'demo-default' : 'demo-custom'}>
                              {isDefault ? 'DEFAULT' : 'CUSTOM'}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className={`status-dot ${isActive ? 'ok' : 'idle'}`} />
                  </button>
                  <button
                    type="button"
                    className="demo-card-edit"
                    onClick={() => onOpenModels(platform)}
                    title={`Change ${platform === 'ios' ? 'iPhone' : 'Android'} model`}
                    aria-label={`Change ${platform === 'ios' ? 'iPhone' : 'Android'} model`}
                  >
                    <Icon name="sliders" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="demo-browse"
            onClick={() => onOpenModels(activeDemoPlatform)}
          >
            <Icon name="search" size={13} />
            Search phone models
            <span className="mono">
              {state.models.filter((model) => model.platform === activeDemoPlatform).length}
            </span>
          </button>
          <p className="rail-hint">
            Simulated hardware profiles. Store installs still run end-to-end locally.
          </p>
        </div>

        {active ? (
          <div className="rail-section">
            <div className="rail-heading">
              <span>Connection</span>
              <span className={`status-dot ${active.status === 'online' ? 'ok' : 'warn'}`} />
            </div>
            <div className="detail-card">
              <div className="detail-row">
                <span className="detail-label">Serial</span>
                <span className="detail-value mono" title={active.serial}>
                  {active.serial.length > 18 ? `${active.serial.slice(0, 8)}…${active.serial.slice(-6)}` : active.serial}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Transport</span>
                <span className="detail-value capitalize">
                  {active.connection === 'virtual' ? 'Simulated' : active.connection.toUpperCase()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Display</span>
                <span className="detail-value mono">
                  {active.resolution ? `${active.resolution.width}×${active.resolution.height}` : '—'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Battery</span>
                <span className="detail-value">
                  {active.battery !== null ? (
                    <span className="battery">
                      <span className="battery-track">
                        <span className="battery-fill" style={{ width: `${active.battery}%` }} />
                      </span>
                      {active.battery}%
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Input</span>
                <span className={`detail-value ${active.controlEngine === 'scrcpy' ? 'ok-text' : ''}`}>
                  {active.isDemo
                    ? 'Demo'
                    : active.controlEngine === 'scrcpy'
                      ? 'Scrcpy · multi-touch'
                      : active.controlEngine === 'idb'
                        ? 'idb · touch'
                        : active.capabilities.input
                          ? 'adb · touch'
                          : 'View only'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Mirror</span>
                <span className={`detail-value ${active.capabilities.mirror ? 'ok-text' : 'warn-text'}`}>
                  {active.capabilities.mirror ? 'Ready' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rail-footer">
        <button type="button" className="tools-row" onClick={onOpenSettings}>
          <span className={`status-dot ${allReady ? 'ok' : 'warn'}`} />
          <span className="tools-label">
            {allReady ? 'Toolchain ready' : `${state.tools.length - toolsReady} tool${state.tools.length - toolsReady === 1 ? '' : 's'} missing`}
          </span>
          <span className="tools-count">{toolsReady}/{state.tools.length}</span>
          <Icon name="chevron-right" size={13} />
        </button>
        <div className="rail-footer-meta">
          <span>PhoneExplorer</span>
          <span className="mono">v{state.version}</span>
        </div>
      </div>
    </aside>
  );
}
